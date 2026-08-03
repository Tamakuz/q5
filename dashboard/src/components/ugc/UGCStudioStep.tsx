// dashboard/src/components/ugc/UGCStudioStep.tsx
import React from 'react';
import UGCProfilesManager from './UGCProfilesManager';

const UGCStudioStep: React.FC = () => {
  return (
    <div className="p-6 bg-gray-950/80 border border-gray-800 rounded-3xl min-h-full space-y-8">
      {/* UGC Character Profile Studio */}
      <UGCProfilesManager />
    </div>
  );
};

export default UGCStudioStep;
