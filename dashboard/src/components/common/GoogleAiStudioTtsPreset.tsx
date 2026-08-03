// dashboard/src/components/common/GoogleAiStudioTtsPreset.tsx
import React, { useState } from 'react';

const DEFAULT_TTS_SETTINGS = {
  model: 'gemini-2.5-pro-preview-tts',
  scene: `You are a professional Indonesian YouTube movie recap narrator speaking to a young audience.

Deliver the story with a controlled, conversational pace that feels smooth, engaging, and effortless to follow.

The narration should feel energetic without rushing, expressive without exaggeration, and emotional without becoming theatrical.

Flow naturally from one idea to the next, allowing listeners to stay immersed without feeling overwhelmed.

Action scenes become slightly faster and more dynamic.

Dialogue and emotional moments become slightly softer and more intimate.

Suspense builds gradually through subtle pacing rather than dramatic pauses.

Every sentence should transition smoothly into the next as if telling a captivating story to a friend.

Maintain a warm, confident, and cinematic storytelling style throughout the entire narration.

The voice should remain consistent from beginning to end, making long-form listening comfortable and enjoyable.`,
  sampleContext: `Continue the narration exactly as if the previous paragraph had never stopped.

Maintain the same voice, rhythm, pacing, pronunciation, emotional intensity, and storytelling flow.

Keep transitions between sentences smooth and natural.

Avoid sounding like separate facts being read aloud.

The narration should feel continuous, immersive, and easy to listen to for long periods.

Maintain a controlled conversational pace that keeps viewers engaged without sounding rushed.`,
  voice: 'Fenrir',
  temperature: '1.3'
};

export const GoogleAiStudioTtsPreset: React.FC<{ defaultExpanded?: boolean }> = ({ defaultExpanded = false }) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      const api = (window as any).electronAPI;
      if (api && api.copyToClipboard) {
        await api.copyToClipboard(text);
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2500);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const copyAllSettings = () => {
    const fullText = `=== GOOGLE AI STUDIO TTS SETTINGS ===
Model: ${DEFAULT_TTS_SETTINGS.model}
Temperature: ${DEFAULT_TTS_SETTINGS.temperature}
Speaker: ${DEFAULT_TTS_SETTINGS.voice}

[SCENE]
${DEFAULT_TTS_SETTINGS.scene}

[SAMPLE CONTEXT]
${DEFAULT_TTS_SETTINGS.sampleContext}`;
    copyToClipboard(fullText, 'all');
  };

  return (
    <div className="bg-gray-900/90 border border-purple-800/40 rounded-2xl overflow-hidden shadow-2xl transition-all my-3">
      {/* Header Bar */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-4 py-3 bg-gradient-to-r from-purple-950/60 via-gray-900 to-gray-950 flex items-center justify-between cursor-pointer hover:bg-gray-800/80 transition-all select-none border-b border-purple-900/30"
      >
        <div className="flex items-center gap-2.5">
          <span className="p-1.5 bg-purple-600/20 text-purple-300 rounded-lg text-sm">🎙️</span>
          <div>
            <h4 className="text-xs font-bold text-white flex items-center gap-2">
              Google AI Studio TTS Presets (Gemini 2.5 Pro TTS)
              <span className="px-2 py-0.5 bg-purple-900/80 border border-purple-600/40 text-purple-300 rounded-full text-[10px] font-mono">
                Copy-Paste Helper
              </span>
            </h4>
            <p className="text-[10px] text-gray-400">
              Preset Scene, Sample Context, Speaker & Temp untuk Google AI Studio
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              copyAllSettings();
            }}
            className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1 shadow-md shadow-purple-600/30"
          >
            <span>{copiedField === 'all' ? '✓ Copied All!' : '📋 Copy All Settings'}</span>
          </button>

          <span className="text-xs text-gray-400 font-mono">
            {isExpanded ? '▲ Hide' : '▼ Expand'}
          </span>
        </div>
      </div>

      {/* Expanded Preset Cards */}
      {isExpanded && (
        <div className="p-4 space-y-3.5 bg-gray-950/80 border-t border-gray-800">
          {/* Quick Badges Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pb-1">
            <div className="p-2 bg-gray-900/80 border border-gray-800 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[9px] uppercase tracking-wider text-gray-500 font-bold block">Model</span>
                <span className="text-xs font-mono font-bold text-purple-300 truncate block">Gemini 2.5 Pro TTS</span>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(DEFAULT_TTS_SETTINGS.model, 'model')}
                className="p-1 text-[10px] bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition-all"
              >
                {copiedField === 'model' ? '✓' : '📋'}
              </button>
            </div>

            <div className="p-2 bg-gray-900/80 border border-gray-800 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[9px] uppercase tracking-wider text-gray-500 font-bold block">Speaker Voice</span>
                <span className="text-xs font-mono font-bold text-amber-300 truncate block">{DEFAULT_TTS_SETTINGS.voice}</span>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(DEFAULT_TTS_SETTINGS.voice, 'voice')}
                className="p-1 text-[10px] bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition-all"
              >
                {copiedField === 'voice' ? '✓' : '📋'}
              </button>
            </div>

            <div className="p-2 bg-gray-900/80 border border-gray-800 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[9px] uppercase tracking-wider text-gray-500 font-bold block">Temperature</span>
                <span className="text-xs font-mono font-bold text-emerald-300 block">1.3</span>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(DEFAULT_TTS_SETTINGS.temperature, 'temp')}
                className="p-1 text-[10px] bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition-all"
              >
                {copiedField === 'temp' ? '✓' : '📋'}
              </button>
            </div>
          </div>

          {/* Scene Field */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-purple-300 flex items-center gap-1.5">
                <span>🎬</span> Scene Prompt
              </label>
              <button
                type="button"
                onClick={() => copyToClipboard(DEFAULT_TTS_SETTINGS.scene, 'scene')}
                className="text-[10px] text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1 underline transition-all"
              >
                {copiedField === 'scene' ? '✓ Copied Scene!' : '📋 Copy Scene'}
              </button>
            </div>
            <div className="p-2.5 bg-gray-900 border border-gray-800 rounded-xl text-xs text-gray-200 font-sans leading-relaxed select-all">
              {DEFAULT_TTS_SETTINGS.scene}
            </div>
          </div>

          {/* Sample Context Field */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-indigo-300 flex items-center gap-1.5">
                <span>📖</span> Sample Context Prompt
              </label>
              <button
                type="button"
                onClick={() => copyToClipboard(DEFAULT_TTS_SETTINGS.sampleContext, 'sampleContext')}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 underline transition-all"
              >
                {copiedField === 'sampleContext' ? '✓ Copied Sample Context!' : '📋 Copy Sample Context'}
              </button>
            </div>
            <div className="p-2.5 bg-gray-900 border border-gray-800 rounded-xl text-xs text-gray-200 font-sans leading-relaxed select-all">
              {DEFAULT_TTS_SETTINGS.sampleContext}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
