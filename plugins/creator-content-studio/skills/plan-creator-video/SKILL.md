---
name: plan-creator-video
description: Plan an editable creator video from approved content or an accepted HTML recording page. Use for direct-content or HTML-to-video scene planning, aspect-ratio choices, scene timing, on-screen copy, captions, transitions, narration alignment, declared-material references, and missing-material checklists. Do not use for editing uploaded footage, removing pauses, color grading, generating media, writing Remotion code, or rendering an MP4.
---

# Plan Creator Video

Produce a truthful, editable scene specification rather than a rendered video.

## Select the interaction mode

Read [references/video-inputs-and-modes.md](references/video-inputs-and-modes.md).

- Use conversation mode for normal requests and return a readable scene table plus assumptions and missing materials.
- Use structured mode only when the caller supplies an explicit schema or asks for machine-readable JSON.
- Never require an application runtime, internal state marker, or repository-specific filename from a conversation-mode user.

## Choose the source mode

- Use `direct-content` when approved content is the visual source.
- Use `accepted-html` when an accepted HTML page is the source; inspect it when possible, preserve its section order, and record how each scene traces back to it.
- If the core content or HTML is not approved, stop before detailed production and state what must be confirmed.

## Build the plan

Read [references/scene-plan-contract.md](references/scene-plan-contract.md).

1. Identify the approved source, aspect ratio, target duration, visual treatment, available materials, audio, and subtitle preferences.
2. Give every scene a stable ID, type, title, on-screen body, narration, start time, duration, transition, caption choice, and material references.
3. Keep narration, captions, and total timing consistent with the scene durations.
4. Use concise on-screen copy; do not paste full narration into the visual body.
5. Reference only declared materials. Put unavailable footage, screenshots, portraits, audio, or data into `missingMaterials`.
6. For landscape and portrait variants, preserve meaning while adjusting composition rather than blindly cropping.
7. When the user requests a file and writing is available, create only `video-scene-plan.json` or the caller's specified plan filename.

## Handle capabilities honestly

Read [references/capability-fallbacks.md](references/capability-fallbacks.md) before reporting completion.

- If accepted HTML cannot be inspected, plan from supplied section summaries and mark HTML trace verification pending.
- If a material cannot be accessed, keep it in `missingMaterials` rather than inventing a replacement path.
- If writing is unavailable, return the complete plan in the response and do not claim a file exists.

## Boundaries

- Do not create React source, images, voiceover, music, subtitles files, or MP4 files.
- Do not claim to have previewed, edited, or rendered a video.
- Do not fabricate creator footage, project screenshots, customer names, metrics, or outcomes.
- Mention downstream rendering or editing capabilities only when the user asks for the next step.
