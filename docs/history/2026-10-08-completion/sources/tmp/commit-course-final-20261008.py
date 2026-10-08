import hashlib,json,pathlib,subprocess,sys
assert sys.argv[1:]==['--execute']
r=pathlib.Path('/home/tolya/Cybersecurity');out=pathlib.Path('/tmp/cybersecurity-final-pr-20261008');out.mkdir(exist_ok=True)
def git(*a):return subprocess.check_output(['git',*a],cwd=r).decode().rstrip('\n')
assert git('rev-parse','HEAD')=='6cae422bfb77c5c3fc54b24d039d624f44d6b7d5'
assert git('branch','--show-current')=='feat/course-contract-20261006'
assert not git('diff','--cached','--name-only')
runtime=json.loads(pathlib.Path('/tmp/cybersecurity-final-gate-review-20261008/scopehash.json').read_text());assert runtime['decision']=='Approved'
review=pathlib.Path('/tmp/cybersecurity-final-author-patch-review-20261008/report.md').read_text();assert 'Approved' in review
w=json.loads(pathlib.Path('/tmp/cybersecurity-final-patch-author-20261008/write-final.json').read_text())
hashes={**runtime['files'],**{x['path']:x['afterSHA256'] for x in w['ownedDocPaths']},**{x['path']:x['sha256'] for x in w['historyFiles']}}
for path,h in hashes.items():assert hashlib.sha256((r/path).read_bytes()).hexdigest()==h,path
actual_history={p.relative_to(r).as_posix() for p in (r/w['historyRoot']).rglob('*') if p.is_file()}
assert actual_history=={x['path'] for x in w['historyFiles']}
changed={p for raw in [subprocess.check_output(['git','diff','--name-only','-z'],cwd=r),subprocess.check_output(['git','ls-files','--others','--exclude-standard','-z'],cwd=r)] for p in raw.decode().split('\0') if p}
assert changed<=hashes.keys(),sorted(changed-hashes.keys())
subprocess.run(['git','add','--',*sorted(changed)],cwd=r,check=True)
assert set(git('diff','--cached','--name-only').splitlines())==changed
subprocess.run(['git','diff','--cached','--check'],cwd=r,check=True)
subprocess.run(['git','commit','-m','Migrate course to released Core 4.0.1 authoring model'],cwd=r,check=True)
head=git('rev-parse','HEAD');tree=git('rev-parse','HEAD^{tree}')
for ancestor in ['9853fb3bcdbea2749f667d179d10caa7a099e3f5','8e8171d9377e0de9d2ebea4b7bb90c047ceaa286']:subprocess.run(['git','merge-base','--is-ancestor',ancestor,head],cwd=r,check=True)
for path,h in hashes.items():assert hashlib.sha256(subprocess.check_output(['git','show',head+':'+path],cwd=r)).hexdigest()==h,path
assert not git('status','--porcelain=v1','--untracked-files=all')
receipt={'head':head,'tree':tree,'branch':git('branch','--show-current'),'reviewedFileCount':len(hashes),'changedFiles':sorted(changed),'nativeRuntime667Match':True,'docHistoryHashesMatch':True,'userHistoryAndMasterPreserved':True,'clean':True}
(out/'tested-head.json').write_text(json.dumps(receipt,indent=2)+'\n')
subprocess.run(['git','push','origin','feat/course-contract-20261006'],cwd=r,check=True)
remote=git('ls-remote','origin','refs/heads/feat/course-contract-20261006').split()[0];assert remote==head
print(json.dumps({'head':head,'tree':tree,'changedPaths':len(changed),'pushedExactHead':True},indent=2))
