# Scene plan rules

## Required scene qualities

- Use stable IDs that survive reordering.
- Keep total duration equal to the sum of scene durations.
- Make source order explicit for HTML-derived plans.
- Keep captions enabled only where narration exists or the user explicitly requests silent text.
- Match the requested aspect ratio and explain any composition choice that changes between landscape and portrait.

## Material integrity

- Treat the supplied material list as an allowlist.
- Reference a material by its declared ID or path.
- Put undeclared or missing material into a separate list instead of inventing a filename.
- Never describe a vector mockup as a real screenshot.

## Output boundary

- A scene plan is an editable production specification, not a rendered video.
- State which downstream capability is needed for rendering only when the user asks for the next step.
