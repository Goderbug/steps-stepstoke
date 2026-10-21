#!/usr/bin/env python3
"""Read-only source/export audit. Run from the repository root; no third-party modules."""
import hashlib
import json
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[4]
base = '878ba4ba1cf7c601656f3a25d17546a425ba1207'
evidence = root / 'docs/validation/platform-ux-v1/final'
def sha(raw):
    return hashlib.sha256(raw).hexdigest()
def git(*args):
    return subprocess.check_output(['git', *args], cwd=root)
protected = ['src', 'sdk', 'cli', 'abi', 'config', 'lib', 'foundry.toml', 'remappings.txt', 'package.json', 'package-lock.json']
files = git('ls-tree', '-r', '--name-only', base, '--', *protected).decode().splitlines()
comparison = []
for name in files:
    before = sha(git('show', f'{base}:{name}'))
    after = sha((root / name).read_bytes())
    comparison.append({'path': name, 'baselineSHA256': before, 'currentSHA256': after, 'match': before == after})
checks = []
for manifest in ['source-sha256.json', 'dist-sha256.json']:
    mismatches = []
    checked = 0
    for name, item in json.loads((evidence / manifest).read_text()).items():
        # Current documentation intentionally supersedes the recorded prose.
        if manifest.startswith('source') and (name == 'README.md' or name.startswith('docs/')):
            continue
        checked += 1
        path = root / name
        if not path.is_file() or sha(path.read_bytes()) != item['sha256']:
            mismatches.append(name)
    checks.append({'manifest': str((evidence / manifest).relative_to(root)), 'checked': checked, 'mismatches': mismatches})
tracked = git('ls-files', '-z').decode().split('\0')
size = {prefix: sum((root / name).stat().st_size for name in tracked if name.startswith(prefix) and (root / name).is_file()) for prefix in ['frontend/', 'dist/']}
flags = json.loads((root / 'config/release.json').read_text())
closed = flags['productionDeployment'] is None and flags['productionReady'] is False and flags['liveCompatibility'] == 'NOT_RUN'
report = {'baselineCommit': base, 'baselineTree': git('rev-parse', f'{base}^{{tree}}').decode().strip(), 'result': 'PASS' if all(x['match'] for x in comparison) and all(not x['mismatches'] for x in checks) and sum(size.values()) <= 8388608 and closed else 'FAIL', 'protectedFiles': comparison, 'recordedFinalManifestChecks': checks, 'trackedBytes': size, 'combinedLimitBytes': 8388608, 'readinessFlagsClosed': closed, 'scope': 'Byte comparison only; no behavioral or live certification. Documentation excluded from historical source-manifest comparison.'}
print(json.dumps(report, indent=2))
raise SystemExit(0 if report['result'] == 'PASS' else 1)
