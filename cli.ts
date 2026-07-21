// cli.ts
import { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { spawn } from 'child_process';
import { createRequire } from 'module';
import { z } from 'zod';
const require = createRequire(import.meta.url);
const ffmpegBin: string = require('@ffmpeg-installer/ffmpeg').path;

const program = new Command();

program
  .name('content-auto')
  .description('Render vertical videos from AI mapping JSON using FFmpeg')
  .version('0.1.0');

// ─── Zod Schemas ─────────────────────────────────────

const ClipSchema = z.object({
  id: z.number().int().positive(),
  text: z.string().optional(),
  ss: z.number().min(0),
  t: z.number().positive(),
});

const MappingSchema = z.object({
  settings: z.object({
    fps: z.number().int().positive(),
    format: z.enum(["9:16", "16:9"]),
    fg_aspect: z.enum(["4:5", "4:3", "1:1", "fit"]).optional().default("4:5"),
    captions: z.boolean().optional().default(true),
    watermark: z.string().optional(),
    watermark_pos: z.enum(["top_left", "top_right", "random"]).optional().default("random"),
    bgm: z.string().optional(),
  }),
  timeline: z.array(ClipSchema).min(1),
});

type Clip = z.infer<typeof ClipSchema>;
type Mapping = z.infer<typeof MappingSchema>;

// ─── Helpers ──────────────────────────────────────────

function getCaptionFontPath(): string {
  const candidates = [
    '/usr/share/fonts/truetype/inter-zorin-os/Inter-ExtraBold.ttf',
    '/usr/share/fonts/truetype/inter-zorin-os/Inter-Bold.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
  ];
  for (const font of candidates) {
    if (fs.existsSync(font)) return font;
  }
  return 'Sans';
}

function cleanPunctuation(text: string): string {
  return text
    .replace(/[.,?!:;""''`~–—\-\(\)\[\]\{\}\/\\«»]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

interface CaptionChunk {
  text: string;
  start: number;
  end: number;
}

function generateCaptionChunks(rawText: string, totalDur: number, maxWordsPerChunk: number = 3): CaptionChunk[] {
  const text = cleanPunctuation(rawText);
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += maxWordsPerChunk) {
    chunks.push(words.slice(i, i + maxWordsPerChunk).join(' '));
  }

  const totalWords = words.length;
  let currentStart = 0;
  const result: CaptionChunk[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunkWords = chunks[i].split(/\s+/).length;
    const chunkDur = (chunkWords / totalWords) * totalDur;
    const end = (i === chunks.length - 1) ? totalDur : Math.min(totalDur, currentStart + chunkDur);

    result.push({
      text: chunks[i],
      start: Number(currentStart.toFixed(3)),
      end: Number(end.toFixed(3)),
    });
    currentStart = end;
  }
  return result;
}

function wrapText(text: string, maxLen: number = 34): string {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length <= maxLen) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.join('\n');
}

function runFFmpeg(args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegBin, args, { cwd });
    let err = '';
    child.stderr.on('data', (d: Buffer) => { err += d.toString(); });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exit ${code}: ${err.slice(-300)}`));
    });
    child.on('error', reject);
  });
}

/**
 * Run FFmpeg with -progress pipe:1 for structured progress.
 * Parses `out_time_us` from stdout and calls cb(pct, msg).
 */
function runFFmpegProgress(
  args: string[],
  cwd: string,
  totalDurSec: number,
  cb: (pct: number, msg: string) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegBin, args, { cwd });
    let stderr = '';

    child.stdout.on('data', (d: Buffer) => {
      const text = d.toString();
      const match = text.match(/^out_time_us=(\d+)$/m);
      if (match) {
        const us = parseInt(match[1], 10);
        const sec = us / 1_000_000;
        const pct = Math.min(99, Math.round((sec / totalDurSec) * 100));
        cb(pct, `${sec.toFixed(1)}s / ${totalDurSec.toFixed(1)}s`);
      }
    });

    child.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

    child.on('close', (code) => {
      if (code === 0) { cb(100, 'Done'); resolve(); }
      else reject(new Error(`FFmpeg exit ${code}: ${stderr.slice(-500)}`));
    });

    child.on('error', reject);
  });
}

// ─── Render command ──────────────────────────────────

program
  .command('render')
  .description('Render a video from AI mapping JSON')
  .argument('<mapping>', 'Path to AI mapping JSON file')
  .requiredOption('--video <path>', 'Path to source video file')
  .option('-a, --audio <path>', 'Path to voice-over audio file')
  .option('-b, --bgm <path>', 'Path to background music file')
  .option('-o, --output <path>', 'Output MP4 file path', 'output/video.mp4')
  .action(async (mappingPath: string, opts: { video: string; audio?: string; bgm?: string; output: string }) => {
    const resolvedMap = path.resolve(mappingPath);
    const resolvedVideo = path.resolve(opts.video);
    const resolvedAudio = opts.audio ? path.resolve(opts.audio) : null;
    const resolvedOutput = path.resolve(opts.output);

    // Validate input existence
    if (!fs.existsSync(resolvedMap)) { console.error(`❌ Mapping not found: ${resolvedMap}`); process.exit(1); }
    if (!fs.existsSync(resolvedVideo)) { console.error(`❌ Video not found: ${resolvedVideo}`); process.exit(1); }
    let resolvedAudioFinal = resolvedAudio;
    if (resolvedAudio && !fs.existsSync(resolvedAudio)) {
      console.warn(`⚠️  Audio not found — rendering without`);
      resolvedAudioFinal = null;
    }

    const outDir = path.dirname(resolvedOutput);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    // 1. Load & validate mapping
    console.log('📄 Loading mapping JSON...');
    let mapping: Mapping;
    try {
      const raw = JSON.parse(fs.readFileSync(resolvedMap, 'utf-8'));
      mapping = MappingSchema.parse(raw);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        console.error('❌ Schema validation failed:');
        for (const issue of err.issues) {
          console.error(`   - ${issue.path.join('.')}: ${issue.message}`);
        }
        process.exit(1);
      }
      console.error(`❌ ${err.message}`);
      process.exit(1);
    }

    const clips = mapping.timeline;
    const totalDur = clips.reduce((s: number, c: Clip) => s + c.t, 0);
    const { width, height } = mapping.settings.format === '16:9'
      ? { width: 1920, height: 1080 }
      : { width: 1080, height: 1920 };

    console.log(`✅ ${clips.length} clips, ${totalDur.toFixed(1)}s total, ${width}x${height}`);

    // 2. Parallel extraction
    const tmpDir = path.join(os.tmpdir(), `ca-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    try {
      const CONCURRENCY = Math.min(os.cpus().length - 1, 6); // max 6 parallel ffmpeg
      const clipFiles: string[] = new Array(clips.length);

      const fgAspect = mapping.settings.fg_aspect || "4:5";
      let fgScaleFilter = `scale=${width}:${height}:force_original_aspect_ratio=decrease`;

      if (fgAspect === "4:5") {
        const fgW = width;                   // 1080px (full viewport width)
        const fgH = Math.round(fgW * 1.25);   // 1350px (4:5 Instagram ratio)
        fgScaleFilter = `scale=w=${fgW}:h=${fgH}:force_original_aspect_ratio=increase,crop=${fgW}:${fgH}`;
      } else if (fgAspect === "4:3") {
        const fgW = width;                   // 1080px (full viewport width)
        const fgH = Math.round(fgW * 0.75);   // 810px (4:3 ratio)
        fgScaleFilter = `scale=w=${fgW}:h=${fgH}:force_original_aspect_ratio=increase,crop=${fgW}:${fgH}`;
      } else if (fgAspect === "1:1") {
        const fgW = width;                   // 1080px (full viewport width)
        fgScaleFilter = `scale=w=${fgW}:h=${fgW}:force_original_aspect_ratio=increase,crop=${fgW}:${fgW}`;
      }

      let chosenWmPos = mapping.settings.watermark_pos || "random";
      if (chosenWmPos === "random") {
        chosenWmPos = Math.random() < 0.5 ? "top_left" : "top_right";
      }
      const watermarkCoords = chosenWmPos === "top_right" ? "x=main_w-overlay_w-28:y=28" : "x=28:y=28";
      console.log(`🎲 Watermark position for this render: ${chosenWmPos}`);

      for (let batch = 0; batch < clips.length; batch += CONCURRENCY) {
        const batchEnd = Math.min(batch + CONCURRENCY, clips.length);
        const batchClips = clips.slice(batch, batchEnd);

        const tasks = batchClips.map((clip, bi) => {
          const i = batch + bi;
          const outFile = path.join(tmpDir, `c${String(i).padStart(4, '0')}.ts`);
          clipFiles[i] = outFile;

          const candidates = [
            mapping.settings.watermark,
            'assets/logo-transparent.png',
            'input/assets/logo-transparent.png',
            'input/assets/watermark_placeholder.png'
          ];
          let watermarkFile: string | null = null;
          for (const cand of candidates) {
            if (cand && fs.existsSync(cand)) {
              watermarkFile = cand;
              break;
            }
          }

          const filterNodes = [
            'split=2[bg_in][fg_in]',
            `[bg_in]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},boxblur=25:2,eq=brightness=-0.15[bg]`,
          ];

          if (watermarkFile) {
            filterNodes.push(`[fg_in]${fgScaleFilter}[fg_raw]`);
            if (watermarkFile.includes('logo-transparent.png')) {
              // Crop 600x600 transparent padding bounding box (crop=456:99:77:252) and scale to 340px width
              filterNodes.push(`[1:v]crop=456:99:77:252,scale=340:-1[wm_scaled]`);
            } else {
              filterNodes.push(`[1:v]scale=340:-1[wm_scaled]`);
            }
            filterNodes.push(`[fg_raw][wm_scaled]overlay=${watermarkCoords}[fg]`);
          } else {
            filterNodes.push(`[fg_in]${fgScaleFilter}[fg]`);
          }

          filterNodes.push(
            '[fg]split=2[fg_main][fg_shadow_src]',
            '[fg_shadow_src]drawbox=color=black@0.8:t=fill,pad=w=iw:h=ih+40:x=0:y=20:color=black@0,boxblur=20:2[shadow]',
            '[bg][shadow]overlay=x=0:y=\'(main_h-overlay_h)/2+6\'[bg_sh]'
          );

          const showCaptions = mapping.settings.captions !== false && clip.text && clip.text.trim().length > 0;
          if (showCaptions) {
            const fontPath = getCaptionFontPath();
            const chunks = generateCaptionChunks(clip.text!, clip.t, 3);

            let lastLabel = 'v_base';
            filterNodes.push('[bg_sh][fg_main]overlay=x=0:y=\'(main_h-overlay_h)/2\'[v_base]');

            chunks.forEach((chunk, idx) => {
              const nextLabel = idx === chunks.length - 1 ? 'outv' : `v_c${idx + 1}`;
              const escaped = chunk.text.replace(/\\/g, '\\\\').replace(/'/g, "'\\\\''").replace(/:/g, '\\\\:');
              filterNodes.push(`[${lastLabel}]drawtext=fontfile='${fontPath}':text='${escaped}':fontsize=40:fontcolor=white:borderw=4:bordercolor=black:x=(w-text_w)/2:y=1440:enable='between(t,${chunk.start},${chunk.end})'[${nextLabel}]`);
              lastLabel = nextLabel;
            });
          } else {
            filterNodes.push('[bg_sh][fg_main]overlay=x=0:y=\'(main_h-overlay_h)/2\'[outv]');
          }

          const filterComplex = filterNodes.join(';');

          const ffmpegArgs = [
            '-y',
            '-ss', String(clip.ss),
            '-i', resolvedVideo,
          ];

          if (watermarkFile) {
            ffmpegArgs.push('-i', watermarkFile);
          }

          ffmpegArgs.push(
            '-t', String(clip.t),
            '-filter_complex', filterComplex,
            '-map', '[outv]',
            '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '18',
            '-an', '-pix_fmt', 'yuv420p',
            outFile
          );

          const task = runFFmpeg(ffmpegArgs, process.cwd());
          return task;
        });

        // Wait for batch, report progress
        await Promise.all(tasks);
        const done = batch + batchClips.length;
        const extractPct = Math.round((done / clips.length) * 60);
        process.stdout.write(`\r   ✂️  Extracting: ${done}/${clips.length} clips (${extractPct}%)   `);
      }
      console.log('');

      // 3. Concat + mux audio with BGM mixing
      console.log('🔗 Concatenating + mixing audio & BGM...');
      const listFile = path.join(tmpDir, 'list.txt');
      fs.writeFileSync(listFile, clipFiles.map((f) => `file '${f}'`).join('\n'), 'utf-8');

      // Auto-detect or AI-decide BGM if not provided explicitly
      let bgmFile: string | null = opts.bgm ? path.resolve(opts.bgm) : null;
      if (!bgmFile || !fs.existsSync(bgmFile)) {
        const bgmCandidates: string[] = [];
        const searchDirs = [path.join(process.cwd(), 'assets'), path.join(process.cwd(), 'input', 'assets')];
        for (const dir of searchDirs) {
          if (fs.existsSync(dir)) {
            const files = fs.readdirSync(dir);
            for (const f of files) {
              const full = path.join(dir, f);
              if (/\.(mp3|wav|m4a|ogg)$/i.test(f) && full !== resolvedAudioFinal) {
                if (dir.endsWith('/assets') || f.toLowerCase().includes('bgm') || f.toLowerCase().includes('music') || f.toLowerCase().includes('background')) {
                  bgmCandidates.push(full);
                }
              }
            }
          }
        }
        if (bgmCandidates.length > 0) {
          const requestedBgm = mapping.settings.bgm?.toLowerCase();
          if (requestedBgm && requestedBgm !== 'random') {
            const matched = bgmCandidates.find((f) => {
              const lowerName = path.basename(f).toLowerCase();
              if (requestedBgm.includes('monkey') && lowerName.includes('monkey')) return true;
              if (requestedBgm.includes('sneaky') && lowerName.includes('sneaky')) return true;
              if (requestedBgm.includes('snitch') && lowerName.includes('snitch')) return true;
              if (requestedBgm.includes('duck') && lowerName.includes('duck')) return true;
              if (requestedBgm.includes('fluffing') && lowerName.includes('fluffing')) return true;
              if (requestedBgm.includes('elevator') && lowerName.includes('elevator')) return true;
              if (requestedBgm.includes('forecast') && lowerName.includes('forecast')) return true;
              return lowerName.includes(requestedBgm);
            });
            if (matched) {
              bgmFile = matched;
              console.log(`🤖 AI Decided BGM: ${path.basename(matched)} (Key: "${mapping.settings.bgm}")`);
            }
          }

          if (!bgmFile) {
            bgmFile = bgmCandidates[Math.floor(Math.random() * bgmCandidates.length)];
            console.log(`🎲 Randomized BGM: ${path.basename(bgmFile)}`);
          }
        }
      }

      const fargs: string[] = [
        '-y',
        '-f', 'concat', '-safe', '0', '-i', listFile,
      ];

      if (resolvedAudioFinal && bgmFile && fs.existsSync(bgmFile)) {
        console.log(`🎵 Mixing Voiceover + BGM: ${path.basename(bgmFile)} (Volume: 12%)`);
        fargs.push('-i', resolvedAudioFinal);
        fargs.push('-i', bgmFile);
        fargs.push(
          '-filter_complex',
          '[1:a]volume=1.0[vo];[2:a]volume=0.12,aloop=loop=-1:size=2e+09[bgm];[vo][bgm]amix=inputs=2:duration=first:dropout_transition=2[aout]',
          '-map', '0:v:0',
          '-map', '[aout]',
          '-shortest'
        );
      } else if (resolvedAudioFinal) {
        fargs.push('-i', resolvedAudioFinal);
        fargs.push('-map', '0:v:0', '-map', '1:a:0', '-shortest');
      } else if (bgmFile && fs.existsSync(bgmFile)) {
        console.log(`🎵 Using BGM: ${path.basename(bgmFile)} (Volume: 20%)`);
        fargs.push('-i', bgmFile);
        fargs.push(
          '-filter_complex',
          '[1:a]volume=0.20,aloop=loop=-1:size=2e+09[bgm]',
          '-map', '0:v:0',
          '-map', '[bgm]',
          '-shortest'
        );
      } else {
        fargs.push('-map', '0:v:0');
      }

      fargs.push(
        '-c:v', 'copy',                    // no re-encode — clips already H.264
        '-c:a', 'aac', '-b:a', '128k',
        '-movflags', '+faststart',
        '-progress', 'pipe:1', '-nostats',
        resolvedOutput,
      );

      const t0 = Date.now();
      await runFFmpegProgress(fargs, process.cwd(), totalDur, (pct, msg) => {
        const displayPct = 60 + Math.round(pct * 0.4); // concat is 60%–100% of overall
        process.stdout.write(`\r   🎥 ${displayPct}% (${msg})   `);
      });
      console.log('');

      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`✅ Done: ${resolvedOutput} (${elapsed}s)`);
    } catch (err: any) {
      console.error(`❌ ${err.message}`);
      process.exit(1);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

program
  .command('aistudio')
  .description('Launch Google AI Studio persistent browser session')
  .option('-h, --headless', 'Run browser in headless mode', false)
  .action(async (options) => {
    const { launchAIStudioSession } = await import('./playwright/aistudio');
    await launchAIStudioSession({ headless: options.headless });
  });

program
  .command('aistudio:init')
  .description('Initialize Google AI Studio profile & Google Account login (Landscape 1920x1080)')
  .action(async () => {
    const { initializeUserSession } = await import('./playwright/initialize');
    await initializeUserSession();
  });

program.parse();
