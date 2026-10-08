"""Dated preservation operation for the nine existing owner repositories."""
import hashlib,json,pathlib,shutil,subprocess,sys
from datetime import datetime,timezone
assert sys.argv[1:]==['--execute']
base=pathlib.Path('/home/tolya/course-tools');stage=pathlib.Path('/tmp/implementation-final-preservation-20261008')
gate_path=pathlib.Path('/tmp/course-final-history-input-20261008.json')
gate=json.loads(gate_path.read_text())
def run(argv,cwd=base):
    p=subprocess.run(argv,cwd=cwd,capture_output=True,check=True)
    return p.stdout.decode().rstrip('\n')
pr=json.loads(run(['gh','api',f'repos/BSU-RFCT-Afonenko-Courses/Cybersecurity/pulls/{gate["coursePRNumber"]}']))
assert pr['state']=='open' and pr['merged_at'] is None and pr['head']['sha']==gate['courseHead']
ci=json.loads(run(['gh','run','view',str(gate['courseCIRun']),'--repo','BSU-RFCT-Afonenko-Courses/Cybersecurity','--json','status,conclusion,headSha']))
assert ci['status']=='completed' and ci['conclusion']=='success' and ci['headSha']==gate['courseHead']
records=json.loads((stage/'SOURCE-MAP.json').read_text())
owners=sorted({r['owner'] for r in records});assert len(owners)==9
history='docs/history/2026-10-08-completion';commits={};operation=[]
for owner in owners:
    repo=base/owner
    assert run(['git','branch','--show-current'],repo)=='main'
    remote=run(['git','ls-remote','origin','refs/heads/main'],repo).split()[0]
    assert remote==run(['git','rev-parse','HEAD'],repo)
    assert not run(['git','diff','--cached','--name-only'],repo)
    rows=[r for r in records if r['owner']==owner]
    payload=repo/history
    assert not payload.exists(),str(payload)
    for row in rows:
        source=stage/owner/row['stagedPath'];raw=source.read_bytes()
        assert hashlib.sha256(raw).hexdigest()==row['sha256']
        target=payload/row['stagedPath'];target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(raw)
    journal_paths=['docs/plans/2026-10-08-implementation.md']
    if owner=='quarto-course':journal_paths+=['docs/plans/2026-10-08-course-tools-implementation.md','spec/authoring-model-next.md']
    snapshots=[]
    for rel in journal_paths:
        source=repo/rel;raw=source.read_bytes();target=payload/'latest-plans'/rel
        target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(raw)
        snapshots.append({'source':rel,'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw)})
    (payload/'SOURCE-MAP.json').write_text(json.dumps({'inputs':rows,'latestPlans':snapshots,'courseGate':gate},ensure_ascii=False,indent=2)+'\n')
    (payload/'README.md').write_text('# История завершения 8 октября 2026\n\nСнимки и проверенные receipts сохранены до очистки веток и завершённых планов. Точные исходные пути и SHA-256 перечислены в SOURCE-MAP.json. Нормативный контракт находится в spec/index.md; эти материалы являются историей.\n')
    allowed=set(journal_paths)
    status=run(['git','status','--porcelain=v1','--untracked-files=all'],repo)
    for line in status.splitlines():
        path=line[3:]
        assert path.startswith(history+'/') or path in allowed,line
    run(['git','add','-f','--',history],repo)
    run(['git','add','--',*journal_paths],repo)
    run(['git','diff','--cached','--check','--','.',':!'+history+'/sources/tmp/core-patch-release-20261008/*.patch'],repo)
    run(['git','commit','-m','docs: preserve final implementation and release evidence'],repo)
    head=run(['git','rev-parse','HEAD'],repo)
    for row in rows:
        raw=subprocess.check_output(['git','show',head+':'+history+'/'+row['stagedPath']],cwd=repo)
        assert hashlib.sha256(raw).hexdigest()==row['sha256']
    for row in snapshots:
        raw=subprocess.check_output(['git','show',head+':'+history+'/latest-plans/'+row['source']],cwd=repo)
        assert hashlib.sha256(raw).hexdigest()==row['sha256']
    assert not run(['git','status','--porcelain=v1','--untracked-files=all'],repo)
    run(['git','push','origin','main'],repo)
    assert run(['git','ls-remote','origin','refs/heads/main'],repo).split()[0]==head
    commits[owner]=head
    operation.append({'owner':owner,'commit':head,'inputs':len(rows),'latestPlans':snapshots})
    pathlib.Path('/tmp/durable-completion-history-20261008.json').write_text(json.dumps({'at':datetime.now(timezone.utc).isoformat(),'owners':operation,'historyCommits':commits},ensure_ascii=False,indent=2)+'\n')
pathlib.Path('/tmp/step17-history-gate-20261008.json').write_text(json.dumps({**gate,'historyCommits':commits},indent=2)+'\n')
print(json.dumps({'historyCommits':commits,'savedInputs':len(records)},indent=2))
