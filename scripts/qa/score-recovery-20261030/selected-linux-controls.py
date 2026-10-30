"""Future ROOT-allocated Linux qualification only. Never run on the local Mac.
Reuse the original runner and native group/rollback assertions, with selected8
owned fixtures. Projection children remain explicit stand-ins, not live proof.
"""
import importlib.util,json,pathlib,platform,sys
sys.dont_write_bytecode=True
HERE=pathlib.Path(__file__).resolve().parent
CASES=('good','bad-filter','bad-order','bad-method','bad-body','bad-header','cricket-source','cricket-fixture','private-fixture','private-nested','unknown-field','wrong-type','secret-hex-uppercase','short-pages','overlap','later-failure','eight-full','page-overflow','cumulative-overflow','parse-deadline','partial-runtime-failure','late-failure','fd-file-secret','hang-child','interrupted-rollback')
def main():
    assert platform.system()=='Linux','Native selected controls require ROOT Linux qualification'
    spec=importlib.util.spec_from_file_location('fixed8_original_controls',HERE/'controls.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
    original=m.prepare.prepare
    m.prepare.prepare=lambda name,**kw:original(name,coverageSport='rugby-union',**kw)
    records=[]
    for case in CASES:
        r=m.run(case,'fixed8-'+case);records.append(r)
        if case in['cricket-source','cricket-fixture']:
            result=json.loads(pathlib.Path(r['result']).read_text());assert result['firstGuardError']['code']=='POST_GUARD_ROW_SHAPE'
            assert not list(pathlib.Path(r['result']).parent.glob('page-*.raw'))
    (HERE/'selected-linux-results.json').write_text(json.dumps({'status':'PASS','cases':records,'coverageSport':'rugby-union','source':m.prepare.SHA,'actualServiceRequests':0},indent=2)+'\n')
if __name__=='__main__':main()
