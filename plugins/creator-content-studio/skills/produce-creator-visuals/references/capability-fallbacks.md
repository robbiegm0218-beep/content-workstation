# Visual capability fallbacks

## Image generation is unavailable

- Return a complete three-size cover specification and reusable prompts.
- Recommend a non-portrait fallback when no approved portrait exists.
- State that no PNG files were generated.

## File writing is unavailable

- For HTML, return the complete single-file source.
- For covers, return the full layout specification.
- Do not invent paths, manifests, previews, or download links.

## Browser preview is unavailable

- Validate the HTML structure and self-contained dependency rule as far as the available tools allow.
- State that visual browser verification remains pending.
- Do not describe an unseen layout as visually verified.

## A supplied asset is inaccessible or unsupported

- Identify the unavailable asset.
- Continue only when a safe layout fallback exists.
- Ask the user to reattach the asset when it is essential, especially for portraits or real project screenshots.
