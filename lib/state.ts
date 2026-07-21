// lib/state.ts
import fs from 'fs';
import path from 'path';

export interface ResourcePaths {
  video_source?: string;      // Raw source video (e.g. input/assets/WV-20260721-79BF_video_source.mp4)
  video_trimmed?: string;     // Trimmed video asset (e.g. input/assets/WV-20260721-79BF_video_trimmed.mp4)
  audio_source?: string;      // Extracted audio asset (e.g. input/assets/WV-20260721-79BF_audio_source.mp3)
  analysis_result?: string;   // AI response output (e.g. input/assets/WV-20260721-79BF_analysis_result.json)
  transcript_result?: string; // Transcript JSON (e.g. input/transcript.json)
  rendered_video?: string;    // Final output video (e.g. output/WV-20260721-79BF_final.mp4)
}

export interface ProjectState {
  content_id: string;
  created_at: string;
  updated_at: string;
  drive_search_query: string; // File name search query without extension (e.g. WV-20260721-79BF_video_trimmed)
  resources: ResourcePaths;
}

const STATE_FILE_PATH = path.resolve(process.cwd(), 'input/state.json');
const MAPPING_FILE_PATH = path.resolve(process.cwd(), 'input/mapping.json');

/**
 * Generate standardized unique resource filename: [unique_id]_[resource_type].[ext]
 * Example: WV-20260721-79BF_video_trimmed.mp4
 */
export function getStandardFileName(contentId: string, resourceType: string, ext: string = 'mp4'): string {
  const cleanExt = ext.startsWith('.') ? ext.slice(1) : ext;
  return `${contentId}_${resourceType}.${cleanExt}`;
}

/**
 * Load active project state from input/state.json.
 * Auto-initializes from input/mapping.json or creates fallback if not present.
 */
export function loadProjectState(): ProjectState {
  let contentId = `WV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  if (fs.existsSync(MAPPING_FILE_PATH)) {
    try {
      const mapping = JSON.parse(fs.readFileSync(MAPPING_FILE_PATH, 'utf-8'));
      if (mapping?.settings?.content_id) {
        contentId = mapping.settings.content_id;
      }
    } catch {}
  }

  let state: ProjectState = {
    content_id: contentId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    drive_search_query: `${contentId}_video_trimmed`,
    resources: {},
  };

  if (fs.existsSync(STATE_FILE_PATH)) {
    try {
      const content = fs.readFileSync(STATE_FILE_PATH, 'utf-8');
      const loaded = JSON.parse(content) as ProjectState;
      if (loaded.content_id) {
        state = loaded;
        if (contentId) state.content_id = contentId;
      }
    } catch (e: any) {
      console.warn(`⚠️ Warning reading state.json: ${e.message}`);
    }
  }

  // Ensure drive_search_query has NO extension
  state.drive_search_query = `${state.content_id}_video_trimmed`;

  // Auto-scan input/assets for matching resource files
  const assetsDir = path.resolve(process.cwd(), 'input/assets');
  if (fs.existsSync(assetsDir)) {
    const files = fs.readdirSync(assetsDir);

    const trimmedFile = files.find((f) => f.includes(`${state.content_id}_video_trimmed`));
    if (trimmedFile) {
      state.resources.video_trimmed = `input/assets/${trimmedFile}`;
    }

    const sourceFile = files.find((f) => f.includes(`${state.content_id}_video_source`));
    if (sourceFile) {
      state.resources.video_source = `input/assets/${sourceFile}`;
    }

    const audioFile = files.find((f) => f.includes(`${state.content_id}_audio_source`));
    if (audioFile) {
      state.resources.audio_source = `input/assets/${audioFile}`;
    }

    const analysisFile = files.find((f) => f.includes(`${state.content_id}_analysis_result`));
    if (analysisFile) {
      state.resources.analysis_result = `input/assets/${analysisFile}`;
    }
  }

  saveProjectState(state);
  return state;
}

/**
 * Save project state to input/state.json
 */
export function saveProjectState(state: ProjectState): void {
  state.updated_at = new Date().toISOString();
  state.drive_search_query = `${state.content_id}_video_trimmed`;

  const dir = path.dirname(STATE_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(STATE_FILE_PATH, JSON.stringify(state, null, 2), 'utf-8');
}

/**
 * Helper to update a single resource path in state.json
 */
export function updateStateResource(resourceType: keyof ResourcePaths, filePath: string): ProjectState {
  const state = loadProjectState();
  state.resources[resourceType] = filePath;
  saveProjectState(state);
  return state;
}
