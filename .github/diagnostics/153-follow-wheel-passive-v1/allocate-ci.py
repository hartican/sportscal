"""Allocate one reviewed, non-acceptance probe inside the existing PR99 CI job."""
from pathlib import Path
import datetime
import hashlib
import json
import os
import shutil
import subprocess

BASE = Path(__file__).resolve().parent
ROOT = BASE.parents[2]
SOURCE = '153123267def97386b7c1b92da9560795a73cbe8'
BASELINE = '58ed7cc12b47f07a13c5abc64e145098dda3548f'
MANIFEST = 'dfce26f37e69eff84ead28b0b54191a6d42d82b5b41ae9bd76a950265ff4d437'


def digest(file):
    return hashlib.sha256(Path(file).read_bytes()).hexdigest()


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT, text=True, timeout=5).strip()


assert os.environ['GITHUB_REPOSITORY'] == 'hartican/sportscal'
assert os.environ['GITHUB_EVENT_NAME'] == 'pull_request'
assert os.environ['FOLLOW_CONTROL_ENGINES'] == 'webkit'
event = json.loads(Path(os.environ['GITHUB_EVENT_PATH']).read_text())
assert event['number'] == 99
assert event['pull_request']['head']['repo']['full_name'] == 'hartican/sportscal'
assert event['pull_request']['base']['sha'] == BASELINE
head = event['pull_request']['head']['sha']
assert git('rev-parse', 'HEAD^{tree}') == git('rev-parse', head + '^{tree}')
assert digest(BASE / 'manifest.json') == MANIFEST
manifest = json.loads((BASE / 'manifest.json').read_text())
expected = {item['path'] for item in manifest['preparedFiles']} | {'manifest.json', 'allocate-ci.py'}
assert {p.name for p in BASE.iterdir()} == expected
files = [BASE / name for name in sorted(expected)] + [ROOT / '.github/workflows/installed-upgrade-tests.yml']
reviewed = {str(p.relative_to(ROOT)): digest(p) for p in files}
assert set(git('diff', '--name-only', SOURCE, 'HEAD').splitlines()) == set(reviewed)
node = Path(shutil.which('node')).resolve()
module = Path(os.environ['PLAYWRIGHT_MODULE']).resolve()
browser = Path(subprocess.check_output([str(node), '-e', 'process.stdout.write(require(process.argv[1]).webkit.executablePath())', str(module)], text=True, timeout=5))
output = Path(os.environ['RUNNER_TEMP']) / 'ns-upgrade-proof'
assert output.is_dir()
allocation = {
    'status': 'ROOT_ALLOCATED_ONCE', 'rootThread': '01a0d5ba-943d-74e0-af7f-dab4fb2bdda4',
    'sourceCandidate': SOURCE, 'sourceTree': manifest['sourceTree'], 'manifestSha256': MANIFEST,
    'runtime': manifest['requiredRuntime'], 'childSeconds': 90, 'outerSeconds': 120,
    'attempts': 1, 'retries': 0, 'runId': 'root-153-follow-wheel-' + os.environ['GITHUB_RUN_ID'],
    'expiresAt': (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=5)).isoformat(),
    'checkout': str(ROOT), 'deliveryHead': git('rev-parse', 'HEAD'), 'deliveryTree': git('rev-parse', 'HEAD^{tree}'),
    'prHead': head, 'prBase': BASELINE, 'githubRunId': os.environ['GITHUB_RUN_ID'],
    'reviewedDeliveryFiles': reviewed, 'nodePath': str(node), 'nodeSha256': digest(node),
    'playwrightModule': str(module), 'playwrightPackageSha256': digest(module / 'package.json'),
    'browserRegistrySha256': digest(module.parent / 'playwright-core/browsers.json'),
    'webkitExecutable': str(browser), 'webkitExecutableSha256': digest(browser), 'evidenceParent': str(output),
}
with (output / 'follow-wheel-allocation.json').open('x') as stream:
    json.dump(allocation, stream, indent=2)
print(json.dumps({'probe': '153-follow-wheel', 'allocatedOnce': True, 'diagnosticOnly': True, 'acceptance': False, 'prHead': head}))
