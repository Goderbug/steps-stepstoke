# Historical evidence and exact recovery

The imported predecessor is commit `d29eedf8e7d6608ed109972c179b367ac07ce91f`. Delivery was initially 20,440,428 tracked bytes, including 12,521,728 bytes of historical validation. To fit the 8 MiB limit without erasing failures or rewriting authenticated content:

- `imported-evidence-text.tar.xz` contains original text logs, operational/design documents and failure records, with their original repository paths and bytes. Extract into a separate directory, not over the candidate.
- `imported-index.json.xz` records **every** moved historical path, byte count, SHA-256, Git blob ID and storage method (archive or predecessor). Historical binary screenshots/archives and structured JSON reports use immutable predecessor references; the index identifies each one. Every reference was verified with `git show COMMIT:PATH` and `git rev-parse COMMIT:PATH` during this task; no future head was fetched. Current screenshots are separate evidence.
- `a1-fixtures.tar.xz` preserves the original synthetic fixture files before necessary namespace updates. Current tests and exact public snapshots remain ordinary files.

```sh
python3 tools/verify-history.py
python3 tools/verify-history.py --predecessor
mkdir -p /tmp/steps-history-restore
tar -xJf docs/history/imported-evidence-text.tar.xz -C /tmp/steps-history-restore
xz -dc docs/history/imported-index.json.xz
```

The first verification is offline and checks every archived byte. The second also requires the imported Git commit and checks every predecessor blob. To recover a binary, use its indexed exact commit/path with `git show` into `/tmp`, then verify its indexed SHA-256 and byte length. Never fetch an unpinned project head to replace missing evidence. If a recipient does not have the predecessor commit, obtain that immutable commit/object set before claiming the binary evidence independently inspected.

This archive is historical data. It includes original failures and obsolete clone/local-only assumptions to make the record recoverable; those are not current instructions or candidate acceptance. Current failures, final measurements and source tests are retained under `docs/validation/rc-v1` and `test/`.

The two screenshots from the immediately accepted adaptation are indexed in `integration-predecessor.json` against the exact local predecessor commit, original path, Git blob, byte length and SHA-256. Both were verified with `git show` before removing duplicate binaries to make room for the new integration evidence. They are not new rendered-review claims. Recover them from those exact immutable references; no future head is fetched. Current integration screenshots and failures are in the separate integration evidence archive.

The accepted adaptation raw archive also has a byte-verified predecessor reference in integration-predecessor.json; its original per-member index remains in ../validation/rc-v1/archive-index.json. This makes room for current raw integration runs without deleting their failures or tests.
