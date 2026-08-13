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
  compressAlurfilmChunk: (opts) => ipcRenderer.invoke('compress-alurfilm-chunk', opts),
  analyzeAlurfilmChunk: (chunkPath, chunkPart, previousContext) =>
    ipcRenderer.invoke('analyze-alurfilm-chunk', { chunkPath, chunkPart, previousContext }),
  listAlurfilmAnalyses: (modeContentId) => ipcRenderer.invoke('list-alurfilm-analyses', modeContentId),
  runAlurfilmGeminiScriptPipeline: (...args) => {
    let opts = {};
    if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
      opts = args[0];
    } else {
      opts = {
        partNum: Number(args[0]) || 1,
        totalChunks: Number(args[1]) || 4,
        previousContext: args[2] || null,
      };
    }
    return ipcRenderer.invoke('run-alurfilm-gemini-script-pipeline', opts);
  },
  getBrowserUserProfiles: () => ipcRenderer.invoke('get-browser-user-profiles'),
  onAlurfilmProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('alurfilm:progress', handler);
    return () => ipcRenderer.removeListener('alurfilm:progress', handler);
  },
  onAlurfilmLog: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('alurfilm:log', handler);
    return () => ipcRenderer.removeListener('alurfilm:log', handler);
  },
  getAlurfilmPrompt: (optsOrPartNum, totalChunks, previousContext) => {
    if (typeof optsOrPartNum === 'object' && optsOrPartNum !== null) {
      return ipcRenderer.invoke('get-alurfilm-prompt', optsOrPartNum);
    }
    return ipcRenderer.invoke('get-alurfilm-prompt', { chunkPart: optsOrPartNum, totalChunks, previousContext });
  },
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
  runAlurfilmWhisperXAlignment: (parts, audioPath) =>
    ipcRenderer.invoke('run-alurfilm-whisperx-alignment', { parts, audioPath }),
  onAlurfilmAlignmentProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('alurfilm-alignment-progress', handler);
    return () => ipcRenderer.removeListener('alurfilm-alignment-progress', handler);
  },
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
  renderAlurfilmPart: (part, videoPath, audioPath, mappingData, opts = {}) =>
    ipcRenderer.invoke('render-alurfilm-video', { part, chunkPart: part, mapping: mappingData, mappingData, videoPath, audioPath, ...opts }),
  renderAlurfilmVideo: (part, mapping, videoPath, audioPath, opts = {}) =>
    ipcRenderer.invoke('render-alurfilm-video', { part, chunkPart: part, mapping, mappingData: mapping, videoPath, audioPath, ...opts }),
  listProjectAssets: () =>
    ipcRenderer.invoke('list-project-assets'),
  getRenderSettings: () =>
    ipcRenderer.invoke('get-render-settings'),
  saveRenderSettings: (settings) =>
    ipcRenderer.invoke('save-render-settings', settings),
  concatAlurfilmFinalVideo: (parts, opts) =>
    ipcRenderer.invoke('concat-alurfilm-final-video', { parts, ...opts }),
  generateAlurfilmMetadata: (opts) =>
    ipcRenderer.invoke('generate-alurfilm-metadata', opts || {}),
  saveAlurfilmMetadata: (opts) =>
    ipcRenderer.invoke('save-alurfilm-metadata', opts || {}),
  getAlurfilmMetadata: (modeContentId) =>
    ipcRenderer.invoke('get-alurfilm-metadata', modeContentId),
  onAlurfilmMetadataChunk: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('alurfilm-metadata-chunk', handler);
    return () => ipcRenderer.removeListener('alurfilm-metadata-chunk', handler);
  },
  renderAlurfilmIntroTest: (options) =>
    ipcRenderer.invoke('alurfilm:render-intro-test', options),
  getAlurfilmIntro: (modeContentId) =>
    ipcRenderer.invoke('get-alurfilm-intro', modeContentId),
  onAlurfilmIntroProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('alurfilm:render-intro-progress', handler);
    return () => ipcRenderer.removeListener('alurfilm:render-intro-progress', handler);
  },
  generateAlurfilmTestTtsWithSilence: (scriptText) =>
    ipcRenderer.invoke('generate-alurfilm-test-tts-with-silence', { scriptText }),
  runAlurfilmTestWhisperAlignment: (audioPath, scriptText) =>
    ipcRenderer.invoke('run-alurfilm-test-whisper-alignment', { audioPath, scriptText }),
  onAlurfilmTestWhisperProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('alurfilm-test-whisper-progress', handler);
    return () => ipcRenderer.removeListener('alurfilm-test-whisper-progress', handler);
  },


  getMediaUrl: (filePath) => `media://content-auto/${encodeURIComponent(filePath)}`,

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
  runSpensiaFasterWhisperAlignment: (data) =>
    ipcRenderer.invoke('run-spensia-faster-whisper-alignment', data),
  onSpensiaFasterWhisperProgress: (handler) => {
    const listener = (_e, data) => handler(data);
    ipcRenderer.on('spensia-faster-whisper-progress', listener);
    return () => ipcRenderer.removeListener('spensia-faster-whisper-progress', listener);
  },
  saveToProject: (subPath, data) => ipcRenderer.invoke('save-to-project', { subPath, data }),
  readFromProject: (subPath) => ipcRenderer.invoke('read-from-project', subPath),
  generateShortsKeywords: (opts) => ipcRenderer.invoke('generate-shorts-keywords', opts),

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

  // Waku Core IPC Helpers
  generateWakuTopics: (promptText, model) => ipcRenderer.invoke('generate-waku-topics', { promptText, model }),
  generateWakuScript: (promptText, model) => ipcRenderer.invoke('generate-waku-script', { promptText, model }),
  generateWakuBreakdown: (promptText, model) => ipcRenderer.invoke('generate-waku-breakdown', { promptText, model }),
  generateWakuImagePrompts: (promptText, model) => ipcRenderer.invoke('generate-waku-image-prompts', { promptText, model }),
  onWakuTopicsChunk: (callback) => {
    const handler = (_e, data) => callback(data);
    ipcRenderer.on('waku-topics-chunk', handler);
    return () => ipcRenderer.removeListener('waku-topics-chunk', handler);
  },
  onWakuScriptChunk: (callback) => {
    const handler = (_e, data) => callback(data);
    ipcRenderer.on('waku-script-chunk', handler);
    return () => ipcRenderer.removeListener('waku-script-chunk', handler);
  },
  onWakuBreakdownChunk: (callback) => {
    const handler = (_e, data) => callback(data);
    ipcRenderer.on('waku-breakdown-chunk', handler);
    return () => ipcRenderer.removeListener('waku-breakdown-chunk', handler);
  },
  onWakuImagePromptsChunk: (callback) => {
    const handler = (_e, data) => callback(data);
    ipcRenderer.on('waku-image-prompts-chunk', handler);
    return () => ipcRenderer.removeListener('waku-image-prompts-chunk', handler);
  },
  generateWakuSingleImage: (segmentId, prompt, model, size, quality, imageDetail, topicId) =>
    ipcRenderer.invoke('generate-waku-single-image', { segmentId, prompt, model, size, quality, image_detail: imageDetail, topicId }),
  generateWakuBatchImages: (items, model, size, quality, imageDetail, concurrency = 5, topicId) =>
    ipcRenderer.invoke('generate-waku-batch-images', { items, model, size, quality, image_detail: imageDetail, concurrency, topicId }),
  onWakuImageProgress: (callback) => {
    const handler = (_e, data) => callback(data);
    ipcRenderer.on('waku-image-progress', handler);
    return () => ipcRenderer.removeListener('waku-image-progress', handler);
  },
  onWakuImageChunkStart: (callback) => {
    const handler = (_e, data) => callback(data);
    ipcRenderer.on('waku-image-chunk-start', handler);
    return () => ipcRenderer.removeListener('waku-image-chunk-start', handler);
  },
  onWakuImageLog: (callback) => {
    const handler = (_e, data) => callback(data);
    ipcRenderer.on('waku-image-log', handler);
    return () => ipcRenderer.removeListener('waku-image-log', handler);
  },
  uploadWakuVoAudio: (segmentId, sourcePath, bufferArray, topicId) =>
    ipcRenderer.invoke('upload-waku-vo-audio', { segmentId, sourcePath, bufferArray, topicId }),
  mergeWakuVoAudio: (audioPaths, topicId) =>
    ipcRenderer.invoke('merge-waku-vo-audio', { audioPaths, topicId }),
  runWakuFasterWhisperAlignment: (data) =>
    ipcRenderer.invoke('run-waku-faster-whisper-alignment', data),
  onWakuFasterWhisperProgress: (handler) => {
    const listener = (_e, data) => handler(data);
    ipcRenderer.on('waku-faster-whisper-progress', listener);
    return () => ipcRenderer.removeListener('waku-faster-whisper-progress', listener);
  },
  generateWakuTimeline: (topicId) => ipcRenderer.invoke('generate-waku-timeline', { topicId }),
  getWakuRenderResult: (topicId) => ipcRenderer.invoke('get-waku-render-result', { topicId }),
  renderWakuVideo: (config, timeline, outputPath, topicId) =>
    ipcRenderer.invoke('render-waku-video', { config, timeline, outputPath, topicId }),
  renderWakuPreviewFrame: (config, imagePath) =>
    ipcRenderer.invoke('render-waku-preview-frame', { config, imagePath }),
  generateWakuThumbnailPrompts: (scriptContent, topicTitle, selectedTitle, metadata, model, topicId) =>
    ipcRenderer.invoke('generate-waku-thumbnail-prompts', { scriptContent, topicTitle, selectedTitle, metadata, model, topicId }),
  onWakuThumbnailPromptsChunk: (callback) => {
    const handler = (_e, data) => callback(data);
    ipcRenderer.on('waku-thumbnail-prompts-chunk', handler);
    return () => ipcRenderer.removeListener('waku-thumbnail-prompts-chunk', handler);
  },
  generateWakuThumbnailImages: (concepts, model, size, topicId) =>
    ipcRenderer.invoke('generate-waku-thumbnail-images', { concepts, model, size, topicId }),
  onWakuThumbnailImageProgress: (callback) => {
    const handler = (_e, data) => callback(data);
    ipcRenderer.on('waku-thumbnail-image-progress', handler);
    return () => ipcRenderer.removeListener('waku-thumbnail-image-progress', handler);
  },
  getWakuThumbnails: (topicId) => ipcRenderer.invoke('get-waku-thumbnails', { topicId }),
  saveWakuThumbnailSelection: (selectedId, concept, topicId) =>
    ipcRenderer.invoke('save-waku-thumbnail-selection', { selectedId, concept, topicId }),
  analyzeWakuThumbnailImages: (topicTitle, selectedTitle, thumbnails, model, topicId) =>
    ipcRenderer.invoke('analyze-waku-thumbnail-images', { topicTitle, selectedTitle, thumbnails, model, topicId }),
  generateWakuUploadMetadata: (scriptContent, topicTitle, model, topicId) =>
    ipcRenderer.invoke('generate-waku-upload-metadata', { scriptContent, topicTitle, model, topicId }),
  onWakuUploadMetadataChunk: (callback) => {
    const handler = (_e, data) => callback(data);
    ipcRenderer.on('waku-upload-metadata-chunk', handler);
    return () => ipcRenderer.removeListener('waku-upload-metadata-chunk', handler);
  },
  getWakuUploadMetadata: (topicId) => ipcRenderer.invoke('get-waku-upload-metadata', { topicId }),
  analyzeWakuMetadata: (topicTitle, metadata, model, topicId) =>
    ipcRenderer.invoke('analyze-waku-metadata', { topicTitle, metadata, model, topicId }),
  fixWakuMetadata: (topicTitle, metadata, analysis, model, topicId) =>
    ipcRenderer.invoke('fix-waku-metadata', { topicTitle, metadata, analysis, model, topicId }),

  // UGC Character Profiles
  selectUGCImageFile: () => ipcRenderer.invoke('ugc:select-image-file'),
  getUGCProfiles: () => ipcRenderer.invoke('ugc:get-profiles'),
  createUGCProfile: (name, sourceFilePath) => ipcRenderer.invoke('ugc:create-profile', { name, sourceFilePath }),
  deleteUGCProfile: (profileId) => ipcRenderer.invoke('ugc:delete-profile', profileId),
  selectActiveUGCProfile: (profileId) => ipcRenderer.invoke('ugc:select-active-profile', profileId),
  getActiveUGCProfile: () => ipcRenderer.invoke('ugc:get-active-profile'),

  // UGC Products & Video Assets
  selectUGCVideoFile: () => ipcRenderer.invoke('ugc:select-video-file'),
  getUGCProducts: () => ipcRenderer.invoke('ugc:get-products'),
  createUGCProduct: (name, sourcePhotoPath) => ipcRenderer.invoke('ugc:create-product', { name, sourcePhotoPath }),
  deleteUGCProduct: (productId) => ipcRenderer.invoke('ugc:delete-product', productId),
  selectActiveUGCProduct: (productId) => ipcRenderer.invoke('ugc:select-active-product', productId),
  getActiveUGCProduct: () => ipcRenderer.invoke('ugc:get-active-product'),
  uploadUGCVideoAsset: (productId, sourceFilePath) =>
    ipcRenderer.invoke('ugc:upload-video-asset', { productId, sourceFilePath }),
  listUGCVideoAssets: (productId) => ipcRenderer.invoke('ugc:list-video-assets', productId),
  deleteUGCVideoAsset: (productId, fileName) =>
    ipcRenderer.invoke('ugc:delete-video-asset', { productId, fileName }),
  downloadUGCVideoAsset: (productId, videoUrl) =>
    ipcRenderer.invoke('ugc:download-video-asset', { productId, videoUrl }),
  onUGCVideoDownloadProgress: (callback) => {
    const handler = (_e, data) => callback(data);
    ipcRenderer.on('ugc:download-video-progress', handler);
    return () => ipcRenderer.removeListener('ugc:download-video-progress', handler);
  },

  // UGC Isolated Render Studio
  getUGCPatternStats: (productId) => ipcRenderer.invoke('ugc:get-render-patterns-stats', productId),
  getUGCPatternsList: (productId) => ipcRenderer.invoke('ugc:get-render-patterns-list', productId),
  shuffleUGCPatterns: (productId) => ipcRenderer.invoke('ugc:shuffle-render-patterns', productId),
  renderUGCPattern: (productId, pattern, patternIndex, transitionStyle) =>
    ipcRenderer.invoke('ugc:render-pattern', { productId, pattern, patternIndex, transitionStyle }),
  toggleUGCOploadStatus: (productId, patternKey, uploaded) =>
    ipcRenderer.invoke('ugc:toggle-upload-status', { productId, patternKey, uploaded }),
  deleteUGCRenderPattern: (productId, patternKey) =>
    ipcRenderer.invoke('ugc:delete-render-pattern', { productId, patternKey }),
  listUGCRenders: (productId) => ipcRenderer.invoke('ugc:list-renders', productId),
  deleteUGCRender: (productId, fileName) => ipcRenderer.invoke('ugc:delete-render', { productId, fileName }),
  onUGCRenderProgress: (callback) => {
    const handler = (_e, data) => callback(data);
    ipcRenderer.on('ugc:render-progress', handler);
    return () => ipcRenderer.removeListener('ugc:render-progress', handler);
  },
});
