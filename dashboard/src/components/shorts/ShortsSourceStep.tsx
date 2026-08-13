// dashboard/src/components/shorts/ShortsSourceStep.tsx
import React, { useState, useEffect } from 'react';

interface GeneratedKeyword {
  id: string;
  sub_niche: string;
  keyword: string;
  youtube_search_url: string;
  target_market: string;
  used_at: string;
  expires_at: string;
}

interface KeywordsHistoryData {
  cooldown_days: number;
  history: GeneratedKeyword[];
}

const SUB_NICHE_ICONS: Record<string, string> = {
  'Mass Food Production': '🍕',
  'Industrial Manufacturing': '⚙️',
  'Master Crafting & Rare Processing': '🔪',
  'Woodworking & Resin Crafting': '🪵',
};

const ShortsSourceStep: React.FC = () => {
  const [videoUrl, setVideoUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentKeywords, setCurrentKeywords] = useState<GeneratedKeyword[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeHistory, setActiveHistory] = useState<GeneratedKeyword[]>([]);

  // Load active history & today's keywords on component mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        if (window.electronAPI?.readFromProject) {
          const raw = await window.electronAPI.readFromProject('input/shorts/keywords-history.json');
          if (raw) {
            const data: KeywordsHistoryData = typeof raw === 'string' ? JSON.parse(raw) : raw;
            const now = new Date();
            const active = (data.history || []).filter((item) => new Date(item.expires_at) > now);
            setActiveHistory(active);

            // Automatically load keywords generated today if present
            const todays = (data.history || []).filter((item) => {
              if (!item.used_at) return false;
              const d = new Date(item.used_at);
              return (
                d.getFullYear() === now.getFullYear() &&
                d.getMonth() === now.getMonth() &&
                d.getDate() === now.getDate()
              );
            });

            if (todays.length >= 4) {
              setCurrentKeywords(todays.slice(0, 4));
            }
          }
        }
      } catch (err) {
        console.warn('Failed to load keywords history from input/shorts/keywords-history.json:', err);
      }
    };
    loadHistory();
  }, []);

  const isGeneratedToday = currentKeywords.length >= 4 && currentKeywords.some((item) => {
    if (!item.used_at) return false;
    const d = new Date(item.used_at);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  });

  const handleGenerateKeywords = async () => {
    setIsGenerating(true);
    setErrorMessage(null);

    try {
      if (window.electronAPI?.generateShortsKeywords) {
        const res = await window.electronAPI.generateShortsKeywords({ model: 'ag/gemini-3-flash-agent' });
        if (res.success && res.keywords) {
          setCurrentKeywords(res.keywords);
          setActiveHistory(res.activeHistory || []);
          return;
        }
      }

      // Fallback web fetch if IPC is not available
      const now = new Date();
      const expires = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      const blacklist = activeHistory.map((k) => k.keyword.toLowerCase());

      const response = await fetch('https://9router.riztama.my.id/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer sk-6b3ac6ef8e3b70c9-eyxuxt-7adfd291',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'ag/gemini-3-flash-agent',
          messages: [
            {
              role: 'system',
              content: 'You are an expert YouTube Shorts Production Strategist specializing in Factory, Industrial Manufacturing, Master Crafting, and Resin Woodworking niches targeting US audiences.',
            },
            {
              role: 'user',
              content: `Generate EXACTLY 4 high-converting longform search keywords in English (1 per sub-niche: 1. Mass Food Production, 2. Industrial Manufacturing, 3. Master Crafting & Rare Processing, 4. Woodworking & Resin Crafting).
Rules:
- DO NOT use these active blacklisted keywords from the last 14 days: ${JSON.stringify(blacklist)}
Format: Return ONLY a valid JSON array of 4 objects with fields "sub_niche" and "keyword".`,
            },
          ],
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`9router API Request Failed (${response.status}): ${errText}`);
      }

      const data = await response.json();
      let rawText = data?.choices?.[0]?.message?.content || '';

      if (!rawText) {
        throw new Error('9router API returned empty response content.');
      }

      if (rawText.includes('```')) {
        const match = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
        if (match && match[1]) rawText = match[1].trim();
      }

      const jsonMatch = rawText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error(`Invalid JSON format returned from 9router: ${rawText}`);
      }

      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed) || parsed.length !== 4) {
        throw new Error(`Invalid keyword count returned (Expected 4, received ${parsed?.length || 0})`);
      }

      const newKeywords: GeneratedKeyword[] = parsed.map((item: any, idx: number) => ({
        id: `kw_${now.getTime()}_${idx}`,
        sub_niche: item.sub_niche || 'Sub-Niche',
        keyword: item.keyword,
        youtube_search_url: `https://www.youtube.com/results?search_query=${encodeURIComponent(item.keyword)}`,
        target_market: 'US',
        used_at: now.toISOString(),
        expires_at: expires.toISOString(),
      }));

      // Persist directly to input/shorts/keywords-history.json
      let existingData: KeywordsHistoryData = { cooldown_days: 14, history: [] };
      if (window.electronAPI?.readFromProject) {
        try {
          const raw = await window.electronAPI.readFromProject('input/shorts/keywords-history.json');
          if (raw) {
            existingData = typeof raw === 'string' ? JSON.parse(raw) : raw;
          }
        } catch {
          // Default empty
        }
      }

      const updatedHistory = [...newKeywords, ...(existingData.history || [])];
      const updatedData: KeywordsHistoryData = {
        cooldown_days: existingData.cooldown_days || 14,
        history: updatedHistory,
      };

      if (window.electronAPI?.saveToProject) {
        await window.electronAPI.saveToProject('input/shorts/keywords-history.json', JSON.stringify(updatedData, null, 2));
      }

      setCurrentKeywords(newKeywords);
      setActiveHistory(updatedHistory.filter((item) => new Date(item.expires_at) > now));
    } catch (err: any) {
      console.error('9router API generation error:', err);
      setErrorMessage(err.message || 'Gagal me-generate keyword dari 9router API.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyKeyword = (item: GeneratedKeyword) => {
    navigator.clipboard.writeText(item.keyword);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleOpenSearch = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="p-6 bg-gray-950/90 border border-gray-800 rounded-3xl min-h-full space-y-8 text-gray-100">
      {/* Step Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-800/80 pb-5 gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 bg-amber-500/10 text-amber-400 rounded-2xl flex items-center justify-center text-2xl border border-amber-500/20 shadow-lg shadow-amber-950/40">
            🎯
          </div>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
              Step 1: Daily AI Sourcing & Clip Selection
              <span className="px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800/60 text-xs font-mono font-semibold">
                Shorts Factory (9:16)
              </span>
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Riset keyword pencarian video *longform* target US dengan proteksi cooldown 14 hari anti-duplikat.
            </p>
          </div>
        </div>

        {/* Global Strategy Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-3 py-1 bg-blue-950/80 border border-blue-800/60 text-blue-300 rounded-xl text-xs font-medium flex items-center gap-1.5">
            <span>🇺🇸</span> US Market
          </span>
          <span className="px-3 py-1 bg-emerald-950/80 border border-emerald-800/60 text-emerald-300 rounded-xl text-xs font-medium flex items-center gap-1.5">
            <span>🛡️</span> 14-Day Cooldown
          </span>
          <span className="px-3 py-1 bg-purple-950/80 border border-purple-800/60 text-purple-300 rounded-xl text-xs font-medium flex items-center gap-1.5">
            <span>📊</span> 4 Shorts / Day
          </span>
        </div>
      </div>

      {/* AI Keyword Generator Banner */}
      <div className="bg-gradient-to-br from-amber-950/40 via-gray-900/80 to-gray-950 border border-amber-500/30 p-6 rounded-2xl relative overflow-hidden shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 z-10 relative">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-amber-400 text-lg">✨</span>
              <h2 className="text-base font-bold text-amber-200">Daily 9router AI Sourcing Generator</h2>
            </div>
            <p className="text-xs text-gray-400 max-w-xl">
              Hasilkan 4 keyword penelusuran YouTube *longform* ter-update via <code className="text-amber-300 bg-amber-950/80 px-1 py-0.5 rounded font-mono">ag/gemini-3-flash-agent</code>.
              Keyword otomatis tersimpan ke 
              <code className="text-amber-300 bg-amber-950/80 px-1.5 py-0.5 rounded mx-1 font-mono">input/shorts/keywords-history.json</code>
              sehingga terbebas dari duplikasi 14 hari.
            </p>
          </div>

          <div className="flex flex-col items-end gap-1">
            <button
              onClick={handleGenerateKeywords}
              disabled={isGenerating || isGeneratedToday}
              className={`px-6 py-3 font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
                isGeneratedToday
                  ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-700/60 cursor-default opacity-90 shadow-emerald-950/30'
                  : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-gray-950 shadow-amber-600/25 transform active:scale-95 disabled:opacity-50'
              }`}
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-gray-950 border-t-transparent rounded-full animate-spin"></div>
                  <span>Generating via 9router...</span>
                </>
              ) : isGeneratedToday ? (
                <>
                  <span>✅</span>
                  <span>Keywords Hari Ini Sudah Digenerate</span>
                </>
              ) : (
                <>
                  <span>🚀</span>
                  <span>Generate 4 Keywords Hari Ini</span>
                </>
              )}
            </button>
            {isGeneratedToday && (
              <span className="text-[10px] text-emerald-400/80 font-mono">
                Generasi baru tersedia keesokan harinya
              </span>
            )}
          </div>
        </div>

        {errorMessage && (
          <div className="mt-4 p-3 bg-red-950/80 border border-red-800/80 rounded-xl text-red-200 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>⚠️</span>
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-red-200 text-xs">
              ✕
            </button>
          </div>
        )}
      </div>

      {/* 4 Sub-Niche Keywords Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-200 flex items-center gap-2">
            <span>🔥</span> Target 4 Shorts Hari Ini (1 per Sub-Niche)
          </h2>
          {currentKeywords.length > 0 && (
            <span className="text-xs text-gray-500">Klik 'Open YouTube' untuk langsung riset video mentahan</span>
          )}
        </div>

        {currentKeywords.length === 0 ? (
          /* Empty State Banner (No Fallbacks / Pure API Trigger) */
          <div className="bg-gray-900/40 border border-dashed border-gray-800 p-10 rounded-2xl text-center space-y-3">
            <div className="text-4xl text-amber-500/50">✨</div>
            <h3 className="text-sm font-bold text-gray-300">Belum Ada Keyword Hari Ini</h3>
            <p className="text-xs text-gray-500 max-w-md mx-auto">
              Klik tombol <span className="text-amber-400 font-medium">"Generate 4 Keywords Hari Ini"</span> di atas untuk meminta 9router AI memproduksi 4 keyword *longform* fresh target US & menyimpannya ke <code className="text-amber-300 font-mono">input/shorts/keywords-history.json</code>.
            </p>
          </div>
        ) : (
          /* Keywords Grid Cards */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {currentKeywords.map((item, index) => {
              const icon = SUB_NICHE_ICONS[item.sub_niche] || '🏭';
              return (
                <div
                  key={item.id}
                  className="bg-gray-900/70 border border-gray-800 hover:border-amber-500/40 p-5 rounded-2xl space-y-3.5 transition-all group shadow-md hover:shadow-amber-950/20"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{icon}</span>
                      <span className="text-xs font-bold text-amber-400 font-mono tracking-wide">
                        Short #{index + 1}: {item.sub_niche}
                      </span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 rounded-full font-mono">
                      14-Day Cooldown Active
                    </span>
                  </div>

                  <div className="bg-gray-950 p-3.5 rounded-xl border border-gray-800/80">
                    <p className="text-xs font-semibold text-gray-100 leading-relaxed tracking-wide font-sans">
                      "{item.keyword}"
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      onClick={() => handleCopyKeyword(item)}
                      className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-[11px] font-medium rounded-lg transition-all flex items-center gap-1.5"
                    >
                      <span>{copiedId === item.id ? '✅ Copied!' : '📋 Copy Keyword'}</span>
                    </button>

                    <button
                      onClick={() => handleOpenSearch(item.youtube_search_url)}
                      className="px-4 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 text-[11px] font-semibold rounded-lg transition-all flex items-center gap-1.5 group-hover:border-amber-500/50"
                    >
                      <span>🔍 Open YouTube Search</span>
                      <span className="text-xs">↗</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Video Import & Trimmer Section */}
      <div className="bg-gray-900/60 border border-gray-800 p-6 rounded-2xl space-y-4">
        <h2 className="text-sm font-bold text-gray-200 flex items-center gap-2">
          <span>🔗</span> Input Link Video YouTube Hasil Riset
        </h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Tempel link video YouTube (contoh: https://www.youtube.com/watch?v=... Process X / Food Factory)"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            className="flex-1 bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-xs text-gray-200 focus:outline-none focus:border-amber-500 transition-all placeholder:text-gray-600"
          />
          <button className="px-6 py-3 bg-amber-600 hover:bg-amber-500 text-gray-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-600/20 transition-all flex items-center justify-center gap-2 whitespace-nowrap">
            <span>📥</span> Import Video & Trim 9:16
          </button>
        </div>
      </div>

      {/* Active Cooldown History Log */}
      <div className="bg-gray-900/40 border border-gray-800/80 p-5 rounded-2xl space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-gray-300 flex items-center gap-2">
            <span>🛡️</span> Riwayat Active Cooldown (14 Hari Terakhir): {activeHistory.length} Keyword
          </h3>
          <span className="text-[10px] text-gray-500 font-mono">File: input/shorts/keywords-history.json</span>
        </div>
        
        {activeHistory.length === 0 ? (
          <p className="text-xs text-gray-500 italic">Belum ada keyword aktif dalam cooldown 14 hari.</p>
        ) : (
          <div className="max-h-36 overflow-y-auto space-y-1.5 pr-2">
            {activeHistory.slice(0, 10).map((item) => (
              <div key={item.id} className="flex items-center justify-between text-[11px] bg-gray-950/60 p-2 rounded-lg border border-gray-800/50">
                <span className="text-gray-300 font-mono truncate max-w-md font-medium">"{item.keyword}"</span>
                <div className="flex items-center gap-3">
                  <span className="text-amber-400 text-[10px]">{item.sub_niche}</span>
                  <span className="text-gray-500 text-[10px]">
                    Expires: {new Date(item.expires_at).toLocaleDateString('id-ID')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-800/80 pt-4 flex items-center justify-between text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span>📂</span> Path Persistence: <code className="text-gray-400 font-mono">input/shorts/keywords-history.json</code>
        </span>
        <span>Target: 4 Shorts/Hari (US Market)</span>
      </div>
    </div>
  );
};

export default ShortsSourceStep;
