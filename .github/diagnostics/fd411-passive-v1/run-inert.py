"""Inert portable supervisor; ROOT must review exact CI delivery and allocate once."""
from pathlib import Path
import datetime
import hashlib
import json
import os
import runpy
import subprocess
import sys
import time

BASE = Path(__file__).resolve().parent
SOURCE = 'fd411c9313ec1e8c08392ac429086abcd809fa20'
TREE = '3723b0cc3ce121d3b757326cfebe5b577adb9858'
HARNESS = 'scripts/validate-account-sync-recovery-browser.js'


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def main():
    if len(sys.argv) != 4 or sys.argv[1] != '--allocation' or sys.argv[3] != '--run':
        print('INERT: explicit --allocation /absolute/ROOT-allocation.json --run required')
        return 0
    started = time.monotonic()
    deadline = started + 120
    assert sys.platform == 'linux', 'Local Mac/Playwright1.62 is not the failed runtime'
    allocation_path = Path(sys.argv[2])
    assert allocation_path.is_absolute()
    allocation = json.loads(allocation_path.read_text())
    assert allocation['status'] == 'ROOT_ALLOCATED_ONCE'
    assert allocation['rootThread'] == '01a0d5ba-943d-74e0-af7f-dab4fb2bdda4'
    assert allocation['sourceCandidate'] == SOURCE and allocation['sourceTree'] == TREE
    assert allocation['manifestSha256'] == digest(BASE / 'manifest.json')
    assert allocation['runtime'] == 'Linux/Node24.21.0/Playwright1.64.1/WebKit'
    assert allocation['childSeconds'] == 90 and allocation['outerSeconds'] == 120
    assert allocation['attempts'] == 1 and allocation['retries'] == 0
    assert allocation['runId'] and allocation['runId'].replace('-', '').replace('_', '').isalnum()
    assert datetime.datetime.fromisoformat(allocation['expiresAt']) > datetime.datetime.now(datetime.timezone.utc)
    manifest = json.loads((BASE / 'manifest.json').read_text())
    for item in manifest['preparedFiles']:
        assert digest(BASE / item['path']) == item['sha256'], item['path']
    root = Path(allocation['checkout']).resolve()

    def git(*args):
        return subprocess.check_output(['git', *args], cwd=root, timeout=5).decode().strip()

    assert git('rev-parse', 'HEAD') == allocation['deliveryHead']
    assert git('rev-parse', SOURCE + '^{tree}') == TREE
    assert git('status', '--porcelain', '--untracked-files=no') == ''
    assert subprocess.check_output(['git', 'show', SOURCE + ':' + HARNESS], cwd=root, timeout=5) == (BASE / 'original.js').read_bytes()
    assert (root / HARNESS).read_bytes() == (BASE / 'original.js').read_bytes()
    # ROOT may carry this packet in the same CI job. No app/data/test body change is allowed.
    permitted = allocation['reviewedDeliveryFiles']
    for name, expected_hash in permitted.items():
        location = (root / name).resolve()
        assert location.is_relative_to(root)
        assert name == '.github/workflows/installed-upgrade-tests.yml' or location.is_relative_to(BASE)
        assert digest(location) == expected_hash
    differences = set(git('diff', '--name-only', SOURCE, '--').splitlines())
    assert differences == set(permitted), 'Exact reviewed CI-carriage files only; no application changes'
    node = Path(allocation['nodePath'])
    module = Path(allocation['playwrightModule'])
    assert node.is_absolute() and module.is_absolute()
    assert digest(node) == allocation['nodeSha256']
    assert json.loads((module / 'package.json').read_text())['version'] == '1.64.1'
    assert digest(module / 'package.json') == allocation['playwrightPackageSha256']
    core = module.parent / 'playwright-core'
    assert json.loads((core / 'package.json').read_text())['version'] == '1.64.1'
    assert digest(core / 'browsers.json') == allocation['browserRegistrySha256']
    browser = Path(allocation['webkitExecutable'])
    assert browser.is_absolute() and digest(browser) == allocation['webkitExecutableSha256']
    cleanup = runpy.run_path(str(BASE / 'owned-cleanup.py'))['cleanup']
    evidence_parent = Path(allocation['evidenceParent'])
    assert evidence_parent.is_absolute() and evidence_parent.is_dir()
    out = evidence_parent / ('run-' + allocation['runId'])
    out.mkdir(mode=0o700, exist_ok=False)
    (out / 'allocation.json').write_text(json.dumps(allocation, indent=2) + '\n')
    env = {key: os.environ[key] for key in ['PATH', 'HOME', 'PLAYWRIGHT_BROWSERS_PATH', 'NODE_PATH', 'LD_LIBRARY_PATH', 'DISPLAY', 'XDG_RUNTIME_DIR'] if key in os.environ}
    env.update({
        'PLAYWRIGHT_MODULE': str(module), 'ACCOUNT_RECOVERY_BROWSER': 'webkit',
        'ACCOUNT_RECOVERY_CASE': 'diagnostic', 'ACCOUNT_RECOVERY_DIAGNOSTIC_TRACE': '1',
        'ACCOUNT_RECOVERY_MANIFEST_CONTROL': 'original',
        'ACCOUNT_SIGNIN_PROBE_ALLOCATED': 'fd411-passive-v1',
        'ACCOUNT_SIGNIN_PROBE_EVIDENCE_DIR': str(out),
    })
    report = {
        'schema': 'account-signin-hit.supervisor.v1', 'sourceCandidate': SOURCE, 'sourceTree': TREE,
        'deliveryHead': allocation['deliveryHead'], 'runtime': allocation['runtime'],
        'packetManifestSha256': digest(BASE / 'manifest.json'), 'allocationSha256': digest(out / 'allocation.json'),
        'attempts': 1, 'retries': 0, 'childLimitSeconds': 90, 'outerLimitSeconds': 120,
        'diagnosticOnly': True, 'acceptance': False,
    }
    proc = None
    with (out / 'run.log').open('x') as stream:
        try:
            assert deadline - time.monotonic() > 15
            proc = subprocess.Popen([str(node), str(BASE / 'launch.cjs')], cwd=root, env=env,
                                    stdout=stream, stderr=subprocess.STDOUT, start_new_session=True)
            report['pid'] = proc.pid
            report['exitCode'] = proc.wait(timeout=min(90, deadline - time.monotonic() - 15))
        except subprocess.TimeoutExpired:
            report['timedOut'] = True
        except Exception as error:
            report['supervisorError'] = type(error).__name__
        finally:
            if proc is not None:
                report['cleanup'] = cleanup(proc, deadline - 12)
    report['trackedSourceUnchanged'] = git('status', '--porcelain', '--untracked-files=no') == ''
    report['headUnchanged'] = git('rev-parse', 'HEAD') == allocation['deliveryHead']
    capture = out / 'account-signin-hit-failure.json'
    report['failureCapturePresent'] = capture.is_file()
    if report.get('exitCode') == 0:
        report['outcome'] = 'NO_REPRO_INCOMPLETE_NOT_ACCEPTANCE'
    elif capture.is_file():
        report['outcome'] = 'SIGN_IN_RED_RETAINED_CAUSE_NOT_AUTOMATICALLY_PROVEN'
    else:
        report['outcome'] = 'INCOMPLETE_OR_DIFFERENT_FAILURE'
    report['elapsedSeconds'] = time.monotonic() - started
    report['withinOuterLimit'] = report['elapsedSeconds'] <= 120
    report['files'] = [{'path': p.name, 'bytes': p.stat().st_size, 'sha256': digest(p)} for p in sorted(out.iterdir()) if p.is_file()]
    (out / 'supervisor.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))
    # Never turn the native failure into success or qualify a diagnostic pass.
    return report.get('exitCode', 1) or (0 if report['trackedSourceUnchanged'] and report['headUnchanged'] and report.get('cleanup', {}).get('complete') and not report.get('cleanup', {}).get('forced') and report['withinOuterLimit'] else 1)


if __name__ == '__main__':
    sys.exit(main())
