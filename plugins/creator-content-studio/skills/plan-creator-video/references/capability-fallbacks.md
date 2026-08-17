# Video-planning capability fallbacks

## Accepted HTML cannot be inspected

- Use supplied section names and narration order when available.
- Mark source-trace verification as pending.
- Do not claim that visual details or DOM order were inspected.

## A declared material cannot be read

- Keep the material in `missingMaterials` with its intended scene and purpose.
- Do not create an undeclared substitute filename.
- Continue only if the plan remains meaningful without pretending the asset exists.

## File writing is unavailable

- Return the complete readable table or JSON in the response.
- Do not claim that `video-scene-plan.json`, a preview, or a rendered video exists.

## Rendering or editing tools are unavailable

- Finish the renderer-neutral scene plan.
- Explain the required downstream handoff only when the user asks to continue into production.
- Do not treat missing rendering as a planning failure.
