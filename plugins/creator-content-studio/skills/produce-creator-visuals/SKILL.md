---
name: produce-creator-visuals
description: Produce creator-facing visual assets from approved content. Use when the user wants a self-contained HTML recording page, a cover design or three social-cover sizes (16:9, 4:3, and 3:4), or revisions to those assets while keeping the accepted content and title unchanged.
---

# Produce Creator Visuals

Create only the requested visual stage. Require approved content before generating HTML or covers.

## Choose the task

- For `html`, create a single-file recording page and a short artifact summary.
- For `cover`, create three independently composed sizes or a precise three-size design plan when image generation is unavailable.
- For revision, inspect the accepted artifact and change only the requested visual properties.

Read [references/visual-rules.md](references/visual-rules.md) before creating files.

## HTML workflow

1. Confirm the content is accepted and identify its section order.
2. Map one visual section to each argument step; do not reorder the thesis for decoration.
3. Keep CSS and JavaScript inline. Do not add tracking, remote fonts, external scripts, or remote images.
4. Design for screen recording: large type, clear section progress, restrained motion, and no essential hover-only content.
5. Write the file only below the requested output directory. Otherwise return the complete HTML in a code block.
6. Report the real file path only after verifying that the file exists.

## Cover workflow

1. Use the exact accepted title unless the user explicitly approves a shorter cover title.
2. Preserve a single visual idea while independently composing 16:9, 4:3, and 3:4 layouts.
3. Optimize title contrast and reading order for small waterfall-feed thumbnails.
4. Use a supplied portrait only with permission. Never fabricate the creator's likeness or claim an unrelated person is the creator.
5. If an image-generation tool is available and the user requests files, generate the supporting visual and place title text through a reliable layout step.
6. If image generation is unavailable, return a complete design specification and prompts. Clearly say that PNG files were not generated.

Do not render MP4, manage application state, or imply that missing files were generated.
