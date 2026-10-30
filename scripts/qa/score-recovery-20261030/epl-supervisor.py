"""Finite EPL predicates used by the existing supervisor, never a new runner."""
import json,pathlib
SOURCE='c34bc991643c7f68ba856eec143d76c66ce4fb63'
KEYS=['feeds/incoming/events.json','data/events.json']
CODES=frozenset('EPL_NETWORK EPL_SOURCE_DEADLINE EPL_SOURCE_BYTES EPL_SOURCE_JSON EPL_SOURCE_HTTP EPL_SOURCE_ENCODING EPL_SOURCE_PARTIAL EPL_UTF8 EPL_FIXTURE_COLLECTION EPL_TABLE_ADMISSION EPL_RESOURCE_INCOMPLETE EPL_RESOURCE_DEADLINE EPL_BODY_CAP EPL_CLOSURE EPL_PRIVACY EPL_NATIVE_CONTAINMENT EPL_CHILD_FAILURE EPL_ROLLBACK_FAILURE'.split())
def validate_route(p,policy_path):
 assert p['sourceGitSha']==SOURCE and p.get('sourceProtocol')=='epl'
 assert p['http']=={'requests':5,'deadlineMs':20000,'fixtureWireAndDecodedBytes':884736,'tableWireAndDecodedBytes':147456,'totalWireAndDecodedBytes':3686400,'retries':0,'redirect':'error'}
 assert p['credentialEnvironmentNames']==[]
 assert not any('SUPABASE'in k or 'TOKEN'in k or 'SECRET'in k for k in p['environmentKeys'])
 if p['mode']=='epl-canonical':
  assert p['root']==p['sourceRoot'] and not any(k.startswith('control')for k in p)
  assert p['entryArgv']==['scripts/update-cards.js','--quick','--source=epl','--local-only'] and p['sourceArgv']==['scripts/quick-results.js','--source=epl']
  assert (p['wholeSeconds'],p['minimumSecondsBeforeLaunch'],p['minimumFreeBytes'],p['maximumNewDiskBytes'],p['maxRollbackBytes'],p['maxFileBytes'])==(180,160,4831838208,728303893,268435456,33554432)
  profile=json.loads((policy_path.parent/'epl-profile.json').read_text());root=pathlib.Path(p['root'])
  assert p['writeFiles']==[str(root/f)for f in profile['writeFiles']]
  assert p['writeCaps']=={str(root/f):v for f,v in profile['writeCaps'].items()}
  assert p['rollbackHashes']=={str(root/f):v['sha256']for f,v in profile['rollbackInventory'].items()}
  assert len(p['writeFiles'])==161 and len(p['rollbackHashes'])==429 and len(profile['runtimeOutputs'])==8
  assert p['surfaceIds']==profile['surfaceIds'] and p['surfaceBindings']==profile['surfaceBindings']
 else:
  assert p['mode']=='owned-control'and p['root']!=p['sourceRoot']and p.get('controlBoundary')
  assert p['entryArgv']==p['sourceArgv']==[str(pathlib.Path(p['sourceRoot'])/'scripts/quick-results.js'),'--source=epl']
 for file in KEYS:assert len(p['surfaceIds'][file])==len(set(p['surfaceIds'][file]))==380

def environment(p,policy_path,digest):
 result={'PATH':'/usr/bin:/bin:/usr/sbin:/sbin','LANG':'en_AU.UTF-8','TZ':'Australia/Sydney','TMPDIR':p['tmpDir'],'NODE_OPTIONS':p['nodeOptions'],'NS_SCORE_GUARD_POLICY':str(policy_path),'NS_SCORE_GUARD_POLICY_SHA256':digest,'REFRESH_REPORT':str(pathlib.Path(p['runDir'])/'refresh-report.json'),'QUICK_RESULTS_REPORT':str(pathlib.Path(p['runDir'])/'quick-results-report.json'),'FOOTBALL_DATA_RUN_DIR':str(pathlib.Path(p['tmpDir'])/'football-backup')}
 assert set(result)<=set(p['environmentKeys'])
 return result

def postconditions(p,receipt,baseline,read):
 """Call only after native group closure; read is the supervisor-owned reader."""
 assert receipt['processGroupClosed']and not receipt['ownedTemporaryFilesRemaining']
 source=receipt['transport'];assert source and source.get('protocol')=='epl'and source.get('collectionComplete')and not source.get('activeCall')and not source.get('readersOpen')and not source.get('requestsOpen')
 assert 1<=source['requests']<=5 and source['receivedBytes']<=3686400 and source['decodedBytes']<=3686400 and source['capturedBytes']==0
 rows=receipt['pages'];assert len(rows)==source['requests']and len({r['resource']for r in rows})==len(rows)
 assert sorted(rows,key=lambda r:r['resource'])==rows
 for row in rows:
  assert type(row['resource'])is int and 0<=row['resource']<=4 and row['state']in['complete','failed']
  cap=147456 if row['resource']==4 else 884736
  assert 0<=row['wireBytes']<=cap+(row['state']=='failed') and 0<=row['decodedBytes']<=cap+(row['state']=='failed')and 0<=row['elapsedMs']<=20000
  assert row['readerClosed']and row['requestClosed']and row['decoderClosed']
  if row['state']=='complete':assert row['bodyComplete']and row['guardParsed']and row['consumerParsed']and'code'not in row
  else:assert row['code']in CODES
 assert sum(r['wireBytes']for r in rows)==source['receivedBytes']and sum(r['decodedBytes']for r in rows)==source['decodedBytes']
 fixtures_ok=len([r for r in rows if r['resource']<4 and r['state']=='complete'])==4
 table_ok=any(r['resource']==4 and r['state']=='complete'for r in rows)
 assert fixtures_ok or table_ok
 root=pathlib.Path(p['root']);report=json.loads(read(pathlib.Path(p['runDir'])/'quick-results-report.json'))
 assert report.get('source')=='epl'and report['backup']['networkRequestsAllowed']==0
 updated=report['updatedFixtureIdsBySurface'];assert set(updated)==set(KEYS)
 if not fixtures_ok:assert not any(updated.values())and report['resources']['fixtures']['state']=='retained-last-good'
 prefix=[['scripts/build-canonical-context-bundle.js'],['scripts/validate-premier-league-context.js']]
 tail=[['scripts/build-code-inspector.js','--codes=football'],['scripts/build-app-shell-runtime.js'],['scripts/apply-current-card-evidence.js','--check'],['scripts/validate-current-card-coverage.js'],['scripts/validate-feed-coverage-resilience.js'],['scripts/validate-feed.js','data/events.json'],['scripts/validate-crowd-foresight.js'],['scripts/build-follow-directories.js'],['scripts/build-follow-directories.js','--check']]
 history=source['childArgvs']
 if not report['changed']:assert history==[]
 elif any(updated.values()):
  pub=['scripts/publish-feed.js','data/events.json','data/events.json','data/feed-meta.json','data/events.js','--preserve-known']
  assert history[:2]==prefix and len(history[2])==7 and history[2][:6]==pub
  assert history[2][6].startswith('--epl-updated-ids=') and json.loads(history[2][6].split('=',1)[1])==updated
  assert history[3:]==[['scripts/qa-storyline-spoilers.js',KEYS[0]],['scripts/qa-storyline-spoilers.js',KEYS[1]],['scripts/build-paged-feed.js']]+tail
 else:assert history==prefix+tail
 for file in KEYS:
  before=json.loads(baseline[str(root/file)]);after=json.loads(read(root/file));old=before['events'];new=after['events'];assert [e['id']for e in old]==[e['id']for e in new]
  assert len(updated[file])==len(set(updated[file])) and set(updated[file])<=set(p['surfaceIds'][file])
  for a,b in zip(old,new):
   if a['id']not in updated[file]:assert a==b
   else:
    binding=p['surfaceBindings'][file][a['id']]
    for key,value in binding.items():assert b.get(key)==value
    facts=['status','homeScore','awayScore','result','score','scoreDisplay','outcomeText','recapText','resultSourceUrl','delayedResultSource','sourceAttribution','participantIds','sourceName','sourceUrl']
    if a.get('status')==b.get('status')=='completed'and all(a.get(k)==b.get(k)for k in facts):
     for k in['scoreCheckedAt','resultSourceCheckedAt']:assert a.get(k)==b.get(k)
 overlay='data/canonical/football-delayed-results.v1.json';assert read(root/overlay)==baseline[str(root/overlay)]
 bundle='data/canonical/afl-nrl-2026.json';a=json.loads(baseline[str(root/bundle)]);b=json.loads(read(root/bundle));comp='competition:premier-league-2026-27'
 if not table_ok:
  old=next(e for e in a['ladderSnapshots']if e['competitionId']==comp);new=next(e for e in b['ladderSnapshots']if e['competitionId']==comp)
  for k in['entries','snapshotTimeUtc','source']:assert old.get(k)==new.get(k)
 ids={side for value in p['surfaceBindings'][KEYS[0]].values()for side in value['participantIds']}
 assert {k:v for k,v in a.items()if k not in['generatedAt','sources','participants','ladderSnapshots']}=={k:v for k,v in b.items()if k not in['generatedAt','sources','participants','ladderSnapshots']}
 assert [e for e in a['participants']if e['id']not in ids]==[e for e in b['participants']if e['id']not in ids]
 assert [e for e in a['ladderSnapshots']if e['competitionId']!=comp]==[e for e in b['ladderSnapshots']if e['competitionId']!=comp]
 assert [e for e in a['sources']if not(e.get('provider')=='Premier League'and e.get('sourceUrl')=='https://www.premierleague.com/en/tables/premier-league/2026-27')]==[e for e in b['sources']if not(e.get('provider')=='Premier League'and e.get('sourceUrl')=='https://www.premierleague.com/en/tables/premier-league/2026-27')]
 for file in ['data/code-inspector/football.json','data/follow-schedule/football.json']:
  if str(root/file)in baseline:
   a=json.loads(baseline[str(root/file)]);b=json.loads(read(root/file))
   assert [e for e in a.get('fixtures',[])if e.get('competitionId')!=comp]==[e for e in b.get('fixtures',[])if e.get('competitionId')!=comp]
 assert set(receipt['changedPaths']or[])<=set(str(pathlib.Path(f).relative_to(root))for f in p['writeFiles'])
 return True
