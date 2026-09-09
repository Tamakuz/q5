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
  generateAlurfilmAutoIntro?: (contentId?: string, clipDurationPerPart?: number) => Promise<{ success: boolean; chunk?: AlurfilmChunk; videoPath?: string; error?: string }>;
  onAlurfilmAutoIntroProgress?: (callback: (data: { step: number; totalSteps: number; percent: number; message: string }) => void) => () => void;
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
    opts?: Partial<RenderSettings> & {
      introFilePath?: string;
      [key: string]: any;
    }
  ) => Promise<{
    filePath?: string;
    fileName?: string;
    mediaUrl?: string;
    error?: string;
  }>;
  getAlurfilmImageReadyPrompt: (opts?: { modeContentId?: string; customNotes?: string; promptType?: 'q5' | 'q5asia' }) => Promise<string>;
  generateAlurfilmMetadata: (opts?: { modeContentId?: string; model?: string; customNotes?: string; promptType?: 'q5' | 'q5asia' }) => Promise<AlurfilmMetadataResult>;
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
  onAlurfilmIntroProgress?: (callback: (data: { percent?: number; percentage?: number; totalSize?: string; speed?: string; msg?: string }) => void) => () => void;
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
  // Generic project file helpers
  getContentId: (mode?: string) => Promise<string | null>;
  resetProject: (mode?: string) => Promise<{ success: boolean; content_id?: string; error?: string }>;
  copyToClipboard: (text: string) => Promise<boolean>;
  saveToProject: (subPath: string, data: string) => Promise<boolean>;
  readFromProject: (subPath: string) => Promise<string | null>;
  renderVideo: (mapping: object, videoPath: string, audioPath?: string) => Promise<RenderResult | { error: string }>;
  onRenderProgress: (callback: (data: RenderProgress) => void) => () => void;
  generateYoutubeTitles: (transcriptText: string) => Promise<YoutubeTitleResult>;
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

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
