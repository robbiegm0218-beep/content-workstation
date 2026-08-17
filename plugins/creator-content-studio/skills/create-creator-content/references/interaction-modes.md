# Interaction modes and output contract

## Conversation mode

Use the user's message and attachments directly. Do not ask them to construct JSON, create a schema, or know a repository layout.

Proceed immediately when the topic, audience, and desired deliverable are clear enough. If context is incomplete:

- Make low-risk assumptions and state them briefly.
- Ask no more than three short questions only when different answers would materially change the result.
- Put missing real-case evidence into a visible question list rather than blocking a useful first draft.

For a full content draft, use this readable order unless the user asks for another format:

1. Recommended direction and core thesis
2. Three subtitle candidates with one recommendation
3. Audience pain and central conflict
4. Opening, body, and closing script
5. Recording and visual-switch timeline
6. Material insertion list
7. Selected-platform publishing package
8. Real-case details still needed
9. Why the structure fits the audience and goal

Do not show empty sections. Do not generate publishing packages when no platform was selected unless the user explicitly asks for a platform-neutral package.

## Structured mode

Use structured mode only when the caller explicitly provides a JSON Schema or names a strict machine-readable contract.

- Read only the named input files and attachments.
- Treat supplied structured data as the evidence boundary.
- Fill every required field and respect enums, constants, and selected-platform lists.
- Return only the requested JSON or manifest, without Markdown fences or explanatory text.
- Write artifacts only under the caller-supplied output directory.
- Report missing evidence in the schema's question or warning field; never add invented values to satisfy required fields.

## Revision mode

- Identify accepted facts, accepted thesis, requested changes, and downstream artifacts that may become stale.
- Preserve unaffected sections.
- Explain changed assumptions only when the revision alters meaning or evidence boundaries.
