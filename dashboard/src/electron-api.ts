// dashboard/src/electron-api.ts

export interface SelectedFile {
  name: string;
  size: number;
  path: string;
}

export interface VideoMeta {
  duration: number;
  width: number;
  height: number;
  name: string;
  size: number;
  url: string;
}

export interface SourceInfo {
  name: string;
  size: number;
  url: string;
  createdAt?: string;
  filePath?: string;
}

export interface AudioInfo {
  name: string;
  size: number;
  url: string;
  createdAt?: string;
  filePath?: string;
}

export interface RenderProgress {
  stage: string;
  progress: number;
  message: string;
}

export interface RenderResult {
  outputPath: string;
  elapsed?: string;
}

export interface TiktokMetadata {
  captions: string[];
  description: string;
  hashtags: string[];
  recommended_caption: string;
  fyp_strategy_tip?: string;
}

export interface YoutubeMetadata {
  titles: string[];
  description: string;
  hashtags: string[];
  recommended_title: string;
}

export interface YoutubeTitleResult {
  titles?: string[];
  description?: string;
  hashtags?: string[];
  recommended_title?: string;
  youtube?: YoutubeMetadata;
  tiktok?: TiktokMetadata;
}

export interface RenderFileInfo {
  name: string;
  size: number;
  createdAt: string;
  filePath: string;
  fullPath: string;
  url: string;
}

export interface AlurfilmChunk {
  part: number;
  name: string;
  size: number;
  startSec?: number;
  durationSec?: number;
  duration?: number;
  filePath: string;
  url: string;
  mediaUrl?: string;
  isCompressed?: boolean;
}

export interface AlurfilmSplitProgressPayload {
  status: 'start' | 'splitting' | 'chunk_completed' | 'done';
  currentPart: number;
  totalParts: number;
  chunk?: AlurfilmChunk;
}

export interface AlurfilmMetadataTitle {
  id: string;
  emotion_category: 'underdog' | 'balas_dendam' | 'aksi_nekat' | 'kaget' | 'misteri';
  emotion_label: string;
  title: string;
  thumbnail_text?: string;
  thumbnail_text_yellow?: string;
  thumbnail_text_red?: string;
  thumbnail_prompt?: string;
  thumbnail_composition_notes?: string;
}

export interface AlurfilmMetadataResult {
  titles: AlurfilmMetadataTitle[];
  description: string;
  tags: string[];
  selectedTitle?: string;
  selectedThumbnailText?: string;
  selectedThumbnailPrompt?: string;
  updatedAt?: string;
}

export interface AlurfilmAlignmentProgressPayload {
  stage: 'preparing' | 'loading_model' | 'aligning' | 'mapping' | 'done' | 'error';
  progress: number;
  log: string;
}

export interface AlurfilmAnalysisData {
  chunk_part: number;
  naskah_voiceover: {
    word_count: number;
    script_text: string;
    macro_summary: string;
  };
  character_registry: Array<{
    visual_description: string;
    assigned_name: string;
  }>;
  timeline_edits: Array<{
    id: string;
    start_time: string;
    end_time: string;
    scene_label: string;
    narrative_focus: string;
  }>;
  status: string;
}

export interface AlurfilmAnalysisResult {
  part: number;
  name: string;
  filePath: string;
  data: AlurfilmAnalysisData;
}

export interface AlurfilmAudioResult {
  id?: string;
  part?: number;
  parts: number[];
  name: string;
  filePath: string;
  url: string;
  mediaUrl?: string;
  size: number;
  createdAt?: string;
}

export interface AlurfilmTranscriptEntry {
  id: number;
  start_seconds: number;
  end_seconds: number;
  timestamp_minute: string;
  text: string;
  speaker?: string;
}

export interface AlurfilmTranscriptResult {
  part: number;
  name?: string;
  filePath?: string;
  data?: AlurfilmTranscriptEntry[];
  entries?: AlurfilmTranscriptEntry[];
  multiPart?: boolean;
  savedResults?: AlurfilmTranscriptResult[];
}

export interface AlurfilmVisualClip {
  type: 'slow_motion' | 'mirror_cut' | 'freeze_frame_with_zoom' | 'video_cut' | 'pan_and_zoom_cut';
  duration: number;
  source_start_seconds?: number;
  source_timestamp_seconds?: number;
  slow_mo_factor?: number;
  mirror_mode?: 'horizontal' | 'vertical';
  pan_direction?: 'left' | 'right' | 'up' | 'down' | 'center';
  zoom_speed?: number;
  color_grading_shift?: {
    contrast?: number;
    brightness?: number;
    saturation?: number;
  };
}

export interface AlurfilmSentenceMapping {
  sentence_index: number;
  text: string;
  start: number;
  end: number;
  duration: number;
  visuals: AlurfilmVisualClip[];
}

export interface AlurfilmMappingData {
  scene_id: string;
  mappings: AlurfilmSentenceMapping[];
  status: string;
}

export interface AlurfilmMappingResult {
  part: number;
  name: string;
  filePath: string;
  data: AlurfilmMappingData;
}

export interface AlurfilmRenderResult {
  part: number;
  outputPath: string;
  elapsed: string;
  name: string;
  mediaUrl: string;
  error?: string;
}

export interface UGCProfile {
  id: string;
  name: string;
  photo: string;
  createdAt: string;
  photoUrl?: string;
  photoPath?: string;
}

export interface UGCProduct {
  id: string;
  name: string;
  photo?: string | null;
  createdAt: string;
  photoUrl?: string;
  photoPath?: string;
}

export interface UGCVideoAsset {
  id: string;
  name: string;
  fileName: string;
  size: number;
  filePath: string;
  url: string;
  createdAt: string;
}

export interface UGCPatternStats {
  productId: string;
  totalRawClips: number;
  totalPossiblePatterns: number;
  renderedCount: number;
  uploadedCount?: number;
  remainingCount: number;
}

export interface UGCPatternItem {
  patternKey: string;
  pattern: string[];
  rendered: boolean;
  uploaded: boolean;
  outputFileName?: string | null;
  videoUrl?: string | null;
  renderedAt?: string | null;
  uploadedAt?: string | null;
}

export interface UGCRenderResult {
  id: string;
  name: string;
  fileName: string;
  size: number;
  pattern?: string[];
  filePath: string;
  url: string;
  createdAt: string;
}

export interface RenderSettings {
  narrationVolume: number;
  bgmVolume: number;
  bgmEnabled: boolean;
  bgmPath: string;
  logoEnabled: boolean;
  logoPath: string;
  logoOpacity: number;
  logoMargin: number;
  logoScale: number;
  introEnabled?: boolean;
  introTitleText?: string;
  introSubtitleText?: string;
  introStylePreset?: 'cinematic_gold' | 'silver_epic' | 'neon_thriller';
  introDuration?: number;
  introImpactTimestamp?: number;
  introAudioPath?: string;
}

export interface ElectronAPI {
  selectUGCImageFile?: () => Promise<SelectedFile | null>;
  getUGCProfiles?: () => Promise<UGCProfile[]>;
  createUGCProfile?: (name: string, sourceFilePath?: string) => Promise<UGCProfile>;
  deleteUGCProfile?: (profileId: string) => Promise<boolean>;
  selectActiveUGCProfile?: (profileId: string) => Promise<boolean>;
  getActiveUGCProfile?: () => Promise<string | null>;

  selectUGCVideoFile?: () => Promise<SelectedFile[]>;
  getUGCProducts?: () => Promise<UGCProduct[]>;
  createUGCProduct?: (name: string, sourcePhotoPath?: string) => Promise<UGCProduct>;
  deleteUGCProduct?: (productId: string) => Promise<boolean>;
  selectActiveUGCProduct?: (productId: string) => Promise<boolean>;
  getActiveUGCProduct?: () => Promise<string | null>;
  uploadUGCVideoAsset?: (productId: string, sourceFilePath: string) => Promise<UGCVideoAsset>;
  downloadUGCVideoAsset?: (productId: string, videoUrl: string) => Promise<UGCVideoAsset>;
  onUGCVideoDownloadProgress?: (
    callback: (data: { productId: string; progress: number; loadedBytes: number; totalBytes: number }) => void
  ) => () => void;
  listUGCVideoAssets?: (productId: string) => Promise<UGCVideoAsset[]>;
  deleteUGCVideoAsset?: (productId: string, fileName: string) => Promise<boolean>;

  getUGCPatternStats?: (productId: string) => Promise<UGCPatternStats | null>;
  getUGCPatternsList?: (
    productId: string
  ) => Promise<{ productId: string; items: UGCPatternItem[]; stats: UGCPatternStats; rawClipUrls?: Record<string, string> } | null>;
  shuffleUGCPatterns?: (productId: string) => Promise<boolean>;
  renderUGCPattern?: (
    productId: string,
    pattern?: string[],
    patternIndex?: number,
    transitionStyle?: 'radian_glow' | 'dissolve' | 'none'
  ) => Promise<UGCRenderResult>;
  toggleUGCOploadStatus?: (productId: string, patternKey: string, uploaded: boolean) => Promise<boolean>;
  deleteUGCRenderPattern?: (productId: string, patternKey: string) => Promise<boolean>;
  listUGCRenders?: (productId: string) => Promise<UGCRenderResult[]>;
  deleteUGCRender?: (productId: string, fileName: string) => Promise<boolean>;
  onUGCRenderProgress?: (
    callback: (data: { productId: string; stage: string; progress: number }) => void
  ) => () => void;

  selectFile: () => Promise<SelectedFile | null>;
  getVideoMeta: (filePath: string) => Promise<VideoMeta | null>;
  uploadSource: (filePath: string, start: number, end: number) => Promise<SourceInfo>;
  listSources: () => Promise<SourceInfo[]>;
  deleteSource: (fileName: string) => Promise<boolean>;
  selectAudio: () => Promise<SelectedFile | null>;
  uploadAudio: (filePath: string) => Promise<AudioInfo>;
  listAudio: () => Promise<AudioInfo[]>;
  listRenders: () => Promise<RenderFileInfo[]>;
  uploadAlurfilmSource: (filePath: string) => Promise<SourceInfo>;
  uploadAlurfilmMaster: (filePath: string) => Promise<SourceInfo>;
  splitAlurfilmVideo: (masterPath: string, startTime: string | number, endTime: string | number) => Promise<AlurfilmChunk[]>;
  splitAlurfilmMaster: (masterPath: string, intervalSeconds?: number, startTime?: string | number, endTime?: string | number) => Promise<{ chunks: AlurfilmChunk[]; content_id?: string }>;
  onAlurfilmSplitProgress?: (callback: (data: AlurfilmSplitProgressPayload) => void) => () => void;
  splitAlurfilmMasterRange: (masterPath: string, startSec: number, durationSec: number, partNum: number) => Promise<{ chunks: AlurfilmChunk[]; content_id?: string }>;
  listAlurfilmChunks: (modeContentId?: string) => Promise<AlurfilmChunk[]>;
  deleteAlurfilmChunk: (part: number) => Promise<boolean>;
  compressAlurfilmChunk: (opts: { part: number; filePath?: string }) => Promise<AlurfilmChunk>;
  analyzeAlurfilmChunk: (chunkPath: string, chunkPart: number, previousContext?: any) => Promise<AlurfilmAnalysisResult>;
  listAlurfilmAnalyses: (modeContentId?: string) => Promise<AlurfilmAnalysisResult[]>;
  getAlurfilmPrompt: (optsOrPartNum: any, totalChunks?: number, previousContext?: any) => Promise<string>;
  saveAlurfilmAnalysis: (contentIdOrPart: string | number, partOrData?: number | any, jsonTextOrPart?: any) => Promise<AlurfilmAnalysisResult>;
  uploadAlurfilmAudio: (contentId: string, parts: number[], filePath: string) => Promise<AlurfilmAudioResult>;
  listAlurfilmAudios: (modeContentId?: string) => Promise<AlurfilmAudioResult[]>;
  deleteAlurfilmAudio: (id: string) => Promise<boolean>;
  getAlurfilmTranscriptPrompt: (chunkPart: number, totalChunks?: number) => Promise<string>;
  saveAlurfilmTranscript: (contentIdOrPart: string | number, partOrData?: number | any, jsonTextOrPart?: any) => Promise<AlurfilmTranscriptResult>;
  listAlurfilmTranscripts: (modeContentId?: string) => Promise<AlurfilmTranscriptResult[]>;
  runAlurfilmWhisperXAlignment?: (parts: number[], audioPath?: string) => Promise<{ success: boolean; savedResults?: any[]; multiPartMap?: any }>;
  onAlurfilmAlignmentProgress?: (callback: (data: AlurfilmAlignmentProgressPayload) => void) => () => void;
  getAlurfilmMappingPrompt: (chunkPart: number, totalChunks?: number) => Promise<string>;
  saveAlurfilmMapping: (contentIdOrPart: string | number, partOrData?: number | any, jsonTextOrPart?: any) => Promise<AlurfilmMappingResult>;
  listAlurfilmMappings: (modeContentId?: string) => Promise<AlurfilmMappingResult[]>;
  listAlurfilmRenders: (modeContentId?: string) => Promise<AlurfilmRenderResult[]>;
  renderAlurfilmPart: (
    part: number,
    videoPath: string,
    audioPath: string,
    mappingData: any,
    opts?: Partial<RenderSettings>
  ) => Promise<AlurfilmRenderResult>;
  renderAlurfilmVideo: (
    part: number,
    mapping: any,
    videoPath: string,
    audioPath?: string,
    opts?: {
      bgmPath?: string;
      bgmVolume?: number;
      logoPath?: string;
      logoOpacity?: number;
      logoMargin?: number;
    }
  ) => Promise<AlurfilmRenderResult>;
  listProjectAssets: () => Promise<{
    logos: Array<{ name: string; path: string; url: string }>;
    bgms: Array<{ name: string; path: string; url: string }>;
  }>;
  getRenderSettings?: () => Promise<RenderSettings>;
  saveRenderSettings?: (settings: Partial<RenderSettings>) => Promise<{ success: boolean; settings?: RenderSettings; error?: string }>;
  concatAlurfilmFinalVideo: (
    parts: number[],
    opts?: {
      bgmPath?: string;
      bgmVolume?: number;
      logoPath?: string;
      logoOpacity?: number;
      logoMargin?: number;
      logoScale?: number;
    }
  ) => Promise<{
    filePath?: string;
    fileName?: string;
    mediaUrl?: string;
    error?: string;
  }>;
  getContentId: (mode?: string) => Promise<string | null>;
  generateAlurfilmMetadata: (opts?: { modeContentId?: string; model?: string; customNotes?: string }) => Promise<AlurfilmMetadataResult>;
  saveAlurfilmMetadata: (opts: { modeContentId?: string; metadata: AlurfilmMetadataResult }) => Promise<{ success: boolean; filePath: string; metadata: AlurfilmMetadataResult }>;
  getAlurfilmMetadata: (modeContentId?: string) => Promise<AlurfilmMetadataResult | null>;
  getBrowserUserProfiles?: () => Promise<string[]>;
  runAlurfilmGeminiScriptPipeline?: (opts: { partNum: number; totalChunks?: number; previousContext?: any; profileName?: string }) => Promise<{ success: boolean; partNum: number; rawText: string; extractedJson?: any; source?: string; error?: string }>;
  onAlurfilmProgress?: (callback: (data: { percent: number; step: string; message: string; partNum: number }) => void) => () => void;
  onAlurfilmLog?: (callback: (data: { level: 'info' | 'warn' | 'error'; message: string; partNum: number }) => void) => () => void;
  onAlurfilmMetadataChunk?: (callback: (data: { chunk: string; fullText: string }) => void) => () => void;
  renderAlurfilmIntroTest?: (opts: {
    titleText: string;
    subtitleText: string;
    audioPath?: string;
    impactTimestamp?: number;
    duration?: number;
    stylePreset?: 'cinematic_gold' | 'silver_epic' | 'neon_thriller';
    outputPath?: string;
  }) => Promise<{ success: boolean; outputPath: string; error?: string }>;
  getAlurfilmIntro?: (modeContentId?: string) => Promise<{ filePath: string; mediaUrl: string; fileName: string } | null>;
  onAlurfilmIntroProgress?: (callback: (data: { percent: number; msg?: string }) => void) => () => void;
  generateAlurfilmTestTtsWithSilence?: (scriptText: string) => Promise<{
    success: boolean;
    audioPath: string;
    audioUrl: string;
    totalDurationSec: number;
    segments: Array<{
      index: number;
      type: 'narration' | 'visual_only';
      text?: string | null;
      description?: string | null;
      startSec: number;
      endSec: number;
      durationSec: number;
    }>;
    error?: string;
  }>;

  runAlurfilmTestWhisperAlignment?: (audioPath?: string, scriptText?: string) => Promise<{
    success: boolean;
    isFasterWhisperUsed: boolean;
    totalDurationSec: number;
    items: Array<{
      sentence_index: number;
      type: 'narration' | 'visual_only';
      text: string;
      description?: string;
      start: number;
      end: number;
      duration: number;
      visuals: Array<{
        type: string;
        duration: number;
        source_start_seconds: number;
        color_grading_shift?: { contrast: number; brightness: number; saturation: number };
      }>;
    }>;
    error?: string;
  }>;
  onAlurfilmTestWhisperProgress?: (callback: (data: { stage: string; progress: number; message: string }) => void) => () => void;

  getMediaUrl?: (filePath: string) => string;
  resetProject: (mode?: string) => Promise<{ success: boolean; content_id?: string; error?: string }>;
  copyToClipboard: (text: string) => Promise<boolean>;
  saveToProject: (subPath: string, data: string) => Promise<boolean>;
  readFromProject: (subPath: string) => Promise<string | null>;
  generateShortsKeywords?: (opts?: { model?: string }) => Promise<{ success: boolean; keywords: any[]; activeHistory: any[] }>;
  renderVideo: (mapping: object, videoPath: string, audioPath?: string) => Promise<RenderResult | { error: string }>;
  onRenderProgress: (callback: (data: RenderProgress) => void) => () => void;
  generateYoutubeTitles: (transcriptText: string) => Promise<YoutubeTitleResult>;
  generateSpensiaTopics: (promptText: string, model?: string) => Promise<{ rawText: string; topics?: Array<{ id: number; title: string; summary: string }> | null; theme?: string | null }>;
  generateSpensiaScript: (promptText: string, model?: string) => Promise<{ rawText: string; scriptData?: any }>;
  generateSpensiaBreakdown: (promptText: string, model?: string) => Promise<{ rawText: string; breakdownData?: any }>;
  generateSpensiaImagePrompts: (promptText: string, model?: string) => Promise<{ rawText: string; imagePromptsData?: any }>;
  onSpensiaTopicsChunk: (callback: (data: { chunk: string; fullText: string }) => void) => () => void;
  onSpensiaScriptChunk: (callback: (data: { chunk: string; fullText: string }) => void) => () => void;
  onSpensiaBreakdownChunk: (callback: (data: { chunk: string; fullText: string }) => void) => () => void;
  onSpensiaImagePromptsChunk: (callback: (data: { chunk: string; fullText: string }) => void) => () => void;
  generateSpensiaSingleImage: (segmentId: number, prompt: string, model?: string, size?: string, quality?: string, imageDetail?: string, topicId?: number) => Promise<{ segmentId: number; topicId?: number; filePath: string; url: string; originalUrl?: string }>;
  generateSpensiaBatchImages: (items: Array<{ segment_id: number; prompt: string }>, model?: string, size?: string, quality?: string, imageDetail?: string, concurrency?: number, topicId?: number, keepOpen?: boolean) => Promise<Array<any>>;
  onSpensiaImageProgress: (callback: (data: { current: number; total: number; segmentId: number; topicId?: number; saved?: any; error?: string; status: string }) => void) => () => void;
  onSpensiaImageChunkStart: (callback: (data: { segmentIds: number[]; topicId?: number }) => void) => () => void;
  onSpensiaImageLog?: (callback: (data: { segmentId: number; workerId?: number; text: string }) => void) => () => void;
  uploadSpensiaVoAudio: (segmentId?: number, sourcePath?: string, bufferArray?: ArrayBuffer | number[], topicId?: number) => Promise<{ segmentId?: number; filename: string; filePath: string; url: string }>;
  mergeSpensiaVoAudio: (audioPaths: string[], topicId?: number) => Promise<{ filename: string; filePath: string; url: string; duration: number }>;
  runSpensiaFasterWhisperAlignment?: (data: { audioPath?: string; scriptText?: string; topicId?: number }) => Promise<{ success: boolean; jsonContent?: string; filePath?: string; error?: string }>;
  onSpensiaFasterWhisperProgress?: (callback: (data: { stage: string; progress: number; message: string; log?: string; topicId?: number }) => void) => () => void;

  // Spensia Render Engine & Thumbnail Studio
  generateSpensiaTimeline: (topicId?: number) => Promise<{ timeline?: SpensiaTimelineStructure; saved?: boolean; error?: string }>;
  getSpensiaRenderResult?: (topicId?: number) => Promise<SpensiaRenderResult | null>;
  renderSpensiaVideo: (config: SpensiaRenderConfig, timeline: SpensiaTimelineStructure, outputPath?: string, topicId?: number) => Promise<SpensiaRenderResult>;
  renderSpensiaPreviewFrame: (config: SpensiaRenderConfig, imagePath: string) => Promise<{ filePath?: string; url?: string; error?: string }>;

  // Thumbnail Studio & Publish Hub SEO
  generateSpensiaThumbnailPrompts?: (scriptContent?: string, topicTitle?: string, selectedTitle?: string, metadata?: SpensiaUploadMetadata | null, model?: string, topicId?: number) => Promise<{ concepts: SpensiaThumbnailConcept[] }>;
  onSpensiaThumbnailPromptsChunk?: (callback: (data: { chunk: string; fullText: string }) => void) => () => void;
  generateSpensiaThumbnailImages?: (concepts: SpensiaThumbnailConcept[], model?: string, size?: string, topicId?: number) => Promise<SpensiaThumbnailConcept[]>;
  onSpensiaThumbnailImageProgress?: (callback: (data: { current: number; total: number; conceptId: number; title: string; item?: SpensiaThumbnailConcept; error?: string; message: string; status: string }) => void) => () => void;
  getSpensiaThumbnails?: (topicId?: number) => Promise<SpensiaThumbnailResult>;
  saveSpensiaThumbnailSelection?: (selectedId: number, concept: SpensiaThumbnailConcept, topicId?: number) => Promise<any>;
  analyzeSpensiaThumbnailImages?: (topicTitle?: string, selectedTitle?: string, thumbnails?: SpensiaThumbnailConcept[], model?: string, topicId?: number) => Promise<SpensiaThumbnailVisionAnalysis>;

  generateSpensiaUploadMetadata?: (scriptContent?: string, topicTitle?: string, model?: string, topicId?: number) => Promise<SpensiaUploadMetadata>;
  onSpensiaUploadMetadataChunk?: (callback: (data: { chunk: string; fullText: string }) => void) => () => void;
  getSpensiaUploadMetadata?: (topicId?: number) => Promise<SpensiaUploadMetadata | null>;
  analyzeSpensiaMetadata?: (topicTitle?: string, metadata?: SpensiaUploadMetadata, model?: string, topicId?: number) => Promise<SpensiaMetadataAnalysis>;
  fixSpensiaMetadata?: (topicTitle?: string, metadata?: SpensiaUploadMetadata, analysis?: SpensiaMetadataAnalysis, model?: string, topicId?: number) => Promise<SpensiaUploadMetadata>;

  // Waku Core IPC Helpers
  generateWakuTopics: (promptText: string, model?: string) => Promise<{ rawText: string; topics?: Array<{ id: number; title: string; summary: string }> | null; theme?: string | null }>;
  generateWakuScript: (promptText: string, model?: string) => Promise<{ rawText: string; scriptData?: any }>;
  generateWakuBreakdown: (promptText: string, model?: string) => Promise<{ rawText: string; breakdownData?: any }>;
  generateWakuImagePrompts: (promptText: string, model?: string) => Promise<{ rawText: string; imagePromptsData?: any }>;
  onWakuTopicsChunk: (callback: (data: { chunk: string; fullText: string }) => void) => () => void;
  onWakuScriptChunk: (callback: (data: { chunk: string; fullText: string }) => void) => () => void;
  onWakuBreakdownChunk: (callback: (data: { chunk: string; fullText: string }) => void) => () => void;
  onWakuImagePromptsChunk: (callback: (data: { chunk: string; fullText: string }) => void) => () => void;
  generateWakuSingleImage: (segmentId: number, prompt: string, model?: string, size?: string, quality?: string, imageDetail?: string, topicId?: number) => Promise<{ segmentId: number; topicId?: number; filePath: string; url: string; originalUrl?: string }>;
  generateWakuBatchImages: (items: Array<{ segment_id: number; prompt: string }>, model?: string, size?: string, quality?: string, imageDetail?: string, concurrency?: number, topicId?: number, keepOpen?: boolean) => Promise<Array<any>>;
  onWakuImageProgress: (callback: (data: { current: number; total: number; segmentId: number; topicId?: number; saved?: any; error?: string; status: string }) => void) => () => void;
  onWakuImageChunkStart: (callback: (data: { segmentIds: number[]; topicId?: number }) => void) => () => void;
  onWakuImageLog?: (callback: (data: { segmentId: number; workerId?: number; text: string }) => void) => () => void;
  uploadWakuVoAudio: (segmentId?: number, sourcePath?: string, bufferArray?: ArrayBuffer | number[], topicId?: number) => Promise<{ segmentId?: number; filename: string; filePath: string; url: string }>;
  mergeWakuVoAudio: (audioPaths: string[], topicId?: number) => Promise<{ filename: string; filePath: string; url: string; duration: number }>;
  runWakuFasterWhisperAlignment?: (data: { audioPath?: string; scriptText?: string; topicId?: number }) => Promise<{ success: boolean; jsonContent?: string; filePath?: string; error?: string }>;
  onWakuFasterWhisperProgress?: (callback: (data: { stage: string; progress: number; message: string; log?: string; topicId?: number }) => void) => () => void;

  // Waku Render Engine & Thumbnail Studio
  generateWakuTimeline: (topicId?: number) => Promise<{ timeline?: WakuTimelineStructure; saved?: boolean; error?: string }>;
  getWakuRenderResult?: (topicId?: number) => Promise<WakuRenderResult | null>;
  renderWakuVideo: (config: WakuRenderConfig, timeline: WakuTimelineStructure, outputPath?: string, topicId?: number) => Promise<WakuRenderResult>;
  renderWakuPreviewFrame: (config: WakuRenderConfig, imagePath: string) => Promise<{ filePath?: string; url?: string; error?: string }>;

  // Thumbnail Studio & Publish Hub SEO
  generateWakuThumbnailPrompts?: (scriptContent?: string, topicTitle?: string, selectedTitle?: string, metadata?: WakuUploadMetadata | null, model?: string, topicId?: number) => Promise<{ concepts: WakuThumbnailConcept[] }>;
  onWakuThumbnailPromptsChunk?: (callback: (data: { chunk: string; fullText: string }) => void) => () => void;
  generateWakuThumbnailImages?: (concepts: WakuThumbnailConcept[], model?: string, size?: string, topicId?: number) => Promise<WakuThumbnailConcept[]>;
  onWakuThumbnailImageProgress?: (callback: (data: { current: number; total: number; conceptId: number; title: string; item?: WakuThumbnailConcept; error?: string; message: string; status: string }) => void) => () => void;
  getWakuThumbnails?: (topicId?: number) => Promise<WakuThumbnailResult>;
  saveWakuThumbnailSelection?: (selectedId: number, concept: WakuThumbnailConcept, topicId?: number) => Promise<any>;
  analyzeWakuThumbnailImages?: (topicTitle?: string, selectedTitle?: string, thumbnails?: WakuThumbnailConcept[], model?: string, topicId?: number) => Promise<WakuThumbnailVisionAnalysis>;

  generateWakuUploadMetadata?: (scriptContent?: string, topicTitle?: string, model?: string, topicId?: number) => Promise<WakuUploadMetadata>;
  onWakuUploadMetadataChunk?: (callback: (data: { chunk: string; fullText: string }) => void) => () => void;
  getWakuUploadMetadata?: (topicId?: number) => Promise<WakuUploadMetadata | null>;
  analyzeWakuMetadata?: (topicTitle?: string, metadata?: WakuUploadMetadata, model?: string, topicId?: number) => Promise<WakuMetadataAnalysis>;
  fixWakuMetadata?: (topicTitle?: string, metadata?: WakuUploadMetadata, analysis?: WakuMetadataAnalysis, model?: string, topicId?: number) => Promise<WakuUploadMetadata>;
}

export type WakuRenderConfig = SpensiaRenderConfig;
export type WakuRenderResult = SpensiaRenderResult;
export type WakuTimelineStructure = SpensiaTimelineStructure;
export type WakuThumbnailConcept = SpensiaThumbnailConcept;
export type WakuThumbnailVisionEvaluation = SpensiaThumbnailVisionEvaluation;
export type WakuThumbnailVisionAnalysis = SpensiaThumbnailVisionAnalysis;
export type WakuThumbnailResult = SpensiaThumbnailResult;
export type WakuUploadTitleItem = SpensiaUploadTitleItem;
export type WakuMetadataImprovementItem = SpensiaMetadataImprovementItem;
export type WakuMetadataAnalysis = SpensiaMetadataAnalysis;
export type WakuUploadMetadata = SpensiaUploadMetadata;

export interface WatermarkTextConfig {
  enabled: boolean;
  text: string;
  fontFamily: string;
  fontSize: number;
  colorHex: string;
  opacity: number;
  position: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  offsetX: number;
  offsetY: number;
}

export interface CaptionConfig {
  enabled: boolean;
  fontName: string;
  fontSize: number;
  activeColorHex: string;
  inactiveColorHex: string;
  outlineColorHex: string;
  outlineWidth: number;
  shadowDistance: number;
  positionY: number;
  positionX: number;
  alignment: number;
  displayMode: 'single-word' | 'phrase' | 'sentence';
  timeOffsetSec: number;
}

export interface BgmConfig {
  enabled: boolean;
  path: string;
  volume: number;
  fadeInSec: number;
  fadeOutSec: number;
}

export interface VignetteConfig {
  enabled: boolean;
  intensity: number;
  colorHex: string;
}

export interface VoiceOverConfig {
  enabled: boolean;
  volume: number;
}

export interface SpensiaRenderConfig {
  voiceOver?: VoiceOverConfig;
  watermark: WatermarkTextConfig;
  caption: CaptionConfig;
  bgm: BgmConfig;
  vignette: VignetteConfig;
  resolution: { width: number; height: number };
  fps: number;
  outputQuality: 'fast' | 'balanced' | 'high';
}

export interface SpensiaRenderResult {
  outputPath?: string;
  mediaUrl?: string;
  fileName?: string;
  error?: string;
}

export interface SpensiaTimelineStructure {
  title: string;
  fps: number;
  resolution: { width: number; height: number; aspect_ratio: string };
  total_duration_sec: number;
  total_frames: number;
  audio_tracks: Array<{ track: string; part_id: number; filePath?: string; url?: string; start_sec: number; end_sec: number; duration_sec: number }>;
  video_clips: Array<{ clip_id: number; segment_id: number; part_id: number; quote: string; image_path?: string; image_url?: string; start_sec: number; end_sec: number; duration_sec: number; start_frame: number; end_frame: number; duration_frames: number; transition: string }>;
  captions: Array<{ part_id: number; word: string; start_sec: number; end_sec: number }>;
  generated_at: string;
}

export interface SpensiaThumbnailConcept {
  id: number;
  title: string;
  text_overlay: string;
  badge_text?: string;
  viral_score: number;
  viral_reason: string;
  prompt: string;
  filePath?: string;
  url?: string;
  error?: string;
}

export interface SpensiaThumbnailVisionEvaluation {
  id: number;
  title: string;
  thumb_stopping_score?: number;
  strengths?: string;
  weaknesses?: string;
  scrolling_impact?: string;
}

export interface SpensiaThumbnailVisionAnalysis {
  winner_id?: number;
  winner_title?: string;
  winner_reason?: string;
  human_scrolling_psychology_notes?: string;
  evaluations?: SpensiaThumbnailVisionEvaluation[];
}

export interface SpensiaThumbnailResult {
  concepts: SpensiaThumbnailConcept[];
  rendered: SpensiaThumbnailConcept[];
  selected?: { selectedId: number; concept: SpensiaThumbnailConcept } | null;
  visionAnalysis?: SpensiaThumbnailVisionAnalysis | null;
}

export interface SpensiaUploadTitleItem {
  title: string;
  ctr_score?: number;
  ctr_reason?: string;
}

export interface SpensiaMetadataImprovementItem {
  target_field: 'tags' | 'titles' | 'description' | 'hashtags' | string;
  reason: string;
  suggested_fix_instruction: string;
}

export interface SpensiaMetadataAnalysis {
  superior_title?: string;
  superior_reason?: string;
  what_is_great?: string;
  areas_to_improve?: string;
  improvements_needed?: SpensiaMetadataImprovementItem[];
  psychological_analysis?: string;
  doom_scroll_impact?: string;
  metadata_checklist?: {
    doom_scroll_stopper?: boolean;
    title_length?: boolean;
    psychological_formula?: boolean;
    description_hook?: boolean;
    seo_completeness?: boolean;
  };
}

export interface SpensiaUploadMetadata {
  titles: (string | SpensiaUploadTitleItem)[];
  recommended_title?: string;
  description: string;
  tags: string[];
  hashtags: string[];
  analysis?: SpensiaMetadataAnalysis;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
