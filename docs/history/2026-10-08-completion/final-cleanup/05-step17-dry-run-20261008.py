"""One-off read-only step17 inventory; never executes the proposed mutation argv."""
import concurrent.futures
import hashlib
import json
import os
import subprocess
from datetime import datetime,timezone
from pathlib import Path

BASE=Path('/home/tolya/course-tools')
OUT=Path('/tmp/final-cleanup-execution-prep-20261008')
OWNERS=['quarto-course','quarto-project-publish','quarto-reference-catalog','quarto-course-print','quarto-course-moodle','quarto-course-prairielearn','quarto-course-cloud','quarto-project-download','quarto-template-course']
OUT.mkdir(exist_ok=True)
def command(argv,cwd=BASE,check=True):
 p=subprocess.run(argv,cwd=cwd,capture_output=True)
 if check and p.returncode:raise RuntimeError(f'{argv}: {p.stderr.decode(errors="replace")}')
 return p
def git(repo,*args,check=True):return command(['git',*args],BASE/repo,check)
def api(endpoint):
 p=command(['gh','api','--paginate','--slurp',endpoint])
 chunks=json.loads(p.stdout)
 return [row for chunk in chunks for row in chunk] if isinstance(chunks[0],list) else chunks[0]
def digest(data):return hashlib.sha256(data).hexdigest()
def worktree(path,values):
 p=Path(path)
 status=command(['git','status','--porcelain=v1','--untracked-files=all'],p).stdout
 tracked=command(['git','ls-files','-z'],p).stdout.split(b'\0')
 content={}
 for raw in tracked:
  if not raw:continue
  rel=os.fsdecode(raw);f=p/rel
  content[rel]=digest(os.readlink(f).encode()) if f.is_symlink() else digest(f.read_bytes()) if f.is_file() else None
 untracked={}
 for raw in command(['git','ls-files','--others','--exclude-standard','-z'],p).stdout.split(b'\0'):
  if not raw:continue
  rel=os.fsdecode(raw);f=p/rel
  untracked[rel]=digest(os.readlink(f).encode()) if f.is_symlink() else digest(f.read_bytes()) if f.is_file() else None
 blob_mismatch=[]
 for entry in command(['git','ls-tree','-r','-z','HEAD'],p).stdout.split(b'\0'):
  if not entry:continue
  metadata,raw=entry.split(b'\t',1);mode,kind,oid=metadata.split();f=p/os.fsdecode(raw)
  if kind!=b'blob':continue
  data=os.readlink(f).encode() if f.is_symlink() else f.read_bytes() if f.is_file() else None
  if data is None or hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()!=oid.decode():blob_mismatch.append(os.fsdecode(raw))
 return {'path':str(p),**values,'status':status.decode(),'statusSha256':digest(status),'trackedFiles':len(content),'trackedBytesMapSha256':digest(json.dumps(content,sort_keys=True).encode()),'untrackedHashes':untracked,'trackedMatchesHeadBlobs':not blob_mismatch,'trackedBlobMismatchPaths':blob_mismatch,'trackedDiffSha256':digest(command(['git','diff','--binary'],p).stdout),'indexDiffSha256':digest(command(['git','diff','--cached','--binary'],p).stdout)}
def inspect(repo):
 namespace='Afonenko-Course-Tools/'+repo
 remote=git(repo,'remote','get-url','origin').stdout.decode().strip()
 assert remote in [f'git@github.com:{namespace}.git',f'https://github.com/{namespace}.git']
 meta=api('repos/'+namespace)
 prs=api('repos/'+namespace+'/pulls?state=open&per_page=100')
 pulls=[]
 for pr in prs:
  commits=api(f'repos/{namespace}/pulls/{pr["number"]}/commits?per_page=100')
  evidence=[{'authorLogin':(c.get('author') or {}).get('login'),'authorType':(c.get('author') or {}).get('type'),'committerLogin':(c.get('committer') or {}).get('login'),'committerType':(c.get('committer') or {}).get('type'),'gitAuthorName':c['commit']['author']['name'],'verification':c['commit']['verification']['verified'],'sha':c['sha']} for c in commits]
  login=pr['user']['login'];kind=pr['user']['type']
  automatic=kind=='Bot' and login in ['dependabot[bot]','renovate[bot]'] and any(c['authorLogin']==login and c['authorType']=='Bot' for c in evidence)
  pulls.append({'number':pr['number'],'url':pr['html_url'],'title':pr['title'],'userLogin':login,'userType':kind,'userURL':pr['user']['html_url'],'headRef':pr['head']['ref'],'headSHA':pr['head']['sha'],'headRepository':(pr['head'].get('repo') or {}).get('full_name'),'baseRef':pr['base']['ref'],'automaticConfirmed':automatic,'originEvidence':evidence,'dependabotConfigPresent':(BASE/repo/'.github/dependabot.yml').is_file(),'labels':[x['name'] for x in pr['labels']]})
 live=git(repo,'ls-remote','--heads','--tags','origin').stdout.decode().splitlines()
 remote_refs={line.split('\t')[1]:line.split('\t')[0] for line in live}
 local=[line.split(' ',1) for line in git(repo,'for-each-ref','--format=%(refname) %(objectname)').stdout.decode().splitlines()]
 local_refs=dict(local)
 main=remote_refs['refs/heads/main']
 worktrees=[]
 for block in git(repo,'worktree','list','--porcelain').stdout.decode().strip().split('\n\n'):
  values={};path=None
  for line in block.splitlines():
   if line.startswith('worktree '):path=line[9:]
   elif line.startswith('HEAD '):values['head']=line[5:]
   elif line.startswith('branch '):values['branch']=line[7:]
   elif line=='detached':values['detached']=True
   elif line.startswith('locked'):values['locked']=line
  worktrees.append(worktree(path,values))
 keep={'main'}
 if repo=='quarto-template-course':keep.add('gh-pages')
 fork=[]
 for pr in pulls:
  if pr['automaticConfirmed']:
   if pr['headRepository']==namespace:keep.add(pr['headRef'])
   else:fork.append(pr)
 candidates=[];proposed=[];blockers=[]
 if meta['default_branch']!='main':blockers.append('Unexpected default branch')
 if local_refs.get('refs/heads/main')!=main:blockers.append('Local main differs from actual remote main')
 for pr in pulls:
  if not pr['automaticConfirmed']:blockers.append(f'Unresolved human/unclassified OPEN PR #{pr["number"]}')
 for kind,refs in [('local',local_refs),('remote',remote_refs)]:
  for ref,head in refs.items():
   if not ref.startswith('refs/heads/'):continue
   name=ref.removeprefix('refs/heads/')
   if name in keep:continue
   known=git(repo,'cat-file','-e',head+'^{commit}',check=False).returncode==0
   unique=int(git(repo,'rev-list','--count',main+'..'+head).stdout) if known else None
   occupied=[w for w in worktrees if w.get('branch')==ref] if kind=='local' else []
   row={'kind':kind,'ref':ref,'sha':head,'uniqueVsActualRemoteMain':unique,'objectKnownLocally':known,'occupiedWorktrees':occupied}
   candidates.append(row)
   if unique!=0:blockers.append(f'{kind} {name}: unique/missing commits require preservation')
   for w in occupied:
    if w['status'] or 'locked' in w:blockers.append(f'Occupied worktree changed/locked: {w["path"]}')
    proposed.append({'phase':'detach-occupied-same-head','repo':repo,'argv':['git','-C',w['path'],'switch','--detach',w['head']],'preserveGuard':{'path':w['path'],'head':w['head'],'trackedBytesMapSha256':w['trackedBytesMapSha256'],'statusSha256':w['statusSha256'],'untrackedHashes':w['untrackedHashes']}})
   proposed.append({'phase':kind+'-delete','repo':repo,'argv':['git','-C',str(BASE/repo),'branch','-d',name] if kind=='local' else ['git','-C',str(BASE/repo),'push','--force-with-lease='+ref+':'+head,'origin',':'+ref],'precondition':'fresh live keep-set/ref SHA unchanged, uniqueVsActualRemoteMain==0, history durable; root executes only after course16/live site gate'})
 releases=api('repos/'+namespace+'/releases?per_page=100')
 release_rows=[{'id':r['id'],'tag':r['tag_name'],'draft':r['draft'],'immutable':r.get('immutable'),'publishedAt':r['published_at'],'url':r['html_url'],'assets':[{'id':a['id'],'name':a['name'],'digest':a.get('digest'),'bytes':a['size']} for a in r['assets']]} for r in releases]
 return {'repo':repo,'namespace':namespace,'remote':remote,'capturedAt':datetime.now(timezone.utc).isoformat(),'defaultBranch':meta['default_branch'],'hasPages':meta['has_pages'],'currentHead':git(repo,'rev-parse','HEAD').stdout.decode().strip(),'status':git(repo,'status','--short').stdout.decode(),'actualRemoteMain':main,'localRefs':local_refs,'actualRemoteRefs':remote_refs,'worktrees':worktrees,'openPRs':pulls,'keepBranchNames':sorted(keep),'externalForkHeadsKeptUntouched':fork,'deletionCandidates':candidates,'proposedMutationArgvNotExecuted':proposed,'blockers':blockers,'releaseBaseline':release_rows}
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:rows=list(pool.map(inspect,OWNERS))
pages=api('repos/Afonenko-Course-Tools/quarto-template-course/pages')
build=api('repos/Afonenko-Course-Tools/quarto-template-course/pages/builds/latest')
baseline=json.loads(git('quarto-course','show','050208549cbf80828b4984af0b4749e4eece7924:docs/history/2026-10-08-before-implementation/local-inventory.json').stdout)
old_by_path={r['path']:r for r in baseline}
for row in rows:
 for w in row['worktrees']:
  if w['path'] in old_by_path and Path(w['path']).name not in OWNERS:
   old=old_by_path[w['path']];w['originalExtraHeadMatches']=w['head']==old['head']['output'];w['originalExtraStatusMatches']=w['status'].strip()==old['status']['output'].strip()
course_path='/home/tolya/course-tools/cybersecurity-implementation'
course_head=command(['git','rev-parse','HEAD'],course_path).stdout.decode().strip()
course_extra=worktree(course_path,{'head':course_head,'excludedFromCleanup':True})
course_extra['originalExtraHeadMatches']=course_head==old_by_path[course_path]['head']['output']
course_extra['originalExtraStatusMatches']=course_extra['status'].strip()==old_by_path[course_path]['status']['output'].strip()
data={'capturedAt':datetime.now(timezone.utc).isoformat(),'mode':'read-only inspection; zero proposed mutations executed','owners':rows,'originalExtraCourseCheckout':course_extra,'pages':{'source':pages.get('source'),'buildType':pages.get('build_type'),'url':pages.get('html_url'),'status':pages.get('status'),'latestBuild':{'status':build.get('status'),'commit':build.get('commit'),'updatedAt':build.get('updated_at'),'error':build.get('error')}},'courseExcluded':True,'courseCondition':'root must complete/attach new OPEN Cybersecurity PR and live Pages QA before step17; no course branches proposed'}
(OUT/'step17-inventory.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
summary=[{'repo':r['repo'],'keep':r['keepBranchNames'],'localDelete':sum(x['kind']=='local' for x in r['deletionCandidates']),'remoteDelete':sum(x['kind']=='remote' for x in r['deletionCandidates']),'worktrees':len(r['worktrees']),'openPRs':[(p['number'],p['userLogin'],p['automaticConfirmed'],p['headRef'],p['headSHA']) for p in r['openPRs']],'blockers':r['blockers']} for r in rows]
print(json.dumps({'owners':summary,'pages':data['pages'],'allCandidateUniqueCountsZero':all(x['uniqueVsActualRemoteMain']==0 for r in rows for x in r['deletionCandidates'])},ensure_ascii=False,indent=2))
