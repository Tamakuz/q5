# Spensia High-CTR Metadata & Rich SEO Upgrade Design Spec

Date: 2026-08-07  
Status: Approved

## Overview
This design spec outlines the comprehensive upgrade of **Spensia's YouTube Upload Metadata Generation Pipeline** (Titles, Description, Tags, and Hashtags). The upgrade replaces formulaic/short output with explosive cognitive-gap titles (<60 characters SEO), high CTR score estimations (88%–98%), and deep narrative science descriptions containing structured key takeaways, rich timestamps, and high-volume SEO search keywords.

---

## 1. High-CTR Title Formulas (<60 Characters)
The system prompt for Spensia metadata generation will produce 4 distinct title options using popular science curiosity triggers:
1. **Direct Mind-Blowing Contradiction**: Address the viewer ("kamu") with an unexpected biological reality contrast.
   *Example:* `MENGAPA MANUSIA PURBA GAK PERNAH SIKAT GIGI TAPI GIGINYA UTUH?` (52 Chars)
2. **Biological Advantage / Underdog Comparison**: Compare ancient human superiority vs modern human flaws.
   *Example:* `GIGI MANUSIA PURBA JAUH LEBIH RAPI DARI GIGIMU SEKARANG` (50 Chars)
3. **The Root Cause Debunking**: Expose the surprising historical shift responsible for modern ailments.
   *Example:* `DOSA GULA: BAGAIMANA REVOLUSI PERTANIAN MERUSAK RAHANG KITA` (54 Chars)
4. **Provocative Existential Question**: Challenge daily dental habits vs evolutionary biology.
   *Example:* `MENGAPA GIGI BUNGSU DICABUT PADAHAL MANUSIA PURBA TIDAK?` (51 Chars)

- **CTR Score Estimation**: Updated to range between 88% and 98% with detailed psychological strategy notes.
- **Constraints**: Strict cap under 60 characters, no "POV:" prefixes, no bracket tags.

---

## 2. Rich Narrative Science Description Structure
The description will be expanded from short placeholders into a 7-part rich storytelling & SEO engine:
1. **Engaging Curiosity Hook (3-4 Sentences)**: Intriguing opening narrative contrasting modern daily life with ancient human biology.
2. **Core Science Synopsis (2 Paragraphs)**: Deep breakdown of evolutionary biology, dental biomechanics, soft food diets, jaw shrinkage, and historical experiments (e.g. Robert Corruccini).
3. **Key Takeaways ("Apa Yang Akan Kamu Pelajari")**: Bullet points highlighting 3-4 mind-blowing science takeaways.
4. **Intriguing Chapter Timestamps**: Timestamps formatted as `00:00 [Title]` with high-curiosity chapter labels.
5. **Community Engagement CTA**: Direct discussion prompt for the pinned comment section ("Tulis pendapatmu di kolom komentar!").
6. **Social Media & Channel Subscriptions**.
7. **Rich Hashtags & Tag SEO (18-25 Keywords)**: Fully utilized 400-500 characters of popular science Indonesian search terms.

---

## 3. Targeted File Modifications

### Prompts Directory (`dashboard/prompts/spensia/`)
1. [upload-metadata-prompt.md](file:///home/jovan/project/content-auto/dashboard/prompts/spensia/upload-metadata-prompt.md): Updated with new 4-formula title prompt guidelines, 88-98% CTR rating rules, and 7-part rich description template.
2. [fix-metadata-prompt.md](file:///home/jovan/project/content-auto/dashboard/prompts/spensia/fix-metadata-prompt.md): Synchronized auto-fix guidelines to output rich narrative descriptions and explosive titles.
3. [analyze-metadata-prompt.md](file:///home/jovan/project/content-auto/dashboard/prompts/spensia/analyze-metadata-prompt.md): Updated metadata checklist and psychological analysis criteria.

### IPC Handlers (`dashboard/electron/ipc/spensiaHandlers.cjs`)
1. Verify `generate-spensia-upload-metadata` handles longer JSON responses smoothly without truncating text or stripping description sections.
2. Ensure title sanitization removes any residual artifacts while keeping clean Indonesian titles under 60 chars.

---

## 4. Verification Plan

### Manual Verification
1. Run `generate-spensia-upload-metadata` on Spensia Topic #2 (Manusia Purba / Dental Hygiene).
2. Confirm generated titles are under 60 characters, have CTR scores >88%, and use strong curiosity gap hooks.
3. Verify the generated description contains all 7 narrative sections (Hook, Core Synopsis, Key Takeaways, Timestamps, CTA, Socials, Hashtags).
4. Verify 18-25 high-search volume popular science tags are populated.
