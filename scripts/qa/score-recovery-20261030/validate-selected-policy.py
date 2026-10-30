"""Pure prelaunch route checks only; never main/inspect or a source process."""
import argparse,copy,importlib.util,json,pathlib,sys
from unittest.mock import patch
sys.dont_write_bytecode=True
HERE=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('selected_supervisor_policy',HERE/'supervisor.py');supervisor=importlib.util.module_from_spec(spec);spec.loader.exec_module(supervisor)
def main():
    ap=argparse.ArgumentParser();ap.add_argument('--report',required=True);args=ap.parse_args()
    p=json.loads((HERE/'profile.json').read_text());p.update(mode='live-coverage-canonical',root='/owned/frozen-source',sourceRoot='/owned/frozen-source',publicFixtureShape=str(HERE/'public-fixture-shape.rugby.json'));names=[]
    def valid(name,value):supervisor.validate_route(value,HERE/'actual-policy.json');names.append(name)
    def denied(name,change):
        value=copy.deepcopy(p);change(value)
        try:supervisor.validate_route(value,HERE/'actual-policy.json')
        except AssertionError:names.append(name);return
        raise AssertionError('Expected route refusal')
    with patch.object(supervisor.subprocess,'Popen',side_effect=AssertionError('SOURCE_EXECUTION_FORBIDDEN'))as launch:
        valid('exact-fixed-eight-actual-policy',p)
        denied('combined-actual-refused',lambda v:v.update(coverageSport=None))
        denied('arbitrary-sport-refused',lambda v:v.update(coverageSport='cricket'))
        denied('old-source-sha-refused',lambda v:v.update(sourceGitSha='3b1f6ceab669d3c643535ef303976742b14705eb'))
        denied('missing-entry-scope-refused',lambda v:v.update(entryArgv=[x for x in v['entryArgv']if not x.startswith('--coverage-sport')]))
        denied('missing-source-scope-refused',lambda v:v.update(sourceArgv=[x for x in v['sourceArgv']if not x.startswith('--coverage-sport')]))
        denied('combined-schema-actual-refused',lambda v:v.update(publicFixtureShape=str(HERE/'public-fixture-shape.json')))
        denied('unscoped-publisher-child-refused',lambda v:v['childArgvs'].append(['scripts/publish-feed.js','--preserve-known']))
        denied('different-whole-clock-refused',lambda v:v.update(wholeSeconds=181))
        denied('actual-different-source-root-refused',lambda v:v.update(root='/other/root'))
        owned=copy.deepcopy(p);owned.update(mode='owned-control',root='/owned/fixture',coverageSport=None,entryArgv=['/owned/frozen-source/scripts/quick-results.js','--source=live-coverage']);owned['sourceArgv']=owned['entryArgv'][:]
        valid('original-default-combined-owned-control-preserved',owned)
        owned.update(coverageSport='rugby-union');owned['entryArgv'].append('--coverage-sport=rugby-union');owned['sourceArgv']=owned['entryArgv'][:];valid('selected-eight-owned-control',owned)
        launch.assert_not_called()
    assert len(names)==12
    value={'status':'PASS','checks':12,'names':names,'sourceExecutions':0,'scope':'pure validate_route only; no supervisor main/inspect/native controls'}
    pathlib.Path(args.report).write_text(json.dumps(value,indent=2)+'\n');print(json.dumps(value))
if __name__=='__main__':main()
