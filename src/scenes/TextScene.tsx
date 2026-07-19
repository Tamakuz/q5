// src/scenes/TextScene.tsx
import React, { useMemo } from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring, AbsoluteFill } from 'remotion';
import type { TextSceneData, TextStyle } from '../types/schema';
import { TEXT_STYLE_PRESETS } from '../types/schema';

// ─── Background ──────────────────────────────────────

const BackgroundFill: React.FC<{ data: TextSceneData['background'] }> = ({ data }) => {
  if (data.type === 'transparent') {
    return null;
  }

  if (data.type === 'color') {
    return <AbsoluteFill style={{ backgroundColor: data.value }} />;
  }

  // gradient
  const gradientStops = data.colors.join(', ');
  const angle = data.angle ?? 180;
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(${angle}deg, ${gradientStops})`,
      }}
    />
  );
};

// ─── Animated Text Layer ─────────────────────────────

const POSITION_MAP: Record<string, React.CSSProperties> = {
  center: { justifyContent: 'center', alignItems: 'center', textAlign: 'center' as const },
  top: { justifyContent: 'flex-start', alignItems: 'center', textAlign: 'center' as const, paddingTop: '8%' },
  bottom: { justifyContent: 'flex-end', alignItems: 'center', textAlign: 'center' as const, paddingBottom: '8%' },
};

interface AnimatedTextLayerProps {
  layer: { text: string; style: TextStyle; animation: string; position: string; color: string };
  index: number;
}

const AnimatedTextLayer: React.FC<AnimatedTextLayerProps> = ({ layer, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const preset = TEXT_STYLE_PRESETS[layer.style];
  const staggerDelay = index * 5; // 5 frames stagger between layers

  const effectiveFrame = Math.max(0, frame - staggerDelay);

  const style: React.CSSProperties = useMemo(() => {
    const base: React.CSSProperties = {
      fontSize: preset.fontSize,
      fontWeight: preset.fontWeight,
      fontStyle: preset.fontStyle,
      color: layer.color,
      fontFamily: 'Arial, sans-serif',
    };

    if (layer.animation === 'none') {
      return base;
    }

    const progress = interpolate(effectiveFrame, [0, 15], [0, 1], {
      extrapolateRight: 'clamp',
      extrapolateLeft: 'clamp',
    });

    switch (layer.animation) {
      case 'fade-in':
        return { ...base, opacity: progress };

      case 'scale-in': {
        const scale = spring({ frame: effectiveFrame, fps, config: { damping: 12 } });
        return { ...base, transform: `scale(${scale})`, opacity: progress };
      }

      case 'slide-up':
        return {
          ...base,
          opacity: progress,
          transform: `translateY(${interpolate(progress, [0, 1], [40, 0], { extrapolateRight: 'clamp' })}px)`,
        };

      case 'typewriter':
        // handled in render below
        return { ...base };

      default:
        return base;
    }
  }, [effectiveFrame, layer, preset, fps]);

  // Typewriter mode — needs custom text rendering
  if (layer.animation === 'typewriter') {
    const charsToShow = Math.floor(
      interpolate(effectiveFrame, [0, layer.text.length * 2], [0, layer.text.length], {
        extrapolateRight: 'clamp',
        extrapolateLeft: 'clamp',
      }),
    );
    const visibleText = layer.text.slice(0, charsToShow);
    return (
      <div style={style}>
        {visibleText}
        {charsToShow < layer.text.length && <span style={{ opacity: 0.5 }}>|</span>}
      </div>
    );
  }

  return <div style={style}>{layer.text}</div>;
};

// ─── Main Scene Component ────────────────────────────

interface TextSceneProps {
  data: TextSceneData;
}

export const TextScene: React.FC<TextSceneProps> = ({ data }) => {
  return (
    <AbsoluteFill>
      <BackgroundFill data={data.background} />
      <AbsoluteFill style={{ flexDirection: 'column', padding: '5%' }}>
        {data.layers.map((layer, i) => {
          const posStyle = POSITION_MAP[layer.position] ?? POSITION_MAP.center;
          return (
            <AbsoluteFill key={i} style={posStyle}>
              <AnimatedTextLayer layer={layer} index={i} />
            </AbsoluteFill>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
