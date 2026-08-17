# Recording HTML production

## Page contract

- Create one semantic HTML file with inline CSS and inline JavaScript.
- Do not load remote fonts, styles, scripts, tracking pixels, analytics, or remote images by default.
- Preserve the approved content section order and align each visible section with its narration purpose.
- Make every essential interaction available without hovering.
- Support keyboard navigation and visible focus states when the page has controls.
- Use responsive layout while prioritizing the requested recording aspect ratio.

## Recording experience

- Use large readable type, clear progress, stable spacing, and restrained motion.
- Keep the current argument visible; avoid decorative dashboards that obscure the point.
- Prefer diagrams, process lanes, comparison cards, checklists, or decision gates when they clarify the argument.
- Use real screenshots only when the user supplied or approved them. Label mockups and diagrams accurately.
- Avoid scroll traps, auto-playing sound, rapid animation, and hover-only explanations.

## Output

When file writing is available, use a descriptive filename such as `presentation.html`, verify the file opens, and report its real path. In structured mode, also produce only the manifest required by the caller.

When file writing is unavailable, return the complete single-file HTML in one code block. Do not claim that a browser preview or downloadable artifact exists.
