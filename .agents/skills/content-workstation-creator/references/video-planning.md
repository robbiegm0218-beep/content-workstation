# Video planning

Turn approved content into a reviewable Remotion scene plan, not a finished video.

## Source modes

- `direct-content`: follow the approved script order and use an empty HTML trace.
- `accepted-html`: read only the supplied accepted HTML snapshot. Preserve its visible heading order in `sourceTrace.htmlSections`; use the run ID and SHA-256 supplied by the caller.

## Scene rules

- Use only the requested duration contract: 30 seconds is 900 frames, 5 minutes is 9000 frames, and 8 minutes is 14400 frames. `16:9` is 1920×1080 and `9:16` is 1080×1920; all use 30fps.
- Use 4–12 scenes for 30 seconds, 25–60 scenes for 5 minutes, or 40–90 scenes for 8 minutes. Scenes must be contiguous and sum exactly to the requested frame count.
- For `9:16`, plan an independent portrait reading order: short title blocks, vertical flows, stacked comparisons and a protected lower caption zone. Never describe it as a crop of a landscape layout.
- Use 2–20 contiguous scenes whose durations add up to 900 frames. No gap or overlap is allowed.
- Use stable `scene-*` IDs. Keep on-screen copy short enough to read in a feed-sized player.
- Narration must sound spoken and must not introduce facts absent from the approved content.
- Match the scene type to the information: conflict for opening, a defensible claim for statement, sequence for flow, tradeoff for comparison, real visual evidence for screenshot, and executable action for summary.
- `materialIds` may reference only assets declared in `materials`. If a needed asset is absent, leave the reference empty and describe it in `missingMaterials`.
- When the caller provides no registered asset list, `materials` and every scene's `materialIds` must be empty. A proposed filename or generated-image idea is not a real registered asset.
- Do not treat HTML as a pixel-perfect video template. Carry over section order, information hierarchy, and theme cues only.

## Evidence and output

Set `generationMeta.skillEvidence` to `CW-SKILL-1.0` and `researchUsed` to false. Write no files except the structured scene-plan result requested by the caller.
