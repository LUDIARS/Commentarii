# Mask audit fixtures

- `guide/` is an **overlay** on `samples/bestia/` (same mechanism as `../broken/`): the manifest
  adds an `audit` section (`min_numeric_length: 2` so the sample's two-digit masked values are
  compared, two forbidden keys, one allow entry), and `wire-spider.masked.json` adds an invented
  masked number with a unit, a masked string and a masked ID.
- `game/` is a fake game repository fragment that exposes those masked values: UI strings
  (`ui/strings.en.json`), a network type definition (`net/enemy-state.d.ts`) and log lines
  (`console/combat-log.ts`). `ui/legacy-hud.json` is excluded by the allow entry, and
  `docs/notes.txt` is not a scan target.

Loaded by `tests/audit/support.ts`.
