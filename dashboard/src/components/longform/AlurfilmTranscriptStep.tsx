// dashboard/src/components/longform/AlurfilmTranscriptStep.tsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { AlurfilmChunk, AlurfilmAudioResult, AlurfilmTranscriptResult, AlurfilmTranscriptEntry } from '../../electron-api';
import {
  validateTranscript,
  autoFixTranscript,
  formatMinute,
  ValidationReport,
} from '../../utils/transcriptValidation';

const api = window.electronAPI;

function normalizeEntry(entry: any, index: number, prevEndSec: number = 0): AlurfilmTranscriptEntry {
  if (!entry || typeof entry !== 'object') {
    const strVal = String(entry || '').trim();
    const startSec = prevEndSec;
    const endSec = startSec + 3;
    const m1 = Math.floor(startSec / 60); const s1 = Math.floor(startSec % 60);
    const m2 = Math.floor(endSec / 60); const s2 = Math.floor(endSec % 60);
    const defaultTs = `${String(m1).padStart(2, '0')}:${String(s1).padStart(2, '0')} - ${String(m2).padStart(2, '0')}:${String(s2).padStart(2, '0')}`;

    return {
      id: index + 1,
      start_seconds: Number(startSec.toFixed(1)),
      end_seconds: Number(endSec.toFixed(1)),
      timestamp_minute: defaultTs,
      text: strVal,
      speaker: 'Narator',
    };
  }

  let textStr = entry.text || entry.narration || entry.speech || entry.content ||
                entry.dialogue || entry.sentence || entry.line || entry.naskah ||
                entry.script || entry.kalimat || entry.transcript || '';

  if (!textStr && typeof entry === 'object') {
    for (const [k, v] of Object.entries(entry)) {
      if (['id', 'start', 'end', 'start_seconds', 'end_seconds', 'timestamp', 'timestamp_minute', 'speaker', 'part', 'part_number'].includes(k.toLowerCase())) {
        continue;
      }
      if (typeof v === 'string' && v.trim().length > 0) {
        textStr = v;
        break;
      }
    }
  }

  let rawStart = entry.start_seconds !== undefined ? entry.start_seconds : (entry.start !== undefined ? entry.start : (entry.startTime !== undefined ? entry.startTime : entry.from));
  let rawEnd = entry.end_seconds !== undefined ? entry.end_seconds : (entry.end !== undefined ? entry.end : (entry.endTime !== undefined ? entry.endTime : entry.to));

  const timeStr = entry.timestamp_minute || entry.timestamp || entry.time || entry.time_range || entry.timeframe;
  if ((rawStart === undefined || rawEnd === undefined) && typeof timeStr === 'string') {
    const matches = timeStr.match(/(\d+:\d+(?::\d+)?|\d+(?:\.\d+)?)/g);
    if (matches && matches.length >= 2) {
      const parseSec = (s: string) => {
        if (s.includes(':')) {
          const parts = s.split(':').map(Number);
          if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
          if (parts.length === 2) return parts[0] * 60 + parts[1];
        }
        return parseFloat(s) || 0;
      };
      if (rawStart === undefined) rawStart = parseSec(matches[0]);
      if (rawEnd === undefined) rawEnd = parseSec(matches[1]);
    }
  }

  const startSec = typeof rawStart === 'number' && !isNaN(rawStart)
    ? rawStart
    : (parseFloat(String(rawStart)) || prevEndSec);

  const endSec = typeof rawEnd === 'number' && !isNaN(rawEnd)
    ? rawEnd
    : (parseFloat(String(rawEnd)) || (startSec + 3));

  const m1 = Math.floor(startSec / 60); const s1 = Math.floor(startSec % 60);
  const m2 = Math.floor(endSec / 60); const s2 = Math.floor(endSec % 60);
  const defaultTs = `${String(m1).padStart(2, '0')}:${String(s1).padStart(2, '0')} - ${String(m2).padStart(2, '0')}:${String(s2).padStart(2, '0')}`;

  const tsMin = timeStr && typeof timeStr === 'string' && timeStr.includes('-') ? timeStr : defaultTs;

  return {
    id: typeof entry.id === 'number' ? entry.id : (index + 1),
    start_seconds: Number(startSec.toFixed(1)),
    end_seconds: Number(endSec.toFixed(1)),
    timestamp_minute: String(tsMin),
    text: String(textStr || ''),
    speaker: entry.speaker || 'Narator',
  };
}

const AlurfilmTranscriptStep: React.FC = () => {
  const [contentId, setContentId] = useState<string | null>(null);
  const [chunks, setChunks] = useState<AlurfilmChunk[]>([]);
  const [audios, setAudios] = useState<Record<number, AlurfilmAudioResult>>({});
  const [transcripts, setTranscripts] = useState<Record<number, AlurfilmTranscriptResult>>({});
  const [activePart, setActivePart] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Audio Durations per Part (cache for validation)
  const [audioDurations, setAudioDurations] = useState<Record<number, number>>({});

  // Player ref & Playback state for real-time segment highlighting
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const [mediaMode, setMediaMode] = useState<'audio' | 'video'>('audio');
  const [currentTime, setCurrentTime] = useState<number>(0);
  const activeItemRef = useRef<HTMLDivElement | null>(null);

  // JSON Import & Edit Modal State
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [pasteJsonInput, setPasteJsonInput] = useState<string>('');
  const [searchFilter, setSearchFilter] = useState<string>('');

  // WhisperX Real-Time Alignment State
  const [isAligning, setIsAligning] = useState<boolean>(false);
  const [alignProgress, setAlignProgress] = useState<number>(0);
  const [alignStage, setAlignStage] = useState<string>('preparing');
  const [alignLogs, setAlignLogs] = useState<string[]>([]);
  const [showAlignModal, setShowAlignModal] = useState<boolean>(false);
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll terminal log window
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [alignLogs]);

  // IPC Listener for real-time progress & terminal logs
  useEffect(() => {
    if (api.onAlurfilmAlignmentProgress) {
      const cleanup = api.onAlurfilmAlignmentProgress((data) => {
        if (data.progress !== undefined) setAlignProgress(data.progress);
        if (data.stage) setAlignStage(data.stage);
        if (data.log) {
          setAlignLogs((prev) => [...prev, data.log]);
        }
      });
      return cleanup;
    }
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const id = await api.getContentId('longform');
      setContentId(id);

      if (id) {
        const chunkList = await api.listAlurfilmChunks(id);
        setChunks(chunkList || []);

        const audioList = await api.listAlurfilmAudios(id);
        const audioMap: Record<number, AlurfilmAudioResult> = {};
        const durMap: Record<number, number> = {};
        if (audioList) {
          for (const item of audioList) {
            const targetParts = item.parts || (typeof item.part === 'number' ? [item.part] : []);
            for (const pt of targetParts) {
              audioMap[pt] = item;
            }
            if (item.filePath) {
              try {
                const meta = await api.getVideoMeta(item.filePath);
                if (meta && meta.duration) {
                  for (const pt of targetParts) {
                    durMap[pt] = meta.duration;
                  }
                }
              } catch {}
            }
          }
        }
        setAudios(audioMap);
        setAudioDurations(durMap);

        const transcriptList = await api.listAlurfilmTranscripts(id);
        const transcriptMap: Record<number, AlurfilmTranscriptResult> = {};
        if (transcriptList) {
          for (const item of transcriptList) {
            transcriptMap[item.part] = item;
          }
        }
        setTranscripts(transcriptMap);

        if (chunkList && chunkList.length > 0) {
          setActivePart(chunkList[0].part);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load transcript files');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const getEntriesForPart = (pt: number): AlurfilmTranscriptEntry[] | null => {
    const t = transcripts[pt];
    if (!t) return null;
    if (Array.isArray(t.data) && t.data.length > 0) return t.data;
    if (Array.isArray(t.entries) && t.entries.length > 0) return t.entries;
    return null;
  };

  // Compute Part Groups (Combines parts sharing the same Voiceover Audio into 1 Group item)
  const partGroups = useMemo(() => {
    const result: Array<{
      id: string;
      label: string;
      parts: number[];
      primaryPart: number;
      audio?: AlurfilmAudioResult;
      isDone: boolean;
      hasSomeDone: boolean;
    }> = [];

    const processedParts = new Set<number>();

    for (const chunk of chunks) {
      if (processedParts.has(chunk.part)) continue;

      const audio = audios[chunk.part];
      if (audio && Array.isArray(audio.parts) && audio.parts.length > 0) {
        const sortedParts = [...audio.parts].sort((a, b) => a - b);
        sortedParts.forEach((p) => processedParts.add(p));

        const isDone = sortedParts.every((p) => !!getEntriesForPart(p)?.length);
        const hasSomeDone = sortedParts.some((p) => !!getEntriesForPart(p)?.length);

        const isGroup = sortedParts.length > 1;
        const minP = sortedParts[0];
        const maxP = sortedParts[sortedParts.length - 1];
        const label = isGroup ? `Group Parts #${minP} - #${maxP}` : `Part #${minP}`;

        result.push({
          id: audio.id || `group_${sortedParts.join('_')}`,
          label,
          parts: sortedParts,
          primaryPart: minP,
          audio,
          isDone,
          hasSomeDone,
        });
      } else {
        processedParts.add(chunk.part);
        const isDone = !!getEntriesForPart(chunk.part)?.length;
        result.push({
          id: `single_${chunk.part}`,
          label: `Part #${chunk.part}`,
          parts: [chunk.part],
          primaryPart: chunk.part,
          isDone,
          hasSomeDone: isDone,
        });
      }
    }

    return result;
  }, [chunks, audios, transcripts]);

  const activeGroup = useMemo(() => {
    return partGroups.find((g) => g.parts.includes(activePart)) || {
      id: `fallback_${activePart}`,
      label: `Part #${activePart}`,
      parts: [activePart],
      primaryPart: activePart,
      isDone: !!getEntriesForPart(activePart)?.length,
      hasSomeDone: !!getEntriesForPart(activePart)?.length,
    };
  }, [partGroups, activePart, transcripts]);

  const handleCopyPromptForPart = async (partNum: number) => {
    try {
      const totalChunks = chunks.length || 1;
      const formattedPrompt = await api.getAlurfilmTranscriptPrompt(partNum, totalChunks);

      if (api.copyToClipboard) {
        await api.copyToClipboard(formattedPrompt);
        showToast(`📋 Copied Audio Transcript Prompt for Part #${partNum}!`);
      }
    } catch (err: any) {
      setError(`Failed to format prompt: ${err.message}`);
    }
  };

  const handleSaveImportedJson = async () => {
    if (!pasteJsonInput.trim()) return;
    setError(null);
    try {
      let raw = pasteJsonInput.trim();
      if (raw.startsWith('```')) {
        raw = raw.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      }

      let parsed: any = null;
      try {
        parsed = JSON.parse(raw);
      } catch (pErr: any) {
        setError(`JSON Syntax Error: ${pErr.message}`);
        return;
      }

      if (!parsed) {
        setError('Transcript JSON cannot be empty');
        return;
      }

      const res = await api.saveAlurfilmTranscript(contentId || 'default', activePart, parsed);

      if (res && res.multiPart && Array.isArray(res.savedResults)) {
        const savedMap: Record<number, AlurfilmTranscriptResult> = {};
        const savedPartNums: number[] = [];
        for (const item of res.savedResults) {
          const rawData = item.data || item.entries || [];
          let prevEnd = 0;
          const normData = Array.isArray(rawData) ? rawData.map((e: any, idx: number) => {
            const r = normalizeEntry(e, idx, prevEnd);
            prevEnd = r.end_seconds;
            return r;
          }) : [];
          savedMap[item.part] = { ...item, data: normData, entries: normData };
          savedPartNums.push(item.part);
        }
        setTranscripts((prev) => ({ ...prev, ...savedMap }));
        setShowImportModal(false);
        setPasteJsonInput('');
        showToast(`🎉 Saved Transcripts for Parts ${savedPartNums.map((p) => `#${p}`).join(', ')}!`);
      } else if (res) {
        const rawData = res.data || res.entries || [];
        let prevEnd = 0;
        const normData = Array.isArray(rawData) ? rawData.map((e: any, idx: number) => {
          const r = normalizeEntry(e, idx, prevEnd);
          prevEnd = r.end_seconds;
          return r;
        }) : [];
        const resNorm = { ...res, data: normData, entries: normData };
        setTranscripts((prev) => ({ ...prev, [activePart]: resNorm }));
        setShowImportModal(false);
        setPasteJsonInput('');
        showToast(`🎉 Saved Transcript for Part #${activePart}!`);
      }
    } catch (err: any) {
      console.error('Save Transcript Error:', err);
      setError(`Failed to save transcript: ${err.message || String(err)}`);
    }
  };

  const handleOpenImportModal = () => {
    if (activeGroup.parts.length > 1) {
      const groupedObj: Record<string, AlurfilmTranscriptEntry[]> = {};
      for (const pt of activeGroup.parts) {
        const entries = getEntriesForPart(pt);
        if (entries && entries.length > 0) {
          groupedObj[String(pt)] = entries;
        }
      }
      if (Object.keys(groupedObj).length > 0) {
        setPasteJsonInput(JSON.stringify(groupedObj, null, 2));
      } else {
        setPasteJsonInput('');
      }
    } else {
      if (currentEntries && currentEntries.length > 0) {
        setPasteJsonInput(JSON.stringify(currentEntries, null, 2));
      } else {
        setPasteJsonInput('');
      }
    }
    setShowImportModal(true);
  };

  const handleRunWhisperXAlignment = async () => {
    const targetParts = activeGroup.parts || [activePart];
    const targetAudio = currentAudio?.filePath;

    setIsAligning(true);
    setAlignProgress(0);
    setAlignStage('preparing');
    setAlignLogs([`🚀 Initializing WhisperX Voiceover Alignment for Parts #${targetParts.join(', #')}...`]);
    setShowAlignModal(true);

    try {
      if (!api.runAlurfilmWhisperXAlignment) {
        throw new Error('WhisperX Alignment API not available in Electron preload');
      }
      const result = await api.runAlurfilmWhisperXAlignment(targetParts, targetAudio);
      if (result && result.success) {
        showToast(`✨ WhisperX alignment complete! Saved transcripts for Parts #${targetParts.join(', #')}`);
        await loadData();
      }
    } catch (err: any) {
      console.error('WhisperX Alignment Error:', err);
      setAlignLogs((prev) => [...prev, `❌ ERROR: ${err.message || String(err)}`]);
      setAlignStage('error');
      setError(`WhisperX alignment failed: ${err.message || String(err)}`);
    } finally {
      setIsAligning(false);
    }
  };

  const handleSeekToTime = (startSec: number) => {
    if (mediaRef.current) {
      let seekTarget = startSec;

      // In Video mode, video chunks start at 0s. Offset target time relative to chunk start if timestamps are master-based.
      if (mediaMode === 'video' && currentEntries && currentEntries.length > 0) {
        const firstEntryStart = currentEntries[0].start_seconds;
        if (firstEntryStart > 5) {
          seekTarget = Math.max(0, startSec - firstEntryStart);
        }
      }

      mediaRef.current.currentTime = seekTarget;
      mediaRef.current.play();
      showToast(`▶️ Playing from ${startSec.toFixed(1)}s`);
    }
  };

  const currentChunk = chunks.find((c) => c.part === activePart);
  const currentAudio = audios[activePart];
  const currentTranscriptResult = transcripts[activePart];
  const currentEntries: AlurfilmTranscriptEntry[] | null = getEntriesForPart(activePart);
  const currentAudioDuration = audioDurations[activePart] || null;

  // Auto-seek audio player to part start when activePart tab changes
  useEffect(() => {
    if (currentEntries && currentEntries.length > 0 && mediaRef.current) {
      if (mediaMode === 'audio') {
        const firstStart = currentEntries[0].start_seconds;
        if (mediaRef.current.currentTime < firstStart || mediaRef.current.currentTime > (currentEntries[currentEntries.length - 1].end_seconds + 5)) {
          mediaRef.current.currentTime = firstStart;
        }
      }
    }
  }, [activePart, mediaMode]);

  const activeEntryId = useMemo(() => {
    if (!currentEntries || currentEntries.length === 0) return null;

    // Calculate effective time matching master transcript timeline
    let timeToMatch = currentTime;
    if (mediaMode === 'video' && currentEntries.length > 0) {
      const firstEntryStart = currentEntries[0].start_seconds;
      if (firstEntryStart > 5) {
        timeToMatch = currentTime + firstEntryStart;
      }
    }

    // Find active entry with gap tolerance hysteresis (keeps line highlighted during brief silence gaps)
    for (let i = 0; i < currentEntries.length; i++) {
      const curr = currentEntries[i];
      const next = currentEntries[i + 1];
      const activeUntil = next
        ? Math.min(curr.end_seconds + 1.2, next.start_seconds)
        : curr.end_seconds + 2.0;

      if (timeToMatch >= curr.start_seconds - 0.2 && timeToMatch < activeUntil) {
        return curr.id;
      }
    }

    return null;
  }, [currentEntries, currentTime, mediaMode]);

  useEffect(() => {
    if (activeEntryId && activeItemRef.current) {
      activeItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [activeEntryId]);

  const currentReport: ValidationReport = useMemo(() => {
    return validateTranscript(currentEntries, currentAudioDuration);
  }, [currentEntries, currentAudioDuration]);

  const handleAutoFixCurrentPart = async () => {
    if (!currentEntries || currentEntries.length === 0) return;
    const fixed = autoFixTranscript(currentEntries, currentAudioDuration);
    try {
      const res = await api.saveAlurfilmTranscript(contentId || 'default', activePart, fixed);
      setTranscripts((prev) => ({ ...prev, [activePart]: res }));
      showToast(`⚡ Auto-fixed timing issues for Part #${activePart}!`);
    } catch (err: any) {
      setError(`Failed auto-fix: ${err.message}`);
    }
  };

  const filteredEntries = currentEntries ? currentEntries.filter((e) => {
    if (!searchFilter.trim()) return true;
    const term = searchFilter.toLowerCase();
    return (
      e.text.toLowerCase().includes(term) ||
      (e.speaker || '').toLowerCase().includes(term) ||
      e.timestamp_minute.toLowerCase().includes(term)
    );
  }) : [];

  const totalTranscriptDuration = currentEntries && currentEntries.length > 0
    ? currentEntries[currentEntries.length - 1].end_seconds
    : 0;

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-100 p-6 overflow-hidden">
      {/* Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 bg-purple-600 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-2xl border border-purple-400 animate-bounce">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-gray-800 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="p-2 bg-purple-600/20 text-purple-400 rounded-lg text-lg">📝</span>
            Alur Film Audio Transcript & Timestamp Studio
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Click any transcript line to preview & seek audio/video narration in real-time.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs text-purple-300 bg-purple-950/40 border border-purple-800/50 px-3 py-1.5 rounded-xl">
          <span>🎙️ Mode:</span>
          <strong className="text-white">Grouped Voiceover Audio Sync</strong>
        </div>
      </div>

      {/* Main Grid Workspace with Side Parts List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-5 flex-1 min-h-0 overflow-hidden">
        {/* SIDE COLUMN: Vertical Parts Selector (Col 3) */}
        <div className="lg:col-span-3 flex flex-col bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden shadow-xl p-3.5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-gray-800 shrink-0">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              Parts ({chunks.length})
            </span>
            <span className="text-[10px] text-purple-400 font-mono font-bold">Audio Group & Transcript</span>
          </div>

          {partGroups.length > 0 ? (
            <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-0.5">
              {partGroups.map((group) => {
                const isGroupActive = group.parts.includes(activePart);
                const isMulti = group.parts.length > 1;

                return (
                  <div
                    key={group.id}
                    className={`rounded-2xl transition-all border overflow-hidden ${
                      isGroupActive
                        ? 'bg-purple-950/40 border-purple-500/80 shadow-lg shadow-purple-600/20'
                        : group.isDone
                        ? 'bg-purple-950/20 border-purple-800/40'
                        : 'bg-gray-950/80 border-gray-800'
                    }`}
                  >
                    <button
                      onClick={() => setActivePart(group.primaryPart)}
                      className={`w-full px-3.5 py-2.5 text-left font-mono transition-all flex flex-col gap-1 ${
                        isGroupActive
                          ? 'bg-purple-600 text-white'
                          : 'hover:bg-gray-900 text-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs font-bold">{group.label}</span>
                        <span className="text-xs">{group.isDone ? '✓' : group.hasSomeDone ? '◐' : '○'}</span>
                      </div>

                      {isMulti ? (
                        <div className="flex items-center justify-between text-[10px] opacity-90 font-normal">
                          <span>🎙️ {group.parts.length} Parts (1 Audio)</span>
                          <span>{group.audio ? `${(group.audio.size / 1024 / 1024).toFixed(1)} MB` : ''}</span>
                        </div>
                      ) : group.audio ? (
                        <span className="text-[9px] opacity-80 font-normal truncate">
                          🎙️ Voiceover Audio Uploaded
                        </span>
                      ) : null}
                    </button>

                    {/* Sub-Part Tabs & Group Action Buttons inside Sidebar Group */}
                    {isMulti && (
                      <div className="p-1.5 bg-gray-950/90 border-t border-purple-800/30 flex flex-col gap-1.5">
                        <div className="grid grid-cols-4 gap-1">
                          {group.parts.map((pt) => {
                            const isPartActive = activePart === pt;
                            const isPartDone = !!getEntriesForPart(pt)?.length;

                            return (
                              <button
                                key={pt}
                                onClick={() => setActivePart(pt)}
                                className={`py-1 text-[10px] font-mono font-bold rounded-lg transition-all flex items-center justify-center gap-0.5 border ${
                                  isPartActive
                                    ? 'bg-purple-600 border-purple-400 text-white shadow'
                                    : isPartDone
                                    ? 'bg-purple-950/60 border-purple-800 text-purple-300 hover:bg-purple-900'
                                    : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white'
                                }`}
                              >
                                <span>#{pt}</span>
                                <span className="text-[9px]">{isPartDone ? '✓' : ''}</span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Inline Group Actions */}
                        {isGroupActive && (
                          <div className="flex items-center gap-1 pt-1 border-t border-gray-800">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyPromptForPart(activePart);
                              }}
                              className="flex-1 py-1 px-1.5 bg-purple-900/60 hover:bg-purple-600 text-purple-200 hover:text-white rounded-lg text-[10px] font-bold font-mono transition-all flex items-center justify-center gap-1"
                            >
                              <span>📋</span> Copy Prompt
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenImportModal();
                              }}
                              className="flex-1 py-1 px-1.5 bg-indigo-900/60 hover:bg-indigo-600 text-indigo-200 hover:text-white rounded-lg text-[10px] font-bold font-mono transition-all flex items-center justify-center gap-1"
                            >
                              <span>📥</span> Paste JSON
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-[11px] text-amber-400 p-2 text-center">
              Belum ada part split.
            </div>
          )}
        </div>

        {/* CENTER PANEL: Media Preview Player & Prompt (Col 4) */}
        <div className="lg:col-span-4 flex flex-col bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden shadow-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-800">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>🤖</span> {activeGroup.parts.length > 1 ? `Group Parts #${activeGroup.parts[0]}-#${activeGroup.parts[activeGroup.parts.length - 1]}` : `Part #${activePart}`} Studio
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">
                AI Input Prompt & Output JSON Sync
              </p>
            </div>

            {/* AI Group Action Buttons inside Center Panel */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleRunWhisperXAlignment}
                disabled={isAligning}
                className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-lg transition-all flex items-center gap-1.5 border border-emerald-400/40 disabled:opacity-50"
                title="Run automatic Faster-Whisper alignment on voiceover audio"
              >
                <span>⚡</span> {isAligning ? 'Aligning...' : 'Auto-Align (Faster-Whisper)'}
              </button>

              <button
                onClick={() => handleCopyPromptForPart(activePart)}
                className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold shadow transition-all flex items-center gap-1"
                title="Copy AI Transcript Prompt for this group"
              >
                <span>📋</span> Copy Prompt
              </button>

              <button
                onClick={handleOpenImportModal}
                className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow"
                title="Import or Edit Output JSON"
              >
                <span>📥</span> Paste JSON
              </button>
            </div>
          </div>

          {/* Audio Grouping Banner Badge */}
          {currentAudio?.parts && currentAudio.parts.length > 1 && (
            <div className="p-2.5 bg-purple-950/50 border border-purple-800/60 rounded-xl flex items-center justify-between text-xs text-purple-200">
              <span className="font-semibold flex items-center gap-1.5 text-[11px]">
                <span>🎙️</span> Multi-Part Voiceover Audio:
              </span>
              <span className="px-2 py-0.5 bg-purple-800 text-purple-100 rounded-lg text-[10px] font-mono font-bold">
                Parts #{currentAudio.parts.join(', #')}
              </span>
            </div>
          )}

          {/* Player Mode Switcher: Audio vs Video */}
          <div className="flex items-center gap-2 bg-gray-950 p-1 rounded-xl border border-gray-800">
            <button
              onClick={() => setMediaMode('audio')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                mediaMode === 'audio' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-white'
              }`}
            >
              🎙️ Voiceover Audio
            </button>
            <button
              onClick={() => setMediaMode('video')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                mediaMode === 'video' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-white'
              }`}
            >
              📹 Video Chunk
            </button>
          </div>

          {/* Media Player Box */}
          <div className="bg-black rounded-xl p-3 border border-gray-800 flex flex-col items-center justify-center min-h-[160px] shadow-inner">
            {mediaMode === 'audio' ? (
              currentAudio ? (
                <div className="w-full space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="p-2 bg-purple-600/20 text-purple-400 rounded-lg text-lg">🎙️</span>
                    <span className="text-xs font-mono font-bold text-white truncate">{currentAudio.name}</span>
                  </div>
                  <audio
                    ref={mediaRef as React.RefObject<HTMLAudioElement>}
                    src={currentAudio.mediaUrl || currentAudio.url}
                    controls
                    onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                    className="w-full h-10 rounded-lg"
                  />
                </div>
              ) : (
                <p className="text-xs text-gray-500">No Audio uploaded for Part #{activePart}</p>
              )
            ) : (
              currentChunk ? (
                <video
                  ref={mediaRef as React.RefObject<HTMLVideoElement>}
                  src={currentChunk.mediaUrl || currentChunk.url}
                  controls
                  onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                  className="w-full h-44 object-contain rounded-lg"
                />
              ) : (
                <p className="text-xs text-gray-500">No Video Chunk for Part #{activePart}</p>
              )
            )}
          </div>

          <div className="flex-1 bg-gray-950 p-4 rounded-xl border border-gray-800 overflow-y-auto space-y-2 font-mono text-xs text-gray-300 leading-relaxed min-h-0">
            <p className="text-purple-400 font-bold">// Transcript Instructions</p>
            <p>- Selected Part: {activePart} of {chunks.length || 1}</p>
            <p>- Audio Parts Coverage: {currentAudio?.parts ? `Parts #${currentAudio.parts.join(', #')}` : `Part #${activePart}`}</p>
            <p>- Audio Duration: {currentAudioDuration ? `${currentAudioDuration.toFixed(1)}s (${formatMinute(currentAudioDuration)})` : 'Unknown'}</p>
            <p>- Step 2 Reference Script: Included in Prompt</p>
          </div>

          {error && (
            <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-xl text-xs text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* RIGHT PANEL: Transcript Table with Interactive Seek (Col 5) */}
        <div className="lg:col-span-5 flex flex-col bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden shadow-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-800 shrink-0">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>💬</span> Speech Lines ({filteredEntries.length})
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Click lines to seek playback.
              </p>
            </div>

            {currentEntries && currentEntries.length > 0 && (
              <button
                onClick={() => {
                  if (api.copyToClipboard) {
                    api.copyToClipboard(JSON.stringify(currentEntries, null, 2));
                    showToast(`📋 Copied JSON Transcript for Part #${activePart}!`);
                  }
                }}
                className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-xs font-medium transition-all"
              >
                📋 Copy JSON
              </button>
            )}
          </div>

          {currentEntries && currentEntries.length > 0 ? (
            <div className="flex-1 flex flex-col min-h-0 space-y-3">
              {/* Stats & Search */}
              <div className="flex items-center justify-between gap-3 bg-gray-950 p-3 rounded-xl border border-gray-800">
                <span className="text-xs text-gray-400">
                  Total: <strong className="text-purple-400 font-mono">{currentEntries.length} items</strong>
                </span>
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Search text..."
                  className="bg-gray-900 text-gray-200 text-xs rounded-lg px-3 py-1 border border-gray-800 focus:border-purple-500 focus:outline-none w-32"
                />
              </div>

              {/* Validation Report Banner */}
              {currentReport.issues.length > 0 && (
                <div
                  className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs font-medium ${
                    currentReport.status === 'ERROR'
                      ? 'bg-rose-950/40 border-rose-800/50 text-rose-300'
                      : 'bg-amber-950/40 border-amber-800/50 text-amber-300'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 font-bold">
                      <span>{currentReport.status === 'ERROR' ? '🔴' : '⚠️'}</span>
                      <span>{currentReport.summaryText}</span>
                    </div>
                  </div>

                  <button
                    onClick={handleAutoFixCurrentPart}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold shadow transition-all shrink-0 flex items-center gap-1"
                  >
                    <span>⚡</span> Auto-Fix
                  </button>
                </div>
              )}

              {/* Click-to-Seek Transcript List */}
              <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
                {filteredEntries.map((e, idx) => {
                  const isActive = (e.id || idx + 1) === activeEntryId;
                  return (
                    <div
                      key={e.id || idx}
                      ref={isActive ? activeItemRef : null}
                      onClick={() => handleSeekToTime(e.start_seconds)}
                      className={`p-3 rounded-xl space-y-1.5 transition-all cursor-pointer group border ${
                        isActive
                          ? 'bg-purple-900/50 border-purple-500 shadow-lg shadow-purple-600/30 scale-[1.01]'
                          : 'bg-gray-950 hover:bg-purple-950/40 border-gray-800 hover:border-purple-600/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-mono font-bold ${isActive ? 'text-purple-300' : 'text-gray-500'}`}>
                            #{e.id || idx + 1}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-all border ${
                              isActive
                                ? 'bg-purple-600 text-white border-purple-400 shadow animate-pulse flex items-center gap-1'
                                : 'bg-purple-950 text-purple-300 border-purple-800/50 group-hover:bg-purple-600 group-hover:text-white'
                            }`}
                          >
                            {isActive ? '🔊 PLAYING | ' : '▶️ '}{e.timestamp_minute}
                          </span>
                        </div>
                        <span className={`text-[11px] font-mono ${isActive ? 'text-purple-300 font-bold' : 'text-gray-500'}`}>
                          {(typeof e.start_seconds === 'number' && !isNaN(e.start_seconds) ? e.start_seconds : 0).toFixed(1)}s - {(typeof e.end_seconds === 'number' && !isNaN(e.end_seconds) ? e.end_seconds : 0).toFixed(1)}s
                        </span>
                      </div>
                      <p
                        className={`text-xs leading-relaxed font-normal p-2.5 rounded-lg border transition-all ${
                          isActive
                            ? 'bg-purple-950/80 text-white font-medium border-purple-500/60 shadow-inner'
                            : 'text-gray-200 bg-gray-900 border-gray-800 group-hover:border-purple-500/30'
                        }`}
                      >
                        "{e.text}"
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-gray-800 rounded-2xl space-y-3">
              <div className="w-12 h-12 bg-gray-900 text-gray-600 rounded-xl flex items-center justify-center text-xl">
                📝
              </div>
              <div className="space-y-1.5 max-w-sm">
                <h4 className="text-xs font-bold text-gray-300">Belum Ada Transkrip Part #{activePart}</h4>
                {currentAudio?.parts && currentAudio.parts.length > 1 ? (
                  <div className="p-3 bg-purple-950/40 border border-purple-800/50 rounded-xl text-left space-y-1">
                    <p className="text-[11px] font-semibold text-purple-200 flex items-center gap-1">
                      <span>🎙️</span> Audio Parts #{currentAudio.parts.join(', #')}
                    </p>
                    <p className="text-[11px] text-gray-400 leading-relaxed">
                      Klik <strong>"Copy Prompt #{activePart}"</strong> di sebelah kiri, buat transkrip di AI Studio, lalu tempel hasilnya via <strong>"Paste Transcript JSON"</strong>.
                    </p>
                    <p className="text-[10px] text-purple-400 font-mono pt-0.5">
                      ⚡ Grouped JSON otomatis membagi transkrip ke semua Part sekaligus!
                    </p>
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    Copy prompt di tengah, jalankan di AI Studio dengan voiceover audio, lalu paste hasilnya ke sini.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>📋</span> Paste / Edit Transcript JSON (Part #{activePart})
            </h3>

            {currentAudio?.parts && currentAudio.parts.length > 1 && (
              <div className="p-3 bg-purple-950/40 border border-purple-800/50 rounded-xl text-[11px] text-purple-300 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <span>💡</span> Fitur Multi-Part Audio Auto-Split Active:
                </p>
                <p className="text-gray-300 text-[10px]">
                  Kamu bisa paste <strong>Grouped Object JSON</strong> <code className="text-purple-300">{`{ "1": [...], "2": [...] }`}</code>. Sistem akan otomatis memecah & mengisi transkrip untuk Parts #{currentAudio.parts.join(', #')} sekaligus!
                </p>
              </div>
            )}

            <textarea
              value={pasteJsonInput}
              onChange={(e) => setPasteJsonInput(e.target.value)}
              placeholder={currentAudio?.parts && currentAudio.parts.length > 1
                ? `{\n  "1": [\n    { "id": 1, "start_seconds": 0.0, "end_seconds": 3.4, "timestamp_minute": "00:00 - 00:03", "text": "..." }\n  ],\n  "2": [\n    { "id": 1, "start_seconds": 105.2, "end_seconds": 109.1, "timestamp_minute": "01:45 - 01:49", "text": "..." }\n  ]\n}`
                : `[\n  {\n    "id": 1,\n    "start_seconds": 0.0,\n    "end_seconds": 3.4,\n    "timestamp_minute": "00:00 - 00:03",\n    "text": "..."\n  }\n]`
              }
              className="w-full h-64 bg-gray-950 text-gray-200 text-xs font-mono p-3 rounded-xl border border-gray-800 focus:border-purple-500 focus:outline-none resize-none"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowImportModal(false)} className="px-4 py-2 bg-gray-800 text-gray-300 rounded-xl text-xs font-medium">Batal</button>
              <button onClick={handleSaveImportedJson} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold">Save Transcript</button>
            </div>
          </div>
        </div>
      )}

      {/* Real-time WhisperX Log & Progress Modal Overlay */}
      {showAlignModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-gray-950 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg text-lg">⚡</span>
                <div>
                  <h3 className="text-sm font-bold text-white">WhisperX Voiceover Alignment Studio</h3>
                  <p className="text-[11px] text-gray-400">Automatic Audio Sync & Multi-Part Script Mapping</p>
                </div>
              </div>

              {!isAligning && (
                <button
                  onClick={() => setShowAlignModal(false)}
                  className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-semibold"
                >
                  Tutup
                </button>
              )}
            </div>

            {/* Modal Body */}
            <div className="p-5 flex flex-col space-y-4 flex-1 overflow-hidden">
              {/* Progress Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-emerald-400 capitalize">
                    {alignStage === 'preparing' && '⚙️ Stage 1: Preparing Script & Audio'}
                    {alignStage === 'loading_model' && '🧠 Stage 2: Loading Wav2Vec2 Model'}
                    {alignStage === 'aligning' && '🎙️ Stage 3: Aligning Voiceover Audio'}
                    {alignStage === 'mapping' && '🧩 Stage 4: Mapping Parts & Saving JSON'}
                    {alignStage === 'done' && '🎉 Stage 5: Completed Successfully!'}
                    {alignStage === 'error' && '❌ Alignment Failed'}
                  </span>
                  <span className="font-mono text-gray-300 font-bold">{alignProgress}%</span>
                </div>

                <div className="w-full bg-gray-800 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      alignStage === 'error'
                        ? 'bg-red-500'
                        : alignStage === 'done'
                        ? 'bg-emerald-500'
                        : 'bg-gradient-to-r from-emerald-500 to-teal-400 animate-pulse'
                    }`}
                    style={{ width: `${alignProgress}%` }}
                  />
                </div>
              </div>

              {/* Terminal Logs */}
              <div className="flex-1 min-h-[220px] flex flex-col bg-gray-950 border border-gray-800 rounded-xl p-3 font-mono text-xs overflow-hidden">
                <div className="flex items-center justify-between pb-2 border-b border-gray-800 mb-2 text-[10px] text-gray-400">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" /> Live Alignment Terminal
                  </span>
                  <span>Parts #{activeGroup.parts.join(', #')}</span>
                </div>

                <div ref={logContainerRef} className="flex-1 overflow-y-auto space-y-1 text-gray-300 text-[11px] leading-relaxed">
                  {alignLogs.map((log, i) => (
                    <div key={i} className={log.includes('ERROR') ? 'text-red-400 font-bold' : log.includes('Selesai') || log.includes('Successfully') ? 'text-emerald-400 font-bold' : ''}>
                      {log}
                    </div>
                  ))}
                  {isAligning && (
                    <div className="text-gray-500 animate-pulse">... processing ...</div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 bg-gray-950 border-t border-gray-800 flex items-center justify-end">
              {isAligning ? (
                <span className="text-xs text-gray-400 flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-emerald-400" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Processing alignment... Please wait
                </span>
              ) : (
                <button
                  onClick={() => setShowAlignModal(false)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow transition-all"
                >
                  Selesai
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlurfilmTranscriptStep;
