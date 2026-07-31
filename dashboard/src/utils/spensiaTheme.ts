// dashboard/src/utils/spensiaTheme.ts
// Canonical Spensia color theme constants.
// All Spensia UI accent is emerald green — change colors here and all
// components + subtitle generators update together.

export const SPENSIA_CAPTION_COLORS = {
  /** Active word highlight color (green-500). Was #FDE047 (yellow). */
  activeColorHex: '#22C55E',
  /** Inactive word color (white). */
  inactiveColorHex: '#FFFFFF',
  /** Text outline color (black). */
  outlineColorHex: '#000000',
} as const;

// ── Tailwind class conventions for Spensia step components ──
//
// These patterns are used consistently across all Spensia*.tsx files:
//
//   Header bg:    from-emerald-950/80 via-gray-900 to-gray-950 border border-emerald-800/40
//   Badge/tag:    bg-emerald-950 text-emerald-300 border border-emerald-800
//   Pending tag:  bg-emerald-950/50 text-emerald-300
//   Button primary: bg-gradient-to-r from-emerald-600 to-teal-600 shadow shadow-emerald-600/30
//   Button process: bg-gradient-to-r from-emerald-600 to-teal-600 (simplified bulk action)
//   Active tab:   bg-emerald-600 text-white shadow-md
//   Active chip:  bg-emerald-950/40 border-emerald-500/80 ring-1 ring-emerald-500/50
//   Toast:        bg-emerald-600 text-white border border-emerald-400/30
//   Focus ring:   focus:border-emerald-500
//   Progress bar: from-emerald-400 via-emerald-500 to-emerald-600
//   Selection:    bg-emerald-500 border-emerald-400 text-gray-950
//
// Semantic colors that should NOT change:
//   Error/red:    bg-red-950 text-red-400 border-red-800
//   Success:      bg-emerald-950 text-emerald-400 border-emerald-800 (already green)
