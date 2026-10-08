import hashlib,json,pathlib,subprocess,shutil
r=pathlib.Path('/home/tolya/Cybersecurity');out=pathlib.Path('/tmp/cybersecurity-docs-cleanup-20261008');out.mkdir(exist_ok=True)
def git(*a):return subprocess.check_output(['git',*a],cwd=r).decode().rstrip('\n')
head=git('rev-parse','HEAD');assert head=='fd62bdb3de1d2c9fce8a51dde9fcb7636e58cb9c'
assert not git('status','--porcelain=v1','--untracked-files=all')
paths={x for x in subprocess.check_output(['git','ls-files','-z','--','docs'],cwd=r).decode().split('\0') if x};assert len(paths)==36
actual={p.relative_to(r).as_posix() for p in (r/'docs').rglob('*') if p.is_file() or p.is_symlink()};assert actual==paths
records=[]
for p in sorted(paths):
 f=r/p;assert not f.is_symlink();raw=f.read_bytes();saved=subprocess.check_output(['git','show',head+':'+p],cwd=r);assert raw==saved
 records.append({'path':p,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'preservedCommit':head})
(out/'preserved-before-delete.json').write_text(json.dumps(records,indent=2)+'\n')
subprocess.run(['git','rm','-r','--','docs'],cwd=r,check=True,stdout=subprocess.DEVNULL)
if (r/'docs').exists():
 assert not any((r/'docs').rglob('*'))
 (r/'docs').rmdir()
assert not (r/'docs').exists()
assert set(git('diff','--cached','--name-only').splitlines())==paths
assert all(line.startswith('D\t') for line in git('diff','--cached','--name-status').splitlines())
subprocess.run(['git','diff','--cached','--check'],cwd=r,check=True)
runtime=json.loads(pathlib.Path('/tmp/cybersecurity-core-patch-20261008/final-scope-hashes.json').read_text())
for p,h in runtime.items():assert hashlib.sha256((r/p).read_bytes()).hexdigest()==h,p
subprocess.run(['git','commit','-m','Remove technical docs folder from course'],cwd=r,check=True,stdout=subprocess.DEVNULL)
final=git('rev-parse','HEAD');assert not git('status','--porcelain=v1','--untracked-files=all')
subprocess.run(['git','push','origin','feat/course-contract-20261006'],cwd=r,check=True)
assert git('ls-remote','origin','refs/heads/feat/course-contract-20261006').split()[0]==final
receipt={'head':final,'tree':git('rev-parse','HEAD^{tree}'),'branch':git('branch','--show-current'),'docsCompletelyAbsent':True,'removedFiles':len(paths),'allOriginalFilesPreservedInGit':head,'runtime667Unchanged':True,'author43Unchanged':True,'READMEUnchanged':True,'clean':True,'pushedExactHead':True}
(out/'verified-cleanup.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt,indent=2))
