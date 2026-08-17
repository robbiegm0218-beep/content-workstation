---
name: plan-creator-video
description: Turn approved creator content or an accepted HTML recording page into an editable video scene plan. Use for direct-content video planning, HTML-to-video evolution, scene timing, captions, transitions, narration alignment, material references, and missing-material checklists; do not use for editing or rendering an MP4.
---

# Plan Creator Video

Produce a truthful, editable scene plan. Do not create React source, audio, images, or MP4 files.

## Choose the source mode

- Use `direct-content` when only approved content is available.
- Use `accepted-html` when an approved HTML page is available; preserve its section order and record the source relationship.
- If neither source is approved, stop before production and explain what needs confirmation.

Read [references/scene-plan-rules.md](references/scene-plan-rules.md) before producing the plan.

## Plan the scenes

1. Read the approved content, selected aspect ratio, target duration, visual treatment, available materials, audio, and subtitle preferences.
2. Give every scene a stable ID, type, title, body, narration, duration, transition, caption choice, and material references.
3. Keep narration and caption timing consistent with the same scene duration.
4. Use concise on-screen copy; do not paste the full narration into the visual body.
5. Reference only declared materials. Put unavailable footage, screenshots, portraits, audio, or data into `missingMaterials`.
6. Return readable Markdown by default or JSON when the caller supplies a schema or asks for an editable structured plan.
7. Create `video-scene-plan.json` only when a writable output directory is supplied or requested.

## Boundaries

- Do not claim to have rendered or edited a video.
- Do not fabricate creator footage, project screenshots, customer names, metrics, or outcomes.
- Do not require Remotion, FFmpeg, ChatCut, or a running Content Workstation for planning.
