"""Owned Python file-boundary faults; never usable with an actual profile."""
import importlib.util,json,pathlib,sys,time
HERE=pathlib.Path(__file__).resolve().parent
policy=pathlib.Path(sys.argv[sys.argv.index('--policy')+1]);p=json.loads(policy.read_text())
assert p['mode']=='owned-control'and p['root']!=p['sourceRoot']
case=p['controlCase'];run=pathlib.Path(p['runDir'])
read_bytes=pathlib.Path.read_bytes;read_text=pathlib.Path.read_text;write_text=pathlib.Path.write_text;exists=pathlib.Path.exists
monotonic=time.monotonic;advance=0
time.monotonic=lambda:monotonic()+advance
def controlled_bytes(self,*a,**k):
    if case.startswith('readback-denied-')and self.parent==run and self.name=='page-00.raw':raise PermissionError('OWNED_READBACK_FAULT')
    return read_bytes(self,*a,**k)
def controlled_text(self,*a,**k):
    if case=='late-invalid-transport'and self.parent==run and self.name.startswith('transport-'):return '{'
    if case=='late-array-transport'and self.parent==run and self.name.startswith('transport-'):return '[1]'
    if case=='late-string-page'and self.parent==run and self.name=='page-00.json':return '"invalid receipt"'
    return read_text(self,*a,**k)
def controlled_write(self,*a,**k):
    global advance
    if case.startswith('report-denied-')and self==run/'result.json':raise PermissionError('OWNED_REPORT_FAULT')
    result=write_text(self,*a,**k)
    if case=='late-output-time'and self==run/'result.json'and not advance:advance=p['wholeSeconds']
    return result
def controlled_exists(self,*a,**k):
    if case=='late-missing-transport'and self.parent==run and self.name.startswith('transport-'):return False
    return exists(self,*a,**k)
pathlib.Path.read_bytes=controlled_bytes;pathlib.Path.read_text=controlled_text;pathlib.Path.write_text=controlled_write;pathlib.Path.exists=controlled_exists
spec=importlib.util.spec_from_file_location('supervisor',HERE/'supervisor.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
raise SystemExit(m.main())
