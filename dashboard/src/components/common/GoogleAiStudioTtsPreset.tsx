// dashboard/src/components/common/GoogleAiStudioTtsPreset.tsx
import React, { useState } from 'react';

const DEFAULT_TTS_SETTINGS = {
  model: 'gemini-2.5-pro-preview-tts',
  scene: `You are a warm, engaging, and professional Indonesian YouTube movie recap narrator speaking to a young adult audience.

Deliver the narration with a natural, conversational Indonesian accent. The pace should be steady, clear, and effortless to follow—like a close friend telling a captivating story at a cozy cafe.

Key Vocal Guidelines:
1. Emotion & Tone: Warm, empathetic, and expressive. Sound genuinely invested in the characters' journey without being overly dramatic or theatrical.
2. Adaptability: Naturally slow down slightly and soften your tone during emotional or sad moments. Increase energy and dynamism during action or suspenseful scenes.
3. Breathing & Pauses: Respect all SSML tags (<break time="..."/>) precisely. Pause naturally at commas and periods to create a comfortable breathing rhythm.
4. Pronunciation: Clear, crisp Indonesian pronunciation. Avoid sounding robotic, flat, or like a formal news anchor.

Maintain this exact voice identity, pitch, and storytelling energy consistently from start to finish.`,
  sampleContext: `Continue the narration seamlessly as if the story has never stopped.

Maintain the exact same voice timbre, speaking speed, pitch, emotional warmth, and storytelling rhythm from the previous section.

Keep transitions between sentences smooth and natural. Ensure there are no awkward pauses or shifts in voice personality.`,
  voice: 'Schedar',
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
