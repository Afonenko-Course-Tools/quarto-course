"""Dated branch cleanup for nine named owners, guarded by actual course/history gates."""
import hashlib,json,pathlib,runpy,subprocess,sys
from datetime import datetime,timezone

assert sys.argv[1:]==['--execute'], 'Explicit execution argument required'
out=pathlib.Path('/tmp/branch-cleanup-final-20261008');out.mkdir(exist_ok=True)
gate=json.loads(pathlib.Path('/tmp/step17-history-gate-20261008.json').read_text())
pr=json.loads(subprocess.check_output(['gh','api',f'repos/BSU-RFCT-Afonenko-Courses/Cybersecurity/pulls/{gate["coursePRNumber"]}']))
assert pr['state']=='open' and pr['merged_at'] is None and pr['head']['sha']==gate['courseHead']
ci=json.loads(subprocess.check_output(['gh','run','view',str(gate['courseCIRun']),'--repo','BSU-RFCT-Afonenko-Courses/Cybersecurity','--json','status,conclusion,headSha,url']))
assert ci['status']=='completed' and ci['conclusion']=='success' and ci['headSha']==gate['courseHead']
ns=runpy.run_path('/tmp/step17-dry-run-20261008.py')
before=ns['data'];(out/'before.json').write_text(json.dumps(before,ensure_ascii=False,indent=2)+'\n')
command=ns['command'];inspect=ns['inspect'];worktree=ns['worktree'];BASE=ns['BASE']
def stable_worktree(w):
    return {key:w.get(key) for key in ['path','head','status','trackedBytesMapSha256','untrackedHashes','trackedDiffSha256','indexDiffSha256','trackedMatchesHeadBlobs']}
def stable_releases(rows):
    return sorted([{**r,'assets':sorted(r['assets'],key=lambda a:a['id'])} for r in rows],key=lambda r:r['id'])
def tags(row,kind):return {k:v for k,v in row[kind].items() if k.startswith('refs/tags/')}
records=[]
def execute(argv,phase,repo):
    result=command(argv);records.append({'at':datetime.now(timezone.utc).isoformat(),'repo':repo,'phase':phase,'argv':argv,'exitCode':result.returncode,'stdout':result.stdout.decode(),'stderr':result.stderr.decode()})
    (out/'operations.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n')
for row in before['owners']:
    repo=row['repo'];assert not row['blockers'] and row['status']==''
    assert row['currentHead']==row['actualRemoteMain']==gate['historyCommits'][repo]
    assert all(c['uniqueVsActualRemoteMain']==0 for c in row['deletionCandidates'])
    for operation in row['proposedMutationArgvNotExecuted']:
        phase=operation['phase'];argv=operation['argv']
        if phase=='detach-occupied-same-head':
            guard=operation['preserveGuard'];expected=next(w for w in row['worktrees'] if w['path']==guard['path'])
            actual=worktree(guard['path'],{'head':command(['git','rev-parse','HEAD'],guard['path']).stdout.decode().strip()})
            assert stable_worktree(actual)==stable_worktree(expected)
            execute(argv,phase,repo)
            after=worktree(guard['path'],{'head':command(['git','rev-parse','HEAD'],guard['path']).stdout.decode().strip()})
            assert stable_worktree(after)==stable_worktree(expected)
        elif phase=='local-delete':
            ref='refs/heads/'+argv[-1];candidate=next(c for c in row['deletionCandidates'] if c['kind']=='local' and c['ref']==ref)
            assert argv[-1] not in row['keepBranchNames']
            assert command(['git','rev-parse',ref],BASE/repo).stdout.decode().strip()==candidate['sha']
            command(['git','merge-base','--is-ancestor',candidate['sha'],'main'],BASE/repo)
            execute(argv,phase,repo)
        elif phase=='remote-delete':
            current=inspect(repo);ref=argv[-1][1:]
            candidate=next(c for c in row['deletionCandidates'] if c['kind']=='remote' and c['ref']==ref)
            assert not current['blockers'] and current['actualRemoteMain']==row['actualRemoteMain']
            assert ref.removeprefix('refs/heads/') not in current['keepBranchNames']
            assert current['actualRemoteRefs'][ref]==candidate['sha']
            assert tags(current,'actualRemoteRefs')==tags(row,'actualRemoteRefs')
            assert stable_releases(current['releaseBaseline'])==stable_releases(row['releaseBaseline'])
            execute(argv,phase,repo)
        else:raise AssertionError(phase)
    execute(['git','-C',str(BASE/repo),'-c','fetch.pruneTags=false','-c','remote.origin.pruneTags=false','fetch','--prune','--no-tags','origin','+refs/heads/*:refs/remotes/origin/*'],'prune-stale-origin-heads',repo)
after_rows=[inspect(row['repo']) for row in before['owners']]
for old,new in zip(before['owners'],after_rows):
    assert old['repo']==new['repo'] and not new['blockers'] and new['status']==''
    assert not new['deletionCandidates'] and new['keepBranchNames']==old['keepBranchNames']
    assert tags(new,'actualRemoteRefs')==tags(old,'actualRemoteRefs') and tags(new,'localRefs')==tags(old,'localRefs')
    assert stable_releases(new['releaseBaseline'])==stable_releases(old['releaseBaseline'])
    assert {w['path']:stable_worktree(w) for w in new['worktrees']}=={w['path']:stable_worktree(w) for w in old['worktrees']}
course_extra=before['originalExtraCourseCheckout'];fresh=worktree(course_extra['path'],{'head':command(['git','rev-parse','HEAD'],course_extra['path']).stdout.decode().strip()})
assert stable_worktree(fresh)==stable_worktree(course_extra)
(out/'after.json').write_text(json.dumps({'capturedAt':datetime.now(timezone.utc).isoformat(),'owners':after_rows,'originalExtraCourseCheckout':fresh},ensure_ascii=False,indent=2)+'\n')
summary={'localBranchesRemoved':sum(r['phase']=='local-delete' for r in records),'remoteBranchesRemoved':sum(r['phase']=='remote-delete' for r in records),'sameHeadDetaches':sum(r['phase']=='detach-occupied-same-head' for r in records),'allTagsAndReleasesUnchanged':True,'allWorktreeHeadBytesStatusUnchanged':True,'courseExcluded':True}
(out/'verified-cleanup.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary))
