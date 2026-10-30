#!/usr/bin/env python3
"""INERT: qualify the actual imported supervisor on an isolated Linux runner.
No browser, dependency install, socket, SDK, provider or publication operation.
System-boundary fault injections call the same stage/cleanup/curation/finalize.
"""
import argparse, contextlib, hashlib, importlib.util, json, os, pwd, shutil
import signal, subprocess, sys, tempfile, time, types, re
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
SOURCE = 'd9460cae05cc32507facc8fb8c184ae8ed866e52'

def bootstrap_write(path, report, reserve=False):
    # Available before importing the controller; reserve a fresh initial FAIL.
    if reserve:
        with path.open('x') as handle:
            json.dump(report, handle, indent=2)
            handle.write('\n')
        return
    temporary = path.with_suffix(path.suffix + '.next')
    with temporary.open('x') as handle:
        json.dump(report, handle, indent=2)
        handle.write('\n')
    temporary.replace(path)

def parse_netdev(data):
    assert len(data) <= 65536, 'proc net/dev observation exceeds 64 KiB'
    text = data.decode('ascii')
    lines = text.splitlines()
    assert len(lines) >= 3, 'Missing proc net/dev header or devices'
    assert [part.split() for part in lines[0].split('|')] == [['Inter-'], ['Receive'], ['Transmit']], 'Invalid proc net/dev header'
    assert [part.split() for part in lines[1].split('|')] == [
        ['face'], ['bytes', 'packets', 'errs', 'drop', 'fifo', 'frame', 'compressed', 'multicast'],
        ['bytes', 'packets', 'errs', 'drop', 'fifo', 'colls', 'carrier', 'compressed']
    ], 'Invalid proc net/dev columns'
    names = []
    for line in lines[2:]:
        assert line.strip(), 'Blank proc net/dev device row'
        name, counters = line.rsplit(':', 1)
        name, counters = name.strip(), counters.split()
        assert name and name not in names and len(counters) == 16 and all(value.isdecimal() for value in counters), 'Invalid proc net/dev device row'
        names.append(name)
    return {'interfaceNames': sorted(names), 'bytes': len(data), 'sha256': hash_bytes(data)}

def read_netdev(path=Path('/proc/self/net/dev')):
    with path.open('rb') as handle:
        return parse_netdev(handle.read(65537))

def observe_network():
    result = {'errors': [], 'authority': '/proc/self/net/dev and /proc/*/ns/net; sysfs is diagnostic only'}
    def probe(name, function):
        try:
            result[name] = function()
        except BaseException as error:
            result['errors'].append({'probe': name, 'name': type(error).__name__, 'message': str(error)[:400]})
    def identity(path):
        value = os.stat(path)
        return [value.st_dev, value.st_ino]
    def sysfs_names():
        names = []
        for path in Path('/sys/class/net').iterdir():
            assert len(names) < 512, 'sysfs diagnostic interface cap exceeded'
            names.append(path.name)
        return sorted(names)
    probe('selfNetns', lambda: os.readlink('/proc/self/ns/net'))
    probe('pid1Netns', lambda: os.readlink('/proc/1/ns/net'))
    probe('selfNetnsIdentity', lambda: identity('/proc/self/ns/net'))
    probe('pid1NetnsIdentity', lambda: identity('/proc/1/ns/net'))
    probe('procSelfNetDev', read_netdev)
    probe('sysfsInterfaceNamesDiagnostic', sysfs_names)
    return result

def require_isolation(observation):
    required = {'selfNetns', 'pid1Netns', 'selfNetnsIdentity', 'pid1NetnsIdentity', 'procSelfNetDev'}
    assert not any(row['probe'] in required for row in observation['errors']), 'Required network observation failed'
    assert required.issubset(observation), 'Required network observation missing'
    assert observation['procSelfNetDev']['interfaceNames'] == ['lo'], 'External network interface present in current namespace'
    assert all(re.fullmatch(r'net:\[\d+\]', observation[name]) for name in ('selfNetns', 'pid1Netns')), 'Invalid network namespace identity'
    assert all(isinstance(observation[name], list) and len(observation[name]) == 2 and
               all(isinstance(value, int) and value >= 0 for value in observation[name]) and observation[name][1] > 0
               for name in ('selfNetnsIdentity', 'pid1NetnsIdentity')), 'Invalid namespace device/inode observation'
    assert observation['selfNetns'] != observation['pid1Netns'], 'Owned isolated network namespace required'
    assert observation['selfNetnsIdentity'] != observation['pid1NetnsIdentity'], 'Distinct network namespace device/inode required'

def prepare_guard(options):
    directory = Path(options.proof).resolve(strict=True)
    target = directory / ('controller-worker-guard.json' if options.worker else 'controller-controls.json')
    report = {'passed': False, 'source': SOURCE, 'phase': 'before-platform-guard', 'guardPassed': False,
              'moduleImported': False, 'platform': sys.platform, 'euid': os.geteuid(),
              'networkNamespace': 'unverified', 'cases': []}
    bootstrap_write(target, report, reserve=True)
    try:
        assert sys.platform == 'linux' and os.geteuid() == 0, 'Linux root controls only'
        report.update(supervisorSha256=hash_bytes(Path(options.supervisor).read_bytes()),
                      controlsSha256=hash_bytes(Path(__file__).read_bytes()), phase='network-observation')
        report['networkObservation'] = observe_network()
        bootstrap_write(target, report)  # Persist names/identities before validation.
        require_isolation(report['networkObservation'])
        report.update(guardPassed=True, phase='before-module-import', networkNamespace='isolated-no-external-interface')
    except BaseException as error:
        report['firstError'] = {'name': type(error).__name__, 'message': str(error)}
    bootstrap_write(target, report)
    return report, target

def guard_controls():
    rows = []
    header = b'Inter-|   Receive | Transmit\n face |bytes packets errs drop fifo frame compressed multicast|bytes packets errs drop fifo colls carrier compressed\n'
    device = lambda name: name.encode() + b': ' + b' '.join([b'0'] * 16) + b'\n'
    base = {'errors': [], 'selfNetns': 'net:[12]', 'pid1Netns': 'net:[11]',
            'selfNetnsIdentity': [4, 12], 'pid1NetnsIdentity': [4, 11],
            'procSelfNetDev': parse_netdev(header + device('lo')), 'sysfsInterfaceNamesDiagnostic': ['eth0', 'lo']}
    clone = lambda: json.loads(json.dumps(base))
    def rejects(value):
        try:
            require_isolation(value)
        except AssertionError:
            return
        raise AssertionError('Unsafe network observation was accepted')
    def check(name, function):
        row = {'name': name, 'passed': False}
        rows.append(row)
        try:
            function()
            row['passed'] = True
        except BaseException as error:
            row['error'] = str(error)
    check('current-proc-loopback-with-inherited-sysfs', lambda: require_isolation(base))
    def external():
        value = clone()
        value['sysfsInterfaceNamesDiagnostic'] = ['lo']
        value['procSelfNetDev'] = parse_netdev(header + device('lo') + device('eth0'))
        rejects(value)
    check('current-proc-external-interface-rejected', external)
    def identities():
        for field in ('selfNetns', 'selfNetnsIdentity'):
            value = clone()
            value[field] = value[field.replace('self', 'pid1')]
            rejects(value)
    check('same-link-or-inode-rejected', identities)
    def invalid():
        value = clone()
        value['errors'] = [{'probe': 'procSelfNetDev', 'message': 'Synthetic unavailable proc file'}]
        rejects(value)
        for data in (b'', header + device('lo') + device('lo'), header + b'lo: 0\n'):
            try:
                parse_netdev(data)
            except (AssertionError, ValueError):
                continue
            raise AssertionError('Invalid proc device observation accepted')
        top, columns = header.splitlines()
        spaced = b' \t Inter- \t |  Receive\t |\t Transmit \t\n\t face\t | bytes\tpackets errs drop fifo frame compressed multicast \t|\t bytes packets errs drop fifo colls carrier compressed \n'
        assert parse_netdev(spaced + device('lo'))['interfaceNames'] == ['lo']
        rows[-1]['whitespaceHeaderAccepted'] = True
        malformed = [
            ('reported-substring-bypass', b'Inter-| Receive Transmit', b'packets'),
            ('top-missing-label', b'Inter-| | Transmit', columns),
            ('top-duplicate-label', b'Inter-| Receive Receive | Transmit', columns),
            ('top-renamed-label', b'Inter-| Receive | Send', columns),
            ('top-reordered-labels', b'Inter-| Transmit | Receive', columns),
            ('top-prefix-junk', b'junk Inter-| Receive | Transmit', columns),
            ('top-suffix-junk', b'Inter-| Receive | Transmit junk', columns),
            ('top-extra-delimiter', b'Inter-|| Receive | Transmit', columns),
            ('columns-missing-label', top, columns.replace(b' multicast', b'', 1)),
            ('columns-duplicate-label', top, columns.replace(b'bytes packets', b'bytes packets packets', 1)),
            ('columns-renamed-label', top, columns.replace(b' errs ', b' errors ', 1)),
            ('columns-reordered-labels', top, columns.replace(b'bytes packets', b'packets bytes', 1)),
            ('columns-prefix-junk', top, b'junk ' + columns),
            ('columns-suffix-junk', top, columns + b' junk'),
            ('columns-missing-delimiter', top, columns.replace(b'|', b' ', 1)),
            ('columns-extra-delimiter', top, columns + b'|')
        ]
        rows[-1]['headerNegativeCases'] = []
        for name, first, second in malformed:
            try:
                parse_netdev(first + b'\n' + second + b'\n' + device('lo'))
            except AssertionError:
                rows[-1]['headerNegativeCases'].append(name)
                continue
            raise AssertionError('Malformed header accepted: ' + name)
    check('unreadable-malformed-duplicate-proc-rejected', invalid)
    def bounded():
        with tempfile.TemporaryDirectory(prefix='ns-net-guard-') as folder:
            file = Path(folder) / 'dev'
            file.write_bytes(header + device('lo'))
            assert read_netdev(file)['interfaceNames'] == ['lo']
            file.write_bytes(b'x' * 65537)
            try:
                read_netdev(file)
            except AssertionError:
                return
            raise AssertionError('Oversized proc observation accepted')
    check('bounded-proc-reader', bounded)
    def failure_receipt():
        global args
        saved_args = args
        try:
            with tempfile.TemporaryDirectory(prefix='ns-net-bootstrap-') as folder:
                options = types.SimpleNamespace(proof=folder, supervisor=args.supervisor, work=str(Path(folder) / 'unused'), worker=False)
                unsafe = clone()
                unsafe['procSelfNetDev'] = parse_netdev(header + device('lo') + device('eth0'))
                with patch.object(parser, 'parse_args', return_value=options), \
                     patch.object(sys.modules[__name__], 'observe_network', return_value=unsafe), \
                     patch.object(sys.modules[__name__], 'load', side_effect=AssertionError('Controller import must not run')) as import_probe:
                    assert main() == 1 and import_probe.call_count == 0
                receipt = json.loads((Path(folder) / 'controller-controls.json').read_text())
                assert not receipt['passed'] and not receipt['guardPassed'] and not receipt['moduleImported']
                assert receipt['networkNamespace'] == 'unverified' and receipt['firstError']
                assert receipt['networkObservation']['procSelfNetDev']['interfaceNames'] == ['eth0', 'lo']
                assert receipt['networkObservation']['selfNetns'] == 'net:[12]'
                assert not Path(options.work).exists() and receipt['cases'] == []
        finally:
            args = saved_args
    check('failed-bootstrap-recorded-before-any-module-import', failure_receipt)
    return rows

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
    case_evidence.append({'actualInterruptedWorkerGuard': json.loads((proof_dir / 'controller-worker-guard.json').read_text())})
    assert not result['passed'] and 'Supervisor interrupted' in result['firstError']['message']
    assert result['remaining'] == [] and not m.owned()

def main():
    global args, m, root, proof_dir, real_cleanup, case_evidence
    args = parser.parse_args()
    report, target = prepare_guard(args)
    if not report['guardPassed']:
        return 1
    root, proof_dir = Path(args.work).resolve(), Path(args.proof).resolve(strict=True)
    case_evidence = []
    if not args.worker:
        report['networkGuardControls'] = guard_controls()
        if len(report['networkGuardControls']) != 6 or not all(row['passed'] for row in report['networkGuardControls']):
            report['firstError'] = {'name': 'AssertionError', 'message': 'Focused network guard controls failed'}
            bootstrap_write(target, report)
            return 1
    try:
        m = load(args.supervisor)
        assert m.SOURCE == SOURCE
        real_cleanup = m.cleanup
        report.update(moduleImported=True, phase='controller-cases')
    except BaseException as error:
        report['firstError'] = {'name': type(error).__name__, 'message': str(error)}
        bootstrap_write(target, report)
        return 1
    bootstrap_write(target, report)
    if args.worker:
        return worker()
    functions = (normal, detached, term, kill, stalled, fast_log, fast_deadline, primary_faults,
                 success_faults, evidence_deadline, curation, interruption)
    try:
        root.mkdir()
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
    except BaseException as error:
        report['passed'] = False
        report.setdefault('firstError', {'name': type(error).__name__, 'message': str(error)})
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
