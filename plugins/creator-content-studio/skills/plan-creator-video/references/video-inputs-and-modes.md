# Video inputs and interaction modes

## Minimum planning input

Use the approved content or HTML, target duration, aspect ratio, chosen visual treatment, available materials, narration or audio choice, and subtitle preference.

Proceed with explicit assumptions when missing choices are low risk. Ask a short question when the answer changes the entire plan, such as whether the source is approved, whether to use direct content or accepted HTML, or whether the output is landscape or portrait.

## Conversation mode

- Accept pasted content, an attached document, or an accepted artifact from the current conversation.
- Return assumptions, a scene table, total duration, missing materials, and the next production decision.
- Do not require JSON, an output schema, or a running local application.
- Create a file only when requested and a writable workspace exists.

## Structured mode

- Read only named source files, configurations, schemas, and declared assets.
- Follow the supplied schema exactly and return JSON without surrounding Markdown.
- Write only the requested scene-plan file below the supplied output directory.
- Preserve source identifiers and section order so later revisions can trace invalidated scenes.
