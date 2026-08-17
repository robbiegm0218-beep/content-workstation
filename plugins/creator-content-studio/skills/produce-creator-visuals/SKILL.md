---
name: produce-creator-visuals
description: Create or revise visual production assets from approved self-media content. Use for a self-contained HTML recording page, an HTML visual style choice, cover composition, or three social-cover sizes (16:9, 4:3, and 3:4). Use the available image-generation capability when requested and supported, otherwise provide an executable cover specification. Do not use for drafting unapproved content, generic website development, video scene planning, MP4 editing, or rendering.
---

# Produce Creator Visuals

Create only the requested visual stage and preserve the approved thesis, section order, and title.

## Confirm the production boundary

Read [references/visual-inputs-and-modes.md](references/visual-inputs-and-modes.md).

- Treat content as approved when the user explicitly confirms it or asks to produce visuals from a clearly identified accepted draft.
- If the user is still changing the core thesis or script, stop visual production and help identify what must be confirmed first.
- Use conversation mode by default. Use structured mode only when the caller supplies a schema, accepted-content snapshot, and output directory.
- Do not require an application runtime, internal status field, or repository-specific filename from a conversation-mode user.

## Choose exactly one task

- For `html`, read [references/html-production.md](references/html-production.md) and create a self-contained recording page or return its complete source when file writing is unavailable.
- For `cover`, read [references/cover-production.md](references/cover-production.md) and create three independently composed sizes or an executable three-size specification.
- For revision, inspect the accepted artifact and modify only the requested visual properties.
- Do not generate HTML and covers together unless the user explicitly requests both and understands they are separate review stages.

## Use capabilities honestly

Read [references/capability-fallbacks.md](references/capability-fallbacks.md) before reporting final artifacts.

- Use only user-supplied, task-generated, or clearly reusable assets.
- Use a supplied portrait only with permission. Never fabricate the creator's likeness or imply that an unrelated person is the creator.
- Verify every reported file exists and matches the requested format and dimensions.
- Never report PNG, HTML, manifest, or download links that were not actually created.

## Return the result

- In conversation mode, summarize the chosen style, show or link the real artifact, list the three cover sizes when relevant, and state any honest fallback.
- In structured mode, return only the requested manifest or JSON and keep every file under the supplied output directory.
- Do not render MP4, manage application state, or silently rewrite the accepted content.
