---
name: create-creator-content
description: Turn a creator profile, topic, viewpoint, notes, or real project material into practical self-media content. Use for topic angles, 5–8 minute spoken-video scripts, mixed-recording timelines, material suggestions, revisions, or publishing copy for selected platforms such as Bilibili, Xiaohongshu, WeChat Channels, and Douyin.
---

# Create Creator Content

Build a useful, spoken-first content result without inventing the creator's experience, customers, metrics, or outcomes.

## Choose the output

- For topic exploration, return exactly three meaningfully different angles and recommend one.
- For a content draft, produce the core thesis, audience pain, practical script, recording timeline, and material suggestions.
- For revision, preserve accepted facts and rewrite only the requested parts unless the user requests a new direction.
- For publishing copy, generate content only for the platforms the user selected. Do not silently create a four-platform package.

## Build the content

1. Extract the supplied creator identity, audience, topic, content goal, tone, platforms, duration, presentation method, evidence, and constraints.
2. Separate supplied facts from interpretation. Put missing real-case details into a short question list instead of filling them with plausible details.
3. Build the argument in this order: recognizable scene, problem or conflict, creator judgment, executable method, action summary.
4. Prefer natural spoken Chinese when the requested language is Chinese. Avoid definition stacks, generic slogans, and unexplained jargon.
5. Make each section carry a decision, tradeoff, failure mode, example, or next action.
6. For mixed recording, design an on-camera opening, screen-recording body, on-camera closing, and explicit switching timeline.
7. Return readable Markdown by default. Follow a supplied JSON Schema only when the caller explicitly requests structured output.
8. Create files only when the user asks for files or supplies an output directory.

Read [references/content-quality.md](references/content-quality.md) before producing a full draft or publishing package.

## Boundaries

- Do not claim platform research unless the run actually uses a search tool and records direct sources.
- Do not treat inaccessible platform pages as evidence.
- Do not start HTML, cover, or video production from an unconfirmed draft.
- Do not manage a content library, application state, analytics database, or automatic platform publishing.
