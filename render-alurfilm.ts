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

const VisualClipSchema = z.object({
  type: z.enum(['slow_motion', 'mirror_cut', 'freeze_frame_with_zoom', 'video_cut', 'pan_and_zoom_cut']).optional().default('video_cut'),
  duration: z.number().positive(),
  source_start_seconds: z.number().min(0).optional(),
  source_timestamp_seconds: z.number().min(0).optional(),
  slow_mo_factor: z.number().optional(),
  mirror_mode: z.enum(['horizontal', 'vertical']).optional(),
  zoom_speed: z.number().optional(),
  pan_direction: z.enum(['left', 'right', 'up', 'down']).optional(),
  color_grading_shift: z.object({
    contrast: z.number().optional(),
    brightness: z.number().optional(),
    saturation: z.number().optional(),
  }).optional(),
});

const SentenceMappingSchema = z.object({
  sentence_index: z.number().int().min(0),
  text: z.string().optional(),
  start: z.number().min(0).optional(),
  end: z.number().min(0).optional(),
  duration: z.number().positive().optional(),
  visuals: z.array(VisualClipSchema).optional(),
});

const AlurfilmMappingSchema = z.object({
  scene_id: z.string().optional(),
  mappings: z.array(SentenceMappingSchema).min(1),
  status: z.string().optional(),
});

type AlurfilmMapping = z.infer<typeof AlurfilmMappingSchema>;

// All shared FFmpeg helpers now live in cli/shared/ffmpeg-helpers.ts

program
  .command('render')
  .description('Render a 16:9 Alur Cerita Film video from mapping JSON')
  .argument('<mapping>', 'Path to Alurfilm mapping JSON file')
  .requiredOption('--video <path>', 'Path to source video chunk')
  .option('-a, --audio <path>', 'Path to voice-over audio file')
  .option('-b, --bgm <path>', 'Path to background music file')
  .option('--bgm-volume <volume>', 'BGM volume factor (e.g. 0.10)', '0.10')
  .option('-l, --logo <path>', 'Path to logo image watermark')
  .option('--logo-opacity <opacity>', 'Logo opacity factor (0.1 to 1.0)', '0.6')
  .option('--logo-margin <pixels>', 'Logo margin from top-left corner in px', '40')
  .option('--logo-scale <height>', 'Logo height in pixels for watermark', '60')
  .option('-o, --output <path>', 'Output MP4 file path', 'output/alurfilm_render.mp4')
  .action(async (mappingPath: string, opts: {
    video: string;
    audio?: string;
    bgm?: string;
    bgmVolume?: string;
    logo?: string;
    logoOpacity?: string;
    logoMargin?: string;
    logoScale?: string;
    output: string;
  }) => {
    const resolvedMap = path.resolve(mappingPath);
    const resolvedVideo = path.resolve(opts.video);
    const resolvedAudio = opts.audio ? path.resolve(opts.audio) : null;
    const resolvedOutput = path.resolve(opts.output);

    if (!fs.existsSync(resolvedMap)) { console.error(`❌ Mapping file not found: ${resolvedMap}`); process.exit(1); }
    if (!fs.existsSync(resolvedVideo)) { console.error(`❌ Source video chunk not found: ${resolvedVideo}`); process.exit(1); }

    let resolvedAudioFinal = resolvedAudio;
    if (resolvedAudio && !fs.existsSync(resolvedAudio)) {
      console.warn(`⚠️ Voiceover audio file not found — rendering video only`);
      resolvedAudioFinal = null;
    }

    const outDir = path.dirname(resolvedOutput);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    // Use explicit logo file if provided, or default to assets/logo.png for Alurfilm
    let logoFile: string | null = opts.logo ? path.resolve(opts.logo) : null;
    if (!logoFile) {
      const alurfilmDefaultLogo = path.join(process.cwd(), 'assets', 'logo.png');
      if (fs.existsSync(alurfilmDefaultLogo)) logoFile = alurfilmDefaultLogo;
    } else if (logoFile && !fs.existsSync(logoFile)) {
      console.warn(`⚠️ Specified logo watermark file not found: ${logoFile}`);
      logoFile = null;
    }

    // Use explicit BGM file if provided (for partial render, BGM is usually applied in final render)
    let bgmFile: string | null = opts.bgm ? path.resolve(opts.bgm) : null;
    if (bgmFile && !fs.existsSync(bgmFile)) {
      console.warn(`⚠️ Specified BGM file not found: ${bgmFile}`);
      bgmFile = null;
    }

    const bgmVolume = parseFloat(opts.bgmVolume || '0.18') || 0.18;
    const logoOpacity = parseFloat(opts.logoOpacity || '0.6') || 0.6;
    const logoMargin = parseInt(opts.logoMargin || '40', 10) || 40;
    const logoScale = parseInt(opts.logoScale || '60', 10) || 60;

    console.log('🎬 [Alurfilm Engine] Loading 16:9 mapping JSON...');
    let mapping: AlurfilmMapping;
    try {
      const raw = JSON.parse(fs.readFileSync(resolvedMap, 'utf-8'));
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
    }

    const clips: FlattenedClip[] = [];
    let clipIdCounter = 1;

    for (const sentence of mapping.mappings) {
      if (sentence.visuals && sentence.visuals.length > 0) {
        for (const vis of sentence.visuals) {
          const ss = vis.source_start_seconds !== undefined
            ? vis.source_start_seconds
            : (vis.source_timestamp_seconds !== undefined ? vis.source_timestamp_seconds : 0);

          clips.push({
            id: clipIdCounter++,
            sentenceIndex: sentence.sentence_index,
            text: sentence.text || '',
            sourceStart: ss,
            duration: vis.duration,
            type: vis.type || 'video_cut',
            slowMoFactor: vis.slow_mo_factor,
            mirrorMode: vis.mirror_mode,
            colorShift: vis.color_grading_shift,
          });
        }
      } else {
        clips.push({
          id: clipIdCounter++,
          sentenceIndex: sentence.sentence_index,
          text: sentence.text || '',
          sourceStart: sentence.start || 0,
          duration: sentence.duration || 3.0,
          type: 'video_cut',
        });
      }
    }

    const totalDur = clips.reduce((s, c) => s + c.duration, 0);
    const width = 1920;
    const height = 1080;

    console.log(`✅ [Alurfilm Engine] ${clips.length} Visual Clips across ${mapping.mappings.length} Sentences | Total Duration: ${totalDur.toFixed(1)}s (${(totalDur / 60).toFixed(2)} min) | Resolution ${width}x${height} (16:9)`);

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
            // Extract first frame at sourceStart, loop infinitely, crop & limit output to duration
            inputReadDur = '0.5';
            scaleFilter = `loop=loop=-1:size=1:start=0,scale=${scaledWidth}:${scaledHeight}:force_original_aspect_ratio=increase,crop=${width}:${height}${fxChain}`;
          } else {
            scaleFilter = `scale=${scaledWidth}:${scaledHeight}:force_original_aspect_ratio=increase,crop=${width}:${height}${fxChain}`;
            inputReadDur = (clip.type === 'slow_motion' && clip.slowMoFactor && clip.slowMoFactor > 0)
              ? (clip.duration * clip.slowMoFactor).toFixed(3)
              : String(clip.duration);
          }

          const ffmpegArgs = [
            '-y',
            '-ss', String(clip.sourceStart),
            '-t', inputReadDur,
            '-i', resolvedVideo,
            '-vf', scaleFilter,
            '-t', String(clip.duration),
            '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '18',
            '-an', '-pix_fmt', 'yuv420p',
            outFile
          ];

          return runFFmpeg(ffmpegArgs, process.cwd(), `Clip #${clip.id} (Sentence ${clip.sentenceIndex})`);
        });

        await Promise.all(tasks);
        const done = batch + batchClips.length;
        const extractPct = Math.round((done / clips.length) * 70);
        process.stdout.write(`\r   ✂️ [Alurfilm Engine] Extracted ${done}/${clips.length} clips (${extractPct}%)   `);
      }
      console.log('');

      // Concat all TS clips & mix Voiceover audio + Logo + BGM
      console.log('🔗 [Alurfilm Engine] Concatenating visual clips, logo overlay & audio mixing...');
      const listFile = path.join(tmpDir, 'list.txt');
      fs.writeFileSync(listFile, clipFiles.map((f) => `file '${f}'`).join('\n'), 'utf-8');

      const fargs: string[] = [
        '-y',
        '-f', 'concat', '-safe', '0', '-i', listFile, // Stream 0:v
      ];

      let streamIndex = 1;
      let voIndex: number | null = null;
      let bgmIndex: number | null = null;
      let logoIndex: number | null = null;

      if (resolvedAudioFinal) {
        fargs.push('-i', resolvedAudioFinal);
        voIndex = streamIndex++;
      }

      if (bgmFile) {
        console.log(`🎵 [Alurfilm Engine] BGM Audio: ${path.basename(bgmFile)} (Volume: ${bgmVolume})`);
        fargs.push('-i', bgmFile);
        bgmIndex = streamIndex++;
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

      // Audio filter for VO + BGM mixing
      if (voIndex !== null && bgmIndex !== null) {
        filterParts.push(`[${voIndex}:a]volume=1.8[vo]`);
        filterParts.push(`[${bgmIndex}:a]volume=${bgmVolume},aloop=loop=-1:size=2e+09,afade=t=out:st=${Math.max(0, totalDur - 2)}:d=2[bgm]`);
        filterParts.push(`[vo][bgm]amix=inputs=2:duration=first:dropout_transition=2[aout]`);
        aMap = '[aout]';
      } else if (voIndex !== null) {
        filterParts.push(`[${voIndex}:a]volume=1.8[vo]`);
        aMap = '[vo]';
      } else if (bgmIndex !== null) {
        filterParts.push(`[${bgmIndex}:a]volume=${bgmVolume},aloop=loop=-1:size=2e+09,afade=t=out:st=${Math.max(0, totalDur - 2)}:d=2[bgm]`);
        aMap = '[bgm]';
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
        fargs.push('-c:a', 'aac', '-b:a', '192k');
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
