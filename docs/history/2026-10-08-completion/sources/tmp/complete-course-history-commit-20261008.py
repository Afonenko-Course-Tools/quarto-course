import hashlib,json,pathlib,subprocess
r=pathlib.Path('/home/tolya/Cybersecurity');out=pathlib.Path('/tmp/cybersecurity-final-pr-20261008')
def git(*a):return subprocess.check_output(['git',*a],cwd=r).decode().rstrip('\n')
assert git('rev-parse','HEAD')=='0451a72b357f0789e94a9059483771906796d33d'
pending=set(git('diff','--cached','--name-only').splitlines())
runtime=json.loads(pathlib.Path('/tmp/cybersecurity-final-gate-review-20261008/scopehash.json').read_text())
w=json.loads(pathlib.Path('/tmp/cybersecurity-final-patch-author-20261008/write-final.json').read_text())
hashes={**runtime['files'],**{x['path']:x['afterSHA256'] for x in w['ownedDocPaths']},**{x['path']:x['sha256'] for x in w['historyFiles']}}
for path,h in hashes.items():assert hashlib.sha256((r/path).read_bytes()).hexdigest()==h,path
missing=json.loads((out/'missing-reviewed-history.json').read_text());assert len(missing)==8
assert all(p.startswith(w['historyRoot']+'/receipts/') and p.endswith('.log') and p in hashes for p in missing)
assert not pending or pending==set(missing)
subprocess.run(['git','add','-f','--',*missing],cwd=r,check=True)
assert set(git('diff','--cached','--name-only').splitlines())==set(missing)
subprocess.run(['git','diff','--cached','--check','--','.',':!'+w['historyRoot']+'/receipts/*.log'],cwd=r,check=True)
subprocess.run(['git','commit','-m','docs: preserve reviewed native verification logs'],cwd=r,check=True)
head=git('rev-parse','HEAD');tree=git('rev-parse','HEAD^{tree}')
for path,h in hashes.items():assert hashlib.sha256(subprocess.check_output(['git','show',head+':'+path],cwd=r)).hexdigest()==h,path
for ancestor in ['9853fb3bcdbea2749f667d179d10caa7a099e3f5','8e8171d9377e0de9d2ebea4b7bb90c047ceaa286']:subprocess.run(['git','merge-base','--is-ancestor',ancestor,head],cwd=r,check=True)
assert not git('status','--porcelain=v1','--untracked-files=all')
receipt={'head':head,'tree':tree,'branch':git('branch','--show-current'),'reviewedFileCount':len(hashes),'reviewedHashesAllEqualGitObjects':True,'runtime667Unchanged':True,'history32Complete':True,'historyMissingIgnoreFix':missing,'userHistoryAndMasterPreserved':True,'clean':True}
(out/'tested-head.json').write_text(json.dumps(receipt,indent=2)+'\n')
subprocess.run(['git','push','origin','feat/course-contract-20261006'],cwd=r,check=True)
assert git('ls-remote','origin','refs/heads/feat/course-contract-20261006').split()[0]==head
print(json.dumps(receipt,indent=2))
