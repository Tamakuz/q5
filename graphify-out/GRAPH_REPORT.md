# Graph Report - .  (2026-07-31)

## Corpus Check
- 107 files · ~119,604 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 608 nodes · 904 edges · 40 communities (38 shown, 2 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 45 edges (avg confidence: 0.75)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Playwright Browser Automation
- Spensia Pipeline Validation
- Electron Main Process
- Root Package Configuration
- Spensia AI Strategy & Prompts
- Dashboard Build Toolchain
- Root TypeScript Config
- Dashboard Package Config
- Electron IPC Type Definitions
- Spensia Render UI Config
- Dashboard TypeScript Config
- Design Docs & Architecture Plans
- Root Runtime Dependencies
- Transcript Processing Pipeline
- Spensia Render Config Schemas
- Alurfilm Audio & Mapping Steps
- FFmpeg Render CLI
- Subtitle & Timeline Generation
- App Shell & Status Bar
- AI Client Integration
- Navigation & Layout Components
- Alurfilm Mapping Validation
- Alurfilm FFmpeg Render Engine
- Workflow Header Navigation
- Spensia Thumbnail Generation
- Project State Management
- Alurfilm Script Analysis
- Shortform Build & Selection
- Shortform Script Analysis
- Shortform Render Engine
- Visual Mapping Prompt Concepts
- Spensia Image Generation
- Alurfilm Video Splitting
- Transcription Prompt Concepts
- YouTube Shorts SEO Strategy
- Brand Assets
- Electron Preload Bridge

## God Nodes (most connected - your core abstractions)
1. `scripts` - 16 edges
2. `compilerOptions` - 13 edges
3. `compilerOptions` - 12 edges
4. `createFlowProjectAction()` - 11 edges
5. `config` - 11 edges
6. `PlaywrightService` - 10 edges
7. `AlurfilmChunk` - 8 edges
8. `formatMinute()` - 8 edges
9. `launchBrowser()` - 8 edges
10. `runBatchPersistentQueue()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `Dalang Digital — Faceless YouTube 100 Juta Blueprint` --conceptually_related_to--> `Remotion Auto-Content Foundation (Programmatic Render Backend)`  [INFERRED]
  BLUEPRINT YOUTUBE FACELESS 100 JUTA - DALANG DIGITAL UPDATED.pdf → docs/superpowers/plans/2026-07-19-remotion-auto-content-foundation.md
- `Dalang Digital — Faceless YouTube 100 Juta Blueprint` --conceptually_related_to--> `Macro Storytelling & Contextual Processing (Alurfilm)`  [INFERRED]
  BLUEPRINT YOUTUBE FACELESS 100 JUTA - DALANG DIGITAL UPDATED.pdf → dashboard/prompts/longform/alurfilm-singlepass-prompt.md
- `Spensia FFmpeg Render Engine` --semantically_similar_to--> `Remotion Auto-Content Foundation (Programmatic Render Backend)`  [INFERRED] [semantically similar]
  plans/2026-07-27-spensia-render-ffmpeg.md → docs/superpowers/plans/2026-07-19-remotion-auto-content-foundation.md
- `YouTube CTR & Viral Thumbnail Strategist` --semantically_similar_to--> `Spensia Thumbnail Prompt Generator (Markdown variant)`  [INFERRED] [semantically similar]
  dashboard/electron/prompts/thumbnail_prompts_system.txt → dashboard/prompts/spensia/thumbnail-prompts-generator-prompt.md
- `YouTube Data & Content Strategist — Topic Ideation & Validation` --semantically_similar_to--> `YouTube Data & Content Strategist — Demand Keyphrase Research`  [INFERRED] [semantically similar]
  dashboard/prompts/spensia/topics-prompt.md → dashboard/prompts/spensia/demand-keyphrases-prompt.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Spensia Faceless Video Production Pipeline** — dashboard_prompts_spensia_topics_prompt_topicstrategist, dashboard_prompts_spensia_demand_keyphrases_prompt_keyphrasestrategist, dashboard_prompts_spensia_script_prompt_scriptwriter, dashboard_prompts_spensia_breakdown_prompt_storyboardagent, dashboard_prompts_spensia_audio_mapping_prompt_audioaligner, dashboard_prompts_spensia_image_prompt_generator_prompt_imagepromptgenerator, dashboard_electron_prompts_upload_metadata_system_seogrowthspecialist, dashboard_electron_prompts_analyze_metadata_system_doomscrollingstrategist, dashboard_electron_prompts_fix_metadata_system_seooptimizer, dashboard_electron_prompts_thumbnail_prompts_system_thumbnailstrategist, dashboard_electron_prompts_analyze_thumbnails_vision_system_eyetrackingexpert [INFERRED 0.95]
- **Psychological Title Formula Triad** — curiosity_gap_formula, underdog_angle_formula, kontradiksi_formula [EXTRACTED 1.00]
- **Longform Movie Recap Pipeline: Script -> Transcript -> Visual Mapping** — dashboard_prompts_longform_alurfilm_singlepass_prompt_macro_storytelling, dashboard_prompts_longform_alurfilm_transcript_prompt_precision_transcription, dashboard_prompts_longform_alurfilm_mapping_prompt_visual_vo_synchronization [EXTRACTED 1.00]
- **Shortform Content Pipeline: Script Analysis -> Transcript -> Visual Mapping -> Viral Optimization** — dashboard_prompts_shortform_analysis_prompt_gen_z_storyteller, dashboard_prompts_shortform_transcript_prompt_shortform_transcription, dashboard_prompts_shortform_mapping_prompt_vertical_visual_mapping, dashboard_prompts_shortform_youtube_shorts_prompt_growth_hacker [EXTRACTED 1.00]
- **Content-Auto Full Toolchain: Remotion Engine + Dashboard UI + Spensia FFmpeg Render** — docs_superpowers_plans_2026_07_19_remotion_auto_content_foundation_remotion_engine, docs_superpowers_plans_2026_07_19_dashboard_foundation_dashboard_spa, plans_2026_07_27_spensia_render_ffmpeg_spensia_render_engine [INFERRED 0.85]

## Communities (40 total, 2 thin omitted)

### Community 0 - "Playwright Browser Automation"
Cohesion: 0.07
Nodes (54): AuthStatus, checkAuthStatus(), SaveSessionOptions, saveSessionState(), createFlowProjectAction(), CreateProjectResult, extractProjectIdFromUrl(), GeneratedImageResult (+46 more)

### Community 1 - "Spensia Pipeline Validation"
Cohesion: 0.06
Nodes (47): BatchTopicItem, MODEL_OPTIONS, SpensiaBreakdownStep(), BatchTopicItem, MODEL_OPTIONS, SpensiaImagePromptStep(), BatchTopicItem, DURATION_PRESETS (+39 more)

### Community 2 - "Electron Main Process"
Cohesion: 0.06
Nodes (35): aiClient, ALURFILM_CHUNKS_DIR, ALURFILM_DIR, { app, BrowserWindow, ipcMain, dialog, protocol }, assTime(), buildAssSubtitleFile(), cleanPunct(), ffmpegBin (+27 more)

### Community 3 - "Root Package Configuration"
Cohesion: 0.06
Nodes (33): description, devDependencies, @remotion/cli, tsx, @types/react, @types/react-dom, typescript, @types/react (+25 more)

### Community 4 - "Spensia AI Strategy & Prompts"
Cohesion: 0.12
Nodes (25): Curiosity Gap Psychological Formula, Dalang Digital Blueprint — YouTube Faceless 100 Juta (Bab 4), YouTube SEO, CTR & Indonesian Doom-Scrolling Psychological Strategist, YouTube Eye-Tracking & Human Doom-Scrolling Behavioral Expert, YouTube SEO Optimization Specialist (Metadata Fixer), YouTube CTR & Viral Thumbnail Strategist, YouTube SEO & Growth Specialist (Metadata Generator), Content Auto Dashboard (+17 more)

### Community 5 - "Dashboard Build Toolchain"
Cohesion: 0.09
Nodes (23): autoprefixer, concurrently, devDependencies, autoprefixer, concurrently, electron, postcss, tailwindcss (+15 more)

### Community 6 - "Root TypeScript Config"
Cohesion: 0.09
Nodes (21): cli.ts, dist, node_modules, output, remotion.config.ts, compilerOptions, declaration, esModuleInterop (+13 more)

### Community 7 - "Dashboard Package Config"
Cohesion: 0.10
Nodes (20): dependencies, @ffmpeg-installer/ffmpeg, @ffprobe-installer/ffprobe, react, react-dom, react, react-dom, main (+12 more)

### Community 8 - "Electron IPC Type Definitions"
Cohesion: 0.10
Nodes (20): AlurfilmAnalysisData, AlurfilmMappingData, AlurfilmRenderResult, AlurfilmSentenceMapping, AlurfilmTranscriptEntry, AlurfilmVisualClip, CaptionConfig, ElectronAPI (+12 more)

### Community 9 - "Spensia Render UI Config"
Cohesion: 0.12
Nodes (11): BatchTopicItem, POSITION_OPTIONS, PreviewCanvas(), QUALITY_OPTIONS, scale(), BgmConfig, SpensiaRenderConfig, SpensiaRenderResult (+3 more)

### Community 10 - "Dashboard TypeScript Config"
Cohesion: 0.11
Nodes (17): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+9 more)

### Community 11 - "Design Docs & Architecture Plans"
Cohesion: 0.12
Nodes (17): Dalang Digital — Faceless YouTube 100 Juta Blueprint, Causality-Driven Scriptwriting (Sebab-Akibat), Macro Storytelling & Contextual Processing (Alurfilm), TTS Neutral & Familiar Language Style (Formal-Santai Dewasa), Macro Storytelling & Contextual Processing (Generic), Gen Z Shortform Storyteller Persona, TTS-Friendly Writing Rules (Punctuation Precision, No Pacing Tags), Dashboard Foundation SPA (React + Vite + Tailwind) (+9 more)

### Community 12 - "Root Runtime Dependencies"
Cohesion: 0.12
Nodes (17): commander, dependencies, commander, playwright, react, react-dom, remotion, @remotion/bundler (+9 more)

### Community 13 - "Transcript Processing Pipeline"
Cohesion: 0.27
Nodes (14): AlurfilmTranscriptStep(), normalizeEntry(), NormalizedTranscriptEntry, normalizeEntry(), ShortformTranscriptStep(), ShortformTranscriptStepProps, autoFixTranscript(), formatMinute() (+6 more)

### Community 14 - "Spensia Render Config Schemas"
Cohesion: 0.14
Nodes (15): SpensiaRenderStep(), BgmConfig, BgmConfigSchema, CaptionConfig, CaptionConfigSchema, getDefaultSpensiaRenderConfig(), SpensiaRenderConfig, SpensiaRenderConfigSchema (+7 more)

### Community 15 - "Alurfilm Audio & Mapping Steps"
Cohesion: 0.17
Nodes (11): MediaPreviewDrawer(), MediaPreviewDrawerProps, AlurfilmAudioStep(), AlurfilmMappingStep(), AlurfilmRenderStep(), AlurfilmAudioResult, AlurfilmChunk, AlurfilmMappingResult (+3 more)

### Community 16 - "FFmpeg Render CLI"
Cohesion: 0.15
Nodes (9): CaptionChunk, cleanPunctuation(), Clip, ClipSchema, generateCaptionChunks(), Mapping, MappingSchema, program (+1 more)

### Community 17 - "Subtitle & Timeline Generation"
Cohesion: 0.20
Nodes (12): CaptionStyleOptions, cleanPunctuation(), formatAssTime(), generateAssSubtitles(), hexToAssColor(), cleanWordForMatch(), generateSpensiaTimeline(), GenerateTimelineParams (+4 more)

### Community 18 - "App Shell & Status Bar"
Cohesion: 0.19
Nodes (9): App(), SHORTFORM_PLACEHOLDERS, Status, STATUS_CONFIG, StatusBar(), StatusBarProps, ShortformUploadStep(), ShortformUploadStepProps (+1 more)

### Community 19 - "AI Client Integration"
Cohesion: 0.29
Nodes (9): chatCompletion(), generateSpensiaBreakdown(), generateSpensiaImagePrompts(), generateSpensiaScript(), generateSpensiaTopics(), generateYoutubeTitles(), resolveModelName(), streamChatCompletion() (+1 more)

### Community 20 - "Navigation & Layout Components"
Cohesion: 0.22
Nodes (9): ContentMode, LONGFORM_STEPS, SHORTFORM_STEPS, Sidebar(), SidebarProps, SPENSIA_STEPS, Step, TopBar() (+1 more)

### Community 21 - "Alurfilm Mapping Validation"
Cohesion: 0.24
Nodes (9): AlurfilmMappingData, autoFixAlurfilmMapping(), MappingIssueType, MappingValidationIssue, MappingValidationReport, SentenceMapping, VALID_VISUAL_TYPES, validateAlurfilmMapping() (+1 more)

### Community 22 - "Alurfilm FFmpeg Render Engine"
Cohesion: 0.20
Nodes (7): AlurfilmMapping, AlurfilmMappingSchema, FlattenedClip, program, require, SentenceMappingSchema, VisualClipSchema

### Community 23 - "Workflow Header Navigation"
Cohesion: 0.28
Nodes (7): StepProps, StepId, LONGFORM_STEPS, SHORTFORM_STEPS, SPENSIA_STEPS, StepItem, WorkflowHeaderProps

### Community 24 - "Spensia Thumbnail Generation"
Cohesion: 0.22
Nodes (8): BatchTopicItem, IMAGE_MODELS, RESOLUTION_OPTIONS, SpensiaThumbnailStep(), TEXT_MODELS, SpensiaThumbnailConcept, SpensiaThumbnailResult, SpensiaUploadMetadata

### Community 25 - "Project State Management"
Cohesion: 0.31
Nodes (7): loadProjectState(), MAPPING_FILE_PATH, ProjectState, ResourcePaths, saveProjectState(), STATE_FILE_PATH, updateStateResource()

### Community 26 - "Alurfilm Script Analysis"
Cohesion: 0.32
Nodes (6): AlurfilmAnalyzeStep(), AlurfilmAnalysisResult, AlurfilmAnalysisData, ScriptValidationIssue, ScriptValidationReport, validateScriptAnalysis()

### Community 27 - "Shortform Build & Selection"
Cohesion: 0.39
Nodes (7): formatDuration(), formatDurationShort(), formatResolution(), formatSize(), SelectionState, ShortformBuildStep(), ShortformBuildStepProps

### Community 28 - "Shortform Script Analysis"
Cohesion: 0.29
Nodes (6): AnalysisResult, ScriptBlock, ShortformAnalyzeStep(), ShortformAnalyzeStepProps, TranscriptEntry, AudioInfo

### Community 29 - "Shortform Render Engine"
Cohesion: 0.29
Nodes (5): MappingBlock, MappingTimeline, ShortformRenderStep(), ShortformRenderStepProps, TranscriptEntry

### Community 30 - "Visual Mapping Prompt Concepts"
Cohesion: 0.33
Nodes (6): Content ID Bypass via Visual Transformations, FFmpeg Visual Mapping JSON Output Format, Visual-to-VO Synchronization (Alurfilm), Visual-to-VO Synchronization (Generic), BGM Mood Selection System (sneaky_snitch/monkeys_spinning/fluffing_duck/elevator), Vertical Video Precision Visual-to-VO Mapping

### Community 31 - "Spensia Image Generation"
Cohesion: 0.33
Nodes (5): BatchTopicItem, GeneratedImageItem, IMAGE_MODELS, RESOLUTION_OPTIONS, SpensiaImageGeneratorStep()

### Community 32 - "Alurfilm Video Splitting"
Cohesion: 0.60
Nodes (4): AlurfilmSplitterStep(), formatSecondsToHHMMSS(), parseHHMMSS(), SourceInfo

### Community 33 - "Transcription Prompt Concepts"
Cohesion: 0.67
Nodes (3): Precision Audio Transcription with Anti-Uniform Timestamp Strategy, Precision Audio Transcription (Generic Longform), Shortform Audio Transcription with Anti-Overflow Duration Ceiling

### Community 34 - "YouTube Shorts SEO Strategy"
Cohesion: 1.00
Nodes (3): Viral Social Media Growth Hacker Persona, TikTok FYP Algorithm Optimization (Comment Bait/Engagement Trigger), YouTube Shorts Curiosity Gap SEO Strategy

## Knowledge Gaps
- **262 isolated node(s):** `require`, `program`, `ClipSchema`, `MappingSchema`, `Clip` (+257 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `Dashboard Build Toolchain` to `Dashboard Package Config`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **Why does `StepId` connect `Workflow Header Navigation` to `App Shell & Status Bar`, `Navigation & Layout Components`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Root Runtime Dependencies` to `Root Package Configuration`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **What connects `require`, `program`, `ClipSchema` to the rest of the system?**
  _262 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Playwright Browser Automation` be split into smaller, more focused modules?**
  _Cohesion score 0.0656010656010656 - nodes in this community are weakly interconnected._
- **Should `Spensia Pipeline Validation` be split into smaller, more focused modules?**
  _Cohesion score 0.05660377358490566 - nodes in this community are weakly interconnected._
- **Should `Electron Main Process` be split into smaller, more focused modules?**
  _Cohesion score 0.06097560975609756 - nodes in this community are weakly interconnected._