// dashboard/src/components/shortform/ShortformAnalyzeStep.tsx
import React, { useState, useEffect, useCallback } from 'react';
import type { AudioInfo } from '../../electron-api';

const api = window.electronAPI;

interface ScriptBlock {
  id: number;
  estimated_timestamp: string;
  visual_context: string;
  narration: string;
}

interface AnalysisResult {
  episode_summary: string;
  total_estimated_words: number;
  script_blocks: ScriptBlock[];
}

interface TranscriptEntry {
  start: number;
  end: number;
  visual: string;
  shot: string;
  characters: string[];
  action: string;
  emotion: string;
  text?: string;
  speaker?: string;
}

const SCENE = "A Gen-Z TikToker gossiping and recapping a funny cartoon episode very passionately in a casual studio.";
const SAMPLE_CONTEXT = "Speaking very fast, using informal Indonesian slang. Laughing at their own jokes, sounding sarcastic, deadpan, and highly expressive.";

interface ShortformAnalyzeStepProps {
  onStepChange?: (step: any) => void;
}

const ShortformAnalyzeStep: React.FC<ShortformAnalyzeStepProps> = ({ onStepChange }) => {
  // Prompts & Context
  const [prompt, setPrompt] = useState('');
  const [transcriptPrompt, setTranscriptPrompt] = useState('');
  const [activePromptTab, setActivePromptTab] = useState<'analysis' | 'transcript' | 'context'>('analysis');

  // Input Data States
  const [jsonRaw, setJsonRaw] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Voice Over
  const [voiceOver, setVoiceOver] = useState<AudioInfo | null>(null);
  const [audioList, setAudioList] = useState<AudioInfo[]>([]);
  const [voiceOverUploading, setVoiceOverUploading] = useState(false);
  const [showAudioList, setShowAudioList] = useState(false);

  // Transcript Data
  const [transcriptJson, setTranscriptJson] = useState('');
  const [transcript, setTranscript] = useState<TranscriptEntry[] | null>(null);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [transcriptSaved, setTranscriptSaved] = useState(false);

  // Copy Feedback
  const [copyToast, setCopyToast] = useState<string | null>(null);

  // Right Panel Input Tabs
  const [activeInputTab, setActiveInputTab] = useState<'analysis' | 'voiceover' | 'transcript'>('analysis');

  const showToast = (msg: string) => {
    setCopyToast(msg);
    setTimeout(() => setCopyToast(null), 2000);
  };

  const loadAudioList = useCallback(async (): Promise<AudioInfo[]> => {
    try {
      const files = await api.listAudio();
      setAudioList(files);
      return files;
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    (async () => {
      const savedPrompt = await api.readFromProject('dashboard/prompts/shortform/analysis-prompt.md');
      if (savedPrompt) setPrompt(savedPrompt);

      const tp = await api.readFromProject('dashboard/prompts/shortform/transcript-prompt.md');
      if (tp) setTranscriptPrompt(tp);

      const savedAnalysis = await api.readFromProject('input/analysis.json');
      if (savedAnalysis) {
        try {
          const parsed = JSON.parse(savedAnalysis);
          setResult(parsed);
          setJsonRaw(savedAnalysis);
          setSaved(true);
        } catch {}
      }

      let currentVO: AudioInfo | null = null;
      const savedVO = await api.readFromProject('input/voiceover.json');
      if (savedVO && savedVO.trim()) {
        try {
          currentVO = JSON.parse(savedVO);
          setVoiceOver(currentVO);
        } catch {}
      }

      const files = await loadAudioList();
      // Auto-select latest audio file if voiceover is not explicitly set yet
      if (!currentVO && files && files.length > 0) {
        const autoVO = files[0];
        setVoiceOver(autoVO);
        await api.saveToProject('input/voiceover.json', JSON.stringify(autoVO, null, 2));
      }

      const savedTranscript = await api.readFromProject('input/transcript.json');
      if (savedTranscript) {
        setTranscriptJson(savedTranscript);
        setTranscriptSaved(true);
        try { setTranscript(JSON.parse(savedTranscript)); } catch {}
      }
    })();
  }, [loadAudioList]);

  // Copy Handlers
  const copyText = async (text: string, label: string) => {
    await api.copyToClipboard(text);
    showToast(`Copied ${label}!`);
  };

  // Parse Analysis
  const handleParseAnalysis = () => {
    setError(null);
    try {
      let raw = jsonRaw.trim();
      if (raw.startsWith('```')) {
        raw = raw.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      }

      const parsed = JSON.parse(raw);

      if (!parsed.script_blocks || !Array.isArray(parsed.script_blocks)) {
        setError('Missing or invalid "script_blocks" array');
        return;
      }
      if (parsed.script_blocks.length === 0) {
        setError('script_blocks must have at least 1 entry');
        return;
      }
      for (const block of parsed.script_blocks) {
        if (!block.id && block.id !== 0) { setError('Each block must have an "id"'); return; }
        if (!block.narration) { setError(`Block #${block.id}: missing "narration"`); return; }
      }

      setResult(parsed);
      handleSaveAnalysis(parsed);
    } catch (e: any) {
      setError(`Invalid JSON: ${e.message}`);
    }
  };

  const handleSaveAnalysis = async (dataToSave = result) => {
    if (!dataToSave) return;
    try {
      const jsonString = JSON.stringify(dataToSave, null, 2);
      await api.saveToProject('input/analysis.json', jsonString);
      setSaved(true);
      showToast('Saved Analysis!');
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleClearAnalysis = () => {
    setResult(null);
    setSaved(false);
    setJsonRaw('');
    setError(null);
  };

  // Voiceover handlers
  const handleBrowseAudio = async () => {
    setVoiceOverUploading(true);
    try {
      const file = await api.selectAudio();
      if (!file) { setVoiceOverUploading(false); return; }
      const res = await api.uploadAudio(file.path);
      setVoiceOver(res);
      await api.saveToProject('input/voiceover.json', JSON.stringify(res, null, 2));
      loadAudioList();
      showToast('Voiceover Saved!');
    } catch {}
    setVoiceOverUploading(false);
  };

  const handleSelectAudio = async (info: AudioInfo) => {
    setVoiceOver(info);
    await api.saveToProject('input/voiceover.json', JSON.stringify(info, null, 2));
    setShowAudioList(false);
    showToast('Voiceover Selected!');
  };

  const handleRemoveAudio = async () => {
    setVoiceOver(null);
    await api.saveToProject('input/voiceover.json', '');
  };

  // Transcript handlers
  const handleParseTranscript = async () => {
    setTranscriptError(null);
    try {
      let raw = transcriptJson.trim();
      if (raw.startsWith('```')) raw = raw.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) { setTranscriptError('Must be a non-empty array'); return; }
      setTranscript(parsed);
      await api.saveToProject('input/transcript.json', JSON.stringify(parsed, null, 2));
      setTranscriptSaved(true);
      showToast('Saved Transcript!');
    } catch (e: any) { setTranscriptError(`Invalid JSON: ${e.message}`); }
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-100 p-6 overflow-hidden">
      {/* Toast Notification */}
      {copyToast && (
        <div className="fixed top-5 right-5 z-50 bg-indigo-600 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-lg border border-indigo-400 animate-bounce">
          {copyToast}
        </div>
      )}

      {/* Top Header & Overview Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-gray-800 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg text-lg">⚡</span>
            Shorts AI Script & Audio Analysis
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Generate AI scene recaps, paste structured analysis JSON, sync voiceovers, and manage audio transcriptions.
          </p>
        </div>

        {/* Readiness Badges & Next Step */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 ${
            saved ? 'bg-emerald-950/60 border-emerald-700/50 text-emerald-300' : 'bg-gray-900 border-gray-800 text-gray-500'
          }`}>
            <span>{saved ? '✓' : '○'}</span>
            <span>Script Analysis</span>
          </div>
          <div className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 ${
            voiceOver ? 'bg-purple-950/60 border-purple-700/50 text-purple-300' : 'bg-gray-900 border-gray-800 text-gray-500'
          }`}>
            <span>{voiceOver ? '✓' : '○'}</span>
            <span>Voiceover</span>
          </div>
          <div className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 ${
            transcriptSaved ? 'bg-cyan-950/60 border-cyan-700/50 text-cyan-300' : 'bg-gray-900 border-gray-800 text-gray-500'
          }`}>
            <span>{transcriptSaved ? '✓' : '○'}</span>
            <span>Transcript</span>
          </div>

          {onStepChange && (
            <button
              onClick={() => onStepChange('transcript')}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-1.5 ml-2"
            >
              <span>Next: 3. Audio Transcript</span>
              <span>➔</span>
            </button>
          )}
        </div>
      </div>

      {/* Main 2-Column Grid Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-5 flex-1 min-h-0 overflow-hidden">

        {/* LEFT PANEL: AI Prompt Generator Toolkit (Col 5) */}
        <div className="lg:col-span-5 flex flex-col bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
          {/* Panel Header / Tabs */}
          <div className="flex items-center justify-between bg-gray-900 px-4 py-3 border-b border-gray-800 shrink-0">
            <span className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>🤖</span> AI Prompt Generator
            </span>
            <div className="flex bg-gray-950 p-1 rounded-lg border border-gray-800">
              <button
                onClick={() => setActivePromptTab('analysis')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  activePromptTab === 'analysis' ? 'bg-indigo-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Analysis
              </button>
              <button
                onClick={() => setActivePromptTab('transcript')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  activePromptTab === 'transcript' ? 'bg-cyan-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Transcript
              </button>
              <button
                onClick={() => setActivePromptTab('context')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  activePromptTab === 'context' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Context
              </button>
            </div>
          </div>

          {/* Panel Body */}
          <div className="p-4 flex-1 flex flex-col min-h-0 overflow-auto space-y-4">
            {activePromptTab === 'analysis' && (
              <div className="flex flex-col h-full space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-400">Master system prompt for Shorts video analysis:</p>
                  <button
                    onClick={() => copyText(prompt, 'Analysis Prompt')}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow transition-all flex items-center gap-1"
                  >
                    <span>📋</span> Copy Analysis Prompt
                  </button>
                </div>
                <div className="relative flex-1 min-h-[220px]">
                  <pre className="absolute inset-0 bg-gray-950 text-gray-300 text-xs font-mono p-3 rounded-xl border border-gray-800 overflow-y-auto whitespace-pre-wrap leading-relaxed select-all">
                    {prompt || 'Loading prompt...'}
                  </pre>
                </div>
              </div>
            )}

            {activePromptTab === 'transcript' && (
              <div className="flex flex-col h-full space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-400">Prompt for multimodal audio-to-text transcript:</p>
                  <button
                    onClick={() => copyText(transcriptPrompt, 'Transcript Prompt')}
                    className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold shadow transition-all flex items-center gap-1"
                  >
                    <span>📋</span> Copy Transcript Prompt
                  </button>
                </div>
                <div className="relative flex-1 min-h-[220px]">
                  <pre className="absolute inset-0 bg-gray-950 text-gray-300 text-xs font-mono p-3 rounded-xl border border-gray-800 overflow-y-auto whitespace-pre-wrap leading-relaxed select-all">
                    {transcriptPrompt || 'Loading transcript prompt...'}
                  </pre>
                </div>
              </div>
            )}

            {activePromptTab === 'context' && (
              <div className="space-y-4 overflow-y-auto">
                <div className="bg-gray-950 p-4 rounded-xl border border-gray-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-amber-400">🎬 Scene Context (Wajib)</span>
                    <button
                      onClick={() => copyText(SCENE, 'Scene Context')}
                      className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-white text-xs rounded font-medium transition-all"
                    >
                      Copy Scene
                    </button>
                  </div>
                  <p className="text-xs text-gray-300 font-mono leading-relaxed bg-gray-900 p-2.5 rounded-lg border border-gray-800">
                    {SCENE}
                  </p>
                </div>

                <div className="bg-gray-950 p-4 rounded-xl border border-gray-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-400">🎙️ Sample Tone Context</span>
                    <button
                      onClick={() => copyText(SAMPLE_CONTEXT, 'Sample Context')}
                      className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-white text-xs rounded font-medium transition-all"
                    >
                      Copy Context
                    </button>
                  </div>
                  <p className="text-xs text-gray-300 font-mono leading-relaxed bg-gray-900 p-2.5 rounded-lg border border-gray-800">
                    {SAMPLE_CONTEXT}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL: Data Ingestion & Media Hub (Col 7) */}
        <div className="lg:col-span-7 flex flex-col bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
          {/* Input Header Tabs */}
          <div className="flex items-center justify-between bg-gray-900 px-4 py-3 border-b border-gray-800 shrink-0">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveInputTab('analysis')}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  activeInputTab === 'analysis'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                }`}
              >
                <span>📄</span> Analysis JSON
                {saved && <span className="w-2 h-2 rounded-full bg-emerald-400"></span>}
              </button>

              <button
                onClick={() => setActiveInputTab('voiceover')}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  activeInputTab === 'voiceover'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                }`}
              >
                <span>🎙️</span> Voiceover
                {voiceOver && <span className="w-2 h-2 rounded-full bg-purple-400"></span>}
              </button>

              <button
                onClick={() => setActiveInputTab('transcript')}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  activeInputTab === 'transcript'
                    ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                }`}
              >
                <span>📜</span> Transcript
                {transcriptSaved && <span className="w-2 h-2 rounded-full bg-cyan-400"></span>}
              </button>
            </div>
          </div>

          {/* Input Tab Content */}
          <div className="p-5 flex-1 flex flex-col min-h-0 overflow-auto">
            {/* 1. ANALYSIS JSON TAB */}
            {activeInputTab === 'analysis' && (
              <div className="flex flex-col h-full space-y-4">
                {result ? (
                  /* Formatted Result View */
                  <div className="flex flex-col h-full space-y-3">
                    <div className="flex items-center justify-between bg-emerald-950/40 p-3 rounded-xl border border-emerald-800/50">
                      <div>
                        <h3 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                          <span>✓</span> Valid Script Analysis
                        </h3>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {result.script_blocks.length} Scene Blocks · ~{result.total_estimated_words} Words
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => copyText(result.script_blocks.map(b => b.narration).join('\n\n'), 'Semua Narasi')}
                          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow transition-all flex items-center gap-1"
                          title="Copy all narration text"
                        >
                          <span>📋</span> Copy Semua Narasi
                        </button>
                        <button
                          onClick={handleClearAnalysis}
                          className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-medium transition-all"
                        >
                          Edit / Replace
                        </button>
                      </div>
                    </div>

                    <div className="bg-gray-950 p-3.5 rounded-xl border border-gray-800">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Episode Summary</span>
                        <button
                          onClick={() => copyText(result.episode_summary, 'Episode Summary')}
                          className="px-2 py-0.5 bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-indigo-300 text-[11px] rounded border border-gray-800 transition-all flex items-center gap-1"
                        >
                          📋 Copy Summary
                        </button>
                      </div>
                      <p className="text-xs text-gray-300 leading-relaxed">{result.episode_summary}</p>
                    </div>

                    <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
                      {result.script_blocks.map((b) => (
                        <div key={b.id} className="p-3 bg-gray-950 rounded-xl border border-gray-800 hover:border-gray-700 transition-all">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-indigo-400 font-mono">Block #{b.id}</span>
                              <span className="text-xs text-gray-500 font-mono">{b.estimated_timestamp}</span>
                            </div>
                            <button
                              onClick={() => copyText(b.narration, `Narasi Block #${b.id}`)}
                              className="px-2 py-0.5 bg-gray-900 hover:bg-gray-800 text-indigo-400 hover:text-indigo-300 text-[11px] font-medium rounded border border-gray-800 hover:border-indigo-800/50 transition-all flex items-center gap-1"
                              title="Copy block narration"
                            >
                              📋 Copy Narasi
                            </button>
                          </div>
                          <p className="text-xs text-gray-400 italic mb-1.5">{b.visual_context}</p>
                          <p className="text-xs text-gray-200 leading-relaxed">{b.narration}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Raw Input View */
                  <div className="flex flex-col h-full space-y-3">
                    <p className="text-xs text-gray-400">Paste the JSON response generated by AI analysis:</p>
                    <textarea
                      value={jsonRaw}
                      onChange={(e) => setJsonRaw(e.target.value)}
                      placeholder={`{\n  "episode_summary": "...",\n  "total_estimated_words": 150,\n  "script_blocks": [\n    {\n      "id": 1,\n      "estimated_timestamp": "0:00 - 0:05",\n      "visual_context": "...",\n      "narration": "..."\n    }\n  ]\n}`}
                      className="flex-1 w-full bg-gray-950 text-gray-200 text-xs font-mono p-4 rounded-xl border border-gray-800 focus:border-indigo-500 focus:outline-none resize-none leading-relaxed"
                      spellCheck={false}
                    />

                    {error && (
                      <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-xl text-xs text-red-400">
                        {error}
                      </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        onClick={handleParseAnalysis}
                        disabled={!jsonRaw.trim()}
                        className={`px-5 py-2 rounded-xl text-xs font-semibold shadow-lg transition-all ${
                          !jsonRaw.trim()
                            ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
                        }`}
                      >
                        Validate & Save Analysis
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 2. VOICEOVER TAB */}
            {activeInputTab === 'voiceover' && (
              <div className="flex flex-col h-full space-y-4 justify-center">
                {voiceOver ? (
                  <div className="bg-gray-950 p-6 rounded-2xl border border-emerald-900/50 space-y-5">
                    <div className="flex items-center justify-between bg-emerald-950/40 p-3.5 rounded-xl border border-emerald-800/50">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">✓</span>
                        <div>
                          <h3 className="text-xs font-bold text-emerald-400">Voiceover Ready & Completed</h3>
                          <p className="text-xs text-gray-400 mt-0.5">1 Audio file linked for narrative video sync.</p>
                        </div>
                      </div>
                      <button
                        onClick={handleRemoveAudio}
                        className="px-3 py-1 bg-gray-800 hover:bg-red-900/40 text-gray-400 hover:text-red-400 rounded-lg text-xs font-medium border border-gray-700 transition-all"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-gray-900/80 rounded-xl border border-gray-800">
                      <span className="p-2.5 bg-purple-600/20 text-purple-400 rounded-lg text-lg">🎙️</span>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-white font-mono truncate">{voiceOver.name}</h4>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {voiceOver.size ? `${(voiceOver.size / 1024).toFixed(0)} KB` : 'Audio Recording'}
                        </p>
                      </div>
                    </div>

                    <audio src={voiceOver.url} controls className="w-full h-10 rounded-lg" />

                    <div className="flex justify-between items-center pt-2">
                      <span className="text-xs text-emerald-400 font-medium">✓ Step 100% Complete</span>
                      <button
                        onClick={handleBrowseAudio}
                        disabled={voiceOverUploading}
                        className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl text-xs font-medium transition-all"
                      >
                        Replace Voiceover
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-950 p-8 rounded-2xl border border-dashed border-gray-800 text-center space-y-4">
                    <div className="w-16 h-16 bg-purple-600/10 text-purple-400 rounded-full flex items-center justify-center mx-auto text-2xl">
                      🎵
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Upload Voiceover Narration</h3>
                      <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                        Select an MP3 or WAV audio recording of your narration. This audio will be synced with timeline clips in the render step.
                      </p>
                    </div>

                    <div className="flex items-center justify-center gap-3 pt-2">
                      <button
                        onClick={handleBrowseAudio}
                        disabled={voiceOverUploading}
                        className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-purple-600/30 transition-all"
                      >
                        {voiceOverUploading ? 'Uploading...' : 'Browse Audio File'}
                      </button>

                      {audioList.length > 0 && (
                        <button
                          onClick={() => setShowAudioList(!showAudioList)}
                          className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-medium transition-all"
                        >
                          Select Existing ({audioList.length})
                        </button>
                      )}
                    </div>

                    {showAudioList && audioList.length > 0 && (
                      <div className="mt-4 bg-gray-900 p-3 rounded-xl border border-gray-800 text-left max-h-40 overflow-y-auto space-y-1">
                        {audioList.map((f) => (
                          <div key={f.name} className="flex items-center justify-between p-2 hover:bg-gray-800 rounded-lg transition-all">
                            <button onClick={() => handleSelectAudio(f)} className="text-xs text-gray-300 hover:text-purple-300 font-mono truncate flex-1 text-left">
                              🎵 {f.name}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 3. TRANSCRIPT TAB */}
            {activeInputTab === 'transcript' && (
              <div className="flex flex-col h-full space-y-4">
                <p className="text-xs text-gray-400">Paste the JSON timestamp transcript for subtitle synchronization:</p>
                <textarea
                  value={transcriptJson}
                  onChange={(e) => setTranscriptJson(e.target.value)}
                  placeholder={`[\n  {\n    "start": 0.0,\n    "end": 3.5,\n    "visual": "...",\n    "text": "..."\n  }\n]`}
                  className="flex-1 w-full bg-gray-950 text-gray-200 text-xs font-mono p-4 rounded-xl border border-gray-800 focus:border-cyan-500 focus:outline-none resize-none leading-relaxed"
                  spellCheck={false}
                />

                {transcriptError && (
                  <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-xl text-xs text-red-400">
                    {transcriptError}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-gray-500">
                    {transcript ? `✓ ${transcript.length} transcript entries loaded` : 'No transcript validated yet'}
                  </span>
                  <button
                    onClick={handleParseTranscript}
                    disabled={!transcriptJson.trim()}
                    className={`px-5 py-2 rounded-xl text-xs font-semibold shadow-lg transition-all ${
                      !transcriptJson.trim()
                        ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                        : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-600/30'
                    }`}
                  >
                    Validate & Save Transcript
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default ShortformAnalyzeStep;
