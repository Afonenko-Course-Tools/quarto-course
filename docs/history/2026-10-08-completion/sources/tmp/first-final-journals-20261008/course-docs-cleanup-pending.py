from pathlib import Path
from hashlib import sha256
import json,subprocess,re,datetime
base=Path('/home/tolya/course-tools');out=Path('/tmp/first-final-journals-20261008');scope=json.loads((out/'scopehash.json').read_text());receipt=Path('/tmp/cybersecurity-docs-cleanup-20261008/verified-cleanup.json');clean=json.loads(receipt.read_text());assert clean['docsCompletelyAbsent'] and clean['removedFiles']==36 and clean['allOriginalFilesPreservedInGit']=='fd62bdb3de1d2c9fce8a51dde9fcb7636e58cb9c' and clean['runtime667Unchanged'] and clean['author43Unchanged'] and clean['READMEUnchanged']
head=clean['head'];run=37743840665;url='https://github.com/BSU-RFCT-Afonenko-Courses/Cybersecurity/actions/runs/'+str(run);sha=lambda raw:sha256(raw).hexdigest()
for row in scope['paths']:
 p=base/row['repo']/row['relativePath'];assert sha(p.read_bytes())==row['afterSHA256'];s=p.read_text()
 s=s.replace('Course PR#4 OPEN/CI SUCCESS','Course PR#4 OPEN/новый CI IN_PROGRESS после удаления docs')
 if row['relativePath'].endswith('course-tools-implementation.md'):
  s=s.replace('Дата: 8 октября 2026. Статус: шаги12–16 выполнены; новый Course PR#4 OPEN,\nrequired CI SUCCESS на exact head. Шаги17–18 ещё не завершены.','Дата: 8 октября 2026. Статус: шаги12–15 выполнены; Course PR#4 OPEN.\nПосле полного удаления Course docs по новому запросу шаг16 ожидает новый CI.\nШаги17–18 ещё не завершены.')
  s,n=re.subn(r'^16\. \[x\]','16. [ ]',s,count=1,flags=re.M);assert n==1
  s=s.replace('[/home/tolya/Cybersecurity](/home/tolya/Cybersecurity/docs/plans/2026-10-08-extension-refresh.md).','[Cybersecurity PR #4](https://github.com/BSU-RFCT-Afonenko-Courses/Cybersecurity/pull/4).')
 s+=f'''\n## Прямое позднее указание: удалить Course docs — 07:33 UTC\n\nПо запросу пользователя каталог `/home/tolya/Cybersecurity/docs` полностью\nудалён: 36 файлов перед удалением побайтно совпали с Git\n`fd62bdb3de1d2c9fce8a51dde9fcb7636e58cb9c`; untracked/symlink материалов нет.\nREADME,43 авторских источника и runtime667 не менялись. Старый owner plan и\nтехнические snapshots остаются только в Git; Course docs не восстанавливать\nи не создавать заново под другим путём. Действующая передача —\n[PR #4](https://github.com/BSU-RFCT-Afonenko-Courses/Cybersecurity/pull/4) и итоговый отчёт Core.\nФактический новый head `{head}`, tree `{clean['tree']}`; PR OPEN.\nПредыдущий CI37742519419/fd62 SUCCESS является историческим результатом.\nНовый [CI {run}]({url}) **IN_PROGRESS** на новом head;\nшаг16 снова pending до actual нового SUCCESS. Шаги17–18 ещё pending.\nExact cleanup receipt: `{receipt}`.\n'''
 p.write_text(s);row['afterSHA256']=sha(p.read_bytes())
for repo in sorted({r['repo'] for r in scope['paths']}):
 allowed={r['relativePath'] for r in scope['paths'] if r['repo']==repo};actual=set(subprocess.check_output(['git','diff','--name-only'],cwd=base/repo,text=True).splitlines());assert actual==allowed;assert not subprocess.check_output(['git','diff','--cached','--name-only'],cwd=base/repo).strip();subprocess.run(['git','diff','--check','--',*sorted(allowed)],cwd=base/repo,check=True)
scope.update({'lateUserDocsCleanup':{'receipt':str(receipt),'receiptSHA256':sha(receipt.read_bytes()),'removedFiles':36,'savedGitSHA':clean['allOriginalFilesPreservedInGit'],'docsAbsent':True,'runtimeAndAuthorUnchanged':True},'courseHead':head,'courseCI':{'run':run,'url':url,'state':'IN_PROGRESS','verifiedExactHead':head},'globalStepCheckboxes':{'12':True,'13':True,'14':True,'15':True,'16':False,'17':False,'18':False},'latestUpdate':datetime.datetime.now(datetime.timezone.utc).isoformat(),'nextGate':'Root exact new Course CI success; then durable nine-owner history,17 refs cleanup,18 reports/routes; never recreate Course docs'})
(out/'scopehash.json').write_text(json.dumps(scope,ensure_ascii=False,indent=2)+'\n')
(out/'report.md').write_text('''# First final journals after late Course docs deletion

Only the ten authorized owner/global plan files are modified; exact current hashes and original released HEAD guards are in scopehash.json. Staging empty, no commits/push/owner deletion. Scoped whitespace PASS. Runtime/README/index/assets/extra worktrees/Course paths were not changed by this worker.

Steps12–15 complete. Previous Course fd62/CI37742519419 SUCCESS is retained as dated history. The direct later user request completely removed36 Course docs files after exact saved Git fd62 equality; docs remain absent, README/runtime667/authored43 unchanged. New Course headb6b085cf0541785d11159bd9a106cd131dfabaf0, PR4 OPEN, newCI37743840665 IN_PROGRESS. Step16 checkbox pending until actual new CI;17/18 pending. Current Course owner route is PR4, no deleted Courseplan link or restored Course docs.

Root can send the new CI SUCCESS signal for an immediate small ten-journal final update, then preserve all latest journals/receipts in existing owner Git before cleanup. Exact user cleanup receipt: /tmp/cybersecurity-docs-cleanup-20261008/verified-cleanup.json.
''')
# Tmp reports reflect current new head and the complete user-requested deletion.
drafts=Path('/tmp/final-completion-write-20261008')
for p in drafts.rglob('*.md'):
 if 'current-source' in p.parts:continue
 s=p.read_text();s+=f'\nПоздний запрос пользователя: Course docs полностью удалён (36 saved-Git файлов, Gitfd62 preservation); не восстанавливать. Текущий PR4 OPEN/head{head}; новый CI{run} IN_PROGRESS, предыдущий CI/fd62 SUCCESS исторический. Course README/runtime667/author43 сохранены.\n' if p.name=='owner-journal-append.md' or p.parent.name=='releases' else ''
 if p==drafts/'root/START-CODEX.md':s=s.replace('Cybersecurity: **ожидает actual OPEN PR `https://github.com/BSU-RFCT-Afonenko-Courses/Cybersecurity/pull/4`**.','Cybersecurity: [OPEN PR #4](https://github.com/BSU-RFCT-Afonenko-Courses/Cybersecurity/pull/4).')
 p.write_text(s)
m=json.loads((drafts/'execution-manifest.json').read_text());m['courseFinalPRCI']={'URL':'https://github.com/BSU-RFCT-Afonenko-Courses/Cybersecurity/pull/4','head':head,'CIURL':url,'conclusion':'IN_PROGRESS','state':'OPEN','mergeDeploy':False};m['courseDocsCleanup']={'files':36,'docsAbsent':True,'savedGitSHA':clean['allOriginalFilesPreservedInGit'],'receipt':str(receipt),'doNotRecreate':True}
for w in m['writes']:
 w['draftSHA256']=sha(Path(w['draftPath']).read_bytes())
 if w['repo']=='root' and w['relativePath']=='START-CODEX.md':w['sourceSHA256']=sha(Path(w['targetPath']).read_bytes());target=drafts/'current-source/root/START-CODEX.md';target.write_bytes(Path(w['targetPath']).read_bytes())
for r in m['removals']:
 if r['kind']=='completed-plan-or-transition':r['sha256']=sha(Path(r['path']).read_bytes());r['bytes']=Path(r['path']).stat().st_size
(drafts/'execution-manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'tenJournalsUpdated':10,'global16':'pending new CI','CourseDocsAbsent':True,'CourseWrites':0,'diffCheck':'PASS'}))
