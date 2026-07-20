// src/scenes/ImageScene.tsx
import React, { useMemo } from 'react';
import { useCurrentFrame, interpolate, AbsoluteFill, Img } from 'remotion';
import type { ImageSceneData, ImageAnimation } from '../types/schema';

// ─── Image Animation Logic ───────────────────────────

function useImageTransform(animation: ImageAnimation, durationInFrames: number) {
  const frame = useCurrentFrame();

  return useMemo((): React.CSSProperties => {
    const p = frame / durationInFrames; // 0 to 1 over scene

    switch (animation) {
      case 'ken-burns': {
        const scale = interpolate(p, [0, 1], [1, 1.1]);
        const translateX = interpolate(p, [0, 1], [0, -20]);
        const translateY = interpolate(p, [0, 1], [0, -10]);
        return {
          transform: `scale(${scale}) translateX(${translateX}px) translateY(${translateY}px)`,
        };
      }

      case 'zoom-in': {
        const scale = interpolate(p, [0, 1], [1, 1.15]);
        return { transform: `scale(${scale})` };
      }

      case 'zoom-out': {
        const scale = interpolate(p, [0, 1], [1.15, 1]);
        return { transform: `scale(${scale})` };
      }

      case 'pan-left': {
        const translateX = interpolate(p, [0, 1], [0, -40]);
        return { transform: `translateX(${translateX}px)` };
      }

      case 'pan-right': {
        const translateX = interpolate(p, [0, 1], [0, 40]);
        return { transform: `translateX(${translateX}px)` };
      }

      case 'none':
      default:
        return {};
    }
  }, [animation, frame, durationInFrames]);
}

// ─── Overlay Caption ─────────────────────────────────

const OVERLAY_POSITION: Record<string, React.CSSProperties> = {
  top: { top: '8%', left: 0, right: 0, textAlign: 'center' as const },
  center: {
    top: '50%',
    left: 0,
    right: 0,
    textAlign: 'center' as const,
  },
  bottom: { bottom: '8%', left: 0, right: 0, textAlign: 'center' as const },
};

const ImageOverlay: React.FC<{ text: string; position: string; color: string }> = ({
  text,
  position,
  color,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <div
      style={{
        position: 'absolute',
        ...(OVERLAY_POSITION[position] ?? OVERLAY_POSITION.bottom),
        transform: position === 'center' ? 'translateY(-50%)' : undefined,
        opacity,
        padding: '16px 32px',
      }}
    >
      <span
        style={{
          color,
          fontSize: 40,
          fontWeight: 600,
          fontFamily: 'Arial, sans-serif',
          textShadow: '0 2px 8px rgba(0,0,0,0.6)',
        }}
      >
        {text}
      </span>
    </div>
  );
};

// ─── Main Scene Component ────────────────────────────

interface ImageSceneProps {
  data: ImageSceneData;
  durationInFrames: number;
}

export const ImageScene: React.FC<ImageSceneProps> = ({ data, durationInFrames }) => {
  const imageTransform = useImageTransform(data.animation, durationInFrames);

  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#000' }}>
      <div
        style={{
          width: '100%',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        <Img
          src={data.src}
          style={{
            width: '100%',
            height: '100%',
            objectFit: data.fit,
            ...imageTransform,
          }}
        />
      </div>

      {data.overlay && (
        <ImageOverlay
          text={data.overlay.text}
          position={data.overlay.position}
          color={data.overlay.color}
        />
      )}
    </AbsoluteFill>
  );
};
