# Design Spec — Spensia Subtitle Preview & Vertical Layout Upgrade

## Overview
Based on user feedback:
1. **Vertical Stacked Layout**: Place the **LIVE CANVAS PREVIEW (16:9)** at the top in full-width large format (`max-w-4xl` HD canvas), allowing clear, sharp, and enlarged inspection of background images, subtitles, vignettes, and watermarks.
2. **Subtitle Color & Outline Fix**: Fix letter stroke suffocating text fill on preview scale, add custom `<ColorInput>` for custom color selection, and ensure `#FFFFFF` (White), `#CBD5E1` (Slate-300), and other colors render vividly with high contrast.

---

## 1. Vertical Layout Restructuring
- **Top Section**: Large `LIVE CANVAS PREVIEW (CSS OVERLAY)` (`max-w-4xl`, 864×486px preview canvas with ~0.45x scale factor).
- **Active Render Progress Bar**: Directly under preview canvas for instant visibility during batch video rendering.
- **Bottom Section**: Stacked Config Panels grouped logically:
  - **Section 1**: Subtitel & Caption Engine (Mode Switcher, Color Presets + Custom Color Picker, Font Size, Position Y)
  - **Section 2**: Vignette Darkening (Intensity, Color)
  - **Section 3**: Watermark & Branding Text (Position, Opacity, Offset X/Y)
  - **Section 4**: Audio Controls (Voice Over Volume & BGM Music Engine)
  - **Section 5**: Export Parameters (Resolution, Framerate, Encoding Quality)

---

## 2. Preview Canvas Scale & Stroke Formula
- Scale factor: `PREVIEW_SCALE = 0.45` (864px width / 1920px = 0.45x).
- Proportional text outline width: `scale(cap.outlineWidth) * 0.75` (preventing stroke from swallowing letter text fill).
- Add custom `<ColorInput label="Warna Teks Custom" />` in Subtitle config section.

---

## Verification Plan
1. Test switching caption color to `#FFFFFF` (White) and verify subtitle text turns pure white on preview canvas.
2. Verify Preview Canvas is significantly larger and vertically stacked above configuration sections.
3. Run `npx tsc --noEmit` to confirm zero type errors.
