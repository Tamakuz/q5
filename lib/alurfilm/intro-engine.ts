// lib/alurfilm/intro-engine.ts
import path from 'path';
import fs from 'fs';
import { runFFmpegProgress } from '../../cli/shared/ffmpeg-helpers.js';

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

  const filterComplex = [
    `color=c=black:s=1920x1080:d=${duration}:r=30[bg]`,
    `[bg]drawtext=text='${cleanTitle}':fontcolor=${titleColor}:fontsize=90:x=(w-text_w)/2:y=(h-text_h)/2-30:enable='between(t,${impactTimestamp},${duration})':alpha='if(lt(t,${impactTimestamp}),0,if(lt(t,${impactTimestamp + 0.3}),(t-${impactTimestamp})/0.3,if(gt(t,${duration - 1.0}),(${duration}-t)/1.0,1)))'[v1]`,
    `[v1]drawtext=text='${cleanSubtitle}':fontcolor=${subtitleColor}:fontsize=32:x=(w-text_w)/2:y=(h-text_h)/2+65:enable='between(t,${impactTimestamp + 0.1},${duration})':alpha='if(lt(t,${impactTimestamp + 0.1}),0,if(lt(t,${impactTimestamp + 0.4}),(t-${impactTimestamp}-0.1)/0.3,if(gt(t,${duration - 1.0}),(${duration}-t)/1.0,1)))'[vfinal]`
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
