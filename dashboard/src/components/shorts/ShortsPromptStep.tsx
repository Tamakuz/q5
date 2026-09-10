// dashboard/src/components/shorts/ShortsPromptStep.tsx
import React, { useState, useEffect } from 'react';
import type { ShortsCraftPromptData } from '../../electron-api';

const PRESET_IDEAS = [
  'Tempat Pensil Mekanik Otomatis',
  'Mini Vending Machine Minuman Kaleng',
  'Lamborghini Mini Car Kayu & Akrilik',
  'Brankas Miniatur Sistem Password Gear',
  'Lighter Box Cyberpunk Mekanisme Pegas',
  'Mini Dispenser Sirup Hidrolik',
  'Pisau Lipat Kerajinan Saku Titanium Style',
];

interface ShortsPromptStepProps {
  onNavigateToMerger?: () => void;
}

export const ShortsPromptStep: React.FC<ShortsPromptStepProps> = ({ onNavigateToMerger }) => {
  const [itemTitle, setItemTitle] = useState<string>('');
  const [customInstructions, setCustomInstructions] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [promptData, setPromptData] = useState<ShortsCraftPromptData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'both' | 'part1' | 'part2' | 'json'>('both');

  useEffect(() => {
    (async () => {
      try {
        if (window.electronAPI?.getLatestShortsPrompt) {
          const res = await window.electronAPI.getLatestShortsPrompt();
          if (res.success && res.data) {
            setPromptData(res.data);
          }
        }
      } catch {}
    })();
  }, []);

  const handleCopy = async (text: string, key: string) => {
    if (window.electronAPI?.copyToClipboard) {
      await window.electronAPI.copyToClipboard(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  const handleGenerate = async (forcedTitle?: string) => {
    const titleToUse = typeof forcedTitle === 'string' ? forcedTitle : itemTitle;
    setIsGenerating(true);
    setErrorMessage(null);

    try {
      if (window.electronAPI?.generateShortsPrompt) {
        const res = await window.electronAPI.generateShortsPrompt({
          itemTitle: titleToUse,
          customInstructions,
        });

        if (res.success && res.data) {
          setPromptData(res.data);
        } else {
          setErrorMessage(res.error || 'Gagal menghasilkan prompt video Shorts.');
        }
      } else {
        setErrorMessage('Fitur API generate prompt belum tersedia.');
      }
    } catch (err: any) {
      setErrorMessage(`Terjadi kesalahan generate: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      {/* Header Banner */}
      <div className="bg-gray-900/90 border border-gray-800 rounded-3xl p-6 shadow-2xl backdrop-blur-md relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-amber-950/80 text-amber-300 border border-amber-700/50 text-[11px] font-mono font-bold tracking-wider uppercase">
              ⚡ Step 1: AI Prompt & VO Director
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-gray-800 text-gray-400 text-[10px] font-mono border border-gray-700">
              9:16 First-Person POV • 2-Part Linear
            </span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <span>🎬</span> AI Video Prompt & Voiceover Generator
          </h1>
          <p className="text-xs text-gray-400 leading-relaxed max-w-3xl">
            Menyiapkan 8 prompt video AI terstruktur (Bahasa Inggris standar tinggi untuk text-to-video generator) dan skrip narasi Voice Over Bahasa Indonesia dengan hook 2 detik awal & loop ending. AI dapat memutuskan ide proyek secara mandiri (*AI Decision Mode*).
          </p>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="bg-red-950/40 border border-red-800/60 rounded-2xl p-4 flex items-start gap-3 shadow-lg">
          <span className="text-xl">⚠️</span>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-red-300">Gagal Menghasilkan Prompt</h4>
            <p className="text-xs text-red-200/80 mt-0.5 whitespace-pre-wrap">{errorMessage}</p>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-red-200 text-xs font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Input Generator Box */}
      <div className="bg-gray-900/70 border border-gray-800 rounded-3xl p-6 shadow-xl space-y-5">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-2">
              <span>🎯</span> Nama Proyek / Benda Kerajinan (Opsional)
            </label>
            <span className="text-[11px] font-mono text-amber-400">
              *Kosongkan untuk AI Decision Mode
            </span>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={itemTitle}
              onChange={(e) => setItemTitle(e.target.value)}
              placeholder='Contoh: "TEMPAT PENSIL MEKANIK" atau "MINI VENDING MACHINE"'
              disabled={isGenerating}
              className="flex-1 bg-gray-950 border border-gray-800 focus:border-amber-500 rounded-2xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none transition-all shadow-inner font-medium"
            />
            <button
              onClick={() => handleGenerate()}
              disabled={isGenerating}
              className={`px-6 py-3 rounded-2xl text-xs font-extrabold uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-2 shrink-0 ${
                isGenerating
                  ? 'bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed'
                  : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-gray-950 shadow-amber-600/30'
              }`}
            >
              {isGenerating ? (
                <>
                  <span className="animate-spin text-sm">⏳</span>
                  <span>AI Sedang Merancang...</span>
                </>
              ) : (
                <>
                  <span className="text-sm">⚡</span>
                  <span>{itemTitle.trim() ? 'Generate Prompt Benda Ini' : 'Generate Otomatis (AI Decision)'}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Preset Idea Pills */}
        <div className="space-y-2 pt-2 border-t border-gray-800/80">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
            Rekomendasi Ide Viral Cepat (Klik untuk langsung generate):
          </span>
          <div className="flex flex-wrap gap-2">
            {PRESET_IDEAS.map((idea) => (
              <button
                key={idea}
                onClick={() => {
                  setItemTitle(idea);
                  handleGenerate(idea);
                }}
                disabled={isGenerating}
                className="px-3 py-1.5 rounded-xl bg-gray-950 hover:bg-gray-800 text-gray-400 hover:text-amber-300 border border-gray-800 hover:border-amber-500/40 text-xs font-medium transition-all flex items-center gap-1.5"
              >
                <span>💡</span>
                <span>{idea}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Generated Result Display */}
      {promptData && (
        <div className="space-y-6 animate-in fade-in zoom-in-95">
          {/* Project Header Info Card */}
          <div className="bg-gradient-to-r from-gray-900 via-gray-900 to-amber-950/20 border border-amber-500/30 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-mono font-bold uppercase">
                  {promptData.project_category || 'Craftsman Project'}
                </span>
                <span className="text-xs text-gray-500">•</span>
                <span className="text-xs text-gray-400 font-medium">Total: 20 Detik (10s + 10s)</span>
              </div>
              <h2 className="text-xl font-black text-white">{promptData.project_name}</h2>
              <p className="text-xs text-amber-200/80 font-medium flex items-center gap-1.5">
                <span>🔥</span> <em>"{promptData.concept_hook}"</em>
              </p>
            </div>

            {/* Navigation to Step 2 */}
            {onNavigateToMerger && (
              <button
                onClick={onNavigateToMerger}
                className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-purple-600/30 flex items-center gap-2 shrink-0 self-start md:self-auto"
              >
                <span>Lanjut ke Upload & Merge</span>
                <span>➔</span>
              </button>
            )}
          </div>

          {/* View Tab Filter */}
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-gray-800 pb-3">
            <div className="flex items-center gap-1.5 bg-gray-950 p-1 rounded-xl border border-gray-800">
              <button
                onClick={() => setActiveTab('both')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'both' ? 'bg-amber-500 text-gray-950 shadow' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Tampilkan Keduanya (Part 1 & 2)
              </button>
              <button
                onClick={() => setActiveTab('part1')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'part1' ? 'bg-amber-500 text-gray-950 shadow' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Part 1 (Pemotongan)
              </button>
              <button
                onClick={() => setActiveTab('part2')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'part2' ? 'bg-amber-500 text-gray-950 shadow' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Part 2 (Perakitan & Reveal)
              </button>
              <button
                onClick={() => setActiveTab('json')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'json' ? 'bg-amber-500 text-gray-950 shadow' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Raw JSON
              </button>
            </div>

            <button
              onClick={() => handleCopy(JSON.stringify(promptData, null, 2), 'full_json')}
              className="px-3.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold rounded-xl border border-gray-700 transition-all flex items-center gap-1.5"
            >
              <span>{copiedKey === 'full_json' ? '✓' : '📋'}</span>
              <span>{copiedKey === 'full_json' ? 'JSON Tersalin!' : 'Salin Semua JSON'}</span>
            </button>
          </div>

          {/* Raw JSON View */}
          {activeTab === 'json' && (
            <div className="bg-gray-950 rounded-2xl border border-gray-800 p-4 font-mono text-xs text-amber-300 overflow-x-auto max-h-[500px] select-all shadow-inner">
              <pre>{JSON.stringify(promptData, null, 2)}</pre>
            </div>
          )}

          {/* Parts Grid View */}
          {activeTab !== 'json' && (
            <div className={`grid gap-6 ${activeTab === 'both' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
              {/* Part 1 Box */}
              {(activeTab === 'both' || activeTab === 'part1') && (
                <div className="bg-gray-900/80 border border-gray-800 rounded-3xl p-6 shadow-xl space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-gray-800">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 font-black text-xs flex items-center justify-center border border-amber-500/30">
                          1
                        </span>
                        <h3 className="text-sm font-extrabold text-white">
                          PART 1: Raw Prep & Brutal Cutting (00:00 - 00:10)
                        </h3>
                      </div>
                      <span className="text-[10px] text-amber-400/90 font-mono block pl-8">
                        ⚠️ ATURAN: Bentuk akhir belum dimunculkan!
                      </span>
                    </div>
                  </div>

                  {/* Combined Video Prompt Card */}
                  <div className="space-y-2 bg-gray-950 p-4 rounded-2xl border border-gray-800">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 font-mono flex items-center gap-1.5">
                        <span>🎥</span> Prompt Video Part 1 (English for Generator)
                      </span>
                      <button
                        onClick={() => handleCopy(promptData.part1.combined_video_prompt, 'p1_video')}
                        className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px] font-bold rounded-lg border border-amber-500/30 transition-all flex items-center gap-1"
                      >
                        <span>{copiedKey === 'p1_video' ? '✓' : '📋'}</span>
                        <span>{copiedKey === 'p1_video' ? 'Tersalin!' : 'Salin Prompt Video'}</span>
                      </button>
                    </div>
                    <p className="text-xs text-gray-300 leading-relaxed italic bg-gray-900/60 p-3 rounded-xl border border-gray-800/80 select-all font-sans">
                      {promptData.part1.combined_video_prompt}
                    </p>
                  </div>

                  {/* 4 Shots Breakdown */}
                  <div className="space-y-2.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 font-mono block">
                      Struktur 4 Shot Sinematik:
                    </span>
                    <div className="space-y-2">
                      {promptData.part1.video_prompts.map((shot) => (
                        <div key={shot.shot_number} className="bg-gray-950/80 p-3 rounded-xl border border-gray-800/80 space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-mono">
                            <span className="text-amber-400 font-bold">Shot #{shot.shot_number}</span>
                            <span className="text-gray-500">{shot.timestamp}</span>
                          </div>
                          <p className="text-xs text-gray-300">{shot.action}</p>
                          <div className="text-[10px] text-gray-500 flex flex-wrap gap-2 pt-1 font-mono">
                            <span>🎥 {shot.camera_movement}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Voice Over Script Card */}
                  <div className="space-y-2 bg-purple-950/20 p-4 rounded-2xl border border-purple-900/40">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300 font-mono flex items-center gap-1.5">
                        <span>🎙️</span> Narasi Voice Over (00:00 - 00:10)
                      </span>
                      <button
                        onClick={() => handleCopy(promptData.part1.voiceover.full_script, 'p1_vo')}
                        className="px-2.5 py-1 bg-purple-900/40 hover:bg-purple-800/60 text-purple-300 text-[10px] font-bold rounded-lg border border-purple-700/50 transition-all flex items-center gap-1"
                      >
                        <span>{copiedKey === 'p1_vo' ? '✓' : '📋'}</span>
                        <span>{copiedKey === 'p1_vo' ? 'Tersalin!' : 'Salin Naskah VO'}</span>
                      </button>
                    </div>

                    {promptData.part1.voiceover.hook_first_2s && (
                      <div className="bg-amber-950/40 p-2 rounded-lg border border-amber-800/40 text-[11px] text-amber-300 font-semibold">
                        ⚡ <strong>Hook 2 Detik Awal:</strong> "{promptData.part1.voiceover.hook_first_2s}"
                      </div>
                    )}

                    <p className="text-xs text-gray-200 leading-relaxed bg-gray-950/60 p-3 rounded-xl border border-gray-800 font-medium">
                      "{promptData.part1.voiceover.full_script}"
                    </p>
                    <span className="text-[10px] text-gray-500 font-mono block">
                      Tempo: {promptData.part1.voiceover.pacing || 'Cepat & Berenergi (10 detik)'}
                    </span>
                  </div>
                </div>
              )}

              {/* Part 2 Box */}
              {(activeTab === 'both' || activeTab === 'part2') && (
                <div className="bg-gray-900/80 border border-gray-800 rounded-3xl p-6 shadow-xl space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-gray-800">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 font-black text-xs flex items-center justify-center border border-emerald-500/30">
                          2
                        </span>
                        <h3 className="text-sm font-extrabold text-white">
                          PART 2: Assembly, Sanding & Reveal (00:10 - 00:20)
                        </h3>
                      </div>
                      <span className="text-[10px] text-emerald-400/90 font-mono block pl-8">
                        ✨ CLIMAX: Perakitan, tiup debu, dan unjuk fungsi nyata!
                      </span>
                    </div>
                  </div>

                  {/* Combined Video Prompt Card */}
                  <div className="space-y-2 bg-gray-950 p-4 rounded-2xl border border-gray-800">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 font-mono flex items-center gap-1.5">
                        <span>🎥</span> Prompt Video Part 2 (English for Generator)
                      </span>
                      <button
                        onClick={() => handleCopy(promptData.part2.combined_video_prompt, 'p2_video')}
                        className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-bold rounded-lg border border-emerald-500/30 transition-all flex items-center gap-1"
                      >
                        <span>{copiedKey === 'p2_video' ? '✓' : '📋'}</span>
                        <span>{copiedKey === 'p2_video' ? 'Tersalin!' : 'Salin Prompt Video'}</span>
                      </button>
                    </div>
                    <p className="text-xs text-gray-300 leading-relaxed italic bg-gray-900/60 p-3 rounded-xl border border-gray-800/80 select-all font-sans">
                      {promptData.part2.combined_video_prompt}
                    </p>
                  </div>

                  {/* 4 Shots Breakdown */}
                  <div className="space-y-2.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 font-mono block">
                      Struktur 4 Shot Sinematik:
                    </span>
                    <div className="space-y-2">
                      {promptData.part2.video_prompts.map((shot) => (
                        <div key={shot.shot_number} className="bg-gray-950/80 p-3 rounded-xl border border-gray-800/80 space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-mono">
                            <span className="text-emerald-400 font-bold">Shot #{shot.shot_number}</span>
                            <span className="text-gray-500">{shot.timestamp}</span>
                          </div>
                          <p className="text-xs text-gray-300">{shot.action}</p>
                          <div className="text-[10px] text-gray-500 flex flex-wrap gap-2 pt-1 font-mono">
                            <span>🎥 {shot.camera_movement}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Voice Over Script Card */}
                  <div className="space-y-2 bg-purple-950/20 p-4 rounded-2xl border border-purple-900/40">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300 font-mono flex items-center gap-1.5">
                        <span>🎙️</span> Narasi Voice Over (00:10 - 00:20)
                      </span>
                      <button
                        onClick={() => handleCopy(promptData.part2.voiceover.full_script, 'p2_vo')}
                        className="px-2.5 py-1 bg-purple-900/40 hover:bg-purple-800/60 text-purple-300 text-[10px] font-bold rounded-lg border border-purple-700/50 transition-all flex items-center gap-1"
                      >
                        <span>{copiedKey === 'p2_vo' ? '✓' : '📋'}</span>
                        <span>{copiedKey === 'p2_vo' ? 'Tersalin!' : 'Salin Naskah VO'}</span>
                      </button>
                    </div>

                    <p className="text-xs text-gray-200 leading-relaxed bg-gray-950/60 p-3 rounded-xl border border-gray-800 font-medium">
                      "{promptData.part2.voiceover.full_script}"
                    </p>

                    {promptData.part2.voiceover.loop_transition_phrase && (
                      <div className="bg-purple-900/30 p-2 rounded-lg border border-purple-800/40 text-[11px] text-purple-200 flex items-center gap-1.5">
                        <span>🔄</span>
                        <span><strong>Seamless Loop:</strong> Menyambung kembali ke hook awal Part 1.</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ShortsPromptStep;

