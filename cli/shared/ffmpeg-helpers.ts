// cli/shared/ffmpeg-helpers.ts
import { spawn, ChildProcess } from 'child_process';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const ffmpegBin: string = require('@ffmpeg-installer/ffmpeg').path;

/**
 * Run ffmpeg and wait for completion. Rejects on non-zero exit code.
 */
export function runFFmpeg(args: string[], cwd: string, taskName?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child: ChildProcess = spawn(ffmpegBin, args, { cwd });
    let err = '';
    child.stderr?.on('data', (d: Buffer) => { err += d.toString(); });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else {
        const lastLines = err.trim().split('\n').filter(Boolean).slice(-8).join(' | ');
        reject(new Error(`FFmpeg exit ${code} on ${taskName || 'clip'}: ${lastLines}`));
      }
    });
    child.on('error', (e) => reject(new Error(`FFmpeg spawn error on ${taskName || 'clip'}: ${e.message}`)));
  });
}

/**
 * Run ffmpeg with -progress pipe:1 for structured progress.
 * Parses `out_time_us` from stdout and calls cb(pct, msg).
 */
export function runFFmpegProgress(
  args: string[],
  cwd: string,
  totalDurSec: number,
  cb: (pct: number, msg: string) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child: ChildProcess = spawn(ffmpegBin, args, { cwd });
    let stderr = '';

    child.stdout?.on('data', (d: Buffer) => {
      const text = d.toString();
      const match = text.match(/^out_time_us=(\d+)$/m);
      if (match) {
        const us = parseInt(match[1], 10);
        const sec = us / 1_000_000;
        const pct = Math.min(99, Math.round((sec / totalDurSec) * 100));
        cb(pct, `${sec.toFixed(1)}s / ${totalDurSec.toFixed(1)}s`);
      }
    });

    child.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });

    child.on('close', (code) => {
      if (code === 0) { cb(100, 'Done'); resolve(); }
      else {
        const lastLines = stderr.trim().split('\n').filter(Boolean).slice(-8).join(' | ');
        reject(new Error(`FFmpeg exit ${code}: ${lastLines}`));
      }
    });

    child.on('error', reject);
  });
}

export { ffmpegBin };
