// src/scenes/VideoClipScene.tsx
import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, AbsoluteFill, Video, Audio } from 'remotion';
import type { VideoClipSceneData } from '../types/schema';

// ─── Caption Overlay ──────────────────────────────────

const CaptionOverlay: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '8%',
        left: 0,
        right: 0,
        textAlign: 'center' as const,
        opacity,
        padding: '0 32px',
      }}
    >
      <span
        style={{
          color: '#FFFFFF',
          fontSize: 32,
          fontWeight: 600,
          fontFamily: 'Arial, sans-serif',
          textShadow: '0 2px 8px rgba(0,0,0,0.7), 0 0 4px rgba(0,0,0,0.9)',
          lineHeight: 1.4,
        }}
      >
        {text}
      </span>
    </div>
  );
};

// ─── Main Scene Component ─────────────────────────────

interface VideoClipSceneProps {
  data: VideoClipSceneData;
  durationInFrames: number;
}

export const VideoClipScene: React.FC<VideoClipSceneProps> = ({ data, durationInFrames }) => {
  const { fps } = useVideoConfig();

  // Safety net: video clip duration follows the audio/scene duration exactly
  // AI provides raw_video_start (imperfect timestamp), we force the clip
  // to end when the narration ends. This prevents out-of-sync stacking.
  const startFrame = Math.floor(data.startFrom * fps);
  const endFrame = startFrame + durationInFrames;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <Video
        src={data.src}
        startFrom={startFrame}
        endAt={endFrame}
        muted
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />

      {data.caption && <CaptionOverlay text={data.caption} />}
    </AbsoluteFill>
  );
};
