# Structured content contract

The caller supplies a JSON Schema. Fill every required field and preserve these semantics:

- `recommendedSubtitle`: one of the three `subtitleCandidates[].title` values.
- `audiencePain`: concrete situations the audience recognizes, not broad demographic labels.
- `coreConflict`: the decision tension that drives the episode.
- `coreThesis`: one defensible sentence the entire episode supports.
- `script.opening`: 20–30 seconds for on-camera delivery when the format is mixed.
- `script.body`: the complete screen-recording narration, aligned with visible sections.
- `script.closing`: 20–30 seconds for on-camera summary and one natural call to action.
- `script.fullMarkdown`: opening, body, and closing assembled into a readable production script.
- `timeline`: chronological switches with seconds, picture, narration summary, and transition purpose.
- `materialSuggestions`: only assets that clarify a point; include insertion timing and purpose.
- `platformPackages`: title, description, tags, and pinned-comment question for every requested platform.
- `missingCaseQuestions`: questions needed to replace generic examples with authentic personal evidence; use an empty array when none are needed.
- `structureRationale`: explain why the structure and presentation fit this audience and goal.

Return JSON only. Do not add commentary before or after it.
