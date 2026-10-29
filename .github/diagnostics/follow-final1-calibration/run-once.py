"""One disposable calibration then the unchanged app journey; never acceptance."""
from pathlib import Path
import datetime
import hashlib
import json
import os
import shutil
import signal
import subprocess
import sys
import time

def members(group,deadline):
    remaining=deadline-time.monotonic()
    if remaining<=0:raise TimeoutError('cleanup_deadline')
    result=subprocess.run(['ps','-axo','pid=,pgid='],capture_output=True,text=True,check=True,timeout=min(1,remaining))
    return [int(parts[0])for line in result.stdout.splitlines()if len(parts:=line.split())==2 and int(parts[1])==group]

def cleanup(proc,deadline):
    result={'forced':False,'signals':[],'remainingProcessGroupMembers':None,'complete':False}
    try:
        remaining=members(proc.pid,deadline)
        if remaining:
            result['forced']=True
            try:os.killpg(proc.pid,signal.SIGTERM);result['signals'].append('SIGTERM')
            except ProcessLookupError:pass
            term_end=min(time.monotonic()+2,deadline-2)
            while time.monotonic()<term_end:
                proc.poll();remaining=members(proc.pid,deadline)
                if not remaining:break
                time.sleep(min(.05,max(0,term_end-time.monotonic())))
            remaining=members(proc.pid,deadline)
            if remaining:
                try:os.killpg(proc.pid,signal.SIGKILL);result['signals'].append('SIGKILL')
                except ProcessLookupError:pass
        # Group cleanup is independent of whether its immediate leader exited.
        while time.monotonic()<deadline:
            proc.poll();remaining=members(proc.pid,deadline)
            if not remaining:break
            time.sleep(min(.05,max(0,deadline-time.monotonic())))
        result['remainingProcessGroupMembers']=remaining
        result['complete']=not remaining and proc.poll() is not None and time.monotonic()<=deadline
    except Exception as error:result['error']=type(error).__name__
    return result



def main():
    if sys.argv[1:] != ['--run']:
        print('INERT: reviewed ROOT CI allocation and --run required')
        return 0
    started = time.monotonic()
    native_deadline = started + 90
    deadline = started + 120
    assert sys.platform == 'linux'
    base = Path(__file__).resolve().parent
    root = base.parents[2]
    assert root == Path(os.environ['GITHUB_WORKSPACE']).resolve()
    assert os.environ['GITHUB_REPOSITORY'] == 'hartican/sportscal'
    assert os.environ['GITHUB_EVENT_NAME'] == 'pull_request'
    assert os.environ['GITHUB_RUN_ATTEMPT'] == '1'
    event = json.loads(Path(os.environ['GITHUB_EVENT_PATH']).read_text())
    assert event['number'] == 99
    assert event['pull_request']['head']['repo']['full_name'] == 'hartican/sportscal'
    assert event['pull_request']['base']['sha'] == '58ed7cc12b47f07a13c5abc64e145098dda3548f'
    assert os.environ['FOLLOW_CONTROL_ENGINES'] == 'webkit'

    def git(*args):
        return subprocess.check_output(['git', *args], cwd=root, text=True, timeout=5).strip()

    def digest(file):
        return hashlib.sha256(Path(file).read_bytes()).hexdigest()

    source = 'f3527e28b5fbedb92c9c6190e67a84e68469b592'
    assert git('rev-parse', source + '^{tree}') == '4ab21d86f7c23a2c8620de83e81a12f6315134b4'
    assert git('rev-parse', 'HEAD^{tree}') == git('rev-parse', event['pull_request']['head']['sha'] + '^{tree}')
    assert git('status', '--porcelain', '--untracked-files=no') == ''
    harness = root / 'scripts/validate-follow-sport-control-browser.js'
    assert digest(harness) == '848e44ec4130eb3eac9bf5d13a632b970b5626ad23d5d98f2c48651b5f79e0c4'
    names = {'run-once.py', 'app-launch.cjs', 'failure-catch.js.txt', 'bare-root-calibration.cjs'}
    assert {file.name for file in base.iterdir()} == names
    files = [base / name for name in sorted(names)] + [root / '.github/workflows/installed-upgrade-tests.yml']
    reviewed = {str(file.relative_to(root)): digest(file) for file in files}
    assert set(git('diff', '--name-only', source, 'HEAD').splitlines()) == set(reviewed)
    node = Path(shutil.which('node')).resolve()
    assert subprocess.check_output([str(node), '--version'], text=True, timeout=5).strip() == 'v24.21.0'
    module = Path(os.environ['PLAYWRIGHT_MODULE']).resolve()
    assert json.loads((module / 'package.json').read_text())['version'] == '1.64.1'
    browser_launcher = Path(subprocess.check_output(
        [str(node), '-e', 'process.stdout.write(require(process.argv[1]).webkit.executablePath())', str(module)],
        text=True, timeout=5))
    parent = Path(os.environ['FOLLOW_CONTROL_EVIDENCE_DIR'])
    assert parent.is_absolute() and parent.is_dir()
    assert parent.resolve().is_relative_to(Path(os.environ['RUNNER_TEMP']).resolve())
    run_id = os.environ['GITHUB_RUN_ID']
    assert run_id.isdigit()
    output = parent / ('calibration-' + run_id)
    output.mkdir(mode=0o700, exist_ok=False)
    report = {
        'diagnosticOnly': True, 'acceptance': False, 'sourceCandidate': source,
        'prHead': event['pull_request']['head']['sha'], 'deliveryHead': git('rev-parse', 'HEAD'),
        'deliveryTree': git('rev-parse', 'HEAD^{tree}'), 'githubRun': run_id,
        'reviewedFiles': reviewed, 'originalHarnessSha256': digest(harness),
        'runtime': {'node': '24.21.0', 'playwright': '1.64.1', 'platform': sys.platform,
                    'nodeSha256': digest(node), 'playwrightPackageSha256': digest(module / 'package.json'),
                    'browserRegistrySha256': digest(module.parent / 'playwright-core/browsers.json'),
                    'browserLauncherPath': str(browser_launcher), 'browserLauncherSha256': digest(browser_launcher)},
        'attempts': 1, 'retries': 0, 'nativeLimitSeconds': 90, 'outerLimitSeconds': 120,
        'stages': [], 'appStarted': False,
    }
    target = output / 'supervisor.json'
    save = lambda: target.write_text(json.dumps(report, indent=2) + '\n')
    save()
    env = {key: os.environ[key] for key in ['PATH', 'HOME', 'PLAYWRIGHT_BROWSERS_PATH', 'NODE_PATH', 'LD_LIBRARY_PATH', 'DISPLAY', 'XDG_RUNTIME_DIR'] if key in os.environ}
    env.update(PLAYWRIGHT_MODULE=str(module), FOLLOW_CONTROL_ENGINES='webkit',
               FOLLOW_CONTROL_EVIDENCE_DIR=str(output), CALIBRATION_EVIDENCE_DIR=str(output),
               FOLLOW_FINAL1_PROBE_ALLOCATED='f352-calibration-once')
    for name, command, cap in [('component', [str(node), str(base / 'bare-root-calibration.cjs'), '--run'], 30),
                               ('app', [str(node), str(base / 'app-launch.cjs')], 90)]:
        if time.monotonic() >= native_deadline:
            report['stopped'] = 'Native budget exhausted; no retry'
            break
        stage = {'name': name, 'startedAt': datetime.datetime.now(datetime.timezone.utc).isoformat()}
        report['stages'].append(stage)
        proc = None
        with (output / (name + '.log')).open('x') as stream:
            try:
                proc = subprocess.Popen(command, cwd=root, env=env, stdout=stream, stderr=subprocess.STDOUT, start_new_session=True)
                stage['pid'] = proc.pid
                if name == 'app':
                    report['appStarted'] = True
                stage['exitCode'] = proc.wait(timeout=min(cap, max(.01, native_deadline - time.monotonic())))
            except subprocess.TimeoutExpired:
                stage['timedOut'] = True
            except Exception as error:
                stage['error'] = type(error).__name__
            finally:
                if proc is not None:
                    stage['cleanup'] = cleanup(proc, deadline - 12)
        save()
        closed = stage.get('cleanup', {}).get('complete') and not stage.get('cleanup', {}).get('forced')
        if not closed or stage.get('timedOut'):
            report['stopped'] = 'Unverified or forced process closure; app cannot overlap'
            break
        if name == 'component':
            component_file = output / 'bare-root-calibration.json'
            try:
                component = json.loads(component_file.read_text()) if component_file.exists() else {}
            except (ValueError, OSError):
                component = {}
                report['componentReadError'] = 'Incomplete component receipt'
            report['componentComplete'] = component.get('complete', False)
            report['componentWithinWholeLimit'] = component.get('withinWholeLimit', False)
            report['componentExitCode'] = stage.get('exitCode')
            report['propertyAttributionEligible'] = component.get('propertyAttributionEligible', False)
            if not component.get('browserClosed'):
                report['stopped'] = 'Component browser closure unverified; app not started'
                break
            # A nonpositive or incomplete matrix never hides the app observation.
    report['headUnchanged'] = git('rev-parse', 'HEAD') == report['deliveryHead']
    report['trackedSourceUnchanged'] = git('status', '--porcelain', '--untracked-files=no') == ''
    report['failureCaptures'] = [file.name for file in output.glob('*-final-wheel-failure.json')]
    report['elapsedSeconds'] = time.monotonic() - started
    report['withinOuterLimit'] = report['elapsedSeconds'] <= 120
    app = next((stage for stage in report['stages'] if stage['name'] == 'app'), None)
    if app and app.get('exitCode') == 0:
        report['outcome'] = 'NO_REPRO_INCOMPLETE_NOT_ACCEPTANCE'
    elif app and report['failureCaptures']:
        report['outcome'] = 'APP_RED_RETAINED_CAUSE_NOT_AUTOMATICALLY_PROVEN'
    else:
        report['outcome'] = 'INCOMPLETE_OR_DIFFERENT_FAILURE'
    report['files'] = {file.name: digest(file) for file in output.iterdir() if file.is_file() and file != target}
    save()
    print(json.dumps(report))
    if not app:
        return 1
    if app.get('exitCode') != 0:
        return app.get('exitCode') or 1
    clean = all(not stage.get('timedOut') and not stage.get('error') and stage.get('cleanup', {}).get('complete') and not stage.get('cleanup', {}).get('forced') for stage in report['stages'])
    component_finished = report.get('componentComplete') and report.get('componentWithinWholeLimit') and report.get('componentExitCode') == 0
    return 0 if clean and component_finished and report['headUnchanged'] and report['trackedSourceUnchanged'] and report['withinOuterLimit'] else 1


if __name__ == '__main__':
    sys.exit(main())
