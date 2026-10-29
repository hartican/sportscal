# Exact function bodies copied from the existing reviewed cleanup helper.
# Parent SHA256: ab42e8ee56ec7ef64a4500d59e0db7e9d3c2ea69caa1fd357ed26c40cc2cf310
import os, signal, subprocess, time

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
