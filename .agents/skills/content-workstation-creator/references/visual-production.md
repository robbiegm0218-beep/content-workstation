# Visual production rules

## Shared boundary

- Treat the approved content snapshot as immutable source material.
- Read the selected style from the supplied configuration; do not substitute a generic style.
- Write only beneath the supplied `output/` directory.
- Use relative POSIX paths in the manifest, rooted at the task workspace.
- Record how each artifact was produced in `generationMode`.
- Set `skillEvidence` to `CW-SKILL-1.0` in every manifest.

## HTML recording page

Create `output/presentation.html` as one self-contained document:

- Inline all CSS and JavaScript.
- Use no external URLs, fonts, analytics, iframes, or network requests.
- Make the first screen communicate the central conflict, then follow the confirmed script order from top to bottom.
- Favor one claim per screen, large readable type, progress/navigation cues, and visualized relationships over paragraphs.
- Support keyboard navigation and vertical scrolling. Avoid auto-playing motion.
- Include a visible marker `data-content-workstation="recording-page-v1"` on the root HTML element.

Write `output/manifest.json` and return the same object as the final response. Set `taskType` to `html`, `generationMode` to `codex-html`, and register only `presentation.html` as the deliverable.

## Covers

Create these exact files with independently composed layouts:

- `output/cover-16x9.png`: 1600 × 900
- `output/cover-4x3.png`: 1200 × 900
- `output/cover-3x4.png`: 900 × 1200

Keep the approved title legible at small size, with strong contrast and safe margins. Reflow and reposition visual elements for every aspect ratio; do not make one canvas and mechanically crop it.

If the style configuration selects `高冲击人物科技` or `high-impact-creator`, read and apply [cover-style-high-impact.md](cover-style-high-impact.md). A reference screenshot is design evidence only: abstract its hierarchy and composition, but do not reproduce a creator's identity, exact wording, logo, signature props, or fixed layout.

Preferred hybrid method when `$imagegen` is available:

1. Generate a text-free visual background or focal illustration that follows the chosen style.
2. Build three local HTML/SVG layouts that place the exact title and optional short eyebrow as normal text.
3. Render each layout to its exact PNG size with an available local browser or renderer.
4. Set `generationMode` to `codex-imagegen-hybrid`.

Fallback method when image generation is unavailable, fails, or cannot return a usable local asset:

1. Build three independent local HTML/SVG covers using typography, CSS shapes, diagrams, gradients, and permitted inline artwork.
2. Render each layout to its exact PNG size with an available local browser or renderer.
3. Set `generationMode` to `codex-template-render` and state the image-generation limitation in `notes`.

Never fabricate an AI-image generation success. Never place title text inside an image-generation prompt. Write `output/manifest.json`, then return that same object as the final response.

## Manifest accuracy

List only files that exist. For every PNG, record its actual pixel width and height. Use the MIME type `image/png`; use `text/html` for the recording page. Keep paths relative and beneath `output/`.
