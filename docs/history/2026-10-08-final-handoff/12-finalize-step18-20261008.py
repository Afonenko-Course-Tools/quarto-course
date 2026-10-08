from pathlib import Path
import json, hashlib, subprocess, shutil, datetime, sys
ROOT=Path('/home/tolya/course-tools')
SRC=Path('/tmp/final-completion-write-20261008')
OUT=Path('/tmp/final-step18-push-20261008')
freeze=json.loads((SRC/'verified-execution.json').read_text())
def run(repo,*args):
 p=subprocess.run(['git','-C',str(ROOT/repo),*args],capture_output=True)
 if p.returncode:raise RuntimeError((repo,args,p.stderr.decode()))
 return p.stdout
def sha(data):return hashlib.sha256(data).hexdigest()
def paths(repo):
 raw=run(repo,'status','--porcelain=v1','-z');parts=raw.split(b'\0');result=[]
 for part in parts:
  if not part:continue
  state=part[:2].decode();name=part[3:].decode()
  if 'R' in state or 'C' in state:raise RuntimeError('rename outside frozen scope')
  if name.endswith('/'):
   result.extend(str(p.relative_to(ROOT/repo)) for p in (ROOT/repo/name).rglob('*') if p.is_file())
  else:result.append(name)
 return sorted(result)
expected={}
for repo,info in freeze['docsOnlyScope'].items():
 expected[repo]=sorted(info['trackedChangedPaths']+[f['relativePath'] for f in freeze['writtenFiles'] if f['repo']==repo and f['relativePath'] not in info['trackedChangedPaths']])
 assert run(repo,'rev-parse','HEAD').decode().strip()==freeze['checkpointCommits'][repo]
 assert run(repo,'branch','--show-current').decode().strip()=='main',repo
 assert not run(repo,'diff','--cached','--name-only')
 assert paths(repo)==expected[repo],(repo,set(paths(repo))^set(expected[repo]))
for f in freeze['writtenFiles']:
 assert sha(Path(f['path']).read_bytes())==f['sha256'],f['path']
assert not Path('/home/tolya/Cybersecurity/docs').exists()
OUT.mkdir(exist_ok=True)
(OUT/'preflight.json').write_text(json.dumps({'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'verifiedFiles':len(freeze['writtenFiles']),'paths':expected},indent=2)+'\n')
if '--execute' not in sys.argv:
 print('PREFLIGHT PASS: exact frozen changes across nine owners; no mutations');sys.exit()
review=json.loads(Path('/tmp/final-step18-review-20261008/approval.json').read_text())
assert review['approved'] is True
# Save final18 receipts and current non-Git root instructions in one reachable Core checkpoint.
archive='docs/history/2026-10-08-final-handoff'
target=ROOT/'quarto-course'/archive
assert not target.exists()
receipt_names=['execution-report.md','verified-execution.json','checkpoint-commits.json','pre-delete-git-guards.json','execution-manifest.json','durable-history-recovery-map.json','final-source-sanity.json','checkpoint.py','execute.py','prepare-drafts.py']
sources=[SRC/n for n in receipt_names]+[ROOT/'START-CODEX.md',ROOT/'AGENTS.md',Path(__file__),Path('/tmp/final-step18-review-20261008/report.md'),Path('/tmp/final-step18-review-20261008/approval.json'),Path('/tmp/final-step18-operation-review-20261008.md')]
target.mkdir(parents=True)
mapping=[]
for i,source in enumerate(sources):
 dst=target/(str(i).zfill(2)+'-'+source.name);dst.write_bytes(source.read_bytes())
 mapping.append({'source':str(source),'path':str(dst.relative_to(ROOT/'quarto-course')),'sha256':sha(dst.read_bytes())})
(target/'SOURCE-MAP.json').write_text(json.dumps(mapping,ensure_ascii=False,indent=2)+'\n')
run('quarto-course','add','-f','--',archive)
assert sorted(run('quarto-course','diff','--cached','--name-only').decode().splitlines())==sorted([m['path'] for m in mapping]+[archive+'/SOURCE-MAP.json'])
run('quarto-course','diff','--cached','--check')
run('quarto-course','commit','-m','docs: preserve verified final handoff receipts in Git history')
receipt_commit=run('quarto-course','rev-parse','HEAD').decode().strip()
for m in mapping:assert sha(run('quarto-course','show',receipt_commit+':'+m['path']))==m['sha256']
git_leaves=sorted(run('quarto-course','ls-tree','-r','--name-only',receipt_commit,'--',archive).decode().splitlines())
current_leaves=[]
for leaf in target.rglob('*'):
 assert not leaf.is_symlink(),str(leaf)
 if leaf.is_file():current_leaves.append(str(leaf.relative_to(ROOT/'quarto-course')))
assert sorted(current_leaves)==git_leaves==sorted([m['path'] for m in mapping]+[archive+'/SOURCE-MAP.json'])
for leaf in git_leaves:assert (ROOT/'quarto-course'/leaf).read_bytes()==run('quarto-course','show',receipt_commit+':'+leaf),leaf
shutil.rmtree(target)
expected['quarto-course']=sorted(expected['quarto-course']+[m['path'] for m in mapping]+[archive+'/SOURCE-MAP.json'])
heads={};result={'receiptCommit':receipt_commit,'heads':heads,'owners':{}}
for repo,scope in expected.items():
 assert paths(repo)==scope,repo
 # Explicit frozen paths only; no broad git-add and no force except receipt checkpoint above.
 run(repo,'add','-A','--',*scope)
 assert sorted(run(repo,'diff','--cached','--name-only').decode().splitlines())==scope,repo
 run(repo,'diff','--cached','--check')
 run(repo,'commit','-m','docs: finalize implementation reports and retire preserved planning history')
 head=run(repo,'rev-parse','HEAD').decode().strip();heads[repo]=head
 assert not run(repo,'status','--porcelain=v1'),repo
 for f in freeze['writtenFiles']:
  if f['repo']==repo:assert sha(run(repo,'show',head+':'+f['relativePath']))==f['sha256']
 assert not run(repo,'ls-tree','-r','--name-only','HEAD','docs/history/2026-10-08-completion')
 run(repo,'push','origin','main')
 remote=run(repo,'ls-remote','origin','refs/heads/main').decode().split()[0]
 assert remote==head,repo
 result['owners'][repo]={'head':head,'pushed':True,'clean':True,'scopeCount':len(scope)}
 (OUT/'verified-push.json').write_text(json.dumps(result,indent=2)+'\n')
 print(repo+' final docs pushed '+head,flush=True)
result['allNinePushed']=len(heads)==9
result['finishedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
(OUT/'verified-push.json').write_text(json.dumps(result,indent=2)+'\n')
print('FINAL DOCS PUSH PASS',flush=True)
