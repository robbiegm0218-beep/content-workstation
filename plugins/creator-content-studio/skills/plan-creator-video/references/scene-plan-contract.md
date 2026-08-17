# Editable scene-plan contract

## Plan-level fields

Include:

- Source mode: `direct-content` or `accepted-html`
- Aspect ratio and frame size when known
- Frames per second or seconds-based timing convention
- Target duration and calculated total duration
- Visual treatment and subtitle policy
- Source trace summary
- Ordered scenes
- Declared materials and `missingMaterials`
- Assumptions and pending confirmations

## Scene-level fields

Give each scene:

- Stable `id`
- Order and scene type
- Start time and duration
- On-screen title and concise body
- Narration or audio intent
- Caption enabled state and caption text source
- Transition
- Material references using declared IDs or paths
- Source trace to an approved content section or accepted HTML section

Use scene types that describe communication intent rather than a specific renderer, such as `opening`, `statement`, `flow`, `comparison`, `screenshot`, and `summary`.

## Integrity checks

- The sum of scene durations must match the reported total duration.
- Scene starts must be contiguous unless the plan explicitly models an intentional gap.
- A material reference must exist in the declared material list.
- A screenshot scene must use an available screenshot or appear in `missingMaterials`.
- HTML-derived scenes must preserve accepted section order.
- Captions must follow the current narration after any revision.
- Updating a scene must not silently reset unrelated accepted scenes.
