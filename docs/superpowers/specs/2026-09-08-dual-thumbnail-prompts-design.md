# Dual Thumbnail Prompts (Q5 & Q5Asia) Design Specification

## Problem & Context
The user needs direct access to two different YouTube Metadata & Thumbnail Prompt formulas in Step 7 (Metadata & Thumbnail Studio):
1. **Q5 (Colossal Scale Paradox / High-Stakes Survival)**: Generates 5 title/thumbnail variations in JSON format, suited for Midjourney/Flux colossal scale prompts.
2. **Q5Asia (Nano Banana Pro / Survival Asia)**: Focuses on extreme direct eye contact, panic, and 1 definitive Nano Banana Pro prompt template.

Rather than hiding prompt choices in dropdowns, the UX must display direct action buttons for copying and generating both prompt options.

## Prompt Files
- `dashboard/prompts/longform/alurfilm-thumbnail-prompt-q5.md`: Restored Q5 formula prompt.
- `dashboard/prompts/longform/alurfilm-thumbnail-prompt-q5asia.md`: Nano Banana Pro Q5Asia formula prompt.
- `dashboard/prompts/longform/alurfilm-thumbnail-prompt.md`: Maintained as default alias to Q5Asia for backward compatibility.

## API & IPC Contracts
- `getAlurfilmImageReadyPrompt({ promptType: 'q5' | 'q5asia', customNotes })`: Returns system prompt text for the specified type with script and variables injected.
- `generateAlurfilmMetadata({ promptType: 'q5' | 'q5asia', model, customNotes })`: Calls AI model using the chosen prompt template.

## User Interface Layout (`AlurfilmMetadataStep.tsx`)
In the top header panel of Step 7:
1. **Copy Buttons Group**:
   - `📋 Prompt Q5`: Copies filled Q5 prompt to clipboard.
   - `📋 Prompt Q5Asia`: Copies filled Q5Asia prompt to clipboard.
2. **Generate Buttons Group**:
   - `⚡ Generate Q5`: Triggers metadata generation using Q5 formula.
   - `⚡ Generate Q5Asia`: Triggers metadata generation using Q5Asia formula.

## Verification
- Test copying both Q5 and Q5Asia prompts to verify variable injection (`{{movie_title}}`, `{{combined_script}}`, etc.).
- Test generating metadata using both Q5 and Q5Asia buttons to ensure proper JSON parsing and UI updates.
