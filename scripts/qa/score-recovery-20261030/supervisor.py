#!/usr/bin/env python3
"""One scoped owner process. A prepared policy is not permission to execute it."""
import argparse,datetime,hashlib,json,os,pathlib,resource,signal,stat,subprocess,time

def sha(data):return hashlib.sha256(data).hexdigest()
def manifest(root):
 rows=[]
 for directory,dirs,names in os.walk(root,followlinks=False):
  for name in list(dirs):
   p=pathlib.Path(directory)/name
   if p.is_symlink():names.append(name);dirs.remove(name)
  for name in names:
   p=pathlib.Path(directory)/name;s=p.lstat();rel=str(p.relative_to(root))
   if stat.S_ISLNK(s.st_mode):row={'path':rel,'type':'symlink','target':os.readlink(p)}
   elif stat.S_ISREG(s.st_mode):row={'path':rel,'type':'file','bytes':s.st_size,'sha256':sha(p.read_bytes())}
   else:raise RuntimeError('Unsupported candidate file type')
   rows.append(row)
 return sorted(rows,key=lambda row:row['path'])

def main():
 began=time.monotonic();os.umask(0o077)
 ap=argparse.ArgumentParser();ap.add_argument('--policy',required=True);ap.add_argument('--expected-sha256',required=True);ap.add_argument('--inspect',action='store_true');ap.add_argument('--allocation');args=ap.parse_args()
 policy_path=pathlib.Path(args.policy).resolve();policy_bytes=policy_path.read_bytes()
 assert sha(policy_bytes)==args.expected_sha256,'Policy hash mismatch'
 p=json.loads(policy_bytes);assert p['mode']in['live-coverage-canonical','owned-control'];assert 0<p['wholeSeconds']<=180
 root=pathlib.Path(p['root']).resolve();run=pathlib.Path(p['runDir']);tmp=pathlib.Path(p['tmpDir']);source=pathlib.Path(p['sourceRoot'])
 assert run.is_absolute()and tmp.parent==run and not run.exists(),'Exclusive run directory required'
 if p['mode']=='live-coverage-canonical':
  assert root==source.resolve()and p['sourceGitSha']=='3b1f6ceab669d3c643535ef303976742b14705eb','Exact frozen source required'
  assert p['entryArgv']==['scripts/update-cards.js','--quick','--source=live-coverage','--local-only']
  assert p['sourceArgv']==['scripts/quick-results.js','--source=live-coverage']and p['wholeSeconds']==180
  assert p['nodeOptions']=='--require='+str(policy_path.parent/'guard.cjs')and not any(k.startswith('control')for k in p),'Actual profile cannot contain control hooks'
  assert p['minimumFreeBytes']>=int(4.5*1024**3),'Existing resource floor required'
  if not args.inspect:
   assert args.allocation,'ROOT_ALLOCATION_REQUIRED: preparation alone cannot execute'
   grant=json.loads(pathlib.Path(args.allocation).read_text());now=datetime.datetime.now(datetime.timezone.utc)
   assert grant['policySha256']==args.expected_sha256 and grant['sourceGitSha']==p['sourceGitSha']and grant['scope']=='one-live-coverage-canonical-local-only'
   assert grant['requestId']and grant['minimumFreeBytes']==p['minimumFreeBytes']
   assert datetime.datetime.fromisoformat(grant['notBefore'])<=now<datetime.datetime.fromisoformat(grant['expiresAt']),'Allocation is not current'
   assert (datetime.datetime.fromisoformat(grant['expiresAt'])-now).total_seconds()>=p['wholeSeconds'],'Allocation must contain the whole bounded attempt'
 else:assert all('update-cards.js'not in str(a)for a in[p['entryArgv'],p['childArgvs']]),'Controls cannot invoke canonical command'
 environment={'PATH':'/usr/bin:/bin:/usr/sbin:/sbin','LANG':'en_AU.UTF-8','TZ':'Australia/Sydney','TMPDIR':str(tmp),'NODE_OPTIONS':p['nodeOptions'],'NS_SCORE_GUARD_POLICY':str(policy_path),'NS_SCORE_GUARD_POLICY_SHA256':args.expected_sha256,'REFRESH_REPORT':str(run/'refresh-report.json'),'QUICK_RESULTS_REPORT':str(run/'quick-results-report.json')}
 if p['mode']=='owned-control':
  assert root!=source.resolve()and p.get('controlBoundary'),'Controls require an isolated owned tree'
  assert p['entryArgv']==[str(source/'scripts/quick-results.js'),'--source=live-coverage'],'Controls use the same admitted source process'
 environment['SUPABASE_URL']='https://mkghopnkhcxtmfrcjdbc.supabase.co'
 if not args.inspect:
  if p['mode']=='live-coverage-canonical'and os.environ.get('SUPABASE_MAINTENANCE_MODE','').strip().lower()in['1','true','yes','on']:raise RuntimeError('SUPABASE_MAINTENANCE_ACTIVE')
  names=p.get('credentialEnvironmentNames',[])
  assert names and all(k in ['SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SECRET_KEY']for k in names)
  key=next((k for k in names if os.environ.get(k)),None)
  assert key,'Credential missing'
  environment[key]=os.environ[key]
 assert set(environment)<=set(p['environmentKeys'])
 command=[p['node'],*p['entryArgv']];proc=None;first=None;head=None;before=None;diagnostics=[];timed_out=False;preflight={};receipt=None;rollback={};rollback_before={}
 started=datetime.datetime.now(datetime.timezone.utc).isoformat()
 if not args.inspect:run.mkdir(mode=0o700);tmp.mkdir(mode=0o700)
 def free_bytes():
  s=os.statvfs(root);return s.f_bavail*s.f_frsize
 def group_alive():
  if not proc:return False
  try:os.killpg(proc.pid,0);return True
  except ProcessLookupError:return False
 def cancel(signum,frame):raise InterruptedError('OWNER_CANCELLED_'+str(signum))
 old_handlers={s:signal.signal(s,cancel)for s in[signal.SIGTERM,signal.SIGINT]}
 try:
  # All resource/pin/time checks precede Popen and therefore any source GET.
  available=free_bytes();required=p['minimumFreeBytes']+p['maximumNewDiskBytes'];preflight.update(availableBytes=available,requiredBytes=required)
  if available<required:raise RuntimeError('DISK_RESERVE')
  assert p['nodeVersion']=='v24.21.0'and sha(pathlib.Path(p['node']).read_bytes())==p['nodeSha256'],'NODE_PIN'
  for file,digest in{**p['sourcePins'],**p['dependencyPins']}.items():
   if sha(pathlib.Path(file).read_bytes())!=digest:raise RuntimeError('SOURCE_PIN')
  git_env={'PATH':'/usr/bin:/bin','LANG':'C','GIT_CONFIG_NOSYSTEM':'1','GIT_CONFIG_GLOBAL':'/dev/null'}
  head=subprocess.check_output(['/usr/bin/git','rev-parse','HEAD'],cwd=source,env=git_env,timeout=min(2,max(.1,p['wholeSeconds']-(time.monotonic()-began))),text=True).strip()
  if head!=p['sourceGitSha']:raise RuntimeError('SOURCE_GIT_SHA')
  for file in sorted(set(p['writeFiles'])|set(p['rollbackHashes'])):
   target=pathlib.Path(file);assert target.is_relative_to(root),'Rollback path outside owned candidate'
   assert not target.is_symlink(),'Rollback symlink refused'
   rollback_before[file]=target.read_bytes()if target.exists()else None
  if sum(len(b)for b in rollback_before.values()if b is not None)>p.get('maxRollbackBytes',268435456):raise RuntimeError('ROLLBACK_BUDGET')
  before=manifest(root)
  if p.get('baselineManifest'):
   baseline=pathlib.Path(p['baselineManifest'])
   if sha(baseline.read_bytes())!=p['baselineManifestSha256']or before!=json.loads(baseline.read_text())['files']:raise RuntimeError('CANDIDATE_BASELINE')
  remaining=p['wholeSeconds']-(time.monotonic()-began);preflight['remainingSecondsBeforeLaunch']=remaining
  if remaining<p['minimumSecondsBeforeLaunch']:raise RuntimeError('PREFLIGHT_WINDOW')
  available=free_bytes();preflight['availableBytesBeforeLaunch']=available
  if available<required:raise RuntimeError('DISK_RESERVE')
  if args.inspect:
   print(json.dumps({'state':'PREPARED_NOT_EXECUTED','source':head,'mode':p['mode'],'command':command,'cwd':str(root),'environmentKeys':sorted(environment),'candidateFiles':len(before),'wholeSeconds':p['wholeSeconds'],'preflight':preflight,'nodeStarts':0,'providerGETs':0}));return 0
  (run/'before-manifest.json').write_text(json.dumps({'files':before},indent=2)+'\n')
  def child_limits():
   resource.setrlimit(resource.RLIMIT_FSIZE,(p['maxFileBytes'],p['maxFileBytes']))
   resource.setrlimit(resource.RLIMIT_CORE,(0,0))
  with(run/'stdout.log').open('xb')as stdout,(run/'stderr.log').open('xb')as stderr:
   proc=subprocess.Popen(command,cwd=root,env=environment,stdout=stdout,stderr=stderr,start_new_session=True,preexec_fn=child_limits)
   while proc.poll()is None:
    if time.monotonic()-began>=p['wholeSeconds']-min(3,p['wholeSeconds']/10):first='WHOLE_WINDOW_TIMEOUT';timed_out=True;break
    if sum((run/f).stat().st_size for f in['stdout.log','stderr.log'])>12582912:first='OUTPUT_LIMIT';break
    if free_bytes()<p['minimumFreeBytes']:first='DISK_RESERVE';break
    time.sleep(.025)
   if not first:proc.wait()
 except BaseException as error:
  first=first or(str(error)if isinstance(error,RuntimeError)else'SUPERVISOR_'+type(error).__name__)
 finally:
  # Once cancellation begins, a second signal must not orphan the owned group.
  for s in old_handlers:signal.signal(s,signal.SIG_IGN)
  try:
   if group_alive():os.killpg(proc.pid,signal.SIGTERM)
   if proc and proc.poll()is None:
    try:proc.wait(timeout=.3)
    except subprocess.TimeoutExpired:pass
   if group_alive():os.killpg(proc.pid,signal.SIGKILL)
   if proc and proc.poll()is None:proc.wait(timeout=.5)
   cleanup_limit=time.monotonic()+.4
   while group_alive()and time.monotonic()<cleanup_limit:time.sleep(.01)
  except(OSError,subprocess.SubprocessError)as error:diagnostics.append('PROCESS_CLEANUP:'+type(error).__name__)
  closed=not group_alive()
  if not args.inspect:
   changed=None
   rollback={'required':bool(first or not proc or proc.returncode!=0 or(run/'first-error.json').exists()),'verified':False,'restoredPaths':[]}
   def restore_candidate():
    rollback['required']=True;rollback['verified']=False
    if not closed:diagnostics.append('ROLLBACK_GROUP_NOT_CLOSED');return
    try:
     for file,body in rollback_before.items():
      target=pathlib.Path(file)
      if target.is_symlink():raise RuntimeError('ROLLBACK_SYMLINK')
      if body is None:
       if target.exists():target.unlink();rollback['restoredPaths'].append(str(target.relative_to(root)))
      elif not target.exists()or target.read_bytes()!=body:
       target.write_bytes(body);rollback['restoredPaths'].append(str(target.relative_to(root)))
     rollback['verified']=all((not pathlib.Path(f).exists())if b is None else pathlib.Path(f).read_bytes()==b for f,b in rollback_before.items())
    except(OSError,RuntimeError)as error:diagnostics.append('ROLLBACK:'+type(error).__name__)
   if rollback['required']:restore_candidate()
   else:rollback['verified']=True
   # The killed source cannot run its spool-finally. Only after its entire
   # native process group is gone, remove files beneath this exclusive tmp.
   temporary_removed=[]
   if closed:
    try:
     for directory,dirs,names in os.walk(tmp,topdown=False,followlinks=False):
      for name in names:
       target=pathlib.Path(directory)/name
       target.unlink();temporary_removed.append(str(target.relative_to(run)))
      for name in dirs:
       target=pathlib.Path(directory)/name
       if target.is_symlink():target.unlink()
       else:target.rmdir()
    except OSError as error:diagnostics.append('TEMPORARY_CLEANUP:'+type(error).__name__)
   try:
    after=manifest(root);(run/'after-manifest.json').write_text(json.dumps({'files':after},indent=2)+'\n')
    if before is not None:
     old={row['path']:row for row in before};new={row['path']:row for row in after};changed=[k for k in sorted(old.keys()|new.keys())if old.get(k)!=new.get(k)]
   except(OSError,RuntimeError)as error:diagnostics.append('CANDIDATE_READBACK:'+type(error).__name__)
   def read_receipt(name):
    try:
     if not(run/name).exists():return None
     value=json.loads((run/name).read_text())
     if not isinstance(value,dict)or not value:raise ValueError('RECEIPT_OBJECT_REQUIRED')
     return value
    except(OSError,ValueError)as error:diagnostics.append(name+':'+type(error).__name__);return None
   guard_error=read_receipt('first-error.json')
   transports=[]
   for file in run.glob('transport-*.json'):
    value=read_receipt(file.name)
    if value:transports.append(value)
   source_transport=next((r for r in transports if r.get('sourceRole')),None)
   pages=[]
   for file in sorted(run.glob('page-*.json')):
    page=read_receipt(file.name)
    if page:
     pages.append(page);body_file=file.with_suffix('.raw')
     try:
      if page.get('captureFileOpened')and(not body_file.exists()or sha(body_file.read_bytes())!=page.get('sha256')):diagnostics.append('BODY_READBACK_HASH')
      if not page.get('captureFileOpened')and body_file.exists():diagnostics.append('UNVALIDATED_BODY_EXPORT')
     except OSError as error:diagnostics.append('BODY_READBACK:'+type(error).__name__)
   receipt={'state':'failed'if first or guard_error or not proc or proc.returncode!=0 or not closed else'candidate-finished-pending-review','mode':p['mode'],'source':head,'startedAt':started,'finishedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'elapsedSeconds':time.monotonic()-began,'timedOut':timed_out,'exitCode':proc.returncode if proc else None,'nodeStarts':int(proc is not None),'preflight':preflight,'firstGuardError':guard_error,'supervisorError':first,'processGroupClosed':closed,'changedPaths':changed,'transport':source_transport,'pages':pages,'rollback':rollback,'ownedTemporaryFilesRemaining':[str(x.relative_to(run))for x in tmp.rglob('*')if x.is_file()],'policySha256':args.expected_sha256,'diagnosticErrors':diagnostics}
   receipt['ownedTemporaryFilesRemovedAfterGroupClose']=temporary_removed
   if diagnostics or receipt['elapsedSeconds']>p['wholeSeconds'] or receipt['ownedTemporaryFilesRemaining']:receipt['state']='failed'
   if not rollback['verified']:receipt['state']='failed'
   if receipt['state']=='candidate-finished-pending-review'and(not source_transport or not source_transport.get('collectionComplete')or source_transport.get('failed')or source_transport.get('activeCall')or source_transport.get('readersOpen')or not pages or any(not all(row.get(k)for k in['bodyComplete','guardParsed','consumerParsed','readerReleased','captureFileClosed'])for row in pages)):receipt['state']='failed'
   def refresh_readback():
    try:
     after=manifest(root);old={row['path']:row for row in before or[]};new={row['path']:row for row in after}
     receipt['changedPaths']=[k for k in sorted(old.keys()|new.keys())if old.get(k)!=new.get(k)]
     (run/'after-manifest.json').write_text(json.dumps({'files':after},indent=2)+'\n')
    except(OSError,RuntimeError)as error:diagnostics.append('FINAL_READBACK:'+type(error).__name__)
   if receipt['state']=='failed'and not rollback['required']:
    restore_candidate();refresh_readback()
   try:(run/'result.json').write_text(json.dumps(receipt,indent=2)+'\n')
   except OSError as error:
    diagnostics.append('FINAL_REPORT:'+type(error).__name__);receipt['state']='failed'
    if not rollback['required']:restore_candidate();refresh_readback()
   receipt['finishedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();receipt['elapsedSeconds']=time.monotonic()-began
   # Final receipt IO is part of the bounded attempt, including an exit-zero
   # source. A late overrun cannot leave a successful candidate behind.
   if receipt['elapsedSeconds']>p['wholeSeconds']:
    receipt['state']='failed';receipt['timedOut']=True
    receipt['supervisorError']=first or 'FINALIZATION_WINDOW_TIMEOUT'
    if not rollback['required']:restore_candidate();refresh_readback()
    receipt['finishedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();receipt['elapsedSeconds']=time.monotonic()-began
    try:(run/'result.json').write_text(json.dumps(receipt,indent=2)+'\n')
    except OSError as error:diagnostics.append('FINAL_REPORT:'+type(error).__name__)
   print(json.dumps(receipt))
  for s,h in old_handlers.items():signal.signal(s,h)
 if args.inspect:print(json.dumps({'state':'PREPARED_BUT_BLOCKED','reason':first,'preflight':preflight,'nodeStarts':0,'providerGETs':0}));return 1
 return 0 if receipt['state']=='candidate-finished-pending-review'else 1
if __name__=='__main__':raise SystemExit(main())
