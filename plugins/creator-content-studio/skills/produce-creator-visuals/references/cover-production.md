# Three-size cover production

## Sizes

Honor dimensions supplied by the caller or structured schema. When no dimensions are supplied, use these high-resolution defaults:

- 16:9 — 1920 × 1080
- 4:3 — 1600 × 1200
- 3:4 — 1440 × 1920

Regardless of pixel dimensions, keep the three aspect ratios exact and compose each size independently.

Do not obtain the vertical cover by blindly cropping the landscape cover. Preserve the same idea while adjusting subject scale, title wrapping, safe areas, and reading order.

## Feed readability

- Use one short primary title, one focal subject, and one supporting visual cue.
- Make the title readable at small waterfall-feed size.
- Keep strong figure-ground contrast and generous safe areas.
- Avoid tiny screenshots, excessive labels, long subtitles, and visual elements that compete with the title.
- Use the approved title exactly unless the user explicitly approves a shorter cover title.

## Image generation

- Use an available image-generation capability only when the user wants actual cover files or a supporting visual.
- Generate the visual background or subject separately from title typography when reliable text rendering matters.
- Add exact title text through a deterministic layout step rather than asking an image model to spell it.
- Use a real portrait only when the user supplies it and permits use; otherwise use a non-portrait concept or an unmistakably generic illustration.

## Deliverable

If actual images are generated, verify each file's dimensions and report the three real paths. Otherwise provide, for each size, title wrapping, subject placement, background, contrast, safe area, supporting elements, and a reusable image prompt; state clearly that image files were not generated.
