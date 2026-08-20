// dashboard/src/components/longform/AlurfilmMappingStep.tsx
import React, { useState, useEffect } from 'react';
import type { AlurfilmChunk, AlurfilmAudioResult, AlurfilmTranscriptResult, AlurfilmMappingResult } from '../../electron-api';

const api = window.electronAPI;

const AlurfilmMappingStep: React.FC = () => {
  const [contentId, setContentId] = useState<string | null>(null);
  const [chunks, setChunks] = useState<AlurfilmChunk[]>([]);
  const [audios, setAudios] = useState<Record<number, AlurfilmAudioResult>>({});
  const [transcripts, setTranscripts] = useState<Record<number, AlurfilmTranscriptResult>>({});
  const [mappings, setMappings] = useState<Record<number, AlurfilmMappingResult>>({});
  
  const [activePart, setActivePart] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Modal State
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [pasteJsonInput, setPasteJsonInput] = useState<string>('');

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
        // Chunks
        const chunkList = await api.listAlurfilmChunks(id);
        setChunks(chunkList || []);

        // Audios
        const audioList = await api.listAlurfilmAudios(id);
        const aMap: Record<number, AlurfilmAudioResult> = {};
        if (audioList) {
          for (const a of audioList) {
            if (a.parts) {
              a.parts.forEach((p) => { aMap[p] = a; });
            } else if (typeof a.part === 'number') {
              aMap[a.part] = a;
            }
          }
        }
        setAudios(aMap);

        // Transcripts
        const tList = await api.listAlurfilmTranscripts(id);
        const tMap: Record<number, AlurfilmTranscriptResult> = {};
        if (tList) { for (const t of tList) tMap[t.part] = t; }
        setTranscripts(tMap);

        // Mappings
        const mList = await api.listAlurfilmMappings(id);
        const mMap: Record<number, AlurfilmMappingResult> = {};
        if (mList) { for (const m of mList) mMap[m.part] = m; }
        setMappings(mMap);

        if (chunkList && chunkList.length > 0) {
          setActivePart(chunkList[0].part);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load mapping data');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCopyPromptForPart = async (partNum: number) => {
    try {
      const mainChunks = chunks.filter((c) => c.part > 0);
      const totalChunks = mainChunks.length > 0 ? mainChunks.length : (chunks.length || 1);
      let formattedPrompt = '';

      if (api.getAlurfilmMappingPrompt) {
        formattedPrompt = await api.getAlurfilmMappingPrompt(partNum, totalChunks);
      }

      if (!formattedPrompt) {
        const chunkInfo = chunks.find((c) => c.part === partNum);
        const transcriptResult = transcripts[partNum];
        const rawEntries = transcriptResult?.data || transcriptResult?.entries || [];

        const voiceoverSentences = Array.isArray(rawEntries)
          ? rawEntries.map((t: any, idx) => ({
              sentence_index: idx,
              text: t.text || t.narration || '',
              start: typeof t.start_seconds === 'number' ? t.start_seconds : (t.start || 0.0),
              end: typeof t.end_seconds === 'number' ? t.end_seconds : (t.end || 0.0),
              duration: Number(((typeof t.end_seconds === 'number' ? t.end_seconds : (t.end || 0)) - (typeof t.start_seconds === 'number' ? t.start_seconds : (t.start || 0))).toFixed(2))
            }))
          : [];

        let promptTpl = await api.readFromProject('dashboard/prompts/longform/alurfilm-mapping-prompt.md');
        if (!promptTpl) {
          promptTpl = await api.readFromProject('dashboard/prompts/longform/mapping-prompt.md');
        }
        if (!promptTpl) {
          promptTpl = `Kamu adalah Editor Video Profesional untuk Alur Cerita Film (16:9). Part {{chunk_part}} dari {{total_chunks}}. Source: {{source_video_name}}. Voiceover sentences: {{voiceover_sentences}}`;
        }

        const audioInfo = audios[partNum];
        const audioVoFileName = audioInfo?.name || `audio_part_${partNum}.wav`;
        const totalAudioDurSec = voiceoverSentences.length > 0 ? (voiceoverSentences[voiceoverSentences.length - 1].end || 0) : 0;
        const mins = Math.floor(totalAudioDurSec / 60);
        const secs = (totalAudioDurSec % 60).toFixed(1);
        const totalAudioDurFormatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(4, '0')}`;
        const audioStartTimestamp = voiceoverSentences.length > 0 ? `${voiceoverSentences[0].start.toFixed(1)}s` : '0.0s';
        const audioEndTimestamp = voiceoverSentences.length > 0 ? `${voiceoverSentences[voiceoverSentences.length - 1].end.toFixed(1)}s` : `${totalAudioDurSec}s`;

        const prevPartNum = partNum - 1;
        const prevMapping = prevPartNum > 0 ? mappings[prevPartNum] : null;
        let prevEndingBgm = 'None (Awal Part #1)';
        const prevBgmList = (prevMapping as any)?.bgm_timeline || (prevMapping as any)?.data?.bgm_timeline;
        if (Array.isArray(prevBgmList) && prevBgmList.length > 0) {
          const lastBgm = prevBgmList[prevBgmList.length - 1];
          prevEndingBgm = `"${lastBgm.category || lastBgm.category_name}" (${lastBgm.file || lastBgm.filename})`;
        }

        formattedPrompt = promptTpl
          .replace(/\{\{chunk_part\}\}/g, String(partNum))
          .replace(/\{\{total_chunks\}\}/g, String(totalChunks))
          .replace(/\{\{source_video_name\}\}/g, chunkInfo ? chunkInfo.name : `part_${partNum}.mp4`)
          .replace(/\{\{scene_id\}\}/g, `scene_p${partNum}`)
          .replace(/\{\{voiceover_sentences\}\}/g, JSON.stringify(voiceoverSentences, null, 2))
          .replace(/\{\{audio_vo_file_name\}\}/g, audioVoFileName)
          .replace(/\{\{total_audio_duration_sec\}\}/g, String(totalAudioDurSec.toFixed(2)))
          .replace(/\{\{total_audio_duration_formatted\}\}/g, totalAudioDurFormatted)
          .replace(/\{\{total_sentences_count\}\}/g, String(voiceoverSentences.length))
          .replace(/\{\{audio_start_timestamp\}\}/g, audioStartTimestamp)
          .replace(/\{\{audio_end_timestamp\}\}/g, audioEndTimestamp)
          .replace(/\{\{previous_part_ending_bgm\}\}/g, prevEndingBgm);
      }

      if (api.copyToClipboard) {
        await api.copyToClipboard(formattedPrompt);
        showToast(`📋 Copied Video Mapping Prompt for Part #${partNum}!`);
      }
    } catch (err: any) {
      setError(`Failed to format prompt: ${err.message}`);
    }
  };

  const handleSaveImportedMapping = async () => {
    if (!pasteJsonInput.trim()) return;
    setError(null);
    try {
      let raw = pasteJsonInput.trim();
      if (raw.startsWith('```')) {
        raw = raw.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      }
      const parsed = JSON.parse(raw);

      const res = await api.saveAlurfilmMapping(contentId || 'default', activePart, raw);
      if (api.listAlurfilmMappings) {
        const updatedList = await api.listAlurfilmMappings(contentId || undefined);
        const mapObj: Record<number, any> = {};
        if (Array.isArray(updatedList)) {
          updatedList.forEach((m: any) => {
            mapObj[m.part] = m;
          });
        }
        setMappings(mapObj);
      } else {
        setMappings((prev) => ({ ...prev, [activePart]: res }));
      }
      setShowImportModal(false);
      setPasteJsonInput('');
      showToast(`🎉 Saved Video Mapping for Part #${activePart}!`);
    } catch (err: any) {
      setError(`Invalid JSON Syntax: ${err.message}`);
    }
  };

  const getNormalizedMapping = (partNum: number) => {
    const raw = mappings[partNum]?.data;
    if (!raw) return null;
    if (Array.isArray(raw)) {
      if (raw.length === 0) return null;
      const match = raw.find((m: any) => m && (m.chunk_part === partNum || m.part === partNum || (typeof m.scene_id === 'string' && m.scene_id.includes(String(partNum))))) || raw[0];
      return match;
    }
    return raw;
  };

  const currentMapping = getNormalizedMapping(activePart);

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
            <span className="p-2 bg-purple-600/20 text-purple-400 rounded-lg text-lg">🎯</span>
            Alur Film Video Mapping Studio
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Map voiceover transcript sentences with source video cuts (`source_start_seconds`, `slow_motion`, `mirror_cut`).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (currentMapping) setPasteJsonInput(JSON.stringify(currentMapping, null, 2));
              else setPasteJsonInput('');
              setShowImportModal(true);
            }}
            className="px-3.5 py-1.5 bg-gray-900 hover:bg-gray-800 border border-gray-800 text-purple-300 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5"
          >
            <span>📋</span> {currentMapping ? 'Edit / Replace Mapping' : 'Paste Mapping JSON'}
          </button>
        </div>
      </div>

      {/* Main Grid Workspace with Side Parts List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-5 flex-1 min-h-0 overflow-hidden">
        {/* SIDE COLUMN: Vertical Parts Selector (Col 2) */}
        <div className="lg:col-span-2 flex flex-col bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden shadow-xl p-3.5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-gray-800 shrink-0">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              Parts ({chunks.length})
            </span>
            <span className="text-[10px] text-purple-400 font-mono font-bold font-mono">Cuts</span>
          </div>

          {chunks.length > 0 ? (
            <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-0.5">
              {chunks.map((chunk) => {
                const normData = getNormalizedMapping(chunk.part);
                const isDone = Boolean(normData?.mappings && normData.mappings.length > 0);
                const isActive = activePart === chunk.part;
                return (
                  <button
                    key={chunk.part}
                    onClick={() => setActivePart(chunk.part)}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-bold font-mono transition-all flex items-center justify-between border ${
                      isActive
                        ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-600/30'
                        : isDone
                        ? 'bg-purple-950/40 border-purple-800/60 text-purple-300 hover:bg-purple-900/50'
                        : 'bg-gray-950 border-gray-800 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <span>Part #{chunk.part}</span>
                    <span className="text-xs">{isDone ? '✓' : '○'}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-[11px] text-amber-400 p-2 text-center">
              Belum ada part split.
            </div>
          )}
        </div>

        {/* CENTER PANEL: Prompt Generator & Context (Col 5) */}
        <div className="lg:col-span-5 flex flex-col bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden shadow-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-800">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>🤖</span> Part #{activePart} Mapping Prompt
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Generate prompt for AI Studio with 10-Min Video Chunk attached.
              </p>
            </div>

            <button
              onClick={() => handleCopyPromptForPart(activePart)}
              className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold shadow transition-all flex items-center gap-1.5"
            >
              <span>📋</span> Copy Prompt #Part {activePart}
            </button>
          </div>

          <div className="flex-1 bg-gray-950 p-4 rounded-xl border border-gray-800 overflow-y-auto space-y-3 font-mono text-xs text-gray-300 leading-relaxed">
            <p className="text-purple-400 font-bold">// Video Synchronization Prompt</p>
            <p>- Part: {activePart} of {chunks.length || 1}</p>
            <p>- Single Source of Truth: Voiceover Transcript Sentence Sentences</p>
            <p>- Fair-Use Effects: Slow Motion (~30%), Mirror Cut (~25%), Zoom (~20%), Video Cut (~15%)</p>
          </div>

          {error && (
            <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-xl text-xs text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* RIGHT PANEL: Mapping Timeline Viewer (Col 5) */}
        <div className="lg:col-span-5 flex flex-col bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden shadow-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-800 shrink-0">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>🎯</span> Visual Cuts Mapping
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Sentence-by-sentence visual cuts timeline layout.
              </p>
            </div>

            {currentMapping && (
              <button
                onClick={() => {
                  if (api.copyToClipboard) {
                    api.copyToClipboard(JSON.stringify(currentMapping, null, 2));
                    showToast(`Copied Mapping JSON for Part #${activePart}!`);
                  }
                }}
                className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-xs font-medium transition-all"
              >
                📋 Copy JSON
              </button>
            )}
          </div>

          {currentMapping && currentMapping.mappings ? (
            <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1">
              {currentMapping.mappings.map((m: any, idx: number) => (
                <div key={idx} className="p-3.5 bg-gray-950 rounded-xl border border-gray-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-purple-400 font-mono">Sentence #{m.sentence_index ?? idx}</span>
                    <span className="text-gray-400 font-mono text-[11px]">Duration: <strong className="text-white">{m.duration || m.end - m.start}s</strong></span>
                  </div>
                  <p className="text-xs text-gray-200 italic font-mono bg-gray-900 p-2 rounded-lg border border-gray-800">
                    "{m.text}"
                  </p>

                  <div className="space-y-1 pt-1">
                    <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Visual Cuts ({m.visuals?.length || 0})</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {m.visuals?.map((v: any, vIdx: number) => (
                        <div key={vIdx} className="p-2 bg-gray-900 rounded-lg border border-gray-800 text-[11px] font-mono space-y-0.5">
                          <div className="flex justify-between text-purple-300 font-bold">
                            <span>{v.type}</span>
                            <span>{v.duration}s</span>
                          </div>
                          <span className="text-gray-500 text-[10px] block">start: {v.source_start_seconds}s</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border border-dashed border-gray-800 rounded-2xl space-y-3">
              <div className="w-12 h-12 bg-gray-900 text-gray-600 rounded-xl flex items-center justify-center text-xl">
                🎯
              </div>
              <div>
                <h4 className="text-xs font-bold text-gray-400">Belum Ada Video Mapping Part #{activePart}</h4>
                <p className="text-[11px] text-gray-500 mt-1 max-w-xs">
                  Copy prompt di tengah, jalankan di AI Studio dengan video 10-menit attached, lalu paste hasilnya ke sini.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>📋</span> Paste / Edit Video Mapping JSON (Part #{activePart})
            </h3>
            <textarea
              value={pasteJsonInput}
              onChange={(e) => setPasteJsonInput(e.target.value)}
              placeholder={`{\n  "scene_id": "scene_p${activePart}",\n  "mappings": [\n    {\n      "sentence_index": 0,\n      "text": "...",\n      "duration": 5.0,\n      "visuals": []\n    }\n  ]\n}`}
              className="w-full h-64 bg-gray-950 text-gray-200 text-xs font-mono p-3 rounded-xl border border-gray-800 focus:border-purple-500 focus:outline-none resize-none"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowImportModal(false)} className="px-4 py-2 bg-gray-800 text-gray-300 rounded-xl text-xs font-medium">Batal</button>
              <button onClick={handleSaveImportedMapping} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold">Save Mapping</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlurfilmMappingStep;
