# Publishing package production

Create one useful Markdown handoff for exactly the platforms listed in `style-config.json.platforms`. Do not add unselected platforms and do not rewrite the core thesis merely to create variety.

## Required sections

- Content theme: core thesis, evidence boundary, desired audience action.
- Recommended release title plus 3–5 accurate alternatives.
- Cover handoff: approved cover style, main/sub copy, and the accepted 16:9, 4:3, 3:4 artifact identifiers when supplied.
- Add a section only for each selected platform, using the applicable format below:
  - B站: title, description, chapters, tags, and one discussion question.
  - 小红书: title, concise body, cover copy, topic directions, and one save-oriented takeaway.
  - 视频号: title, release copy, suggested duration, and one discussion question.
  - 抖音: title, first-sentence hook, release copy, tags, and one discussion question.
- Short-video cuts: 2–4 standalone cuts with core point, suggested duration, independent opening, and closing action.
- Final checklist: factual boundary, title promise, platform fit, and accepted asset availability.

## Adaptation rules

- Use `coverStyle` as the approved cover style. Never copy the publishing task's `styleId` or `styleName` into the cover handoff.
- Treat `style-config.json.platforms` as the complete output scope. Never create a section for an unselected platform.
- When accepted cover manifest notes specify exact main and secondary cover copy, preserve that copy exactly. Otherwise, mark the copy for confirmation instead of inventing a replacement.
- B站 may keep the fullest argument and searchable context.
- 小红书 should foreground one concrete problem and a collectible framework; do not mechanically truncate the long script.
- 视频号 should keep the tone steady, reduce jargon, and emphasize professional experience without inflating it.
- 抖音 should reach the conflict quickly, but the approved content must support the hook.
- Use a natural CTA tied to the episode's value. Do not use empty follow prompts or force a course sale.
- Treat supplied platform rules as current configuration, not permanent algorithm facts.

## Manifest

Write `output/publishing-package.md`, then `output/manifest.json` with:

- `taskType`: `publishing`
- `generationMode`: `codex-publishing`
- one artifact with id and type `publishing-package`, path `output/publishing-package.md`, MIME type `text/markdown`, null dimensions, and the actual SHA-256
- `skillEvidence`: `CW-SKILL-1.0`

Return the exact manifest JSON and no surrounding commentary.
