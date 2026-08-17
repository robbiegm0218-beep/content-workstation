# Visual inputs and modes

## Minimum accepted-content input

Use the approved title, core thesis, section order, key on-screen phrases, presentation method, target platform or aspect ratio, and selected visual style. When some of these are absent, infer only low-risk layout choices.

Ask a question only when the answer changes the production direction, such as:

- Whether a draft is approved
- Whether a supplied portrait may be used
- Whether the user wants HTML, covers, or both
- Whether the user expects actual files or only a design proposal

## Conversation mode

- Accept pasted content, an attached document, or an accepted draft from the current conversation.
- Do not require JSON or a pre-existing output folder.
- If the user asks for a file and the workspace is writable, create a clearly named output folder in the current workspace.
- If writing is unavailable, return the complete source or specification and say that no file was created.

## Structured mode

- Require an accepted-content snapshot, task type, visual configuration, output directory, and output schema.
- Read only named inputs and assets.
- Write only below the output directory.
- Return only the required manifest or JSON.
- Keep HTML and cover manifests independent so one stage can be revised without invalidating the other.
