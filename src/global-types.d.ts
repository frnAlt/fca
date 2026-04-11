/** Wide dynamic value for legacy FCA surfaces (same width as `JSON.parse` result). Prefer explicit types in new code. */
type Loose = ReturnType<typeof JSON.parse>;
