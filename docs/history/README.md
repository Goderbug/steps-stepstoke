# Historical evidence and exact recovery

The multi-file revision preserves all 220 earlier accepted platform records by verified immutable predecessor commit/path/blob/SHA-256 references in `accepted-platform-validation-index.json.xz`. Each member was read from commit `1c5a3339f09b98516fe3f364147acce0b8c55b9c` and compared byte for byte before removal. Decode the index with Python `lzma.decompress`, then retrieve a member with `git show <commit>:<path>` to an explicit separate destination. Six previous RC raw evidence/measurement/failure files remain byte-recoverable at their original paths in `accepted-rc-raw.tar.xz`; its adjacent compressed index verifies every member and archive digest. Extract that archive into a separate directory using `tar -xJf`. `python3 tools/verify-history.py --predecessor` verifies every archive member and predecessor reference. These are historical observations, not final revision passes.

The previous integration `evidence.tar.xz` is retained by the byte-verified commit/path/blob/SHA-256 reference to `1c5a3339f09b98516fe3f364147acce0b8c55b9c` in `integration-predecessor.json`; its original per-member index remains at `docs/validation/integration-v1/archive-index.json`. Retrieve it with `git show <commit>:<path>` to an explicit separate destination. Current revision results and failures are preserved independently in `docs/validation/multi-file-revision/`.

The imported predecessor is commit `d29eedf8e7d6608ed109972c179b367ac07ce91f`. Delivery was initially 20,440,428 tracked bytes, including 12,521,728 bytes of historical validation. To fit the 8 MiB limit without erasing failures or rewriting authenticated content:

- `imported-evidence-text.tar.xz` contains original text logs, operational/design documents and failure records, with their original repository paths and bytes. The boundary revision retains its complete bytes at `61c829259507587220062d62ef5120beb0781deb:docs/history/imported-evidence-text.tar.xz`, verified against the length/SHA-256/Git-blob reference in `integration-predecessor.json`. Retrieve it before extracting into a separate directory, not over the candidate. Its per-member index is unchanged.
- `imported-index.json.xz` records **every** moved historical path, byte count, SHA-256, Git blob ID and storage method (archive or predecessor). Historical binary screenshots/archives and structured JSON reports use immutable predecessor references; the index identifies each one. Every reference was verified with `git show COMMIT:PATH` and `git rev-parse COMMIT:PATH` during this task; no future head was fetched. Current screenshots are separate evidence.
- `a1-fixtures.tar.xz` preserves the original synthetic fixture files before necessary namespace updates. Current tests and exact public snapshots remain ordinary files.

```sh
python3 tools/verify-history.py
python3 tools/verify-history.py --predecessor
mkdir -p /tmp/steps-history-restore
git show 61c829259507587220062d62ef5120beb0781deb:docs/history/imported-evidence-text.tar.xz > /tmp/steps-history-evidence-text.tar.xz
tar -xJf /tmp/steps-history-evidence-text.tar.xz -C /tmp/steps-history-restore
xz -dc docs/history/imported-index.json.xz
```

The first verification is offline and checks every archived byte. The second also requires the imported Git commit and checks every predecessor blob. To recover a binary, use its indexed exact commit/path with `git show` into `/tmp`, then verify its indexed SHA-256 and byte length. Never fetch an unpinned project head to replace missing evidence. If a recipient does not have the predecessor commit, obtain that immutable commit/object set before claiming the binary evidence independently inspected.

This archive is historical data. It includes original failures and obsolete clone/local-only assumptions to make the record recoverable; those are not current instructions or candidate acceptance. Current failures, final measurements and source tests are retained under `docs/validation/rc-v1` and `test/`.

The two screenshots from the immediately accepted adaptation are indexed in `integration-predecessor.json` against the exact local predecessor commit, original path, Git blob, byte length and SHA-256. Both were verified with `git show` before removing duplicate binaries to make room for the new integration evidence. They are not new rendered-review claims. Recover them from those exact immutable references; no future head is fetched. Current integration screenshots and failures are in the separate integration evidence archive.

The accepted adaptation raw archive also has a byte-verified predecessor reference in integration-predecessor.json; its original per-member index remains in ../validation/rc-v1/archive-index.json. This makes room for current raw integration runs without deleting their failures or tests.

For the boundary revision, the complete accepted multi-file archive is retained at `61c829259507587220062d62ef5120beb0781deb:docs/validation/multi-file-revision/evidence.tar.xz`. `integration-predecessor.json` records its verified byte length, SHA-256 and Git blob; its per-member index remains at the original path. Every byte was compared before replacing the duplicate archive with this immutable reference. Recover it with `git show` into a separate directory, then check its index. New failures and final boundary-revision evidence are retained separately.

For LOCAL-REPAIR-V1, the boundary-revision and documentation-v1 archives are retained by additional byte-verified references to original candidate `b7747bf377e292f44b35fb0acc55c6ee1772cee4` in `integration-predecessor.json`. Both archives were compared with those Git objects before their duplicate copies were removed. All original archive member indexes remain. New repair evidence is separate; no historical result is relabelled as a current pass.
