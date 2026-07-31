// dashboard/electron/shared/media.cjs
const path = require('path');
const fs = require('fs');
const { PROJECT_ROOT } = require('./paths.cjs');

const MEDIA_PROTOCOL = 'media';
const MEDIA_BASE = `${MEDIA_PROTOCOL}://content-auto/`;

function mediaUrl(filePath) {
  const encoded = encodeURIComponent(filePath);
  return `${MEDIA_BASE}${encoded}`;
}

function decodeMediaUrl(url) {
  const cleanUrl = url.split('?')[0];
  const encoded = cleanUrl.replace(MEDIA_BASE, '');
  return decodeURIComponent(encoded);
}

function mimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm',
    '.mkv': 'video/x-matroska', '.avi': 'video/x-msvideo',
    '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.flac': 'audio/flac',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.webp': 'image/webp', '.gif': 'image/gif',
  };
  return map[ext] || 'application/octet-stream';
}

/**
 * Register the custom media:// protocol for serving local files with range request support
 */
function registerMediaProtocol(protocol) {
  protocol.handle(MEDIA_PROTOCOL, (request) => {
    let filePath = decodeMediaUrl(request.url);

    if (!path.isAbsolute(filePath)) {
      filePath = path.join(PROJECT_ROOT, filePath);
    }

    if (!fs.existsSync(filePath)) {
      return new Response('File not found', { status: 404 });
    }

    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      return new Response('Not a file', { status: 400 });
    }

    const fileSize = stat.size;
    const rangeHeader = request.headers.get('range');

    if (!rangeHeader) {
      const body = fs.createReadStream(filePath);
      return new Response(body, {
        status: 200,
        headers: {
          'Content-Type': mimeType(filePath),
          'Content-Length': String(fileSize),
          'Accept-Ranges': 'bytes',
        },
      });
    }

    const matches = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (!matches) {
      return new Response('Invalid range', { status: 416 });
    }

    const start = parseInt(matches[1], 10);
    const end = matches[2] ? parseInt(matches[2], 10) : fileSize - 1;

    if (start >= fileSize || end >= fileSize) {
      return new Response('Range not satisfiable', {
        status: 416,
        headers: { 'Content-Range': `bytes */${fileSize}` },
      });
    }

    const chunkSize = end - start + 1;
    const body = fs.createReadStream(filePath, { start, end });

    return new Response(body, {
      status: 206,
      headers: {
        'Content-Type': mimeType(filePath),
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Content-Length': String(chunkSize),
        'Accept-Ranges': 'bytes',
      },
    });
  });
}

module.exports = {
  MEDIA_PROTOCOL,
  MEDIA_BASE,
  mediaUrl,
  decodeMediaUrl,
  mimeType,
  registerMediaProtocol,
};
