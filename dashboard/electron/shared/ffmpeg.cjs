// dashboard/electron/shared/ffmpeg.cjs
const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

const ffmpegBin = require('@ffmpeg-installer/ffmpeg');
const ffprobeBin = require('@ffprobe-installer/ffprobe');
const ffmpegPath = fs.existsSync('/usr/bin/ffmpeg') ? '/usr/bin/ffmpeg' : ffmpegBin.path;
const ffprobePath = fs.existsSync('/usr/bin/ffprobe') ? '/usr/bin/ffprobe' : ffprobeBin.path;

/**
 * Get video metadata via ffprobe. Returns raw data (caller adds mediaUrl).
 */
function getVideoMetaHelper(filePath) {
  return new Promise((resolve) => {
    if (!fs.existsSync(filePath)) {
      return resolve(null);
    }

    const stat = fs.statSync(filePath);
    const args = [
      '-v', 'error',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath,
    ];

    const ffprobe = spawn(ffprobePath, args);

    let stdout = '';
    ffprobe.stdout.on('data', (d) => { stdout += d.toString(); });
    ffprobe.stderr.on('data', () => {});

    ffprobe.on('close', (code) => {
      if (code !== 0 || !stdout.trim()) {
        return resolve({
          duration: 0,
          width: 0,
          height: 0,
          name: path.basename(filePath),
          size: stat.size,
        });
      }

      try {
        const data = JSON.parse(stdout);
        const videoStream = data.streams?.find((s) => s.codec_type === 'video');
        const duration = parseFloat(data.format?.duration ?? '0');
        const width = videoStream?.width ?? 0;
        const height = videoStream?.height ?? 0;

        resolve({
          duration: isNaN(duration) ? 0 : duration,
          width,
          height,
          name: path.basename(filePath),
          size: stat.size,
        });
      } catch {
        resolve({
          duration: 0,
          width: 0,
          height: 0,
          name: path.basename(filePath),
          size: stat.size,
        });
      }
    });

    ffprobe.on('error', () => {
      resolve(null);
    });
  });
}

/**
 * Get audio duration via ffprobe
 */
function getAudioDurationHelper(audioFilePath) {
  return new Promise((resolve) => {
    if (!fs.existsSync(audioFilePath)) return resolve(0);
    const args = ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', audioFilePath];
    const child = spawn(ffprobePath, args);
    let out = '';
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.on('close', () => {
      const dur = parseFloat(out.trim());
      resolve(isNaN(dur) ? 0 : dur);
    });
    child.on('error', () => resolve(0));
  });
}

/**
 * Synchronous ffprobe duration probe (for use in non-async contexts)
 */
function probeAudioDurationSync(audioFilePath) {
  try {
    const out = execSync(
      `"${ffprobePath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioFilePath}"`,
      { encoding: 'utf-8' }
    );
    const d = parseFloat(out.trim());
    return isNaN(d) ? 0 : d;
  } catch { return 0; }
}

module.exports = {
  ffmpegPath,
  ffprobePath,
  getVideoMetaHelper,
  getAudioDurationHelper,
  probeAudioDurationSync,
};
