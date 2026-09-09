// lib/alurfilm/intro-engine.ts
import path from 'path';
import fs from 'fs';
import { runFFmpegProgress } from '../../cli/shared/ffmpeg-helpers.js';

// Font paths — assets/fonts/ relative to project root
const FONT_DIR = 'assets/fonts';
const FONT_TITLE = path.join(FONT_DIR, 'BebasNeue-Regular.ttf');    // Display / Impact
const FONT_SUBTITLE = path.join(FONT_DIR, 'Montserrat-ExtraBold.ttf'); // Subtitle / Label

export interface IntroRenderOptions {
  titleText: string;
  subtitleText: string;
  audioPath?: string;
  impactTimestamp?: number;
  duration?: number;
  stylePreset?: 'cinematic_gold' | 'silver_epic' | 'neon_thriller';
  outputPath?: string;
}

export async function renderIntroVideo(
  options: IntroRenderOptions,
  onProgress?: (percent: number, msg: string) => void
): Promise<{ success: boolean; outputPath: string; error?: string }> {
  const {
    titleText = 'UNDER THE DOME',
    subtitleText = 'FILM 2013',
    audioPath = 'assets/The Final Horizon.mp3',
    impactTimestamp = 0.48,
    duration = 6.0,
    stylePreset = 'cinematic_gold',
    outputPath = 'output/testing/intro_test.mp4',
  } = options;

  const cwd = process.cwd();
  const resolvedAudio = path.isAbsolute(audioPath) ? audioPath : path.resolve(cwd, audioPath);
  const resolvedOutput = path.isAbsolute(outputPath) ? outputPath : path.resolve(cwd, outputPath);

  const outDir = path.dirname(resolvedOutput);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // Define styling based on preset
  let titleColor = '0xE5B83A'; // Gold
  let subtitleColor = '0xFFFFFF'; // White

  if (stylePreset === 'silver_epic') {
    titleColor = '0xE2E8F0';
    subtitleColor = '0x94A3B8';
  } else if (stylePreset === 'neon_thriller') {
    titleColor = '0xEF4444';
    subtitleColor = '0x38BDF8';
  }

  const cleanTitle = titleText.replace(/'/g, "\\'").replace(/:/g, '\\:');
  const cleanSubtitle = subtitleText.replace(/'/g, "\\'").replace(/:/g, '\\:');

  // Resolve font paths absolute from cwd
  const fontTitle = path.isAbsolute(FONT_TITLE) ? FONT_TITLE : path.resolve(cwd, FONT_TITLE);
  const fontSubtitle = path.isAbsolute(FONT_SUBTITLE) ? FONT_SUBTITLE : path.resolve(cwd, FONT_SUBTITLE);

  // FFmpeg drawtext requires escaped colons/backslashes in font path on Linux
  const escPath = (p: string) => p.replace(/\\/g, '/').replace(/:/g, '\\:');
  const fontTitleEsc = escPath(fontTitle);
  const fontSubtitleEsc = escPath(fontSubtitle);

  const titleFadeAlpha = `if(lt(t,${impactTimestamp}),0,if(lt(t,${impactTimestamp + 0.3}),(t-${impactTimestamp})/0.3,if(gt(t,${duration - 1.0}),(${duration}-t)/1.0,1)))`;
  const subtitleFadeAlpha = `if(lt(t,${impactTimestamp + 0.1}),0,if(lt(t,${impactTimestamp + 0.4}),(t-${impactTimestamp}-0.1)/0.3,if(gt(t,${duration - 1.0}),(${duration}-t)/1.0,1)))`;

  const filterComplex = [
    `color=c=black:s=1920x1080:d=${duration}:r=30[bg]`,
    // Drop shadow layer for title (offset +4px, semi-transparent black)
    `[bg]drawtext=text='${cleanTitle}':fontfile='${fontTitleEsc}':fontcolor=0x000000:fontsize=108:x=(w-text_w)/2+4:y=(h-text_h)/2-26:enable='between(t,${impactTimestamp},${duration})':alpha='${titleFadeAlpha}*0.55'[shadow]`,
    // Main title — Bebas Neue, larger, letter-spacing feel via fontsize bump
    `[shadow]drawtext=text='${cleanTitle}':fontfile='${fontTitleEsc}':fontcolor=${titleColor}:fontsize=108:x=(w-text_w)/2:y=(h-text_h)/2-30:enable='between(t,${impactTimestamp},${duration})':alpha='${titleFadeAlpha}'[v1]`,
    // Subtitle — Montserrat ExtraBold, spaced out with wider tracking feel
    `[v1]drawtext=text='${cleanSubtitle}':fontfile='${fontSubtitleEsc}':fontcolor=${subtitleColor}:fontsize=30:x=(w-text_w)/2:y=(h-text_h)/2+75:enable='between(t,${impactTimestamp + 0.1},${duration})':alpha='${subtitleFadeAlpha}'[vfinal]`
  ].join(';');

  const ffmpegArgs = [
    '-y',
    '-progress', 'pipe:1',
    '-f', 'lavfi', '-i', `color=c=black:s=1920x1080:d=${duration}:r=30`,
    '-i', resolvedAudio,
    '-filter_complex', filterComplex,
    '-map', '[vfinal]',
    '-map', '1:a',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '18',
    '-r', '30',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-shortest',
    resolvedOutput
  ];

  try {
    await runFFmpegProgress(ffmpegArgs, cwd, duration, (pct, msg) => {
      if (onProgress) {
        onProgress(pct, msg);
      }
    });

    return { success: true, outputPath: resolvedOutput };
  } catch (err: any) {
    console.error('❌ Intro render error:', err);
    return { success: false, outputPath: resolvedOutput, error: err.message };
  }
}
