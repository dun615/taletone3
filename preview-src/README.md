# Preview

Preview is generated from the canonical src/ and assets/ sources. No duplicate source tree is maintained. The build retains /preview/ URLs and noindex metadata.

The story-to-project experiment is isolated in `story-journey.mjs` (template transforms and translated copy) and `story-journey.css`. These are applied only to preview outputs. The existing book and underwater scene are reused; no new illustration or runtime dependency is introduced.
