# ADR-010: CSV Batch-Import Column-Alias Resolution

## Status

Accepted

## Context

The batch/airdrop CSV importer (`lib/csv-parser.ts`) needs to accept CSVs
from different sources (spreadsheet exports, hand-written files, other
tools) that may use slightly different but equally reasonable header names
for the same logical field — e.g. `to` vs `recipient_address` vs `recipient`
for the same column. Requiring one exact header spelling would make the
importer needlessly brittle for anyone whose CSV doesn't happen to match it
exactly. Separately, a cliff (a lump sum or delay before linear unlock
begins) can naturally be expressed either as an absolute date or as a
relative offset from the stream's start, and the importer needs a
deterministic rule for when a CSV supplies both.

## Decision

### Header-alias resolution

`HEADER_ALIASES` maps each logical field to an ordered list of accepted
header spellings (case-insensitive):

| Logical field | Accepted aliases |
|---|---|
| `recipient` | `recipient`, `recipient_address`, `address`, `to` |
| `amount` | `amount`, `total_amount`, `stream_amount` |
| `start_time` | `start_time`, `start_date`, `start_timestamp` |
| `end_time` | `end_time`, `end_date`, `end_timestamp` |
| `cliff_time` | `cliff_time`, `cliff_date`, `cliff_timestamp` |
| `cliff_amount` | `cliff_amount` |
| `cliff_duration` | `cliff_duration`, `cliff_period` |

`recipient`, `amount`, and either of `start_time`/`start_date` or
`end_time`/`end_date` are required; everything else is optional.

`findColumnIndex` normalizes the header row to lowercase, then tries each
alias for a field **in list order**, returning the first match. This means:

- Alias order encodes a preference — if a CSV somehow had columns matching
  more than one alias for the same field (not possible with valid CSV, since
  headers are typically unique, but relevant if two aliases could otherwise
  collide), the earlier-listed alias wins.
- Matching is exact-normalized-string, not fuzzy — `Recipient Address` (with
  a space) or `recipientAddress` (camelCase) would **not** match
  `recipient_address`. Only the literal strings listed are recognized.

### `cliff_time` vs `cliff_duration` precedence

A cliff can be specified two ways, and a row may in principle supply both.
`resolveCliffTime`'s precedence, in order:

1. **`cliff_time`** (absolute) wins if present and parseable — an absolute
   timestamp (unix seconds or ISO date string) is unambiguous, so it takes
   priority.
2. **`cliff_duration`** (relative, e.g. `30d`, `12h`) is used only if
   `cliff_time` was absent or unparseable, computed as `start_time + duration`.
3. If neither is present/parseable, the row has no cliff (`null`).

Absolute was chosen to win over relative because an absolute date is a more
specific, less ambiguous instruction — if a user provides both, they most
likely intended the absolute date as the authoritative value and left
`cliff_duration` as a leftover from a template or a previous edit, rather
than intending the relative offset to silently override an explicit date.

## Consequences

**Easier:**
- CSVs from varied sources (different spreadsheet tools, hand-authored
  files, exports from other systems) work without requiring users to rename
  columns to one exact canonical spelling.
- The cliff precedence rule is deterministic and doesn't require rejecting a
  row just because it happens to populate both cliff columns.

**Harder / accepted limitations:**
- The alias list is fixed at these exact strings — a header spelling not in
  the list (e.g. a typo, or a reasonable variant not yet added) fails to
  auto-detect and requires either fixing the CSV header or passing
  `customColumnMapping` explicitly.
- No fuzzy/whitespace-insensitive matching — `recipient address` (space) or
  `Recipient-Address` (hyphen) will not match `recipient_address`.
- Silently preferring `cliff_time` over `cliff_duration` when both are
  present means a user who actually intended the relative value to take
  precedence gets no warning that their `cliff_duration` was ignored.
