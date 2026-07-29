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
  part: number;
  name: string;
  filePath: string;
  url: string;
  mediaUrl?: string;
  size: number;
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
  name: string;
  filePath: string;
  data: AlurfilmTranscriptEntry[];
  entries?: AlurfilmTranscriptEntry[];
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
  splitAlurfilmMasterRange: (masterPath: string, startSec: number, durationSec: number, partNum: number) => Promise<{ chunks: AlurfilmChunk[]; content_id?: string }>;
  listAlurfilmChunks: (modeContentId?: string) => Promise<AlurfilmChunk[]>;
  deleteAlurfilmChunk: (part: number) => Promise<boolean>;
  analyzeAlurfilmChunk: (chunkPath: string, chunkPart: number, previousContext?: any) => Promise<AlurfilmAnalysisResult>;
  listAlurfilmAnalyses: (modeContentId?: string) => Promise<AlurfilmAnalysisResult[]>;
  getAlurfilmPrompt: (chunkPart: number, totalChunks?: number, previousContext?: any) => Promise<string>;
  saveAlurfilmAnalysis: (contentIdOrPart: string | number, partOrData?: number | any, jsonTextOrPart?: any) => Promise<AlurfilmAnalysisResult>;
  uploadAlurfilmAudio: (contentIdOrPart: string | number, partOrFilePath?: number | string, filePath?: string) => Promise<AlurfilmAudioResult>;
  listAlurfilmAudios: (modeContentId?: string) => Promise<AlurfilmAudioResult[]>;
  deleteAlurfilmAudio: (part: number) => Promise<boolean>;
  getAlurfilmTranscriptPrompt: (chunkPart: number, totalChunks?: number) => Promise<string>;
  saveAlurfilmTranscript: (contentIdOrPart: string | number, partOrData?: number | any, jsonTextOrPart?: any) => Promise<AlurfilmTranscriptResult>;
  listAlurfilmTranscripts: (modeContentId?: string) => Promise<AlurfilmTranscriptResult[]>;
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
  generateSpensiaSingleImage: (segmentId: number, prompt: string, model?: string, size?: string, quality?: string, imageDetail?: string) => Promise<{ segmentId: number; filePath: string; url: string; originalUrl?: string }>;
  generateSpensiaBatchImages: (items: Array<{ segment_id: number; prompt: string }>, model?: string, size?: string, quality?: string, imageDetail?: string, concurrency?: number) => Promise<Array<any>>;
  onSpensiaImageProgress: (callback: (data: { current: number; total: number; segmentId: number; saved?: any; error?: string; status: string }) => void) => () => void;
  onSpensiaImageChunkStart: (callback: (data: { segmentIds: number[] }) => void) => () => void;
  uploadSpensiaVoAudio: (segmentId?: number, sourcePath?: string, bufferArray?: ArrayBuffer | number[]) => Promise<{ segmentId?: number; filename: string; filePath: string; url: string }>;
  mergeSpensiaVoAudio: (audioPaths: string[]) => Promise<{ filename: string; filePath: string; url: string; duration: number }>;
  runWhisperxTranscribe: (audioPath: string, model?: string, language?: string, device?: string, computeType?: string) => Promise<{ success: boolean; transcriptData?: any }>;
  onWhisperxProgress: (callback: (data: { audioPath?: string; logText: string }) => void) => () => void;

  // Spensia Render Engine
  generateSpensiaTimeline: () => Promise<{ timeline?: SpensiaTimelineStructure; saved?: boolean; error?: string }>;
  getSpensiaRenderResult?: () => Promise<SpensiaRenderResult | null>;
  renderSpensiaVideo: (config: SpensiaRenderConfig, timeline: SpensiaTimelineStructure, outputPath?: string) => Promise<SpensiaRenderResult>;
  renderSpensiaPreviewFrame: (config: SpensiaRenderConfig, imagePath: string) => Promise<{ filePath?: string; url?: string; error?: string }>;
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

export interface SpensiaRenderConfig {
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

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
