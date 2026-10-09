# Broken fixtures

Each directory is an **overlay** on `samples/bestia/`: files here replace (or add to) the
sample file at the same relative path, everything else comes from the sample. Each overlay
breaks exactly one validate item, named by its directory (`v03-masked-outside` -> V03).
Some breakages are also schema violations (V01) by design; each test asserts only its own item.

Loaded by `tests/support/bundles.ts`.
