// render-alurfilm.ts
import { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { z } from 'zod';
import { runFFmpeg, runFFmpegProgress } from './cli/shared/ffmpeg-helpers.js';

const program = new Command();

program
  .name('render-alurfilm')
  .description('Dedicated 16:9 Alur Cerita Film FFmpeg Video Renderer')
  .version('1.0.0');

// ─── Zod Schema for Alurfilm Mapping ─────────────────────

const positiveDurationSchema = z.preprocess(
  (val) => (typeof val === 'number' && val <= 0 ? 0.1 : val),
  z.number().positive()
);

const VisualClipSchema = z.object({
  type: z.enum(['slow_motion', 'mirror_cut', 'freeze_frame_with_zoom', 'video_cut', 'pan_and_zoom_cut']).optional().default('video_cut'),
  duration: positiveDurationSchema,
  source_start_seconds: z.number().min(0).optional(),
  source_timestamp_seconds: z.number().min(0).optional(),
  slow_mo_factor: z.number().optional(),
  mirror_mode: z.enum(['horizontal', 'vertical']).optional(),
  zoom_speed: z.number().optional(),
  pan_direction: z.enum(['left', 'right', 'up', 'down', 'center']).optional(),
  color_grading_shift: z.object({
    contrast: z.number().optional(),
    brightness: z.number().optional(),
    saturation: z.number().optional(),
  }).optional(),
});

const SentenceMappingSchema = z.object({
  sentence_index: z.number().int().min(0),
  text: z.string().optional(),
  type: z.string().optional(),
  start: z.number().min(0).optional(),
  end: z.number().min(0).optional(),
  duration: positiveDurationSchema.optional(),
  visuals: z.array(VisualClipSchema).optional(),
});

const BgmTimelineSchema = z.object({
  start: z.number().min(0),
  end: z.number().min(0),
  category: z.string().optional(),
  file: z.string()
});

const AlurfilmMappingSchema = z.object({
  scene_id: z.string().optional(),
  bgm_timeline: z.array(BgmTimelineSchema).optional(),
  mappings: z.array(SentenceMappingSchema).min(1),
  status: z.string().optional(),
});

type AlurfilmMapping = z.infer<typeof AlurfilmMappingSchema>;

function findBgmFile(fileName?: string): string | null {
  const cwd = process.cwd();
  if (fileName) {
    const directPath = path.isAbsolute(fileName) ? fileName : path.resolve(cwd, fileName);
    if (fs.existsSync(directPath) && fs.statSync(directPath).isFile()) {
      return directPath;
    }
  }

  const bgmBaseDir = path.join(cwd, 'assets', 'bgm');
  if (!fs.existsSync(bgmBaseDir)) return null;

  if (fileName) {
    const baseName = path.basename(fileName).toLowerCase();
    const scanBgm = (dir: string): string | null => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          const subMatch = scanBgm(full);
          if (subMatch) return subMatch;
        } else if (entry.isFile() && entry.name.match(/\.(mp3|wav|m4a|aac|flac)$/i)) {
          if (entry.name.toLowerCase() === baseName || entry.name.toLowerCase().includes(baseName.replace(/\.[^/.]+$/, ''))) {
            return full;
          }
        }
      }
      return null;
    };
    const matched = scanBgm(bgmBaseDir);
    if (matched) return matched;
  }

  // Fallback: return first available mp3 file in assets/bgm
  const firstAny = (dir: string): string | null => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const sub = firstAny(full);
        if (sub) return sub;
      } else if (entry.isFile() && entry.name.match(/\.(mp3|wav|m4a|aac|flac)$/i)) {
        return full;
      }
    }
    return null;
  };

  return firstAny(bgmBaseDir);
}


program
  .command('render')
  .description('Render a 16:9 Alur Cerita Film video from mapping JSON')
  .argument('<mapping>', 'Path to Alurfilm mapping JSON file')
  .requiredOption('--video <path>', 'Path to source video chunk')
  .option('-a, --audio <path>', 'Path to voice-over audio file')
  .option('-b, --bgm <path>', 'Path to background music file')
  .option('--no-bgm', 'Disable adding background music (for partial/preview renders)')
  .option('--bgm-offset <seconds>', 'BGM start seek offset in seconds for cross-part continuity (e.g. 120.0)', '0')
  .option('--bgm-volume <volume>', 'BGM volume factor (e.g. 0.28)')
  .option('--narration-volume <volume>', 'Voiceover/Narration volume factor (e.g. 1.8)')
  .option('-l, --logo <path>', 'Path to logo image watermark')
  .option('--logo-opacity <opacity>', 'Logo opacity factor (0.1 to 1.0)')
  .option('--logo-margin <pixels>', 'Logo margin from top-left corner in px')
  .option('--logo-scale <height>', 'Logo height in pixels for watermark')
  .option('--config <path>', 'Path to render settings JSON file', 'input/render_settings.json')
  .option('-o, --output <path>', 'Output MP4 file path', 'output/alurfilm_render.mp4')
  .action(async (mappingPath: string, opts: {
    video: string;
    audio?: string;
    bgm?: string;
    noBgm?: boolean;
    bgmOffset?: string;
    bgmVolume?: string;
    narrationVolume?: string;
    logo?: string;
    logoOpacity?: string;
    logoMargin?: string;
    logoScale?: string;
    config?: string;
    output: string;
  }) => {
    const resolvedMap = path.resolve(mappingPath);
    const resolvedVideo = path.resolve(opts.video);
    const resolvedAudio = opts.audio ? path.resolve(opts.audio) : null;
    const resolvedOutput = path.resolve(opts.output);

    // Load render_settings.json if present
    let jsonSettings: any = {};
    const configPath = opts.config ? path.resolve(opts.config) : path.join(process.cwd(), 'input', 'render_settings.json');
    if (fs.existsSync(configPath)) {
      try {
        jsonSettings = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        console.log(`⚙️ [Alurfilm Engine] Loaded render settings from ${path.basename(configPath)}`);
      } catch (err: any) {
        console.warn(`⚠️ Failed to parse ${configPath}: ${err.message}`);
      }
    }

    if (!fs.existsSync(resolvedMap)) { console.error(`❌ Mapping file not found: ${resolvedMap}`); process.exit(1); }
    if (!fs.existsSync(resolvedVideo)) { console.error(`❌ Source video chunk not found: ${resolvedVideo}`); process.exit(1); }

    let resolvedAudioFinal = resolvedAudio;
    if (resolvedAudio && !fs.existsSync(resolvedAudio)) {
      console.warn(`⚠️ Voiceover audio file not found — rendering video only`);
      resolvedAudioFinal = null;
    }

    const outDir = path.dirname(resolvedOutput);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    // Use explicit logo file if provided, or fallback to jsonSettings.logoPath, or default assets/logo.png
    let logoFile: string | null = opts.logo ? path.resolve(opts.logo) : (jsonSettings.logoPath ? path.resolve(jsonSettings.logoPath) : null);
    if (!logoFile) {
      const alurfilmDefaultLogo = path.join(process.cwd(), 'assets', 'logo.png');
      if (fs.existsSync(alurfilmDefaultLogo)) logoFile = alurfilmDefaultLogo;
    } else if (logoFile && !fs.existsSync(logoFile)) {
      console.warn(`⚠️ Specified logo watermark file not found: ${logoFile}`);
      logoFile = null;
    }

    if (jsonSettings.logoEnabled === false && !opts.logo) {
      logoFile = null;
    }

    console.log('🎬 [Alurfilm Engine] Loading 16:9 mapping JSON...');
    let mapping: AlurfilmMapping;
    try {
      const raw = JSON.parse(fs.readFileSync(resolvedMap, 'utf-8'));
      if (raw && Array.isArray(raw.mappings)) {
        raw.mappings = raw.mappings.map((m: any) => {
          if (!m || typeof m !== 'object') return m;
          const s = typeof m.start === 'number' ? m.start : 0;
          const e = typeof m.end === 'number' ? m.end : s;
          if (typeof m.duration !== 'number' || m.duration <= 0) {
            m.duration = e > s ? Number((e - s).toFixed(2)) : 0.1;
          }

          const isVisOnly = m.type === 'visual_only' || String(m.text || '').includes('VISUAL_ONLY');
          if (Array.isArray(m.visuals)) {
            if (isVisOnly) {
              m.duration = Number(m.visuals.reduce((acc: number, c: any) => acc + (c.duration || 0), 0).toFixed(2));
            }
          }
          return m;
        });
      }
      mapping = AlurfilmMappingSchema.parse(raw);
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

    // Use explicit BGM file if provided, or fallback to jsonSettings.bgmPath, or resolve from mapping.bgm_timeline or default baseline
    let bgmCandidate = opts.bgm || jsonSettings.bgmPath;
    let bgmFile: string | null = findBgmFile(bgmCandidate);
    if (bgmFile) {
      console.log(`🎵 [Alurfilm Engine] Selected BGM: ${path.basename(bgmFile)}`);
    } else if (mapping.bgm_timeline && mapping.bgm_timeline.length > 0) {
      for (const item of mapping.bgm_timeline) {
        const found = findBgmFile(item.file);
        if (found) {
          bgmFile = found;
          console.log(`🎵 [Alurfilm Engine] Auto-selected BGM from mapping timeline: ${path.basename(found)}`);
          break;
        }
      }
    }
    if (!bgmFile) {
      bgmFile = findBgmFile();
      if (bgmFile) {
        console.log(`🎵 [Alurfilm Engine] Auto-selected Default Baseline BGM: ${path.basename(bgmFile)}`);
      }
    }

    if ((opts.noBgm || jsonSettings.bgmEnabled === false) && !opts.bgm) {
      bgmFile = null;
    }

    const narrationVolume = parseFloat(opts.narrationVolume || String(jsonSettings.narrationVolume ?? '1.8')) || 1.8;
    const bgmVolume = parseFloat(opts.bgmVolume || String(jsonSettings.bgmVolume ?? '0.28')) || 0.28;
    const logoOpacity = parseFloat(opts.logoOpacity || String(jsonSettings.logoOpacity ?? '0.6')) || 0.6;
    const logoMargin = parseInt(opts.logoMargin || String(jsonSettings.logoMargin ?? '40'), 10) || 40;
    const logoScale = parseInt(opts.logoScale || String(jsonSettings.logoScale ?? '60'), 10) || 60;


    // Flatten sentence mappings into individual clip items
    interface FlattenedClip {
      id: number;
      sentenceIndex: number;
      text: string;
      sourceStart: number;
      duration: number;
      type: string;
      slowMoFactor?: number;
      mirrorMode?: string;
      colorShift?: { contrast?: number; brightness?: number; saturation?: number };
      isVisualOnly: boolean;
    }

    const clips: FlattenedClip[] = [];
    let clipIdCounter = 1;

    for (const sentence of mapping.mappings) {
      const isVisualOnly = Boolean(
        (sentence.type && sentence.type.toLowerCase().includes('visual_only')) ||
        (sentence.text && /\[visual_only/i.test(sentence.text))
      );

      const targetVoDur = isVisualOnly
        ? (sentence.duration || 3.0)
        : ((sentence.start !== undefined && sentence.end !== undefined && sentence.end > sentence.start)
            ? Number((sentence.end - sentence.start).toFixed(2))
            : (sentence.duration || 3.0));

      if (sentence.visuals && sentence.visuals.length > 0) {
        const sumVisDur = sentence.visuals.reduce((sum, v) => sum + (v.duration || 0), 0);
        const scale = (sumVisDur > 0 && Math.abs(sumVisDur - targetVoDur) > 0.15 && !isVisualOnly)
          ? (targetVoDur / sumVisDur)
          : 1.0;

        for (const vis of sentence.visuals) {
          const ss = vis.source_start_seconds !== undefined
            ? vis.source_start_seconds
            : (vis.source_timestamp_seconds !== undefined ? vis.source_timestamp_seconds : 0);

          const adjustedDur = Number(((vis.duration || 3.0) * scale).toFixed(3));

          clips.push({
            id: clipIdCounter++,
            sentenceIndex: sentence.sentence_index,
            text: sentence.text || '',
            sourceStart: ss,
            duration: adjustedDur,
            type: vis.type || 'video_cut',
            slowMoFactor: vis.slow_mo_factor,
            mirrorMode: vis.mirror_mode,
            colorShift: vis.color_grading_shift,
            isVisualOnly,
          });
        }
      } else {
        const fallbackSs = (sentence as any).source_start_seconds !== undefined
          ? (sentence as any).source_start_seconds
          : ((sentence as any).source_timestamp_seconds !== undefined ? (sentence as any).source_timestamp_seconds : (sentence.start || 0));

        clips.push({
          id: clipIdCounter++,
          sentenceIndex: sentence.sentence_index,
          text: sentence.text || '',
          sourceStart: fallbackSs,
          duration: targetVoDur,
          type: 'video_cut',
          isVisualOnly,
        });
      }
    }

    // Inspect actual voiceover audio file duration if available to prevent rendering past audio end
    let maxAudioDurationSec = 0;
    if (resolvedAudioFinal && fs.existsSync(resolvedAudioFinal)) {
      try {
        const voMeta = await ffmpeg.getVideoMeta(resolvedAudioFinal);
        if (voMeta && voMeta.duration && voMeta.duration > 0) {
          maxAudioDurationSec = voMeta.duration;
        }
      } catch {}
    }

    let totalDur = clips.reduce((s, c) => s + c.duration, 0);
    const narrationClips = clips.filter(c => !c.isVisualOnly);
    const narrationTotalDur = narrationClips.reduce((s, c) => s + c.duration, 0);

    if (maxAudioDurationSec > 0 && narrationClips.length > 0 && Math.abs(narrationTotalDur - maxAudioDurationSec) > 0.1) {
      console.log(`⚠️ [Alurfilm Engine] Narration visual clips duration (${narrationTotalDur.toFixed(2)}s) differs from Audio VO duration (${maxAudioDurationSec.toFixed(2)}s). Auto-adjusting narration clips.`);
      const scale = maxAudioDurationSec / narrationTotalDur;
      narrationClips.forEach((c, idx) => {
        if (idx === narrationClips.length - 1) {
          const otherSum = narrationClips.slice(0, idx).reduce((s, x) => s + x.duration, 0);
          c.duration = Math.max(0.2, Number((maxAudioDurationSec - otherSum).toFixed(3)));
        } else {
          c.duration = Number((c.duration * scale).toFixed(3));
        }
      });
      totalDur = clips.reduce((s, c) => s + c.duration, 0);
    }

    const width = 1920;
    const height = 1080;

    console.log(`✅ [Alurfilm Engine] ${clips.length} Visual Clips across ${mapping.mappings.length} Sentences | Total Duration: ${totalDur.toFixed(1)}s (${(totalDur / 60).toFixed(2)} min) | Resolution ${width}x${height} (16:9)`);

    // Collect exact frame-accurate time intervals for all VISUAL_ONLY clips on the rendered timeline
    const visualOnlyIntervals: Array<{ start: number; end: number }> = [];
    let runningTimelineTime = 0;

    for (const clip of clips) {
      const clipStart = runningTimelineTime;
      const clipEnd = clipStart + clip.duration;

      if (clip.isVisualOnly) {
        visualOnlyIntervals.push({
          start: Number(clipStart.toFixed(3)),
          end: Number(clipEnd.toFixed(3)),
        });
      }
      runningTimelineTime = clipEnd;
    }

    let visualOnlyConditions = '0';
    if (visualOnlyIntervals.length > 0) {
      visualOnlyConditions = visualOnlyIntervals
        .map(inv => `between(t,${inv.start.toFixed(2)},${inv.end.toFixed(2)})`)
        .join('+');
    }
    console.log(`🎬 [Alurfilm Engine] VISUAL_ONLY Intervals: ${visualOnlyIntervals.map(i => `${i.start.toFixed(1)}s-${i.end.toFixed(1)}s`).join(', ') || 'None'}`);

    const tmpDir = path.join(os.tmpdir(), `alurfilm-render-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    try {
      const CONCURRENCY = Math.min(Math.max(1, os.cpus().length - 1), 4);
      const clipFiles: string[] = new Array(clips.length);

      for (let batch = 0; batch < clips.length; batch += CONCURRENCY) {
        const batchEnd = Math.min(batch + CONCURRENCY, clips.length);
        const batchClips = clips.slice(batch, batchEnd);

        const tasks = batchClips.map((clip, bi) => {
          const i = batch + bi;
          const outFile = path.join(tmpDir, `c${String(i).padStart(4, '0')}.ts`);
          clipFiles[i] = outFile;

          const fxFilters: string[] = [];

          // 1. Mirror cut
          if (clip.mirrorMode === 'horizontal') fxFilters.push('hflip');
          else if (clip.mirrorMode === 'vertical') fxFilters.push('vflip');

          // 2. Slow motion (setpts)
          if (clip.type === 'slow_motion' && clip.slowMoFactor && clip.slowMoFactor > 0 && clip.slowMoFactor !== 1) {
            const ptsFactor = (1 / clip.slowMoFactor).toFixed(2);
            fxFilters.push(`setpts=${ptsFactor}*PTS`);
          }

          // 3. Color grading shift (YouTube Content ID bypass)
          if (clip.colorShift) {
            const contrast = clip.colorShift.contrast ?? 1.04;
            const brightness = clip.colorShift.brightness ?? 0.005;
            const saturation = clip.colorShift.saturation ?? 1.05;
            fxFilters.push(`eq=contrast=${contrast}:brightness=${brightness}:saturation=${saturation}`);
          }

          const fxChain = fxFilters.length > 0 ? ',' + fxFilters.join(',') : '';

          const scaledWidth = Math.round(width * 1.06); // 2035
          const scaledHeight = Math.round(height * 1.06); // 1145

          let scaleFilter = '';
          let inputReadDur = '';

          if (clip.type === 'freeze_frame_with_zoom') {
            // Extract first frame at sourceStart, loop, scale/crop, apply smooth subtle zoompan (1.00x -> 1.035x) & limit output to duration with lanczos crisp sharpness
            inputReadDur = '0.5';
            const clipFrames = Math.max(1, Math.round(clip.duration * 30));
            scaleFilter = `loop=loop=-1:size=1:start=0,scale=${width}:${height}:force_original_aspect_ratio=increase:flags=lanczos,crop=${width}:${height},zoompan=z='1+0.035*(on/${clipFrames})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${width}x${height}:fps=30,setsar=1${fxChain}`;
          } else {
            scaleFilter = `scale=${scaledWidth}:${scaledHeight}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1${fxChain}`;
            inputReadDur = (clip.type === 'slow_motion' && clip.slowMoFactor && clip.slowMoFactor > 0)
              ? (clip.duration * clip.slowMoFactor).toFixed(3)
              : String(clip.duration);
          }

          const ffmpegArgs: string[] = [];

          if (clip.isVisualOnly) {
            // For VISUAL_ONLY clips, extract original movie video (0:v:0) and original audio (0:a:0?) explicitly
            ffmpegArgs.push(
              '-y',
              '-ss', String(clip.sourceStart),
              '-t', inputReadDur,
              '-i', resolvedVideo,
              '-vf', scaleFilter,
              '-t', String(clip.duration),
              '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '18', '-r', '30',
              '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2',
              '-map', '0:v:0', '-map', '0:a:0?',
              '-avoid_negative_ts', 'make_zero',
              '-pix_fmt', 'yuv420p',
              outFile
            );
          } else {
            // For narration clips, use silent stereo audio (anullsrc) to prevent movie audio from clashing with narrator voiceover
            ffmpegArgs.push(
              '-y',
              '-ss', String(clip.sourceStart),
              '-t', inputReadDur,
              '-i', resolvedVideo,
              '-f', 'lavfi', '-t', String(clip.duration), '-i', 'anullsrc=r=48000:cl=stereo',
              '-vf', scaleFilter,
              '-t', String(clip.duration),
              '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '18', '-r', '30',
              '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2',
              '-map', '0:v:0', '-map', '1:a:0',
              '-avoid_negative_ts', 'make_zero',
              '-pix_fmt', 'yuv420p',
              outFile
            );
          }

          return runFFmpeg(ffmpegArgs, process.cwd(), `Clip #${clip.id} (Sentence ${clip.sentenceIndex})`);
        });

        await Promise.all(tasks);
        const done = batch + batchClips.length;
        const extractPct = Math.round((done / clips.length) * 70);
        process.stdout.write(`\r   ✂️ [Alurfilm Engine] Extracted ${done}/${clips.length} clips (${extractPct}%)   `);
      }
      console.log('');

      // Concat all TS clips & mix Voiceover audio + Logo
      console.log('🔗 [Alurfilm Engine] Concatenating visual clips & logo overlay...');
      const listFile = path.join(tmpDir, 'list.txt');
      fs.writeFileSync(listFile, clipFiles.map((f) => `file '${f}'`).join('\n'), 'utf-8');

      const fargs: string[] = [
        '-y',
        '-f', 'concat', '-safe', '0', '-i', listFile, // Stream 0:v (video) & 0:a (movie FX audio)
      ];

      let streamIndex = 1;
      let voIndex: number | null = null;
      let logoIndex: number | null = null;

      if (resolvedAudioFinal) {
        fargs.push('-i', resolvedAudioFinal);
        voIndex = streamIndex++;
      }

      // Collect all BGM timeline segments
      interface BgmSegmentInput {
        filePath: string;
        start: number;
        end: number;
      }
      const bgmSegments: BgmSegmentInput[] = [];

      if (mapping.bgm_timeline && mapping.bgm_timeline.length > 0) {
        for (const item of mapping.bgm_timeline) {
          const found = findBgmFile(item.file);
          if (found) {
            bgmSegments.push({ filePath: found, start: item.start, end: item.end });
          } else {
            console.warn(`⚠️ BGM file from timeline not found: ${item.file}`);
          }
        }
      }

      if (bgmSegments.length === 0) {
        const fallbackBgm = opts.bgm ? path.resolve(opts.bgm) : (bgmFile || findBgmFile());
        if (fallbackBgm && fs.existsSync(fallbackBgm)) {
          bgmSegments.push({ filePath: fallbackBgm, start: 0, end: totalDur });
        }
      }

      const bgmStreamIndices: number[] = [];
      for (const seg of bgmSegments) {
        console.log(`🎵 [Alurfilm Engine] BGM Segment: ${path.basename(seg.filePath)} (${seg.start}s - ${seg.end}s)`);
        fargs.push('-i', seg.filePath);
        bgmStreamIndices.push(streamIndex++);
      }

      if (logoFile) {
        console.log(`🎨 [Alurfilm Engine] Logo Watermark: ${path.basename(logoFile)} (Margin: ${logoMargin}px, Opacity: ${logoOpacity})`);
        fargs.push('-i', logoFile);
        logoIndex = streamIndex++;
      }

      const filterParts: string[] = [];
      let vMap = '0:v';
      let aMap: string | null = null;

      // Video filter for logo watermark
      if (logoIndex !== null) {
        filterParts.push(`[${logoIndex}:v]scale=-1:${logoScale},format=rgba,colorchannelmixer=aa=${logoOpacity}[logo_alpha]`);
        filterParts.push(`[0:v][logo_alpha]overlay=${logoMargin}:${logoMargin}[vout]`);
        vMap = '[vout]';
      }

      // Build Multi-BGM Audio Filter Graph
      if (bgmStreamIndices.length > 0) {
        const bgmSegNames: string[] = [];
        for (let idx = 0; idx < bgmStreamIndices.length; idx++) {
          const sIdx = bgmStreamIndices[idx];
          const seg = bgmSegments[idx];
          const segDur = Math.max(0.5, seg.end - seg.start);
          const delayMs = Math.round(seg.start * 1000);
          const fadeInSec = 1.2;
          const fadeOutSec = 1.2;
          const fadeOutStart = Math.max(0, segDur - fadeOutSec);
          const tag = `bgm_seg_${idx}`;

          filterParts.push(`[${sIdx}:a]atrim=0:${segDur.toFixed(3)},aloop=loop=-1:size=2e+09,atrim=0:${segDur.toFixed(3)},afade=t=in:st=0:d=${fadeInSec},afade=t=out:st=${fadeOutStart.toFixed(3)}:d=${fadeOutSec},adelay=${delayMs}|${delayMs}[${tag}]`);
          bgmSegNames.push(`[${tag}]`);
        }

        const numBgmSegs = bgmSegNames.length;
        if (numBgmSegs > 1) {
          filterParts.push(`${bgmSegNames.join('')}amix=inputs=${numBgmSegs}:dropout_transition=0[bgm_full]`);
        } else {
          filterParts.push(`${bgmSegNames[0]}acopy[bgm_full]`);
        }

        const bgmSegScale = numBgmSegs > 1 ? numBgmSegs : 1;

        if (voIndex !== null) {
          const numFinalInputs = 3;
          const targetBgmVol = (bgmVolume * bgmSegScale * numFinalInputs).toFixed(3);
          const targetVisualOnlyVol = (Math.max(bgmVolume * 1.6, 0.45) * bgmSegScale * numFinalInputs).toFixed(3);
          const targetVoVol = (narrationVolume * numFinalInputs).toFixed(3);
          const targetMovieFxVol = (1.8 * numFinalInputs).toFixed(3);

          filterParts.push(`[${voIndex}:a]volume=${targetVoVol}[vo]`);
          filterParts.push(`[0:a]volume=${targetMovieFxVol}[movie_fx]`);
          filterParts.push(`[bgm_full]volume='if(${visualOnlyConditions}, ${targetVisualOnlyVol}, ${targetBgmVol})':eval=frame[bgm_ducked]`);
          filterParts.push(`[vo][movie_fx][bgm_ducked]amix=inputs=3:duration=first:dropout_transition=0[aout]`);
          aMap = '[aout]';
        } else {
          const numFinalInputs = 2;
          const targetBgmVol = (bgmVolume * bgmSegScale * numFinalInputs).toFixed(3);
          const targetVisualOnlyVol = (Math.max(bgmVolume * 1.6, 0.45) * bgmSegScale * numFinalInputs).toFixed(3);
          const targetMovieFxVol = (1.8 * numFinalInputs).toFixed(3);

          filterParts.push(`[0:a]volume=${targetMovieFxVol}[movie_fx]`);
          filterParts.push(`[bgm_full]volume='if(${visualOnlyConditions}, ${targetVisualOnlyVol}, ${targetBgmVol})':eval=frame[bgm_ducked]`);
          filterParts.push(`[movie_fx][bgm_ducked]amix=inputs=2:duration=first:dropout_transition=0[aout]`);
          aMap = '[aout]';
        }
      } else if (voIndex !== null) {
        filterParts.push(`[0:a]volume=1.8[aout]`);
        aMap = '[aout]';
      }


      if (filterParts.length > 0) {
        fargs.push('-filter_complex', filterParts.join(';'));
      }

      fargs.push('-map', vMap);
      if (aMap) {
        fargs.push('-map', aMap);
      }

      if (logoIndex !== null) {
        fargs.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p');
      } else {
        fargs.push('-c:v', 'copy');
      }

      if (aMap) {
        fargs.push('-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2');
      }

      fargs.push(
        '-movflags', '+faststart',
        '-progress', 'pipe:1', '-nostats',
        resolvedOutput,
      );

      const t0 = Date.now();
      await runFFmpegProgress(fargs, process.cwd(), totalDur, (pct, msg) => {
        const displayPct = 70 + Math.round(pct * 0.3);
        process.stdout.write(`\r   🎥 [Alurfilm Engine] Rendering: ${displayPct}% (${msg})   `);
      });
      console.log('');

      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`🎉 [Alurfilm Engine] Render Complete! File: ${resolvedOutput} (${elapsed}s, Total Duration: ${totalDur.toFixed(1)}s)`);
    } catch (err: any) {
      console.error(`❌ [Alurfilm Engine Error] ${err.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
