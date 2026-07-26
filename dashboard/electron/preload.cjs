// dashboard/electron/preload.cjs
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // File open dialog
  selectFile: () => ipcRenderer.invoke('select-file'),

  // Get video metadata via ffprobe
  getVideoMeta: (filePath) => ipcRenderer.invoke('get-video-meta', filePath),

  // Upload & trim source video
  uploadSource: (filePath, start, end) =>
    ipcRenderer.invoke('upload-source', { filePath, start, end }),

  // List uploaded sources
  listSources: () => ipcRenderer.invoke('list-sources'),

  // Delete an uploaded source
  deleteSource: (fileName) => ipcRenderer.invoke('delete-source', fileName),

  // Audio file selection & upload
  selectAudio: () => ipcRenderer.invoke('select-audio'),
  uploadAudio: (filePath) => ipcRenderer.invoke('upload-audio', { filePath }),
  listAudio: () => ipcRenderer.invoke('list-audio'),
  listRenders: () => ipcRenderer.invoke('list-renders'),

  // Clipboard
  copyToClipboard: (text) => ipcRenderer.invoke('copy-to-clipboard', text),

  // Render video via Remotion
  renderVideo: (mapping, videoPath, audioPath) => ipcRenderer.invoke('render-video', mapping, videoPath, audioPath),
  onRenderProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('render-progress', handler);
    // Return cleanup function
    return () => ipcRenderer.removeListener('render-progress', handler);
  },

  // Alur Film Specific IPC Helpers
  uploadAlurfilmSource: (filePath) => ipcRenderer.invoke('upload-alurfilm-source', { filePath }),
  uploadAlurfilmMaster: (filePath) => ipcRenderer.invoke('upload-alurfilm-source', { filePath }),
  splitAlurfilmVideo: (masterPath, startTime, endTime) =>
    ipcRenderer.invoke('split-alurfilm-video', { masterPath, startTime, endTime }),
  splitAlurfilmMaster: (masterPath, intervalSeconds, startTime, endTime) =>
    ipcRenderer.invoke('split-alurfilm-master', { masterPath, intervalSeconds, startTime, endTime }),
  splitAlurfilmMasterRange: (masterPath, startSec, durationSec, partNum) =>
    ipcRenderer.invoke('split-alurfilm-master-range', { masterPath, startSec, durationSec, partNum }),
  listAlurfilmChunks: (modeContentId) => ipcRenderer.invoke('list-alurfilm-chunks', modeContentId),
  deleteAlurfilmChunk: (part) => ipcRenderer.invoke('delete-alurfilm-chunk', { part }),
  analyzeAlurfilmChunk: (chunkPath, chunkPart, previousContext) =>
    ipcRenderer.invoke('analyze-alurfilm-chunk', { chunkPath, chunkPart, previousContext }),
  listAlurfilmAnalyses: (modeContentId) => ipcRenderer.invoke('list-alurfilm-analyses', modeContentId),
  getAlurfilmPrompt: (chunkPart, totalChunks, previousContext) =>
    ipcRenderer.invoke('get-alurfilm-prompt', { chunkPart, totalChunks, previousContext }),
  saveAlurfilmAnalysis: (...args) => {
    let chunkPart = 1;
    let jsonText = null;
    if (args.length >= 3) {
      chunkPart = args[1];
      jsonText = args[2];
    } else if (args.length === 2) {
      if (typeof args[0] === 'number' || !isNaN(Number(args[0]))) {
        chunkPart = Number(args[0]);
        jsonText = args[1];
      } else {
        chunkPart = Number(args[1]) || 1;
        jsonText = args[0] || args[2];
      }
    } else if (args.length === 1) {
      jsonText = args[0];
    }
    return ipcRenderer.invoke('save-alurfilm-analysis', { chunkPart, jsonText });
  },
  uploadAlurfilmAudio: (part, filePath) =>
    ipcRenderer.invoke('upload-alurfilm-audio', { part, filePath }),
  listAlurfilmAudios: (modeContentId) =>
    ipcRenderer.invoke('list-alurfilm-audios', modeContentId),
  deleteAlurfilmAudio: (part) =>
    ipcRenderer.invoke('delete-alurfilm-audio', { part }),
  getAlurfilmTranscriptPrompt: (chunkPart, totalChunks) =>
    ipcRenderer.invoke('get-alurfilm-transcript-prompt', { chunkPart, totalChunks }),
  saveAlurfilmTranscript: (chunkPart, jsonText) =>
    ipcRenderer.invoke('save-alurfilm-transcript', { chunkPart, jsonText }),
  listAlurfilmTranscripts: (modeContentId) =>
    ipcRenderer.invoke('list-alurfilm-transcripts', modeContentId),
  getAlurfilmMappingPrompt: (chunkPart, totalChunks) =>
    ipcRenderer.invoke('get-alurfilm-mapping-prompt', { chunkPart, totalChunks }),
  saveAlurfilmMapping: (chunkPart, jsonText) =>
    ipcRenderer.invoke('save-alurfilm-mapping', { chunkPart, jsonText }),
  listAlurfilmMappings: (modeContentId) =>
    ipcRenderer.invoke('list-alurfilm-mappings', modeContentId),
  listAlurfilmRenders: (modeContentId) =>
    ipcRenderer.invoke('list-alurfilm-renders', modeContentId),
  renderAlurfilmVideo: (part, mapping, videoPath, audioPath, opts) =>
    ipcRenderer.invoke('render-alurfilm-video', { part, mapping, videoPath, audioPath, ...opts }),
  listProjectAssets: () =>
    ipcRenderer.invoke('list-project-assets'),
  concatAlurfilmFinalVideo: (parts, opts) =>
    ipcRenderer.invoke('concat-alurfilm-final-video', { parts, ...opts }),

  // Generic project file helpers
  getContentId: (mode) => ipcRenderer.invoke('get-content-id', mode),
  resetProject: (mode) => ipcRenderer.invoke('reset-project', mode),
  generateYoutubeTitles: (transcriptText) => ipcRenderer.invoke('generate-youtube-titles', transcriptText),
  saveToProject: (subPath, data) => ipcRenderer.invoke('save-to-project', { subPath, data }),
  readFromProject: (subPath) => ipcRenderer.invoke('read-from-project', subPath),
});
