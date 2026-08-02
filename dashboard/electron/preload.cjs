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
  onAlurfilmSplitProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('alurfilm-split-progress', handler);
    return () => ipcRenderer.removeListener('alurfilm-split-progress', handler);
  },
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
  uploadAlurfilmAudio: (contentId, parts, filePath) =>
    ipcRenderer.invoke('upload-alurfilm-audio', { parts, filePath }),
  listAlurfilmAudios: (modeContentId) =>
    ipcRenderer.invoke('list-alurfilm-audios', modeContentId),
  deleteAlurfilmAudio: (id) =>
    ipcRenderer.invoke('delete-alurfilm-audio', { id }),
  getAlurfilmTranscriptPrompt: (chunkPart, totalChunks) =>
    ipcRenderer.invoke('get-alurfilm-transcript-prompt', { chunkPart, totalChunks }),
  saveAlurfilmTranscript: (...args) => {
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
        jsonText = args[0];
      }
    } else if (args.length === 1) {
      jsonText = args[0];
    }
    return ipcRenderer.invoke('save-alurfilm-transcript', { chunkPart, jsonText });
  },
  listAlurfilmTranscripts: (modeContentId) =>
    ipcRenderer.invoke('list-alurfilm-transcripts', modeContentId),
  getAlurfilmMappingPrompt: (chunkPart, totalChunks) =>
    ipcRenderer.invoke('get-alurfilm-mapping-prompt', { chunkPart, totalChunks }),
  saveAlurfilmMapping: (...args) => {
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
        jsonText = args[0];
      }
    } else if (args.length === 1) {
      jsonText = args[0];
    }
    return ipcRenderer.invoke('save-alurfilm-mapping', { chunkPart, jsonText });
  },
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
  generateSpensiaTopics: (promptText, model) => ipcRenderer.invoke('generate-spensia-topics', { promptText, model }),
  generateSpensiaScript: (promptText, model) => ipcRenderer.invoke('generate-spensia-script', { promptText, model }),
  generateSpensiaBreakdown: (promptText, model) => ipcRenderer.invoke('generate-spensia-breakdown', { promptText, model }),
  generateSpensiaImagePrompts: (promptText, model) => ipcRenderer.invoke('generate-spensia-image-prompts', { promptText, model }),
  onSpensiaTopicsChunk: (callback) => {
    const handler = (_e, data) => callback(data);
    ipcRenderer.on('spensia-topics-chunk', handler);
    return () => ipcRenderer.removeListener('spensia-topics-chunk', handler);
  },
  onSpensiaScriptChunk: (callback) => {
    const handler = (_e, data) => callback(data);
    ipcRenderer.on('spensia-script-chunk', handler);
    return () => ipcRenderer.removeListener('spensia-script-chunk', handler);
  },
  onSpensiaBreakdownChunk: (callback) => {
    const handler = (_e, data) => callback(data);
    ipcRenderer.on('spensia-breakdown-chunk', handler);
    return () => ipcRenderer.removeListener('spensia-breakdown-chunk', handler);
  },
  onSpensiaImagePromptsChunk: (callback) => {
    const handler = (_e, data) => callback(data);
    ipcRenderer.on('spensia-image-prompts-chunk', handler);
    return () => ipcRenderer.removeListener('spensia-image-prompts-chunk', handler);
  },
  generateSpensiaSingleImage: (segmentId, prompt, model, size, quality, imageDetail, topicId) =>
    ipcRenderer.invoke('generate-spensia-single-image', { segmentId, prompt, model, size, quality, image_detail: imageDetail, topicId }),
  generateSpensiaBatchImages: (items, model, size, quality, imageDetail, concurrency = 5, topicId) =>
    ipcRenderer.invoke('generate-spensia-batch-images', { items, model, size, quality, image_detail: imageDetail, concurrency, topicId }),
  onSpensiaImageProgress: (callback) => {
    const handler = (_e, data) => callback(data);
    ipcRenderer.on('spensia-image-progress', handler);
    return () => ipcRenderer.removeListener('spensia-image-progress', handler);
  },
  onSpensiaImageChunkStart: (callback) => {
    const handler = (_e, data) => callback(data);
    ipcRenderer.on('spensia-image-chunk-start', handler);
    return () => ipcRenderer.removeListener('spensia-image-chunk-start', handler);
  },
  onSpensiaImageLog: (callback) => {
    const handler = (_e, data) => callback(data);
    ipcRenderer.on('spensia-image-log', handler);
    return () => ipcRenderer.removeListener('spensia-image-log', handler);
  },
  uploadSpensiaVoAudio: (segmentId, sourcePath, bufferArray, topicId) =>
    ipcRenderer.invoke('upload-spensia-vo-audio', { segmentId, sourcePath, bufferArray, topicId }),
  mergeSpensiaVoAudio: (audioPaths, topicId) =>
    ipcRenderer.invoke('merge-spensia-vo-audio', { audioPaths, topicId }),
  saveToProject: (subPath, data) => ipcRenderer.invoke('save-to-project', { subPath, data }),
  readFromProject: (subPath) => ipcRenderer.invoke('read-from-project', subPath),

  // Spensia Render Engine & Thumbnail Studio
  generateSpensiaTimeline: (topicId) => ipcRenderer.invoke('generate-spensia-timeline', { topicId }),
  getSpensiaRenderResult: (topicId) => ipcRenderer.invoke('get-spensia-render-result', { topicId }),
  renderSpensiaVideo: (config, timeline, outputPath, topicId) =>
    ipcRenderer.invoke('render-spensia-video', { config, timeline, outputPath, topicId }),
  renderSpensiaPreviewFrame: (config, imagePath) =>
    ipcRenderer.invoke('render-spensia-preview-frame', { config, imagePath }),

  // Thumbnail Studio
  generateSpensiaThumbnailPrompts: (scriptContent, topicTitle, selectedTitle, metadata, model, topicId) =>
    ipcRenderer.invoke('generate-spensia-thumbnail-prompts', { scriptContent, topicTitle, selectedTitle, metadata, model, topicId }),
  onSpensiaThumbnailPromptsChunk: (callback) => {
    const handler = (_e, data) => callback(data);
    ipcRenderer.on('spensia-thumbnail-prompts-chunk', handler);
    return () => ipcRenderer.removeListener('spensia-thumbnail-prompts-chunk', handler);
  },
  generateSpensiaThumbnailImages: (concepts, model, size, topicId) =>
    ipcRenderer.invoke('generate-spensia-thumbnail-images', { concepts, model, size, topicId }),
  onSpensiaThumbnailImageProgress: (callback) => {
    const handler = (_e, data) => callback(data);
    ipcRenderer.on('spensia-thumbnail-image-progress', handler);
    return () => ipcRenderer.removeListener('spensia-thumbnail-image-progress', handler);
  },
  getSpensiaThumbnails: (topicId) => ipcRenderer.invoke('get-spensia-thumbnails', { topicId }),
  saveSpensiaThumbnailSelection: (selectedId, concept, topicId) =>
    ipcRenderer.invoke('save-spensia-thumbnail-selection', { selectedId, concept, topicId }),
  analyzeSpensiaThumbnailImages: (topicTitle, selectedTitle, thumbnails, model, topicId) =>
    ipcRenderer.invoke('analyze-spensia-thumbnail-images', { topicTitle, selectedTitle, thumbnails, model, topicId }),

  // Publish Hub SEO & Upload Metadata
  generateSpensiaUploadMetadata: (scriptContent, topicTitle, model, topicId) =>
    ipcRenderer.invoke('generate-spensia-upload-metadata', { scriptContent, topicTitle, model, topicId }),
  onSpensiaUploadMetadataChunk: (callback) => {
    const handler = (_e, data) => callback(data);
    ipcRenderer.on('spensia-upload-metadata-chunk', handler);
    return () => ipcRenderer.removeListener('spensia-upload-metadata-chunk', handler);
  },
  getSpensiaUploadMetadata: (topicId) => ipcRenderer.invoke('get-spensia-upload-metadata', { topicId }),
  analyzeSpensiaMetadata: (topicTitle, metadata, model, topicId) =>
    ipcRenderer.invoke('analyze-spensia-metadata', { topicTitle, metadata, model, topicId }),
  fixSpensiaMetadata: (topicTitle, metadata, analysis, model, topicId) =>
    ipcRenderer.invoke('fix-spensia-metadata', { topicTitle, metadata, analysis, model, topicId }),
});
