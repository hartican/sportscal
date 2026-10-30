#!/usr/bin/env python3
"""INERT: qualify the actual imported supervisor on an isolated Linux runner.
No browser, dependency install, socket, SDK, provider or publication operation.
System-boundary fault injections call the same stage/cleanup/curation/finalize.
"""
import argparse, contextlib, hashlib, importlib.util, json, os, pwd, shutil
import signal, subprocess, sys, time, types
from pathlib import Path
from unittest.mock import patch
from urllib.parse import quote, quote_plus

sys.dont_write_bytecode = True
parser = argparse.ArgumentParser()
parser.add_argument('--supervisor', required=True)
parser.add_argument('--proof', required=True)
parser.add_argument('--work', required=True)
parser.add_argument('--runner-uid', type=int, required=True)
parser.add_argument('--runner-gid', type=int, required=True)
parser.add_argument('--worker', action='store_true')
hash_bytes = lambda data: hashlib.sha256(data).hexdigest()

def load(path):
    spec = importlib.util.spec_from_file_location('actual_website_qa_supervisor', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

@contextlib.contextmanager
def fixture(name):
    folder = root / name
    folder.mkdir()
    m.work, m.proof = folder / 'work', folder / 'proof'
    m.work.mkdir()
    os.chown(m.work, args.runner_uid, args.runner_gid)
    m.proof.mkdir()
    m.args = types.SimpleNamespace(runner_uid=args.runner_uid, runner_gid=args.runner_gid)
    m.receipt = {'passed': False, 'status': 'running', 'stages': [], 'reaped': []}
    m.whole_deadline = time.monotonic() + 25
    m.clean_env = {'PATH': '/usr/bin:/bin', 'HOME': pwd.getpwuid(args.runner_uid).pw_dir,
                   'LANG': 'C.UTF-8', 'TMPDIR': str(m.work)}
    m.atomic(m.proof / 'supervisor.json', m.receipt)
    try:
        yield
    finally:
        actions, remaining = real_cleanup()
        case_evidence.append({'fixture': name, 'actualReceipt': json.loads(json.dumps(m.receipt)),
                              'fixtureRescue': {'actions': actions, 'remaining': remaining}})
        assert not remaining, 'Controls rescue could not close owned descendants'
        shutil.rmtree(folder)

def child(code):
    return [sys.executable, '-c', code]

def fails(command, seconds=5, contains=None):
    try:
        m.stage('actual-stage', command, seconds)
    except BaseException as error:
        if contains is not None:
            assert contains in str(error), (contains, str(error))
        assert m.receipt['stages'][-1]['passed'] is False
        assert m.receipt['firstError']['message'] == str(error)
        return m.receipt['stages'][-1]
    raise AssertionError('Expected actual stage failure')

def normal():
    with fixture('normal'):
        row = m.stage('normal', child("import subprocess,sys; subprocess.run([sys.executable,'-c','print(123)'],check=True)"), 5)
        assert row['passed'] and row['naturalClosure'] and not m.owned()

def detached():
    with fixture('detached'):
        code = "import subprocess,sys; subprocess.Popen([sys.executable,'-c','import time; time.sleep(60)'],start_new_session=True)"
        row = fails(child(code), 5, 'left owned descendants')
        assert not row['naturalClosure'] and row['cleanupActions'] and not row['remaining'] and not m.owned()

def term():
    with fixture('term'):
        row = fails(child('import time; time.sleep(60)'), .3, 'deadline')
        assert any(x['signal'] == 'SIGTERM' for x in row['cleanupActions'])
        assert not row['naturalClosure'] and not m.owned()

def kill():
    with fixture('kill'):
        row = fails(child('import signal,time; signal.signal(signal.SIGTERM,signal.SIG_IGN); print("ready",flush=True); time.sleep(60)'), .5, 'deadline')
        assert any(x['signal'] == 'SIGKILL' for x in row['cleanupActions'])
        assert not row['naturalClosure'] and not m.owned()

def stalled():
    with fixture('stalled'):
        # Real child, real /proc ownership, real cleanup loop. Only signal delivery
        # is suppressed temporarily; independent unpatched cleanup rescues it.
        with patch.object(m, 'cleanup', lambda: real_cleanup(signal_seconds=.02)), patch.object(m.os, 'kill', lambda pid, sig: None):
            row = fails(child('import time; time.sleep(60)'), .2, 'deadline')
        assert row['remaining'] and any('left owned descendants' in x['message'] for x in row['failures'])
        actions, remaining = real_cleanup()
        assert actions and not remaining
        m.receipt['stalledSignalRescue'] = {'actions': actions, 'remaining': remaining}

def exited_poll(process):
    # A real child exits before the first public poll returns, deterministically
    # reaching the old bypass path without substituting a fake Popen runner.
    process.wait(timeout=5)
    return process.returncode

def fast_log():
    with fixture('fast-log'):
        with patch.object(m.subprocess.Popen, 'poll', exited_poll):
            row = fails(child('import os; os.write(1,b"x"*(2*1024*1024+1))'), 5, 'log exceeded')
        assert row['exitCode'] == 0 and row['logBytes'] > 2 * 1024 * 1024
        assert len(row['logTail'].encode()) <= 4096 and len(row['logSha256']) == 64

def fast_deadline():
    with fixture('fast-deadline'):
        with patch.object(m.subprocess.Popen, 'poll', exited_poll):
            row = fails(child('import time; time.sleep(.05)'), .01, 'deadline')
        assert row['exitCode'] == 0

def primary_faults():
    with fixture('primary'):
        with patch.object(m, 'cleanup', side_effect=OSError('B cleanup fault')), \
             patch.object(m, 'capture_log', side_effect=OSError('C log fault')), \
             patch.object(m, 'atomic', side_effect=OSError('D artifact fault')):
            row = fails(child('raise SystemExit(7)'), 5, 'exited unsuccessfully: 7')
            assert m.finalize(False) == 1
        assert m.receipt['firstError']['message'] == row['error']
        secondary = json.dumps(m.receipt['secondaryFailures'])
        assert all(label in secondary for label in ('B cleanup fault', 'C log fault', 'D artifact fault'))
        assert not m.owned()

def success_faults():
    for name in ('capture_log', 'atomic'):
        with fixture('success-' + name):
            with patch.object(m, name, side_effect=OSError('success evidence fault')):
                fails(child('pass'), 5, 'success evidence fault')
            assert not m.receipt['stages'][-1]['passed']

def evidence_deadline():
    with fixture('evidence-deadline'):
        capture = m.capture_log
        def slow_capture(path, deadline=None):
            value = capture(path, deadline)
            m.whole_deadline = time.monotonic() - 1
            time.sleep(2.1)
            return value
        with patch.object(m, 'capture_log', slow_capture):
            fails(child('pass'), 2, 'evidence deadline')
        assert m.finalize(False) == 1 and not m.receipt['passed']

def curation():
    with fixture('curation'):
        identifier = 'fb.1.1723456789012.QA_owned_cookie_value/part:segment'
        encoded = quote(identifier, safe='')
        report = {'passed': True, 'candidateSource': m.SOURCE, 'cookies': [{'rows': [{'name': '_fbp', 'domain': 'nothingsport.com', 'value': identifier}]}],
                  'requests': [{'url': 'https://www.facebook.com/tr/?id=1149008224326641&fbp=' + encoded,
                                'body': 'fbp=' + quote_plus(identifier), 'event': {'fbp': identifier},
                                'headers': {'cookie': '_fbp=' + identifier}, 'initiatedAtMs': 12.5}],
                  'encodedBody': quote('fbp=' + encoded, safe=''),
                  'lowerEncoded': encoded.replace('%2F', '%2f').replace('%3A', '%3a'), 'extra': identifier,
                  'responses': [{'headers': {'set-cookie': '_fbp=' + identifier + '; Path=/'}}]}
        raw = json.dumps(report).encode()
        source, destination = m.work / 'raw.json', m.proof / 'curated.json'
        source.write_bytes(raw)
        m.curated_report(source, destination)
        result = json.loads(destination.read_text())
        digest = hash_bytes(identifier.encode())
        assert identifier not in destination.read_text() and encoded not in destination.read_text()
        assert report['lowerEncoded'] not in destination.read_text()
        assert result['rawReportSha256'] == hash_bytes(raw)
        rows = result['report']
        assert rows['cookies'][0]['rows'][0]['value']['sha256'] == digest
        assert rows['requests'][0]['event']['fbp']['sha256'] == digest
        assert 'ns-redacted-sha256-' + digest in rows['requests'][0]['url']
        assert rows['requests'][0]['bodyRawSha256'] == hash_bytes(report['requests'][0]['body'].encode())
        assert rows['requests'][0]['urlRawSha256'] == hash_bytes(report['requests'][0]['url'].encode())
        assert rows['requests'][0]['initiatedAtMs'] == 12.5
        case_evidence.append({'curatedArtifact': result, 'expectedIdentifierDigest': digest})
        with patch.object(m, 'atomic', side_effect=OSError('curation write fault')):
            try:
                m.curated_report(source, destination)
            except OSError as error:
                assert str(error) == 'curation write fault'
            else:
                raise AssertionError('Curation write failure passed')

def worker():
    m.enable_subreaper()
    m.install_interrupt_handlers()
    with fixture('interrupt-worker'):
        first = None
        try:
            m.stage('interrupt', child("from pathlib import Path; import time; Path('ready').write_text('ready'); time.sleep(60)"), 20)
        except BaseException as error:
            first = error
        result = m.finalize(False)
        (root / 'worker-result.json').write_text(json.dumps(m.receipt))
        assert first is not None and 'Supervisor interrupted' in str(first)
        return result

def interruption():
    worker_root = root / 'worker-root'
    worker_root.mkdir()
    log = root / 'worker.log'
    argv = [sys.executable, str(Path(__file__).resolve()), '--supervisor', str(Path(args.supervisor).resolve()),
            '--proof', str(proof_dir), '--work', str(worker_root), '--runner-uid', str(args.runner_uid),
            '--runner-gid', str(args.runner_gid), '--worker']
    with log.open('xb') as handle:
        process = subprocess.Popen(argv, stdout=handle, stderr=subprocess.STDOUT, start_new_session=True,
                                   env={'PATH': '/usr/bin:/bin', 'LANG': 'C.UTF-8'})
        deadline = time.monotonic() + 5
        while not (worker_root / 'interrupt-worker/work/ready').exists():
            assert process.poll() is None and time.monotonic() < deadline, 'Interrupt worker never reached actual stage'
            time.sleep(.02)
        os.kill(process.pid, signal.SIGTERM)
        assert process.wait(timeout=15) == 1
    result = json.loads((worker_root / 'worker-result.json').read_text())
    case_evidence.append({'actualInterruptedWorkerReceipt': result, 'workerExitCode': process.returncode})
    assert not result['passed'] and 'Supervisor interrupted' in result['firstError']['message']
    assert result['remaining'] == [] and not m.owned()

def main():
    global args, m, root, proof_dir, real_cleanup, case_evidence
    args = parser.parse_args()
    assert sys.platform == 'linux' and os.geteuid() == 0, 'Linux root controls only'
    assert {p.name for p in Path('/sys/class/net').iterdir()} == {'lo'}, 'External network interface present'
    assert os.readlink('/proc/self/ns/net') != os.readlink('/proc/1/ns/net'), 'Owned isolated network namespace required'
    m = load(args.supervisor)
    real_cleanup = m.cleanup
    root, proof_dir = Path(args.work).resolve(), Path(args.proof).resolve(strict=True)
    case_evidence = []
    if args.worker:
        return worker()
    root.mkdir()
    report = {'passed': False, 'source': m.SOURCE, 'supervisorSha256': hash_bytes(Path(args.supervisor).read_bytes()),
              'controlsSha256': hash_bytes(Path(__file__).read_bytes()), 'networkNamespace': 'isolated-no-external-interface', 'cases': []}
    target = proof_dir / 'controller-controls.json'
    m.atomic(target, report)
    functions = (normal, detached, term, kill, stalled, fast_log, fast_deadline, primary_faults,
                 success_faults, evidence_deadline, curation, interruption)
    try:
        m.enable_subreaper()
        for name, function in zip(m.CONTROLS_REQUIRED, functions):
            case_evidence = []
            row = {'name': name, 'passed': False}
            report['cases'].append(row)
            try:
                function()
                row['passed'] = True
            except BaseException as error:
                row['error'] = str(error)
                break
            finally:
                row['evidence'] = case_evidence
                m.atomic(target, report)
        report['passed'] = len(report['cases']) == len(functions) and all(row['passed'] for row in report['cases'])
    finally:
        if hasattr(m, 'receipt'):
            actions, remaining = real_cleanup()
            report['finalCleanup'] = {'actions': actions, 'remaining': remaining}
            if actions or remaining:
                report['passed'] = False
        m.atomic(target, report)
        if report['passed']:
            shutil.rmtree(root)
    return 0 if report['passed'] else 1

if __name__ == '__main__':
    sys.exit(main())
