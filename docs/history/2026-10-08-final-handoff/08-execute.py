from pathlib import Path
import json,hashlib,subprocess,datetime,re,urllib.parse,collections
B=Path('/home/tolya/course-tools');O=Path('/tmp/final-completion-write-20261008');M=json.loads((O/'execution-manifest.json').read_text());C=json.loads((O/'checkpoint-commits.json').read_text());H=C['commits'];F=json.loads((O/'draft-facts.json').read_text());A=json.loads(Path('/tmp/branch-cleanup-final-20261008/after.json').read_text());OPS=json.loads(Path('/tmp/branch-cleanup-final-20261008/operations.json').read_text());V=json.loads(Path('/tmp/branch-cleanup-final-20261008/verified-cleanup.json').read_text())
def sha(b):return hashlib.sha256(b).hexdigest()
def git(r,*args):return subprocess.check_output(['git','-C',str(r),*args])
def dump(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
def bloburl(n,h,p):return f'https://github.com/Afonenko-Course-Tools/{n}/blob/{h}/{p}'
assert V=={'localBranchesRemoved':46,'remoteBranchesRemoved':11,'sameHeadDetaches':11,'allTagsAndReleasesUnchanged':True,'allWorktreeHeadBytesStatusUnchanged':True,'courseExcluded':True}
assert len(OPS)==77 and all(x['exitCode']==0 for x in OPS)
assert not Path('/home/tolya/Cybersecurity/docs').exists()
# Verify every source, all leaves, exact Git path sets before performing any deletion.
for x in M['writes']:
 p=Path(x['targetPath']);assert (sha(p.read_bytes()) if p.exists() else None)==x['sourceSHA256'],str(p)
guards=[];delete=[]
for x in M['removals']:
 p=Path(x['path']);assert p.is_file() and not p.is_symlink(),str(p);b=p.read_bytes()
 if x['repo']=='root':
  assert sha(b)==x['sha256'];r=Path(x['preservedOwner']) if x['preservedOwner'].startswith('/') else B/x['preservedOwner'];h=x['preservationCommit'];rel=x['snapshotPath']
 else:
  r=B/x['repo'];h=H[x['repo']];rel=x['relativePath']
 assert git(r,'show',h+':'+rel)==b,str(p)
 guards.append({'path':str(p),'owner':str(r),'commit':h,'blobPath':rel,'sha256':sha(b),'bytes':len(b),'kind':x['kind']});delete.append(p)
treecounts={}
for x in M['datedHistoryTreesToRemoveAfterDurable']:
 n=x['repo'];r=B/n;t=Path(x['targetPath']);assert t.is_dir() and not t.is_symlink();h=H[n];rel=x['relativePath']
 current=[]
 for p in t.rglob('*'):
  assert not p.is_symlink(),str(p)
  if p.is_file():current.append(p)
 expected=git(r,'ls-tree','-r','--name-only',h,'--',rel).decode().splitlines();assert set(expected)=={p.relative_to(r).as_posix() for p in current},n
 for p in current:
  q=p.relative_to(r).as_posix();b=p.read_bytes();assert git(r,'show',h+':'+q)==b,str(p);guards.append({'path':str(p),'owner':str(r),'commit':h,'blobPath':q,'sha256':sha(b),'bytes':len(b),'kind':'dated-completion-tree'});delete.append(p)
 treecounts[n]=len(current)
dump(O/'pre-delete-git-guards.json',{'verifiedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'files':guards,'treeFileCounts':treecounts})
# Fill bounded prepared reports, using actual cleanup API evidence.
cleanupURL=bloburl('quarto-course',H['quarto-course'],'docs/history/2026-10-08-completion/final-cleanup/03-verified-cleanup.json')
for x in M['writes']:
 if x['kind']!='compact-implementation-report':continue
 n=x['repo'];p=Path(x['draftPath']);t=p.read_text();local=sum(z['repo']==n and z['phase']=='local-delete' for z in OPS);remote=sum(z['repo']==n and z['phase']=='remote-delete' for z in OPS)
 token='{{CLEANUP_RESULT_'+n.upper().replace('-','_')+'}}'
 t=t.replace(token,f'{local} LOCAL / {remote} REMOTE; main, all tags/Releases, serving gh-pages и API-confirmed OPEN bot heads сохранены')
 t=re.sub(r'Шаг 17 пока ожидает actual before/after receipt:', 'Шаг 17 выполнен; actual before/after receipt:',t)
 t=t.replace('Course OPEN PR/его required checks/финальная очистка ещё не подставлены;','Course [OPEN PR #4](https://github.com/BSU-RFCT-Afonenko-Courses/Cybersecurity/pull/4), head `b6b085cf0541785d11159bd9a106cd131dfabaf0`, [CI SUCCESS](https://github.com/BSU-RFCT-Afonenko-Courses/Cybersecurity/actions/runs/37743840665), publication SKIPPED;')
 t=t.replace('`{{TEMPLATE_FINAL_REF_RECEIPT}}`','итоговый docs commit будет зафиксирован после независимого review; он не меняет published source/gh-pages SHA')
 t=t.replace('Окончательная сохранённая история owner-плана:', 'Первый сохранённый owner history checkpoint:').replace('Окончательная история плана:', 'Первый сохранённый owner history checkpoint:')
 t=t.replace('Final cleanup receipts сохраняются отдельно в compact evidence без исторических контрактов.',f'Последние планы и cleanup receipts: [Git checkpoint]({bloburl(n,H[n],"docs/history/2026-10-08-completion/final-journals/2026-10-08-implementation.md")}); [общая квитанция]({cleanupURL}).')
 # Avoid duplicated Course facts in every tool report; the central report owns that detail.
 t=re.sub(r'\nПоздний запрос пользователя: Course docs полностью удалён.*?Course README/runtime667/author43 сохранены\.\n?', '\n',t,flags=re.S)
 t=t.replace('status: historical','status: completed');p.write_text(t)
# Compact central report includes all required tables and honest limits.
now=datetime.datetime.now(datetime.timezone.utc);time=now.strftime('%Y-%m-%d %H:%M:%S UTC');elapsed=now-datetime.datetime(2026,10,7,23,36,tzinfo=datetime.timezone.utc)
toolrows=[]
for z in F['tools']:
 n=z['repo'];k=F['ciMeta'][n];inst=F['tagInstalls'][n]['fileCount'];toolrows.append(f'| {k["label"]} | [{z["tag"]}]({z["releaseURL"]}) | `{z["commit"]}` | [SUCCESS](https://github.com/Afonenko-Course-Tools/{n}/actions/runs/{k["mainCI"]}) | {inst} |')
demorows=[]
for z in F['demos']:
 groups=', '.join(f'{k}: {v["fileCount"]}' for k,v in z['groups'].items());demorows.append(f'| {z["repo"]} | [{z["tag"]}]({z["url"]}) | `{z["commit"]}` | {groups} |')
keeperrows=[]
for z in A['owners']:
 branches=[k.removeprefix('refs/heads/') for k in z['actualRemoteRefs'] if k.startswith('refs/heads/')];local=sum(y['repo']==z['repo'] and y['phase']=='local-delete' for y in OPS);remote=sum(y['repo']==z['repo'] and y['phase']=='remote-delete' for y in OPS);keeperrows.append(f'| {z["repo"]} | {local} / {remote} | '+', '.join('`'+v+'`' for v in branches)+' |')
historyrows=[f'| {n} | [{h}]({bloburl(n,h,"docs/history/2026-10-08-completion/SOURCE-MAP.json")}) | [{H[n]}]({bloburl(n,H[n],"docs/history/2026-10-08-completion/final-journals/2026-10-08-implementation.md")}) |' for n,h in M['durableHistory']['commits'].items()]
central='''---
type: implementation-report
component: course-tools
status: completed
updated: 2026-10-08
---

# Инструменты, руководство и Cybersecurity: результат 8 октября 2026

Текущие правила находятся в [индексе Core](../../spec/index.md) и индексах
владельцев. Этот отчёт фиксирует проверенные результаты и ограничения.
Выпущены восемь инструментов, семь demo Releases с восемью ready-группами;
русское руководство опубликовано штатно в gh-pages. Course передан в
[OPEN PR #4](https://github.com/BSU-RFCT-Afonenko-Courses/Cybersecurity/pull/4)
с успешным CI; курс не слит и не опубликован.

| Инструмент | Immutable release | Source SHA | Main CI | Exact tag-install файлов |
| --- | --- | --- | --- | ---: |
'''+ '\n'.join(toolrows)+'''

Теги/Releases опубликованы после проверок draft assets и повторной загрузки.
Поздние history/docs commits в main не меняют release source SHA. Quarto
1.11.5 / CUE 0.17.1 — проверенные версии. Core 4.0.1 исправляет нативные book
ссылки participant assignments; публичные model/schema/NativeRun/Body API
остаются совместимыми с 4.0.0. Первый Core 4.0.0/demo0 сохранён.

| Producer | Demo release | Source SHA | Ready группы и число файлов |
| --- | --- | --- | --- |
'''+ '\n'.join(demorows)+'''

Каждый BUILD имеет sourceDirty:false и собственный producer SHA. Native
sourceRef использует tool tag, catalog — demo tag. Download не имеет ready
демо. Core demo.1 содержит 107 файлов; archive SHA-256
`fe90b587569891455694836a48385d102960e906e07f2011c1f28092d4455ae4`,
2,783,070 bytes. Семь остальных catalog records и их зависимости сохранены;
всего скачано 549 ready-файлов без переписывания producer HTML/resources.
Publisher CI использовал совместимый QRC 2.2.1, ready composition — QRC 3.0.0;
это отдельные подтверждённые результаты.

Русское [руководство](https://afonenko-course-tools.github.io/quarto-template-course/)
опубликовано из source `52316a762da3a9c054b5ac6a7a89620e46c7c150`;
[PR #19](https://github.com/Afonenko-Course-Tools/quarto-template-course/pull/19)
MERGED после [CI SUCCESS](https://github.com/Afonenko-Course-Tools/quarto-template-course/actions/runs/37737745573).
Native gh-pages `8dc11b599406f65af420aef39babdb15375df61b`, Pages built.
Пять ordered clean-main проверок и task publish: exit 0; установленный Core
63 файла byte-equal tag a9; 61 HTML / 2459 local links. 28 QMD / 95 fenced blocks
сохранены, кроме трёх shell pins. Все 599 published файлов равны checked bytes;
22 HTTP/hash checks и Root CUA Source/search/catalog/Core example прошли.
Публикация использовала `quarto publish gh-pages --no-render`; более поздние
history/docs main commits не обозначают новую публикацию сайта.

Course PR #4 остаётся OPEN на head
`b6b085cf0541785d11159bd9a106cd131dfabaf0`;
[CI 37743840665 SUCCESS](https://github.com/BSU-RFCT-Afonenko-Courses/Cybersecurity/actions/runs/37743840665)
на exact head, publication SKIPPED. Native install 618 файлов (159/149/161/149),
NativeRun 48 / CUE 8; student 107.247 / full 120.018 / student 111.065 / site
0.358 секунд, exit 0. Обе проекции разрешили nested bank href и caption 11.1.
Selected Body: 40.629 секунд, exit 0; root-only owner, одна реальная open/manual
задача, авторская оценка 90, required/individual, 0 resources, без закрытых полей.
Student 178 файлов и 43 authored источника неизменны. Не выдуманы checksum,
control questions, решения или ZIP. По прямому запросу пользователя Course
**docs полностью удалён**: 36 файлов byte-equal сохранённому Git
`fd62bdb3de1d2c9fce8a51dde9fcb7636e58cb9c` до удаления; каталог не воссоздаётся.
README / 667 runtime / 43 authored источника не менялись при docs cleanup.

Принятые правила: единый native source/projection path; actual public-solution
witness после native условий и переносимый solution для selected JSON;
Source AST mask; selected restricted participant statement без key/solution/
notes/assessment-preview; qualified membership/time и partial omission.
Core 4.0.1 использует публичный post-quarto stage и
`quarto.doc.include_text('after-body', ...)` для уже-native HTML вне main.
Native book resolver разрешает href/caption; search не получает assignment
shadow. Post переносит exact разрешённую разметку и удаляет closed carriers.
Нет второго render, Markdown parser, URL/caption builder или search rewrite.

Чужие warning streams сохраняются с actual exit: строка WARN сама по себе
не меняет Quarto exit 0. Узкие Windows path/CUE-TEMP проверки выполнены fixtures;
**native Windows session не заявляется**. Upstream recoverEncode на кириллическом
пути остаётся ограничением; путь checkout без кириллицы — проверенный обход.
Три настоящих PDF прошли visual QA. Local XML/PL/Cloud проверки не означают
live Moodle import, hosted PL execution или VM/Cloud actions.

Шаг 17: 46 LOCAL / 11 REMOTE удалений, 11 same-HEAD detaches, все 77 операций
exit 0. Все remote tags (включая peeled SHA) и 61 Releases с asset metadata
неизменны. Все 13 исходных пользовательских checkout HEAD/bytes/status
сохранены; Course исключён. Два временных чистых checkout этой реализации
удалены отдельно. Сохранённые remote ветки после cleanup:

| Владелец | LOCAL / REMOTE удалено | Сохранённые remote ветки |
| --- | ---: | --- |
'''+ '\n'.join(keeperrows)+f'''

API-confirmed Bot heads: Core OPEN PR #4
`8968c8da141d00651606d3fdf333bab7f13b9fb0`, QRC OPEN PR #5
`8d88a3272d73f6d868f3c7bd2b6ad84a743081c6`.
[Cleanup receipt]({cleanupURL}) содержит actual before/after guards;
соседние архивные files сохраняют before/after/operations и helper sources.

До cleanup сохранены и pushed 401 input / 3,615,580 bytes в девяти owner Git.
Последние десять журналов и Core cleanup receipts затем сохранены отдельными
local checkpoints перед удалением активной истории. Все удаляемые current
files/path sets сверены с exact reachable Git blobs. Удалены только 11 известных
completed plans/stub, 24 metadata, 41 root historical files и девять новых dated
completion trees; неизвестные архивы и пользовательские checkout сохранены.

| Владелец | Первый durable SOURCE-MAP | Последний журнал checkpoint |
| --- | --- | --- |
'''+ '\n'.join(historyrows)+f'''

Восстановление: `git show <history-SHA>:<path>`; SOURCE-MAP указывает исходный
путь, bytes и SHA-256. ROOT START/AGENTS и последний ignored root ledger
сохранены в Core final-cleanup SOURCE-MAP. Исторические контракты и планы
не оставлены активными маршрутами. Финальные documentation commits/push
проходят отдельное независимое review; их будущие SHA здесь не выдуманы.

Время финальной проверки маршрута: **{time}**, от старта 2026-10-07
23:36 UTC — **{str(elapsed).split('.')[0]}**, лимит 9 часов / deadline
2026-10-08 08:36 UTC. Это время документальной проверки, а не будущего push.
Runtime/тесты назначались medium, спецификации/README/docs/инструкции и весь
шаблон — ultra; финальная docs работа выполнена с inherited ultra.
'''
(O/'quarto-course/docs/releases/2026-10-08-implementation.md').write_text(central)
for x in M['writes']:
 t=Path(x['draftPath']).read_text();assert not re.search(r'\{\{[^}]+\}\}',t),x['draftPath']
# Delete only the explicitly verified leaves; unknown additions would stop exact tree-set checks above.
for p in delete:p.unlink()
for x in M['datedHistoryTreesToRemoveAfterDurable']:
 t=Path(x['targetPath'])
 for p in sorted(t.rglob('*'),key=lambda z:len(z.parts),reverse=True):
  if p.is_dir():p.rmdir()
 t.rmdir()
# Prune only empty parent directories of exact removed leaves, bounded inside owners/root.
for p in delete:
 q=p.parent
 while q!=B and q.is_relative_to(B) and q.name not in H:
  try:q.rmdir()
  except OSError:break
  q=q.parent
written=[]
for x in M['writes']:
 p=Path(x['targetPath']);q=Path(x['draftPath']);p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(q.read_bytes());written.append({'repo':x['repo'],'path':str(p),'relativePath':x['relativePath'],'sha256':sha(p.read_bytes()),'bytes':p.stat().st_size,'kind':x['kind']})
assert not Path('/home/tolya/Cybersecurity/docs').exists()
# Docs-only diff scope and whitespace checks; no final staging, commit, push.
diffscopes={}
for n,h in H.items():
 r=B/n;git(r,'diff','--check');assert git(r,'rev-parse','HEAD').decode().strip()==h;assert not git(r,'diff','--cached','--name-only').strip();names=git(r,'diff','--name-only').decode().splitlines();untracked=git(r,'ls-files','--others','--exclude-standard').decode().splitlines();allowed={x['relativePath'] for x in M['writes'] if x['repo']==n}|{x['relativePath'] for x in M['removals'] if x['repo']==n}
 for rel in names+untracked:assert rel in allowed or rel.startswith('docs/history/2026-10-08-completion/'),(n,rel)
 diffscopes[n]={'head':h,'trackedChangedPaths':names,'untrackedPaths':untracked}
# Bounded authored Markdown link check on the current routes/reports/authority repairs.
links=0;fail=[]
for x in written:
 p=Path(x['path']);t=re.sub(r'(?ms)^```.*?^```[^\n]*\n?', '',p.read_text())
 for raw in re.findall(r'\[[^\]]*\]\(([^)]+)\)',t):
  z=raw.strip().split(' ')[0].strip('<>');u=urllib.parse.urlsplit(z)
  if u.scheme or z.startswith('#'):continue
  q=(p.parent/urllib.parse.unquote(u.path)).resolve();links+=1
  if not q.exists():fail.append({'file':str(p),'link':z})
assert not fail,fail
verified={'verifiedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'checkpointCommits':H,'firstDurableHistory':M['durableHistory'],'allPreDeleteGitByteGuards':True,'guardedRemovedFiles':len(delete),'completedPlansAndStubRemoved':11,'historicalMetadataRemoved':24,'rootHistoricalFilesRemoved':41,'datedHistoryTreeFileCounts':treecounts,'datedHistoryTreesRemoved':9,'writtenFiles':written,'localMarkdownLinksChecked':links,'brokenLocalMarkdownLinks':fail,'gitDiffChecks':True,'noPendingTemplateMarkers':True,'docsOnlyScope':diffscopes,'courseDocsStillAbsent':True,'courseCurrentHead':'b6b085cf0541785d11159bd9a106cd131dfabaf0','courseCI':37743840665,'coursePRState':'OPEN','step17':V,'publishedSiteSource':'52316a762da3a9c054b5ac6a7a89620e46c7c150','servingGhPages':'8dc11b599406f65af420aef39babdb15375df61b','finalDocumentationChangesCommitted':False,'finalPushPerformed':False}
dump(O/'verified-execution.json',verified)
(O/'execution-report.md').write_text(f'''# Step18 executed; final docs review pending\n\nCheckpoint commits: see checkpoint-commits.json. All ten journals and final cleanup receipts Git-saved before deletion.\n\nExact Git byte/path-set guards passed for {len(delete)} deleted leaves: 11 plans/stub, 24 metadata, 41 root historical files, nine dated completion trees. Unknown archives/user checkout were not touched.\n\nWritten 26 documents: nine reports, fifteen owner authority repairs, root START/AGENTS. {links} bounded local Markdown links resolve; nine git diff --check pass; zero pending template markers. Course docs remains absent; no Course mutation.\n\nOnly checkpoint commits created locally. Final docs changes are uncommitted/unstaged for independent review. Published tag/demo/site refs remain separate from docs main.\n\nVerified {verified['verifiedAt']}; exact file hashes/scopes/receipts in verified-execution.json and pre-delete-git-guards.json.\n''')
print(json.dumps({'verifiedAt':verified['verifiedAt'],'removedFiles':len(delete),'datedTrees':9,'writes':26,'localLinks':links,'checkpointCommits':H,'finalDocsUncommitted':True},ensure_ascii=False))
