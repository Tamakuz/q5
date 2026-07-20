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
  }),
  timeline: z.array(ClipSchema).min(1),
});

type Clip = z.infer<typeof ClipSchema>;
type Mapping = z.infer<typeof MappingSchema>;

// ─── Helpers ──────────────────────────────────────────

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
  .option('-o, --output <path>', 'Output MP4 file path', 'output/video.mp4')
  .action(async (mappingPath: string, opts: { video: string; audio?: string; output: string }) => {
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

      for (let batch = 0; batch < clips.length; batch += CONCURRENCY) {
        const batchEnd = Math.min(batch + CONCURRENCY, clips.length);
        const batchClips = clips.slice(batch, batchEnd);

        const tasks = batchClips.map((clip, bi) => {
          const i = batch + bi;
          const outFile = path.join(tmpDir, `c${String(i).padStart(4, '0')}.ts`);
          clipFiles[i] = outFile;

          const task = runFFmpeg([
            '-y',
            '-ss', String(clip.ss),
            '-i', resolvedVideo,
            '-t', String(clip.t),
            '-vf', `scale=w=${width}:h=${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`,
            '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '18',
            '-an', '-pix_fmt', 'yuv420p',
            outFile,
          ], process.cwd());
          return task;
        });

        // Wait for batch, report progress
        await Promise.all(tasks);
        const done = batch + batchClips.length;
        const extractPct = Math.round((done / clips.length) * 60);
        process.stdout.write(`\r   ✂️  Extracting: ${done}/${clips.length} clips (${extractPct}%)   `);
      }
      console.log('');

      // 3. Concat + mux audio (single ffmpeg invocation)
      console.log('🔗 Concatenating + muxing audio...');
      const listFile = path.join(tmpDir, 'list.txt');
      fs.writeFileSync(listFile, clipFiles.map((f) => `file '${f}'`).join('\n'), 'utf-8');

      const fargs: string[] = [
        '-y',
        '-f', 'concat', '-safe', '0', '-i', listFile,
      ];
      if (resolvedAudioFinal) {
        fargs.push('-i', resolvedAudioFinal);
        fargs.push('-map', '0:v:0', '-map', '1:a:0', '-shortest');
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

program.parse();
