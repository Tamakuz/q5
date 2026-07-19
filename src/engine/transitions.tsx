// src/engine/transitions.ts
import React, { useMemo } from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import type { Transition } from '../types/schema';
import { TRANSITION_DURATION_FRAMES } from '../types/schema';

interface TransitionWrapperProps {
  type: Transition;
  children: React.ReactNode;
}

export const TransitionWrapper: React.FC<TransitionWrapperProps> = ({ type, children }) => {
  const frame = useCurrentFrame();

  const style: React.CSSProperties = useMemo(() => {
    if (type === 'none') {
      return {};
    }

    // Progress of the transition: 0 at frame 0, 1 at TRANSITION_DURATION_FRAMES
    const progress = interpolate(frame, [0, TRANSITION_DURATION_FRAMES], [0, 1], {
      extrapolateRight: 'clamp',
      extrapolateLeft: 'clamp',
    });

    switch (type) {
      case 'fade':
        return { opacity: progress };

      case 'slide-left':
        return {
          opacity: progress,
          transform: `translateX(${interpolate(progress, [0, 1], [60, 0], { extrapolateRight: 'clamp' })}px)`,
        };

      case 'slide-right':
        return {
          opacity: progress,
          transform: `translateX(${interpolate(progress, [0, 1], [-60, 0], { extrapolateRight: 'clamp' })}px)`,
        };

      case 'slide-up':
        return {
          opacity: progress,
          transform: `translateY(${interpolate(progress, [0, 1], [60, 0], { extrapolateRight: 'clamp' })}px)`,
        };

      case 'slide-down':
        return {
          opacity: progress,
          transform: `translateY(${interpolate(progress, [0, 1], [-60, 0], { extrapolateRight: 'clamp' })}px)`,
        };

      default:
        return {};
    }
  }, [frame, type]);

  return <div style={{ ...style, width: '100%', height: '100%' }}>{children}</div>;
};
