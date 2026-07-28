// spensiaRender.ts
// Spensia FFmpeg Render Engine — 16:9 (1920×1080) YouTube Longform Video Generator
// Importable module for Electron main process (via tsx/cjs require hook)

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const ffmpegBin: string = require('@ffmpeg-installer/ffmpeg').path;

import type { SpensiaRenderConfig } from './dashboard/src/utils/spensiaRenderConfig';
import type { SpensiaTimelineStructure, TimelineCaptionItem } from './dashboard/src/utils/spensiaTimelineGenerator';
import { generateAssSubtitles, CaptionStyleOptions } from './dashboard/src/utils/spensiaAssGenerator';

// ─── Types ─────────────────────────────────────────────

export interface RenderProgressCallback {
  (pct: number, msg: string, stage: string): void;
}

// ─── FFmpeg Runner ────────────────────────────────────

function runFfmpeg(args: string[], cwd: string = process.cwd()): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegBin, args, { cwd });
    let err = '';
    child.stderr.on('data', (d: Buffer) => { err += d.toString(); });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else {
        const lastLines = err.trim().split('\n').filter(Boolean).slice(-8).join(' | ');
        reject(new Error(`FFmpeg exit ${code}: ${lastLines}`));
      }
    });
    child.on('error', (e) => reject(new Error(`FFmpeg spawn error: ${e.message}`)));
  });
}

// ─── Geometry Helpers for 16:9 Canvas ─────────────────

function calcWatermarkXY(
  width: number,
  height: number,
  pos: string,
  offsetX: number,
  offsetY: number,
): { x: string; y: string } {
  // FFmpeg drawtext expressions: x and y are evaluated with text_w/text_h available
  const margin = 40;
  const xOff = margin + offsetX;
  const yOff = margin + offsetY;

  const posMap: Record<string, { x: string; y: string }> = {
    'top-left': { x: `${xOff}`, y: `${yOff}` },
    'top-center': { x: `(w-text_w)/2+${offsetX}`, y: `${yOff}` },
    'top-right': { x: `w-text_w-${xOff}`, y: `${yOff}` },
    'bottom-left': { x: `${xOff}`, y: `h-text_h-${yOff}` },
    'bottom-center': { x: `(w-text_w)/2+${offsetX}`, y: `h-text_h-${yOff}` },
    'bottom-right': { x: `w-text_w-${xOff}`, y: `h-text_h-${yOff}` },
  };
  return posMap[pos] || posMap['bottom-center'];
}

function hexToFFmpegColor(hex: string, opacity: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  const a = Math.round(opacity * 255);
  return `0x${a.toString(16).padStart(2, '0')}${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// ─── Assemble Video Filter Chain ──────────────────────

function buildVideoFilterChain(
  config: SpensiaRenderConfig,
): string {
  const { width, height } = config.resolution;
  const parts: string[] = [];

  // 0. Scale & crop to target resolution
  parts.push(`scale=${width}:${height}:force_original_aspect_ratio=increase`);
  parts.push(`crop=${width}:${height}`);

  // 1. Vignette filter (applied to video content)
  if (config.vignette.enabled) {
    // vignette filter: angle=PI/4 for radial gradient, intensity controls strength
    const vigExpr = `vignette=PI/4:max_eval=0:eval=frame`;
    // Fine-tune vignette via eq adjustments as alternative
    parts.push(vigExpr);
  }

  // 2. Watermark text overlay (drawtext)
  if (config.watermark.enabled) {
    const wm = config.watermark;
    const pos = calcWatermarkXY(width, height, wm.position, wm.offsetX, wm.offsetY);
    const fgColor = hexToFFmpegColor(wm.colorHex, wm.opacity);

    // Escape single quotes in text
    const escapedText = wm.text.replace(/'/g, "'\\\\\\''");

    const drawtextParts: string[] = [
      `drawtext=text='${escapedText}'`,
      `fontsize=${wm.fontSize}`,
      `fontcolor=${fgColor}`,
      `x=${pos.x}`,
      `y=${pos.y}`,
      `shadowcolor=black@0.4`,
      `shadowx=2`,
      `shadowy=2`,
    ];

    // Only add fontfile if we can find a system font
    // FFmpeg default font is used if fontfile not specified
    // For Montserrat: try to find it, fallback to sans-serif
    const fontPaths = [
      '/usr/share/fonts/truetype/msttcorefonts/Arial.ttf',
      '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
      '/usr/share/fonts/TTF/DejaVuSans.ttf',
      '/System/Library/Fonts/Helvetica.ttc',
    ];
    for (const fp of fontPaths) {
      if (fs.existsSync(fp)) {
        drawtextParts.push(`fontfile='${fp}'`);
        break;
      }
    }

    parts.push(drawtextParts.join(':'));
  }

  // 3. Format output pixel format for encoding
  parts.push(`format=yuv420p`);

  return parts.join(',');
}

// ─── Generate Single Image Video Clip ─────────────────

async function createImageClip(
  imagePath: string,
  durationSec: number,
  outputPath: string,
  width: number,
  height: number,
  fps: number,
  fadeInOut: boolean = true,
): Promise<void> {
  const filters: string[] = [];

  // Scale & crop
  filters.push(`scale=${width}:${height}:force_original_aspect_ratio=increase`);
  filters.push(`crop=${width}:${height}`);

  // Optional fade in/out
  if (fadeInOut) {
    const fadeDur = Math.min(0.3, durationSec / 3);
    filters.push(`fade=t=in:d=${fadeDur.toFixed(2)}`);
    filters.push(`fade=t=out:st=${(durationSec - fadeDur).toFixed(2)}:d=${fadeDur.toFixed(2)}`);
  }

  filters.push(`format=yuv420p`);

  const args = [
    '-y',
    '-loop', '1',
    '-r', String(fps),
    '-i', imagePath,
    '-vf', filters.join(','),
    '-t', String(durationSec),
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    '-an',
    outputPath,
  ];

  await runFfmpeg(args);
}

// ─── Main Render Pipeline ─────────────────────────────

export async function renderSpensiaVideo(
  config: SpensiaRenderConfig,
  timeline: SpensiaTimelineStructure,
  outputPath: string,
  onProgress?: RenderProgressCallback,
): Promise<void> {
  const { width, height } = config.resolution;
  const fps = config.fps || 30;
  const totalDur = timeline.total_duration_sec;

  onProgress?.(0, 'Initializing Spensia Render Engine...', 'init');

  // ── Validate inputs
  const projectRoot = process.cwd();

  // Resolve BGM path
  let bgmPath: string | null = null;
  if (config.bgm.enabled && config.bgm.path) {
    const resolved = path.isAbsolute(config.bgm.path)
      ? config.bgm.path
      : path.join(projectRoot, config.bgm.path);
    if (fs.existsSync(resolved)) {
      bgmPath = resolved;
    } else {
      onProgress?.(0, `⚠️ BGM file not found: ${config.bgm.path} — rendering without BGM`, 'warning');
    }
  }

  // Validate image files
  const missingImages: number[] = [];
  for (const clip of timeline.video_clips) {
    if (clip.image_path && !fs.existsSync(clip.image_path)) {
      missingImages.push(clip.clip_id);
    }
  }
  if (missingImages.length > 0) {
    throw new Error(`Missing image files for clips: ${missingImages.join(', ')}`);
  }

  // Validate audio files
  for (const track of timeline.audio_tracks) {
    if (track.filePath && !fs.existsSync(track.filePath)) {
      throw new Error(`Audio file not found: ${track.filePath}`);
    }
  }

  // ── Create temp directory
  const tmpDir = path.join(os.tmpdir(), `spensia-render-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    // ── Step 1: Generate ASS subtitle file (10%)
    onProgress?.(5, 'Generating ASS word-level subtitles...', 'subtitles');

    if (config.caption.enabled && timeline.captions.length > 0) {
    } else {
      onProgress?.(10, 'Captions disabled — skipping ASS generation', 'subtitles');
    }

    // ── Step 2: Create individual image clips (10% → 40%)
    const clips = timeline.video_clips;
    const clipFiles: string[] = new Array(clips.length);

    onProgress?.(10, `Creating ${clips.length} image clips...`, 'clips');

    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      const clipFile = path.join(tmpDir, `clip_${String(i).padStart(4, '0')}.ts`);
      clipFiles[i] = clipFile;

      const imgPath = clip.image_path!;
      await createImageClip(imgPath, clip.duration_sec, clipFile, width, height, fps);

      const pct = 10 + Math.round((i + 1) / clips.length * 30);
      onProgress?.(pct, `Image clip ${i + 1}/${clips.length} — ${clip.duration_sec.toFixed(1)}s`, 'clips');
    }

    // ── Step 3: Concat clips + apply overlays (40% → 75%)
    onProgress?.(40, 'Concatenating clips with transitions...', 'concat');

    const listFile = path.join(tmpDir, 'concat_list.txt');
    fs.writeFileSync(listFile, clipFiles.map((f) => `file '${f}'`).join('\n'), 'utf-8');

    const concatFile = path.join(tmpDir, 'concat_raw.ts');
    const concatArgs = [
      '-y',
      '-f', 'concat', '-safe', '0',
      '-i', listFile,
      '-c', 'copy',
      concatFile,
    ];
    await runFfmpeg(concatArgs);

    onProgress?.(50, 'Applying video overlays (watermark, vignette)...', 'overlay');

    // Count audio streams
    let streamIdx = 1; // 0 is video concat

    // Build the final FFmpeg command
    const finalArgs: string[] = ['-y'];

    // Input 0: concat video
    finalArgs.push('-i', concatFile);

    // Input 1, 2: VO audio tracks
    const audioInputs: number[] = [];
    for (const track of timeline.audio_tracks) {
      if (track.filePath && fs.existsSync(track.filePath)) {
        finalArgs.push('-i', track.filePath);
        audioInputs.push(streamIdx++);
      }
    }

    // Input N: BGM
    let bgmInputIdx: number | null = null;
    if (bgmPath) {
      finalArgs.push('-i', bgmPath);
      bgmInputIdx = streamIdx++;
    }

    // Build filter complex
    const filterParts: string[] = [];

    // Video filter chain: vignette + watermark + pixel format
    let videoChain = `[0:v]${buildVideoFilterChain(config)}[vout]`;

    // Generate ASS subtitle file and add to filter if enabled
    if (config.caption.enabled && timeline.captions.length > 0) {
      const assPath = path.join(tmpDir, 'subtitles.ass');
      const assOptions: CaptionStyleOptions = {
        fontName: config.caption.fontName,
        fontSize: config.caption.fontSize,
        activeColorHex: config.caption.activeColorHex,
        inactiveColorHex: config.caption.inactiveColorHex,
        outlineColorHex: config.caption.outlineColorHex,
        outlineWidth: config.caption.outlineWidth,
        shadowDistance: config.caption.shadowDistance,
        positionY: config.caption.positionY,
        positionX: config.caption.positionX,
        alignment: config.caption.alignment,
        timeOffsetSec: config.caption.timeOffsetSec,
        captionDisplayMode: config.caption.displayMode,
      };
      const assContent = generateAssSubtitles(timeline.captions, assOptions);
      fs.writeFileSync(assPath, assContent, 'utf-8');

      finalArgs.push('-i', assPath);
      const assIdx = streamIdx++;

      // ASS overlay after vignette but before watermark
      // Actually watermark is already in buildVideoFilterChain
      // ASS needs to be overlaid on the video BEFORE watermark... or after.
      // For simplicity, overlay ASS after the main filter chain
      videoChain = `[0:v]${buildVideoFilterChain(config)}[vtemp];[vtemp][${assIdx}:s]overlay[vout]`;
    }

    filterParts.push(videoChain);

    // Audio filter chain: mix VO tracks + BGM
    if (audioInputs.length > 0) {
      const audioMaps: string[] = [];

      // Map each VO track with its start offset
      audioInputs.forEach((ai, idx) => {
        const track = timeline.audio_tracks[idx];
        if (track) {
          const delayMs = Math.round(track.start_sec * 1000);
          filterParts.push(`[${ai}:a]adelay=${delayMs}|${delayMs}[vo${idx}]`);
          audioMaps.push(`[vo${idx}]`);
        }
      });

      // Mix all VO tracks
      if (audioMaps.length > 1) {
        filterParts.push(`${audioMaps.join('')}amix=inputs=${audioMaps.length}:duration=longest:dropout_transition=0.5[vomix]`);
      }

      const voFinal = audioMaps.length > 1 ? '[vomix]' : audioMaps[0];

      // Mix BGM with VO
      if (bgmInputIdx !== null) {
        const bgmVol = config.bgm.volume;
        const fadeIn = config.bgm.fadeInSec;
        const fadeOut = config.bgm.fadeOutSec;
        const fadeOutStart = Math.max(0, totalDur - fadeOut);

        filterParts.push(`${voFinal}volume=1.0[vonorm]`);
        filterParts.push(`[${bgmInputIdx}:a]volume=${bgmVol},afade=t=in:d=${fadeIn},afade=t=out:st=${fadeOutStart.toFixed(1)}:d=${fadeOut},aloop=loop=-1:size=2e+09[bgmproc]`);
        filterParts.push(`[vonorm][bgmproc]amix=inputs=2:duration=first:dropout_transition=2[aout]`);
      } else {
        filterParts.push(`${voFinal}volume=1.0[aout]`);
      }
    } else if (bgmInputIdx !== null) {
      const bgmVol = config.bgm.volume;
      const fadeIn = config.bgm.fadeInSec;
      const fadeOut = config.bgm.fadeOutSec;
      const fadeOutStart = Math.max(0, totalDur - fadeOut);

      filterParts.push(`[${bgmInputIdx}:a]volume=${bgmVol},afade=t=in:d=${fadeIn},afade=t=out:st=${fadeOutStart.toFixed(1)}:d=${fadeOut},aloop=loop=-1:size=2e+09[aout]`);
    }

    // Assemble filter complex
    finalArgs.push('-filter_complex', filterParts.join(';'));

    // Map outputs
    finalArgs.push('-map', '[vout]');
    if (audioInputs.length > 0 || bgmInputIdx !== null) {
      finalArgs.push('-map', '[aout]');
    }

    // Video encode settings
    const qualitySettings = {
      fast: ['-preset', 'ultrafast', '-crf', '22'],
      balanced: ['-preset', 'fast', '-crf', '18'],
      high: ['-preset', 'medium', '-crf', '16'],
    };
    const qSettings = qualitySettings[config.outputQuality];

    finalArgs.push('-c:v', 'libx264');
    finalArgs.push(...qSettings);
    finalArgs.push('-pix_fmt', 'yuv420p');

    if (audioInputs.length > 0 || bgmInputIdx !== null) {
      finalArgs.push('-c:a', 'aac', '-b:a', '192k');
    }

    finalArgs.push('-movflags', '+faststart');
    finalArgs.push('-t', String(totalDur));
    finalArgs.push(outputPath);

    onProgress?.(55, 'Rendering final video...', 'final');

    // Execute final render
    await new Promise<void>((resolve, reject) => {
      const child = spawn(ffmpegBin, finalArgs, { cwd: projectRoot });
      let stderr = '';

      child.stderr.on('data', (d: Buffer) => {
        const text = d.toString();
        stderr += text;

        // Parse FFmpeg time progress
        const timeMatch = text.match(/time=(\d+):(\d+):(\d+)\.(\d+)/);
        if (timeMatch && totalDur > 0) {
          const hrs = parseInt(timeMatch[1], 10);
          const mins = parseInt(timeMatch[2], 10);
          const secs = parseInt(timeMatch[3], 10);
          const currSec = hrs * 3600 + mins * 60 + secs;
          const framePct = Math.min(99, Math.round((currSec / totalDur) * 100));
          const mappedPct = 55 + Math.round(framePct * 0.45); // map to 55-100 range
          onProgress?.(mappedPct, `Encoding: ${currSec.toFixed(0)}s / ${totalDur.toFixed(0)}s`, 'final');
        }
      });

      child.on('close', (code) => {
        if (code === 0) {
          onProgress?.(100, 'Render complete!', 'done');
          resolve();
        } else {
          const lastLines = stderr.trim().split('\n').filter(Boolean).slice(-10).join('\n');
          reject(new Error(`FFmpeg final render exit ${code}:\n${lastLines}`));
        }
      });

      child.on('error', (err) => reject(new Error(`FFmpeg spawn error: ${err.message}`)));
    });

    onProgress?.(100, `🎉 Render Complete! → ${path.basename(outputPath)}`, 'done');
  } finally {
    // Cleanup temp directory
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}

// ─── Preview Frame Render ─────────────────────────────

export async function renderSpensiaPreviewFrame(
  config: SpensiaRenderConfig,
  imagePath: string,
  outputPath: string,
): Promise<string> {
  const { width, height } = config.resolution;

  if (!fs.existsSync(imagePath)) {
    throw new Error(`Preview image not found: ${imagePath}`);
  }

  const filterChain = buildVideoFilterChain(config);

  const args = [
    '-y',
    '-i', imagePath,
    '-vf', filterChain,
    '-vframes', '1',
    '-c:v', 'png',
    outputPath,
  ];

  await runFfmpeg(args);

  return outputPath;
}
