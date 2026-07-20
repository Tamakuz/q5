// src/Root.tsx
import React from 'react';
import { Composition, Sequence, Audio, AbsoluteFill } from 'remotion';
import type { VideoConfig, ResolvedScene } from './types/schema';
import { TransitionWrapper } from './engine/transitions';
import { TextScene } from './scenes/TextScene';
import { ImageScene } from './scenes/ImageScene';
import { VideoClipScene } from './scenes/VideoClipScene';

// ─── Resolver Logic ──────────────────────────────────

export function resolveScenes(config: VideoConfig): ResolvedScene[] {
  let cumulativeFrames = 0;

  return config.scenes.map((scene) => {
    const durationInFrames = Math.round(scene.duration * config.metadata.fps);
    const startFrame = cumulativeFrames;
    cumulativeFrames += durationInFrames;

    return {
      ...scene,
      startFrame,
      durationInFrames,
    } as ResolvedScene;
  });
}

export function totalDurationFrames(config: VideoConfig): number {
  return config.scenes.reduce(
    (sum, scene) => sum + Math.round(scene.duration * config.metadata.fps),
    0,
  );
}

// ─── Scene Renderer ──────────────────────────────────

const SceneRenderer: React.FC<{ scene: ResolvedScene }> = ({ scene }) => {
  switch (scene.type) {
    case 'text':
      return <TextScene data={scene.data} />;
    case 'image':
      return <ImageScene data={scene.data} durationInFrames={scene.durationInFrames} />;
    case 'video_clip':
      return <VideoClipScene data={scene.data} durationInFrames={scene.durationInFrames} />;
    default:
      return null;
  }
};

// ─── Video Renderer ──────────────────────────────────

export const VideoSceneRenderer: React.FC<VideoConfig> = (config) => {
  const resolved = resolveScenes(config);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* Global background music */}
      {config.audio?.bgm && <Audio src={config.audio.bgm} volume={config.audio.volume} />}

      {/* Scene sequences */}
      {resolved.map((scene, i) => (
        <Sequence
          key={i}
          from={scene.startFrame}
          durationInFrames={scene.durationInFrames}
        >
          <TransitionWrapper type={scene.transition}>
            <SceneRenderer scene={scene} />
          </TransitionWrapper>
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

// ─── Root Composition ────────────────────────────────

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="content-auto-video"
        component={VideoSceneRenderer}
        durationInFrames={1}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          version: '1' as const,
          metadata: {
            title: '',
            duration: 1,
            resolution: { width: 1080, height: 1920 },
            fps: 30,
          },
          scenes: [{ type: 'text' as const, duration: 1, transition: 'fade' as const, data: { layers: [{ text: '', style: 'body' as const, animation: 'fade-in' as const, position: 'center' as const, color: '#FFFFFF' }], background: { type: 'color' as const, value: '#1A1A2E' } } }],
        }}
        calculateMetadata={({ props }) => {
          const config = props as VideoConfig;
          return {
            durationInFrames: totalDurationFrames(config),
            fps: config.metadata.fps,
            width: config.metadata.resolution.width,
            height: config.metadata.resolution.height,
            props: config,
          };
        }}
      />
    </>
  );
};
