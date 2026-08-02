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
}

export interface AlurfilmSplitProgressPayload {
  status: 'start' | 'splitting' | 'chunk_completed' | 'done';
  currentPart: number;
  totalParts: number;
  chunk?: AlurfilmChunk;
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
  pan_direction?: 'left' | 'right' | 'up' | 'down';
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

export interface ElectronAPI {
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
  analyzeAlurfilmChunk: (chunkPath: string, chunkPart: number, previousContext?: any) => Promise<AlurfilmAnalysisResult>;
  listAlurfilmAnalyses: (modeContentId?: string) => Promise<AlurfilmAnalysisResult[]>;
  getAlurfilmPrompt: (chunkPart: number, totalChunks?: number, previousContext?: any) => Promise<string>;
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
    mappingData: any
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
  resetProject: (mode?: string) => Promise<{ success: boolean; content_id?: string; error?: string }>;
  copyToClipboard: (text: string) => Promise<boolean>;
  saveToProject: (subPath: string, data: string) => Promise<boolean>;
  readFromProject: (subPath: string) => Promise<string | null>;
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
  generateSpensiaBatchImages: (items: Array<{ segment_id: number; prompt: string }>, model?: string, size?: string, quality?: string, imageDetail?: string, concurrency?: number, topicId?: number) => Promise<Array<any>>;
  onSpensiaImageProgress: (callback: (data: { current: number; total: number; segmentId: number; topicId?: number; saved?: any; error?: string; status: string }) => void) => () => void;
  onSpensiaImageChunkStart: (callback: (data: { segmentIds: number[]; topicId?: number }) => void) => () => void;
  onSpensiaImageLog?: (callback: (data: { segmentId: number; workerId?: number; text: string }) => void) => () => void;
  uploadSpensiaVoAudio: (segmentId?: number, sourcePath?: string, bufferArray?: ArrayBuffer | number[], topicId?: number) => Promise<{ segmentId?: number; filename: string; filePath: string; url: string }>;
  mergeSpensiaVoAudio: (audioPaths: string[], topicId?: number) => Promise<{ filename: string; filePath: string; url: string; duration: number }>;

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
}

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
  displayMode: 'single-word' | 'phrase';
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
