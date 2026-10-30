#!/usr/bin/env python3
"""INERT PROPOSAL. Linux QA only; not installed, executed, or qualified.
ROOT must review and bind this file in an immutable test-only snapshot first.
Run as root in the disposable runner so cleanup can also own apt descendants;
npm and browser processes explicitly run as the original runner user.
"""
import argparse, ctypes, hashlib, json, os, pwd, re, shutil, signal, subprocess, sys, time
from http.cookies import SimpleCookie
from pathlib import Path
from urllib.parse import quote, quote_plus, unquote_plus

SOURCE = 'd9460cae05cc32507facc8fb8c184ae8ed866e52'
TREE = '1bf417647ef3fb54c04c6198e019887fa593c401'
MANIFEST = 'ac3d76f83cdfe8c74b1d90bc36951df9dd390b461bdc4f259953ed50d70f92ce'
CONTROLS_REQUIRED = ('normal-descendants', 'detached-descendants', 'term-cleanup', 'kill-cleanup',
                     'stalled-cleanup', 'fast-log-cap', 'fast-deadline', 'primary-secondary-faults',
                     'success-evidence-faults', 'post-evidence-deadline', 'curation', 'outer-interruption')
sha = lambda data: hashlib.sha256(data).hexdigest()
parser = argparse.ArgumentParser()
for name in ('payload', 'manifest', 'proof', 'work', 'node', 'controls'):
    parser.add_argument('--' + name, required=True)
parser.add_argument('--engine', choices=('chromium', 'webkit'), required=True)
parser.add_argument('--runner-uid', type=int, required=True)
parser.add_argument('--runner-gid', type=int, required=True)

def atomic(path, value):
    temporary = path.with_suffix(path.suffix + '.next')
    with temporary.open('x') as handle:
        json.dump(value, handle, indent=2)
        handle.write('\n')
    temporary.replace(path)

def snapshot():
    rows = {}
    for item in Path('/proc').iterdir():
        if not item.name.isdigit():
            continue
        try:
            fields = (item / 'stat').read_text().rsplit(')', 1)[1].split()
            rows[int(item.name)] = (int(fields[1]), int(fields[19]), fields[0])
        except (FileNotFoundError, ProcessLookupError):
            continue
    return rows

def owned():
    rows = snapshot()
    parents = {os.getpid()}
    found = {}
    while True:
        added = {pid: row for pid, row in rows.items() if row[0] in parents and pid not in parents}
        if not added:
            break
        found.update(added)
        parents.update(added)
    return found

def reap():
    while True:
        try:
            pid, status = os.waitpid(-1, os.WNOHANG)
        except ChildProcessError:
            break
        if not pid:
            break
        receipt['reaped'].append({'pid': pid, 'status': status})

def cleanup(signal_seconds=5):
    """Only exact descendant identities; never broad process names or pkill."""
    actions = []
    for sig in (signal.SIGTERM, signal.SIGKILL):
        deadline = time.monotonic() + signal_seconds
        while True:
            reap()
            rows = owned()
            if not rows:
                return actions, []
            for pid, row in rows.items():
                current = snapshot().get(pid)
                if current is not None and current[1] == row[1]:
                    try:
                        os.kill(pid, sig)
                        actions.append({'pid': pid, 'startTick': row[1], 'signal': sig.name})
                    except ProcessLookupError:
                        pass
            if time.monotonic() >= deadline:
                break
            time.sleep(.1)
    reap()
    return actions, [{'pid': pid, 'startTick': row[1], 'state': row[2]} for pid, row in owned().items()]

def child_identity():
    os.setgroups([])
    os.setgid(args.runner_gid)
    os.setuid(args.runner_uid)

def remember(error, where):
    record = {'where': where, 'name': type(error).__name__, 'message': str(error)}
    receipt.update(passed=False, status='failed')
    if 'firstError' not in receipt:
        receipt['firstError'] = record
    else:
        receipt.setdefault('secondaryFailures', []).append(record)

def require_time(deadline, label):
    if time.monotonic() >= deadline:
        raise TimeoutError(label + ' deadline exceeded')

def capture_log(path, deadline=None):
    digest, size, tail = hashlib.sha256(), 0, b''
    remaining = path.stat().st_size
    with path.open('rb') as handle:
        while remaining:
            require_time(min(whole_deadline, deadline if deadline is not None else whole_deadline), 'Log capture')
            chunk = handle.read(min(65536, remaining))
            if not chunk:
                raise RuntimeError('Log changed during capture')
            size += len(chunk)
            remaining -= len(chunk)
            digest.update(chunk)
            tail = (tail + chunk)[-4096:]
    if path.stat().st_size != size:
        raise RuntimeError('Log changed during capture')
    return {'logBytes': size, 'logSha256': digest.hexdigest(), 'logTail': tail.decode('utf-8', errors='replace')}

def stage(name, argv, seconds, *, privileged=False):
    started = time.monotonic()
    deadline = min(whole_deadline, started + seconds)
    log = work / (name + '.log')
    row = {'name': name, 'argv': argv, 'limitSeconds': seconds, 'passed': False, 'naturalClosure': False}
    receipt['stages'].append(row)
    first, process = None, None
    def fail(error, where):
        nonlocal first
        if first is None:
            first = error
            row['error'] = str(error)
        row.setdefault('failures', []).append({'where': where, 'message': str(error)})
        remember(error, name + '/' + where)
        row['passed'] = False
    def budget():
        require_time(deadline, name)
        if log.stat().st_size > 2 * 1024 * 1024:
            raise RuntimeError(name + ' log exceeded 2 MiB')
    try:
        require_time(deadline, name)
        assert not owned(), 'Previous stage still owns processes'
        environment = dict(clean_env)
        if privileged:
            environment['HOME'] = pwd.getpwuid(0).pw_dir
        with log.open('xb') as handle:
            process = subprocess.Popen(argv, cwd=work, env=environment, stdout=handle, stderr=subprocess.STDOUT,
                                       start_new_session=True, preexec_fn=None if privileged else child_identity)
            row['pid'] = process.pid
            while process.poll() is None:
                budget()
                time.sleep(.1)
        row['exitCode'] = process.returncode
        budget()  # Fast exit must not bypass final size or elapsed limits.
        assert process.returncode == 0, name + ' exited unsuccessfully: ' + str(process.returncode)
        grace = min(deadline, time.monotonic() + 1)
        while True:
            reap()  # Popen has already collected its own exit status.
            if not owned() or time.monotonic() >= grace:
                break
            time.sleep(.05)
        row['naturalClosure'] = not owned()
        assert row['naturalClosure'], name + ' left owned descendants'
        budget()
    except BaseException as error:
        fail(error, 'execute')
    if first is not None:
        try:
            actions, remaining = cleanup()
            row.update(cleanupActions=actions, remaining=remaining)
            if remaining:
                raise RuntimeError('Cleanup left owned descendants')
        except BaseException as error:
            fail(error, 'cleanup')
        if process is not None:
            try:
                process.wait(timeout=1)
            except BaseException as error:
                fail(error, 'wait-after-cleanup')
    try:
        # Failure diagnostics get at most one extra second within the whole cap;
        # this never turns an expired stage into a passing one.
        row.update(capture_log(log, min(whole_deadline, time.monotonic() + 1) if first is not None else deadline))
        if row['logBytes'] > 2 * 1024 * 1024:
            raise RuntimeError(name + ' log exceeded 2 MiB')
    except BaseException as error:
        fail(error, 'log')
    try:
        require_time(deadline, name + ' evidence')
    except BaseException as error:
        fail(error, 'evidence-deadline')
    row['elapsedSeconds'] = time.monotonic() - started
    row['passed'] = first is None
    try:
        atomic(proof / 'supervisor.json', receipt)
    except BaseException as error:
        fail(error, 'report')
    try:
        require_time(deadline, name + ' report')
    except BaseException as error:
        fail(error, 'report-deadline')
    if first is not None:
        try:
            atomic(proof / 'supervisor.json', receipt)
        except BaseException as error:
            fail(error, 'failure-report')
        raise first
    return row

def curated_report(path, destination):
    raw = path.read_bytes()
    report = json.loads(raw)
    identifiers = set()
    keys = {'fbp', 'fbc', '_fbp', '_fbc'}
    def collect(value):
        if isinstance(value, list):
            for item in value:
                collect(item)
        elif isinstance(value, dict):
            if 'name' in value and 'domain' in value and isinstance(value.get('value'), str):
                identifiers.add(value['value'])
            for key, item in value.items():
                if key.lower() in keys and isinstance(item, str):
                    identifiers.add(item)
                if key.lower() in ('cookie', 'set-cookie') and isinstance(item, str):
                    cookies = SimpleCookie()
                    cookies.load(item)
                    identifiers.update(cookie.value for cookie in cookies.values())
                collect(item)
        elif isinstance(value, str):
            decoded = value
            for _ in range(4):
                found = False
                for match in re.finditer(r'(?:^|[?&])(?:_?fbp|_?fbc)=([^&#\s]*)', decoded, re.I):
                    identifiers.add(unquote_plus(match.group(1)))
                    found = True
                for match in re.finditer(r'"(?:_?fbp|_?fbc)"\s*:\s*"([^"\r\n]+)"', decoded, re.I):
                    identifiers.add(match.group(1))
                    found = True
                if found:
                    break
                next_value = unquote_plus(decoded)
                if next_value == decoded:
                    break
                decoded = next_value
    collect(report)
    replacements = {}
    escape_token = r'%(?:25){0,4}[0-9A-Fa-f]{2}'
    def percent_key(value):
        return re.sub(escape_token, lambda match: match.group().upper(), value)
    def literal_pattern(value):
        parts = re.split('(' + escape_token + ')', value)
        return ''.join(''.join('[' + char.lower() + char.upper() + ']' if char in 'abcdefABCDEF' else re.escape(char) for char in part)
                       if re.fullmatch(escape_token, part) else re.escape(part) for part in parts)
    for value in identifiers - {''}:
        marker = 'ns-redacted-sha256-' + sha(value.encode())
        variants = {value, json.dumps(value)[1:-1]}
        for _ in range(4):
            variants |= {encode(item, safe='') for item in variants for encode in (quote, quote_plus)}
        for variant in variants:
            replacements[percent_key(variant)] = marker
    # A single substitution pass avoids redacting the replacement digests again.
    pattern = re.compile('|'.join(literal_pattern(item) for item in sorted(replacements, key=len, reverse=True))) if replacements else None
    def text(value):
        return pattern.sub(lambda match: replacements[percent_key(match.group())], value) if pattern else value
    def redact(value):
        if isinstance(value, list):
            return [redact(item) for item in value]
        if not isinstance(value, dict):
            return text(value) if isinstance(value, str) else value
        result = {}
        for key, item in value.items():
            sensitive = key.lower() in ('cookie', 'set-cookie', 'authorization', 'proxy-authorization')
            sensitive |= key.lower() in keys
            sensitive |= key == 'value' and 'domain' in value and 'name' in value
            result[key] = {'sha256': sha(str(item).encode()), 'redacted': True} if sensitive else redact(item)
            if key in ('body', 'url') and isinstance(item, str):
                result[key + 'RawSha256'] = sha(item.encode())
        return result
    atomic(destination, {'rawReportSha256': sha(raw), 'redactions': 'Cookie identifiers, including event fields and repeated URL/body encodings, use stable digests. Original URL/body hashes and timing retained; no profile/storageState/HAR uploaded.', 'report': redact(report)})
    return report

def enable_subreaper():
    libc = ctypes.CDLL(None, use_errno=True)
    assert libc.prctl(36, 1, 0, 0, 0) == 0, 'PR_SET_CHILD_SUBREAPER failed'
    enabled = ctypes.c_int(0)
    assert libc.prctl(37, ctypes.byref(enabled), 0, 0, 0) == 0 and enabled.value == 1

def install_interrupt_handlers():
    def interrupted(signum, frame):
        raise RuntimeError('Supervisor interrupted: ' + str(signum))
    for sig in (signal.SIGTERM, signal.SIGINT):
        signal.signal(sig, interrupted)

def finalize(created_work):
    remaining = None
    try:
        actions, remaining = cleanup()
        receipt.update(finalCleanupActions=actions, remaining=remaining)
        if actions or remaining:
            raise RuntimeError('Final cleanup required force or left descendants')
    except BaseException as error:
        remember(error, 'final-cleanup')
    if created_work and remaining == []:
        try:
            shutil.rmtree(work)
            receipt['ownedTemporaryDataRemoved'] = True
        except BaseException as error:
            remember(error, 'temporary-removal')
    try:
        require_time(whole_deadline, 'Whole execution and evidence')
    except BaseException as error:
        remember(error, 'whole-deadline')
    receipt['passed'] = 'firstError' not in receipt and bool(receipt['stages']) and all(row['passed'] for row in receipt['stages'])
    receipt['status'] = 'passed' if receipt['passed'] else 'failed'
    try:
        atomic(proof / 'supervisor.json', receipt)
    except BaseException as error:
        remember(error, 'final-report')
    try:
        require_time(whole_deadline, 'Whole final report')
    except BaseException as error:
        remember(error, 'whole-report-deadline')
    if not receipt['passed']:
        try:
            atomic(proof / 'supervisor.json', receipt)
        except BaseException as error:
            remember(error, 'final-failure-report')
    return 0 if receipt['passed'] else 1

def main():
    global args, work, proof, clean_env, receipt, whole_deadline
    args = parser.parse_args()
    assert sys.platform == 'linux' and os.geteuid() == 0, 'Disposable Linux root supervisor required'
    assert args.runner_uid > 0 and pwd.getpwuid(args.runner_uid).pw_gid == args.runner_gid
    proof = Path(args.proof).resolve(strict=True)
    receipt = {'passed': False, 'status': 'running', 'source': SOURCE, 'tree': TREE, 'engine': args.engine,
               'stages': [], 'reaped': [], 'wholeSeconds': 700, 'cleanupSecondsPerSignal': 5,
               'limits': 'Proposed runner; unqualified until ROOT test allocation. No publication or hosted/device acceptance.'}
    atomic(proof / 'supervisor.json', receipt)
    whole_deadline = time.monotonic() + 700
    install_interrupt_handlers()
    created_work = False
    try:
        enable_subreaper()
        controls = json.loads(Path(args.controls).read_text())
        assert controls['passed'] is True and controls['source'] == SOURCE
        assert controls['supervisorSha256'] == sha(Path(__file__).read_bytes())
        assert controls['controlsSha256'] == sha(Path(__file__).with_name('controller-controls.py').read_bytes())
        assert controls['networkNamespace'] == 'isolated-no-external-interface'
        assert tuple(row['name'] for row in controls['cases']) == CONTROLS_REQUIRED
        assert all(row['passed'] for row in controls['cases']), 'Actual controller controls must pass before dependencies/browser'
        payload = Path(args.payload).resolve(strict=True)
        manifest_path = Path(args.manifest).resolve(strict=True)
        assert sha(manifest_path.read_bytes()) == MANIFEST
        manifest = json.loads(manifest_path.read_text())
        assert manifest['candidateSource'] == SOURCE and manifest['candidateTree'] == TREE
        assert len(manifest['files']) == 15 and manifest['totalBytes'] == 211934
        assert manifest['origin'] == 'https://nothingsport.com' and manifest['pixel'] == '1149008224326641'
        expected = set()
        for item in manifest['files']:
            relative = Path(item['path'])
            assert not relative.is_absolute() and '..' not in relative.parts
            file = payload / relative
            assert file.is_file() and not file.is_symlink() and file.resolve().is_relative_to(payload)
            data = file.read_bytes()
            assert len(data) == item['bytes'] and sha(data) == item['sha256'], str(relative)
            expected.add(relative.as_posix())
        assert {p.relative_to(payload).as_posix() for p in payload.rglob('*') if p.is_file()} == expected
        assert 'sdkEnabled:false' in (payload / 'public/measurement-start.js').read_text()
        work = Path(args.work).absolute()
        work.mkdir(mode=0o755)
        created_work = True
        os.chown(work, args.runner_uid, args.runner_gid)
        for name in ('tmp', 'runtime', 'browsers', 'npm-cache'):
            folder = work / name
            folder.mkdir(mode=0o755)
            os.chown(folder, args.runner_uid, args.runner_gid)
        xdg = work / 'tmp/xdg'
        xdg.mkdir(mode=0o700)
        os.chown(xdg, args.runner_uid, args.runner_gid)
        # Only original runner identity and explicit task paths; no GitHub, Site,
        # provider, database, auth, registry, or visitor credentials inherited.
        clean_env = {'PATH': str(Path(args.node).parent) + ':/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
                     'HOME': pwd.getpwuid(args.runner_uid).pw_dir, 'LANG': 'C.UTF-8', 'TZ': 'UTC',
                     'TMPDIR': str(work / 'tmp'), 'XDG_RUNTIME_DIR': str(xdg), 'PLAYWRIGHT_BROWSERS_PATH': str(work / 'browsers'),
                     'PLAYWRIGHT_MODULE': str(work / 'runtime/node_modules/playwright'),
                     'NPM_CONFIG_USERCONFIG': '/dev/null', 'NPM_CONFIG_GLOBALCONFIG': '/dev/null',
                     'NPM_CONFIG_REGISTRY': 'https://registry.npmjs.org', 'NPM_CONFIG_CACHE': str(work / 'npm-cache'),
                     'NPM_CONFIG_UPDATE_NOTIFIER': 'false', 'CI': '1'}
        verifier = str(payload / 'scripts/verify-measurement-browser.cjs')
        base = [args.node, verifier, '--root=' + str(payload), '--manifest=' + str(manifest_path)]
        stage('integrity', base + ['--verify-only'], 10)
        stage('npm', [str(Path(args.node).with_name('npm')), 'install', '--prefix', str(work / 'runtime'),
                      '--no-save', '--package-lock=false', 'playwright@1.64.1'], 120)
        mirror = "from pathlib import Path; r=Path('/etc/apt'); files=[*r.glob('*.list'),*r.glob('apt-mirrors*.txt'),*(r/'sources.list.d').glob('*.list'),*(r/'sources.list.d').glob('*.sources')]; selected=[f for f in files if f.is_file() and not f.is_symlink()]; assert any('archive.ubuntu.com' in f.read_text() for f in selected); [(f.write_text(f.read_text().replace('azure.archive.ubuntu.com','archive.ubuntu.com'))) for f in selected if 'azure.archive.ubuntu.com' in f.read_text()]; print('Official Ubuntu mirror; signature validation unchanged')"
        stage('official-mirror', ['/usr/bin/python3', '-c', mirror], 10, privileged=True)
        stage('browser-install', [args.node, str(work / 'runtime/node_modules/playwright/cli.js'),
                                 'install', '--with-deps', args.engine], 240, privileged=True)
        stage('runtime', [args.node, '-e', "const p=require(process.env.PLAYWRIGHT_MODULE+'/package.json');if(process.version!=='v24.21.0'||p.version!=='1.64.1')throw Error('Pinned runtime changed');console.log(JSON.stringify({node:process.version,playwright:p.version,platform:process.platform,arch:process.arch}))"], 10)
        for mode in ('mock', 'actual'):
            if mode == 'actual':
                clean_env.update(NS_META_QA_SOURCE=SOURCE, NS_META_QA_ORIGIN='https://nothingsport.com',
                                 NS_META_QA_PIXEL='1149008224326641', NS_META_QA_MAX_REQUESTS='40')
            output = work / (mode + '-attempt')  # verifier creates exclusively
            command = base + ['--engine=' + args.engine, '--output=' + str(output)]
            if mode == 'actual':
                command += ['--live-meta']
            first = None
            try:
                stage(mode, command, 150)
            except BaseException as error:
                first = error
            raw_report = output / 'browser-privacy-report.json'
            try:
                require_time(whole_deadline, 'Whole pre-curation')
                report = curated_report(raw_report, proof / (mode + '.json'))
                assert report.get('passed') is True and report.get('candidateSource') == SOURCE, 'Verifier report did not pass exact source'
                require_time(whole_deadline, 'Whole post-curation')
            except BaseException as error:
                remember(error, mode + '/curation')
                if first is None:
                    first = error
            if first is not None:
                raise first
    except BaseException as error:
        if 'firstError' not in receipt:
            remember(error, 'execute')
    finally:
        result = finalize(created_work)
    return result

if __name__ == '__main__':
    sys.exit(main())
