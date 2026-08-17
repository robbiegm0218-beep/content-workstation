---
name: create-creator-content
description: Create or revise practical self-media content from a creator profile, topic, viewpoint, notes, document, or real project material. Use for topic selection and three differentiated angles, 5–8 minute spoken-video scripts, mixed-recording timelines, material suggestions, or publishing copy for only the selected platforms such as Bilibili, Xiaohongshu, WeChat Channels, and Douyin. Do not use for HTML or cover production, video rendering or editing, content-library software development, or analytics systems.
---

# Create Creator Content

Build useful, spoken-first content without inventing the creator's experience, customers, metrics, or outcomes.

## Select the interaction mode

Read [references/interaction-modes.md](references/interaction-modes.md), then choose exactly one mode:

- Use **conversation mode** for a normal user request. Work from the message and attached materials, ask only questions that materially change the result, and return readable Markdown.
- Use **structured mode** only when the caller supplies input files or JSON plus an explicit output schema. Follow that schema exactly and return no surrounding commentary.
- Never require repository-specific filenames, an application runtime, or an internal status marker from a conversation-mode user.

## Choose the production task

- For topic exploration, produce exactly three meaningfully different angles and recommend one.
- For a content draft, produce the thesis, audience pain, practical script, recording timeline, material suggestions, missing-case questions, and structure rationale.
- For revision, preserve accepted facts and rewrite only the requested parts unless the user asks for a new direction.
- For publishing copy, read [references/publishing-platforms.md](references/publishing-platforms.md) and produce packages only for platforms explicitly selected by the user.
- When the user asks for research, use an available search capability and follow the evidence rules below. Do not imply research happened when it did not.

## Build the argument

1. Extract the supplied creator identity, audience, topic, goal, tone, platforms, duration, presentation method, evidence, and constraints.
2. Separate supplied facts from interpretation. Put missing real-case details into `待补充问题` or the structured equivalent instead of filling them with plausible details.
3. Build the argument in this order: recognizable scene, problem or conflict, creator judgment, executable method, action summary.
4. Prefer natural spoken Chinese when the requested language is Chinese. Avoid definition stacks, generic slogans, unexplained jargon, and repetitive summary sentences.
5. Make each section carry a decision, tradeoff, failure mode, example, or next action.
6. For mixed recording, design an on-camera opening, screen-recording body, on-camera closing, and explicit switching timeline.
7. Match the requested duration. If none is supplied, use 5–8 minutes for a full video draft and state the assumption once.
8. Read [references/content-quality.md](references/content-quality.md) before producing a full draft or publishing package.

## Handle capabilities honestly

Read [references/capability-fallbacks.md](references/capability-fallbacks.md) whenever research, external pages, attachments, or file creation are requested.

- Cite direct URLs for samples actually found during the current run.
- Treat inaccessible or login-gated platform pages as unavailable evidence.
- Create files only when the user asks for files and a writable workspace is available.
- Name and link only files that were successfully created and verified.

## Boundaries

- Do not start HTML, cover, or video production from an unconfirmed draft; hand the approved content to the matching visual or video Skill.
- Do not manage content-library state, databases, dashboards, analytics, automatic publishing, or account authentication.
- Do not expose plugin implementation details in user-facing output unless the user asks how the plugin works.
