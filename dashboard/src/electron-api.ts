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
  filePath: string;
  url: string;
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
  splitAlurfilmVideo: (masterPath: string, startTime: string | number, endTime: string | number) => Promise<AlurfilmChunk[]>;
  listAlurfilmChunks: (modeContentId?: string) => Promise<AlurfilmChunk[]>;
  analyzeAlurfilmChunk: (chunkPath: string, chunkPart: number, previousContext?: any) => Promise<AlurfilmAnalysisResult>;
  listAlurfilmAnalyses: (modeContentId?: string) => Promise<AlurfilmAnalysisResult[]>;
  getAlurfilmPrompt: (chunkPart: number, totalChunks?: number, previousContext?: any) => Promise<string>;
  saveAlurfilmAnalysis: (chunkPart: number, jsonText: string) => Promise<AlurfilmAnalysisResult>;
  uploadAlurfilmAudio: (part: number, filePath: string) => Promise<AlurfilmAudioResult>;
  listAlurfilmAudios: (modeContentId?: string) => Promise<AlurfilmAudioResult[]>;
  deleteAlurfilmAudio: (part: number) => Promise<boolean>;
  getAlurfilmTranscriptPrompt: (chunkPart: number, totalChunks?: number) => Promise<string>;
  saveAlurfilmTranscript: (chunkPart: number, jsonText: string) => Promise<AlurfilmTranscriptResult>;
  listAlurfilmTranscripts: (modeContentId?: string) => Promise<AlurfilmTranscriptResult[]>;
  getContentId: (mode?: string) => Promise<string | null>;
  resetProject: (mode?: string) => Promise<{ success: boolean; content_id?: string; error?: string }>;
  copyToClipboard: (text: string) => Promise<boolean>;
  saveToProject: (subPath: string, data: string) => Promise<boolean>;
  readFromProject: (subPath: string) => Promise<string | null>;
  renderVideo: (mapping: object, videoPath: string, audioPath?: string) => Promise<RenderResult | { error: string }>;
  onRenderProgress: (callback: (data: RenderProgress) => void) => () => void;
  generateYoutubeTitles: (transcriptText: string) => Promise<YoutubeTitleResult>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
