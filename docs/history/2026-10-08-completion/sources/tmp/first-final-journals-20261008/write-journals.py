from pathlib import Path
from hashlib import sha256
import json,re,subprocess,datetime
base=Path('/home/tolya/course-tools');drafts=Path('/tmp/final-completion-write-20261008');out=Path('/tmp/first-final-journals-20261008');facts=json.loads((drafts/'draft-facts.json').read_text());owners=list(json.loads((drafts/'execution-manifest.json').read_text())['ownerHeads']);courseURL='https://github.com/BSU-RFCT-Afonenko-Courses/Cybersecurity/pull/4';courseHead='fd62bdb3de1d2c9fce8a51dde9fcb7636e58cb9c';ciURL='https://github.com/BSU-RFCT-Afonenko-Courses/Cybersecurity/actions/runs/37742519419';native='/tmp/cybersecurity-core-patch-20261008/verified-final-native.json'
expected={t['repo']:t['commit'] for t in facts['tools']};expected['quarto-template-course']='52316a762da3a9c054b5ac6a7a89620e46c7c150'
sha=lambda raw:sha256(raw).hexdigest();git=lambda repo,*args:subprocess.check_output(['git',*args],cwd=base/repo,text=True).strip()
for repo in owners:
 assert git(repo,'branch','--show-current')=='main';assert git(repo,'rev-parse','HEAD')==expected[repo];assert git(repo,'rev-parse','origin/main')==expected[repo];assert not git(repo,'status','--porcelain')
common=f'''\n## Подтверждённый финальный журнал — 8 октября 2026, 07:19 UTC\n\nШаги 12–15 завершены: восемь текущих инструментов immutable выпущены,\nштатная установка по тегам и native ready результаты проверены; Core 4.0.1\nи demo-20261008-1 сохранены отдельно от предыдущей immutable линии.\n[Template PR #19](https://github.com/Afonenko-Course-Tools/quarto-template-course/pull/19)\nMERGED после [CI SUCCESS](https://github.com/Afonenko-Course-Tools/quarto-template-course/actions/runs/37737745573).\nPublished source main `52316a762da3a9c054b5ac6a7a89620e46c7c150`,\nnative gh-pages `8dc11b599406f65af420aef39babdb15375df61b`. Пять clean-main\nnative gates и task publish exit 0; exact 63 Core/549 ready/599 site bytes,\n61 HTML/2459 local links,22 HTTP/Pages built/Root CUA Source-search-catalog PASS.\n[Руководство](https://afonenko-course-tools.github.io/quarto-template-course/).\n\nШаг 16: [новый PR #4]({courseURL}) **OPEN**, прикреплён к задаче,\nhead `{courseHead}`, tree `a9fdc3fe043bcaf75249dc2f7c839324287924e1`.\nСохранены пользовательские 9853/master8e histories; 701 одобренный путь\nсовпадает с Git bytes, включая все32 Course receipts/history files и8 raw logs.\nCore 4.0.1 installed618 exact paths/bytes; NativeRun48/CUE8, student107.247/\nfull120.018/student111.065/site0.358s exit0; оба bank href/native11.1; Body40.629s,\nroot-only owner, real open/manual90-minute estimate, required/individual,\nclosed participant fields absent/resources0/noZIP. Student178bytes, author43\nи runtime667 сохранены. Exact native proof: `{native}`.\n[Required CI 37742519419]({ciURL}) **IN_PROGRESS**; успех ещё не заявляется,\nпоэтому checkbox16 остаётся pending. Курс не merge/deploy/branch cleanup.\n\nШаги 17–18 pending: first durable nine-owner final history, fresh branch/tag/\nRelease/worktree guards, exact refs cleanup и final docs handoff ещё не выполнены.\nТеги/Releases/source producer SHA, serving gh-pages, OPEN automatic heads\nи все пользовательские worktrees/Course ветки сохраняются.\n'''
changes=[]
for repo in owners:
 rel='docs/plans/2026-10-08-implementation.md';p=base/repo/rel;before=p.read_text();snap=out/'current-source'/repo/rel;snap.parent.mkdir(parents=True,exist_ok=True);snap.write_text(before)
 if repo=='quarto-template-course':status='Статус: повторная публикация руководства с Core 4.0.1 выполнена;\nmain 52316a7/gh-pages8dc11b5 и native/live gates подтверждены.\nШаги12–15 завершены; Course PR#4 OPEN/CI IN_PROGRESS, шаги17–18 ожидаются.'
 else:
  t=next(t for t in facts['tools'] if t['repo']==repo);status=f"Статус: выпуск {t['tag']} выполнен на чистом проверенном main,\nimmutable release и native remote-tag install подтверждены. Шаги12–15\nзавершены; Course PR#4 OPEN/CI IN_PROGRESS, шаги17–18 ожидаются."
 after,n=re.subn(r'^Статус:[\s\S]*?(?=\n\n)',status,before,count=1,flags=re.M);assert n==1,(repo,n)
 own=(drafts/repo/'owner-journal-append.md').read_text();own=own.replace('{{COURSE_NEW_OPEN_PR_URL}}',courseURL).replace('{{COURSE_FINAL_HEAD}}',courseHead).replace('{{COURSE_FINAL_CI_RESULT}}','IN_PROGRESS — '+ciURL)
 # The appends retain dated past receipts; common final block is the current execution status.
 after+=own+common;assert '{{' not in after,repo
 changes.append({'repo':repo,'relativePath':rel,'beforeSHA256':sha(before.encode()),'afterSHA256':sha(after.encode()),'expectedHEAD':expected[repo],'data':after})
repo='quarto-course';rel='docs/plans/2026-10-08-course-tools-implementation.md';p=base/repo/rel;before=p.read_text();snap=out/'current-source'/repo/rel;snap.parent.mkdir(parents=True,exist_ok=True);snap.write_text(before)
after=before.replace('Дата: 8 октября 2026. Статус: согласован для следующей сессии Codex;\nподготовка плана не означает выполнения кода, merge, release или публикации.','Дата: 8 октября 2026. Статус: шаги12–15 выполнены; новый Course PR#4 OPEN,\nrequired CI выполняется. Шаг16 ожидает CI; шаги17–18 ещё не завершены.')
for step in (12,13,14,15):
 after,n=re.subn(r'^'+str(step)+r'\. \[ \]',str(step)+'. [x]',after,count=1,flags=re.M);assert n==1,(step,n)
assert re.search(r'^16\. \[ \]',after,re.M) and re.search(r'^17\. \[ \]',after,re.M) and re.search(r'^18\. \[ \]',after,re.M)
after=after.replace('CI/merge/immutable releases/ready assets/Pages/новый OPEN PR курса/cleanup остаются пунктами 12–18.','CI/merge/immutable releases/ready assets/Pages пунктов12–15 завершены.\nНовый Course PR#4 OPEN; required CI IN_PROGRESS,16 ещё pending;17–18 ожидаются.')
after+=common;changes.append({'repo':repo,'relativePath':rel,'beforeSHA256':sha(before.encode()),'afterSHA256':sha(after.encode()),'expectedHEAD':expected[repo],'data':after})
# Every owner is still the exact clean released main, then write only the ten authorized files.
for c in changes:assert sha((base/c['repo']/c['relativePath']).read_bytes())==c['beforeSHA256']
for c in changes:(base/c['repo']/c['relativePath']).write_text(c['data'])
for repo in owners:
 allowed={c['relativePath'] for c in changes if c['repo']==repo};actual=set(git(repo,'diff','--name-only').splitlines());assert actual==allowed,(repo,actual,allowed);assert not git(repo,'diff','--cached','--name-only');subprocess.run(['git','diff','--check','--',*sorted(allowed)],cwd=base/repo,check=True)
rows=[]
for c in changes:
 assert sha((base/c['repo']/c['relativePath']).read_bytes())==c['afterSHA256'];rows.append({k:v for k,v in c.items() if k!='data'})
result={'writtenAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'paths':rows,'writtenFileCount':10,'ownerCount':9,'coursePR':courseURL,'courseHead':courseHead,'courseCI':{'run':37742519419,'url':ciURL,'state':'IN_PROGRESS'},'globalStepCheckboxes':{'12':True,'13':True,'14':True,'15':True,'16':False,'17':False,'18':False},'onlyAuthorizedPlanFilesChanged':True,'allNineMainRefsUnchanged':True,'diffCheck':'PASS','staged':False,'committedPushed':False,'nextGate':'Root actual Course CI success, small ten-journal completion16 update, then durable nine-owner preservation'}
(out/'scopehash.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k!='paths'},ensure_ascii=False,indent=2))
