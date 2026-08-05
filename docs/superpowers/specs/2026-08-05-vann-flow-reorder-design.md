# Vann Workflow Step Reorder Design

## Summary
Reorder Step 6 ("Voice & Timeline Studio" / `publish`) to Step 3 in the Vann Content Mode workflow so that Voiceover creation and audio timing happen immediately after Script Generation (Step 2) and before Scene Splitting / Scene Breakdown (Step 4).

## New Workflow Sequence (Vann)
1. **Step 1 (`source`)**: Topics Generator
2. **Step 2 (`analyze`)**: Script Generator
3. **Step 3 (`publish`)**: Voice & Timeline Studio *(Reordered from Step 6 to Step 3)*
4. **Step 4 (`audio`)**: Scene Splitter *(Reordered from Step 3 to Step 4)*
5. **Step 5 (`mapping`)**: Image Prompt Generator *(Reordered from Step 4 to Step 5)*
6. **Step 6 (`render`)**: Image Generator *(Reordered from Step 5 to Step 6)*
7. **Step 7 (`upload`)**: Render Studio (16:9)
8. **Step 8 (`thumbnail`)**: Publish Hub & Thumbnail

## Target Components
- `dashboard/src/components/common/Sidebar.tsx`: Update `VANN_STEPS` ordering.
- `dashboard/src/components/common/WorkflowHeader.tsx`: Update `WAKU_STEPS` ordering.
- `dashboard/src/components/vann/VannVoiceOverStep.tsx`: Update navigation button target from `upload` to `audio` (Scene Splitter).
