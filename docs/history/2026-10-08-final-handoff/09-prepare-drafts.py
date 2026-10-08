from pathlib import Path
from hashlib import sha256
import json,re,subprocess,datetime
base=Path('/home/tolya/course-tools'); dst=Path('/tmp/final-completion-write-20261008'); olddraft=Path('/tmp/final-report-drafts-20261008')
oldfacts=json.loads((olddraft/'draft-facts.json').read_text()); patch=json.loads(Path('/tmp/core-patch-release-20261008/verified-releases.json').read_text()); merged=json.loads(Path('/tmp/core-patch-release-20261008/merged.json').read_text()); linkmap=json.loads(Path('/tmp/final-cleanup-execution-prep-20261008/step18-owner-link-map.json').read_text()); initial=json.loads(Path('/tmp/final-handoff-preservation-prep-20261008/inventory.json').read_text())
sha=lambda b:sha256(b).hexdigest()
def dump(rel,data):
 p=dst/rel;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(data)
def token(repo):return repo.upper().replace('-','_')
def hist(repo):return '{{HISTORY_SHA_'+token(repo)+'}}'
def snapshot(repo,rel):
 p=(base/repo/rel) if repo!='root' else base/rel
 if p.exists():
  b=p.read_bytes(); q=dst/'current-source'/repo/rel;q.parent.mkdir(parents=True,exist_ok=True);q.write_bytes(b);return {'path':str(p),'sha256':sha(b),'bytes':len(b),'snapshot':str(q)}
 return {'path':str(p),'exists':False}
manifest={'mode':'draft only; no owner/root changes or commits','capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'writes':[],'removals':[],'ownerHeads':{},'pending':['patched Template final main/PR/CI/native publish/gh-pages/live receipts','new OPEN Cybersecurity PR/head/CI/native/Body receipts','first durable nine-owner preservation commit SHAs and current SOURCE-MAP','step17 fresh before/after tag/Release/worktree/keep-set comparisons','actual final finish/elapsed and reasoning assignment receipt']}
for o in linkmap:
 repo=o['repo']; manifest['ownerHeads'][repo]=subprocess.check_output(['git','rev-parse','HEAD'],cwd=base/repo,text=True).strip()
 for rel in o['exactRemovalPaths']+o['historicalMetadataCandidates']:
  entry=snapshot(repo,rel);entry.update({'repo':repo,'relativePath':rel,'kind':'completed-plan-or-transition' if rel in o['exactRemovalPaths'] else 'historical-metadata','requiredGuard':'latest current bytes equal a blob in reachable first-preservation commit before removal'});manifest['removals'].append(entry)
 for x in o['activeCrosslinksToUpdate']:snapshot(repo,x['file'])
 # Baseline compact owner report; seven unchanged producer releases stay exactly as released.
 p=olddraft/repo/'docs/releases/2026-10-08-implementation.md'
 if p.exists():dump(repo/'docs/releases/2026-10-08-implementation.md' if isinstance(repo,Path) else f'{repo}/docs/releases/2026-10-08-implementation.md',p.read_text())
# Root historical copies: use verified initial mappings only, current bytes must still equal one preserved snapshot.
roots={}
for r in initial['snapshotRecords']:
 if r.get('rootUnownedSource'):roots.setdefault(r.get('source') or r['sourcePath'],[]).append(r)
for src,records in roots.items():
 p=Path(src)
 if p.name in ('AGENTS.md','START-CODEX.md') or 'local-tools' in p.parts:continue
 if not p.is_file():continue
 digest=sha(p.read_bytes()); matching=[r for r in records if r['sha256']==digest and r['gitSnapshotMatchesRecord']]
 if matching:
  r=matching[0];manifest['removals'].append({'repo':'root','path':src,'relativePath':str(p.relative_to(base)),'sha256':digest,'bytes':p.stat().st_size,'kind':'initial-verified-root-history','preservedOwner':r['repo'],'preservationCommit':r['preservationCommit'],'snapshotPath':r['snapshot'],'requiredGuard':'recheck current byte SHA and git show preserved commit:path equality immediately before exact file removal'})
for r in initial['additionalCybersecurityRootSources']:
 p=Path(r['source'])
 if p.is_file() and sha(p.read_bytes())==r['gitSnapshotSha256']:
  manifest['removals'].append({'repo':'root','path':str(p),'relativePath':str(p.relative_to(base)),'sha256':sha(p.read_bytes()),'bytes':p.stat().st_size,'kind':'initial-verified-course-root-history','preservedOwner':'/home/tolya/Cybersecurity','preservationCommit':r['preservationCommit'],'snapshotPath':r['snapshot'],'requiredGuard':'recheck current byte SHA and git show preserved commit:path equality; do not mutate any course ref/worktree'})
# Latest tool/demo facts replace active Core row only; six other producer demo releases stay unchanged.
facts={**oldfacts,'mode':'draft-only current active release facts; owner/root files untouched','baseline':'Core4.0.1 current + other verified original immutable producer releases','pending':manifest['pending']}
facts['tools']=[dict(t) for t in oldfacts['tools']]; facts['tools'][0]={**facts['tools'][0],**{'tag':'v4.0.1','commit':patch['commit'],'releaseId':patch['releases']['v4.0.1']['gate']['releaseId'],'publishedAt':patch['releases']['v4.0.1']['gate']['publishedAt'],'releaseURL':patch['releases']['v4.0.1']['release']['html_url'],'immutable':True}}
facts['demos']=[dict(t) for t in oldfacts['demos']]; d=dict(facts['demos'][0]);d.update({'tag':'demo-20261008-1','commit':patch['commit'],'releaseId':patch['releases']['demo-20261008-1']['gate']['releaseId'],'url':patch['releases']['demo-20261008-1']['release']['html_url'],'downloadVerifiedReceipt':'/tmp/core-patch-release-20261008/receipts/releases/quarto-course/demo-20261008-1/download-verified.json'});d['groups']={'core':{**d['groups']['core'],'archiveSha256':patch['releases']['demo-20261008-1']['assets']['course.tar.gz']['sha256'],'archiveBytes':patch['releases']['demo-20261008-1']['assets']['course.tar.gz']['bytes'],'downloadURL':'https://github.com/Afonenko-Course-Tools/quarto-course/releases/download/demo-20261008-1/course.tar.gz','sourceRef':'v4.0.1','build':patch['demoBuild']['build'],'fileCount':107}};facts['demos'][0]=d
facts['tagInstalls']=dict(oldfacts['tagInstalls']);facts['tagInstalls']['quarto-course']={'fileCount':63,'receipt':'/tmp/core-patch-release-20261008/verified-releases.json#nativeTagInstall','passed':True,'source':patch['commit']}
facts['ciMeta']=dict(oldfacts['ciMeta']);facts['ciMeta']['quarto-course']={'label':'Core / Presentation / Navigation','pr':27,'mainCI':37734901545,'local':'Core4.0.1 exact native book RED→GREEN, restricted HTML/search/resource/Source/public DTO/partial/aborted-pointer guards; corrected unchanged complete npm test exit0; independent runtime review Approved.','pins':'Quarto 1.11.5 / CUE 0.17.1.'}
dump('draft-facts.json',json.dumps(facts,ensure_ascii=False,indent=2)+'\n')
# Central factual report with no invented late gates.
rows=[]
for t in facts['tools']:
 r=t['repo'];m=facts['ciMeta'][r];rows.append(f"| {m['label']} | [{t['tag']}]({t['releaseURL']}) | `{t['commit']}` | [#{m['pr']}](https://github.com/Afonenko-Course-Tools/{r}/pull/{m['pr']}) / [SUCCESS](https://github.com/Afonenko-Course-Tools/{r}/actions/runs/{m['mainCI']}) | {facts['tagInstalls'][r]['fileCount']} |")
demorows=[]
for d in facts['demos']:
 for name,g in d['groups'].items():demorows.append(f"| {name} | [{d['tag']}]({d['url']}) | `{g['sourceRef']}` / `{d['commit']}` | {g['fileCount']} | `{g['archiveSha256']}` |")
central='''---
type: implementation-report
component: course-tools
status: historical
updated: 2026-10-08
---

# Инструменты, руководство и Cybersecurity: результат 8 октября 2026

Отчёт фиксирует проверенные операции. Действующие правила находятся в
[current индексе Core](../../spec/index.md) и индексах владельцев.

Старт: **2026-10-08 02:36 Europe/Minsk / 2026-10-07 23:36 UTC**.
Дедлайн: **11:36 Europe/Minsk / 08:36 UTC**, девять часов.
Фактический финиш/elapsed: **ожидает `{{FINAL_FINISH_AND_ELAPSED}}`**.
По заданию runtime/tests выполняют medium, specs/README/docs/template — ultra
при поддержке исполнителя. Фактические настройки: `{{ACTUAL_REASONING_RECEIPT}}`.

Восемь текущих инструментов выпущены; Core4.0.1 и новый Core demo проверены.
Повторная публикация руководства с Core4.0.1, окончательный OPEN PR курса,
очистка17 и сохранение/передача18 ожидают точных завершающих receipts.

| Инструмент | Immutable tag | Source SHA | PR / main CI | Remote-tag файлов |
| --- | --- | --- | --- | ---: |
'''+ '\n'.join(rows)+'''

Source SHA каждого выпуска равен проверенному чистому merged main до публикации.
PR/main CI прошли, merged tree равен tested PR tree. Штатный remote-tag
`quarto add` установил exact upstream пути/bytes без overlay. Draft assets
скачаны и hash/size сверены до immutable публикации; actual API metadata,
теги и SHA проверены после неё. Старые теги/assets/Releases сохранены.

Core4.0.1: [PR #27](https://github.com/Afonenko-Course-Tools/quarto-course/pull/27),
PR CI [SUCCESS](https://github.com/Afonenko-Course-Tools/quarto-course/actions/runs/37734271246),
main CI [SUCCESS](https://github.com/Afonenko-Course-Tools/quarto-course/actions/runs/37734901545).
Новый bundle — 63 файла, tool archive SHA256
`beaab9b7f69d424445c02c088072e14ebe298bdeb4beeb441c9f1c889fdcc5e9`.
Native book RED→GREEN проверяет точные адреса и числовые подписи 2.1/3.1;
Source/search/resource/public DTO/partial/failed-run guards сохранены.
Полный неизменный `npm test` с существующим Chromium завершился exit0.
Исходная browser setup failure сохранена отдельно; она не скрыта повторным
успехом. Публичная модель, схемы и NativeRun/Body API Core4.0.0 сохранены.
Первый Core4.0.0/demo-20261008 остаётся проверенной историей.

Quarto 1.11.5 / CUE 0.17.1. Print/Moodle/PL/Cloud и optional Download bridge
проверены и выпущены с Core4.0.0. Publisher CI использует released-compatible
QRC2.2.1; final ready composition использует QRC3.0.0. QRC CI/ready используют
Publisher5.0.0. Эти actual зависимости других producer не переименованы
после patch Core; новая установленная документация/курс используют Core4.0.1.

| Ready группа | Immutable demo | Tool sourceRef / producer SHA | Файлов | Archive SHA256 |
| --- | --- | --- | ---: | --- |
'''+ '\n'.join(demorows)+'''

Восемь групп принадлежат семи текущим immutable demo Releases: Core `-1`,
шесть остальных `demo-20261008`; QRC выпускает qrc/external вместе. Download
отдельного demo не имеет. Каждый producer source SHA совпадает со своим tool;
`BUILD.sourceDirty:false`, зависимости и все файлы подтверждены native
build/download receipts. Consumer сохраняет producer HTML/opaque files
побайтно. SourceRef — tool tag; каталог исходников использует demo tag на том
же SHA. Новый Core demo: 107 файлов, 8 HTML / 230 local links, HTML/resources/
SourceLinks/outputs PASS; downloaded archive map совпал со всем ready деревом.

Адаптерная native матрица: 14/14 команд exit0. Print — 56 tests/0 failed,
три настоящих PDF с текстовой и visual QA; Moodle — 84/0, разобранные XML и
выбранные teacher key 100/0; PL — Java25/Gradle9.8, шесть reference assertions
и ожидаемый отказ незавершённого student starter; Cloud — full/student/VM/
current native loader; Download — actual ZIP/hash/private/ownership/current-run
и standalone без Core/CUE. Publisher/QRC прошли native composition,
warning/profile/resources/Source/export-context/search/HTTP/browser проверки.

Русское руководство: буквальные QMD банка, обеих форм решения, 12 ролей,
четырёх работ и пяти форм ответа. Installed suite покрывает public/teacher Body,
qualified assignments, времена 35/75/50/90, theory7.5 и partial omission;
Task/curl/tar fetch regression — Unicode/spaces/refusal/preservation.
Первый Template PR#18/main `8b050033b594eeae4270ca6f55f12a1d6e8f1243`
проверен и опубликован: 28 QMD, 61 HTML / 2459 local links, 599 site файлов,
62 Core файла и 549 ready файлов. Native `task publish` exit0, Pages legacy
`gh-pages:/`, gh-pages `a55b0e399febec10b9dec4a87273adb5b603e732`, build SUCCESS;
599 published bytes совпали, native `.nojekyll` отдельно. Первая live QA:
22 HTTP/hash проверки и CUA Source/search/catalog/Core example.

[Руководство](https://afonenko-course-tools.github.io/quarto-template-course/):
окончательная Core4.0.1 re-pin/recheck/native publication и live proof
**ожидают `{{PATCHED_TEMPLATE_PUBLICATION_RECEIPT}}`**. Последующий docs/history
main фиксируется отдельно от фактически опубликованного source main.

Cybersecurity: новый OPEN PR **ожидает `{{COURSE_NEW_OPEN_PR_URL}}`**;
head `{{COURSE_FINAL_HEAD}}`, CI `{{COURSE_FINAL_CI_RESULT}}`, итоговый native/Body
receipt `{{COURSE_FINAL_NATIVE_RECEIPT}}`. Старый PR#3 MERGED. Курс сохраняет
авторское условие backup и собственную оценку90, узкий bank и root-only id;
пустые checksum/control drafts не объявлены готовыми задачами. Первые48
NativeRun/8CUE cases и selected backup Body проходили; первая course href
проверка обнаружила Core P1, теперь исправленный отдельным immutable patch.
Итоговый course student/full/student/site результат ещё не подставлен.
Курс передаётся в OPEN PR; его merge/deploy и очистка веток не выполняются.

Очистка17: **ожидает `{{CLEANUP_BEFORE_AFTER_RECEIPT}}`**;
counts `{{CLEANUP_FINAL_COUNTS}}`, guards `{{CLEANUP_FINAL_GUARDS_RESULT}}`.
Удаляются только проверенные tool/template ветки, сохраняются main, serving
native gh-pages, exact API-confirmed OPEN bot heads и все course ветки.
Свежая before/after проверка должна сравнить все tags/peeled SHA и Release
id/tag/immutable/publishedAt/assets id/name/size/digest; все13 исходных
дополнительных checkout путей, HEAD/bytes/untracked/ignored state сохраняются.
Дополнительные patch worktrees учитываются отдельно свежим inventory.

История: **ожидает `{{CORE_PRESERVATION_SHA}}` / `{{CORE_HISTORY_ROOT}}`**.
Первый reachable Git commit сохраняет final owner/global journals, текущие
START/AGENTS и compact receipts/helpers/SOURCE-MAP; лишь затем completed plans,
transition stubs и проверенная историческая metadata удаляются из active tree.
Initial147 Git snapshot records подтверждены; root originals удаляются только
при повторном совпадении current bytes с preserved blob. Неучтённые root
archives сохраняются. Новая финальная docs/history ревизия не меняет tool/demo
refs и не считается source SHA уже опубликованного сайта.

Принятые правила: один native source/projection path; actual public-solution
witness после native условий, переносимый solution для selected JSON; Source
AST mask; selected participant restricted statement без key/solution/notes/
assessment-preview; qualified membership/time/partial omission. Core4.0.1
публичный `post-quarto` фильтр переносит уже-native HTML через
`quarto.doc.include_text('after-body', ...)` вне main. Native book resolver
разрешает адрес/подпись; search сохраняет work title/prose без assignment shadow.
Core post переносит exact permitted native markup и удаляет закрытые carriers.
Новый общий runtime/Markdown parser/URL builder/search rewrite/второй render
не вводятся.

Native warning streams сохраняются с actual exit; сама строка WARN не заменяет
результат Quarto. Узкие Windows path/CUE-TEMP исправления подтверждены fixtures;
**native Windows session не заявляется**. Upstream Quarto recoverEncode на
кириллическом пути остаётся ограничением; checkout в пути без кириллицы — обход.
Local PDF/XML/PL/Cloud evidence не означает hosted PL execution, live Moodle
import или VM/Cloud actions. Нерешённые ограничения не скрываются cleanup.
'''
dump('quarto-course/docs/releases/2026-10-08-implementation.md',central)
# Template draft explicitly distinguishes first publication from pending patched native publication.
tpl=(dst/'quarto-template-course/docs/releases/2026-10-08-implementation.md').read_text().replace('Новое course P1 native book-xref\nfinding требует отдельного Core4.0.1/core-demo patch и повторной template\nпроверки/публикации:', 'Core4.0.1 и Core demo-20261008-1 уже immutable опубликованы на\n`a9a439bd6e6498806d4d4943efd71232e70170be`, native install63 и ready107\nпобайтно проверены. Повторная template проверка/публикация:')
dump('quarto-template-course/docs/releases/2026-10-08-implementation.md',tpl)
# Exact authority/navigation edits, drafted from preserved current bytes.
for o in linkmap:
 repo=o['repo']
 for rel in sorted({x['file'] for x in o['activeCrosslinksToUpdate']}):
  p=base/repo/rel;old=p.read_text();new=old
  if rel=='spec/index.md':
   if repo=='quarto-course':
    start='[Линейный план](../docs/plans/2026-10-08-course-tools-implementation.md) остаётся\nмаршрутом исполнения, а не отдельным нормативным владельцем. Публикация, CI,\nфинальный browser/review gate и ready assets подтверждаются отдельно.'
    repl='Проверки, immutable releases, публикация, история и итоговая передача\nзафиксированы в [отчёте реализации](../docs/releases/2026-10-08-implementation.md).\nЗавершённые планы сохраняются в Git истории и не задают текущих требований.'
    assert new.count(start)==1;new=new.replace(start,repl)
   else:
    new=re.sub(r'^\| \[План владельца\]\([^\n]+$',lambda m:m.group(0).replace('[План владельца](../docs/plans/2026-10-08-implementation.md)','[Результат реализации](../docs/releases/2026-10-08-implementation.md)').replace('| plan |','| implementation-report |').replace('| in-progress |','| historical |'),new,flags=re.M)
    if o['historicalMetadataCandidates']:
     new=new.replace('../docs/history/2026-10-08/README.md',f'https://github.com/Afonenko-Course-Tools/{repo}/blob/{hist(repo)}/docs/history/2026-10-08/README.md')
    new=new.replace('[плане владельца](../docs/plans/2026-10-08-implementation.md)','[отчёте реализации](../docs/releases/2026-10-08-implementation.md)')
    if repo=='quarto-template-course':
     new=new.replace('Порядок внедрения и оставшиеся публикационные этапы — [линейный план](../../quarto-course/docs/plans/2026-10-08-course-tools-implementation.md).','Фактическая публикация и сохранённая история — [отчёт реализации](../docs/releases/2026-10-08-implementation.md).')
  elif rel=='docs/history-index.md':
   new=new.replace('Действующие правила находятся в [индексе спецификаций](../spec/index.md), будущие\nизменения — в [плане владельца](plans/2026-10-08-implementation.md).','Действующие правила находятся в [индексе спецификаций](../spec/index.md),\nпроверенный результат — в [отчёте реализации](releases/2026-10-08-implementation.md).')
  elif repo=='quarto-template-course' and rel=='README.md':
   new=new.replace('[плану владельца](docs/plans/2026-10-08-implementation.md)','[отчёту реализации](docs/releases/2026-10-08-implementation.md)')
  elif repo=='quarto-template-course' and rel=='spec/site.md':
   new=new.replace('Core 4.0.0','Core 4.0.1').replace('[План владельца](../docs/plans/2026-10-08-implementation.md) задаёт полное авторское покрытие, новые pins и проверку Pages.', '[Отчёт реализации](../docs/releases/2026-10-08-implementation.md) фиксирует авторское покрытие, точные pins и фактическую проверку Pages.')
  assert new!=old,(repo,rel)
  dump(f'{repo}/{rel}',new);manifest['writes'].append({'repo':repo,'relativePath':rel,'targetPath':str(p),'sourceSHA256':sha(old.encode()),'draftSHA256':sha(new.encode()),'draftPath':str(dst/repo/rel),'kind':'authority-link-repair','lateGuard':'rebase the narrow links against final clean owner main after Template/Course/history gates; do not overwrite intervening author changes'})
# Root route is compact and contains no completed-plan authority.
start='''# Старт Codex: инструменты курса и документация

Действующие правила: [индекс Core](quarto-course/spec/index.md),
[контракт сайта](quarto-template-course/spec/site.md) и current индексы владельцев.
Проверенные releases, source SHA, история и ограничения —
[итоговый отчёт](quarto-course/docs/releases/2026-10-08-implementation.md).
[Русское руководство](https://afonenko-course-tools.github.io/quarto-template-course/).

| Владелец | Текущий контракт |
| --- | --- |
| Core / Presentation / Navigation | [quarto-course](quarto-course/spec/index.md) |
| Publisher | [quarto-project-publish](quarto-project-publish/spec/index.md) |
| QRC | [quarto-reference-catalog](quarto-reference-catalog/spec/index.md) |
| Print | [quarto-course-print](quarto-course-print/spec/index.md) |
| Moodle | [quarto-course-moodle](quarto-course-moodle/spec/index.md) |
| PrairieLearn | [quarto-course-prairielearn](quarto-course-prairielearn/spec/index.md) |
| Cloud | [quarto-course-cloud](quarto-course-cloud/spec/index.md) |
| Download | [quarto-project-download](quarto-project-download/spec/index.md) |
| Документация | [quarto-template-course](quarto-template-course/spec/index.md) |

Cybersecurity: **ожидает actual OPEN PR `{{COURSE_NEW_OPEN_PR_URL}}`**.
Курс передаётся через OPEN PR; все его ветки и рабочие деревья сохраняются.

Этот корень не Git-репозиторий. Не создавать новый. Исторические планы,
спецификации и receipts восстанавливаются по сохранённым owner Git refs,
указанным в отчётах; completed планы не являются текущим маршрутом.
Сохранять пользовательские рабочие деревья, main, serving gh-pages, heads
OPEN автоматических PR, все теги и Releases. Последние прямые указания
пользователя имеют приоритет над историческими материалами.
'''
for rel in ('AGENTS.md','START-CODEX.md'):snapshot('root',rel)
ag=(base/'AGENTS.md').read_text(); old='''Сначала прочитать [START-CODEX.md](START-CODEX.md). Действующие решения следующего
внедрения находятся у владельца Core:
[контракт](quarto-course/spec/authoring-model-next.md) и
[линейный план](quarto-course/docs/plans/2026-10-08-course-tools-implementation.md).
Задачи других владельцев связаны из START. Корневые старые specs/планы/evidence
используются как история, не заменяют актуальные прямые указания пользователя.''';new='''Сначала прочитать [START-CODEX.md](START-CODEX.md). Действующие правила находятся
у владельца Core: [индекс контрактов](quarto-course/spec/index.md).
Проверенный результат и восстановление истории —
[отчёт реализации](quarto-course/docs/releases/2026-10-08-implementation.md).
Контракты других владельцев связаны из START. Старые specs/планы/evidence
используются как история, не заменяют актуальные прямые указания пользователя.''';assert ag.count(old)==1;ag=ag.replace(old,new).replace('обновление существующего OPEN PR Cybersecurity','создание нового OPEN PR Cybersecurity')
for rel,data in [('START-CODEX.md',start),('AGENTS.md',ag)]:
 dump('root/'+rel,data);manifest['writes'].append({'repo':'root','relativePath':rel,'targetPath':str(base/rel),'sourceSHA256':sha((base/rel).read_bytes()),'draftSHA256':sha(data.encode()),'draftPath':str(dst/'root'/rel),'kind':'current-authority-route','lateGuard':'save original current bytes in first durable Core history commit before replacement; preserve the AGENTS file and all instructions except the obsolete authority paragraph'})
# Journal appends are evidence patches before history commit; no checkbox success is invented.
for o in linkmap:
 repo=o['repo'];append='\n## Итоговый журнал 8 октября: проверенные выпуски и передача\n\n'
 if repo=='quarto-course':append+='Core4.0.1: PR#27 merged source `a9a439bd6e6498806d4d4943efd71232e70170be`, PR CI37734271246/main CI37734901545 SUCCESS. Immutable tool Release406473961/native install63 exact files; Core demo-20261008-1 Release406475550/native ready107 exact files, sourceDirty false. Full npm test exit0 и native book2.1/late-bank3.1/privacy/Source/search/resource/partial guards PASS. Core4.0.0 и первая demo0 остаются immutable историей.\n'
 elif repo=='quarto-template-course':append+='Первый PR#18/main `8b050033b594eeae4270ca6f55f12a1d6e8f1243` прошёл native install/fetch/render/check и опубликован через task publish в gh-pages `a55b0e399febec10b9dec4a87273adb5b603e732`; Pages legacy build и live proof PASS. Повторный Core4.0.1 install63 + mixed demo Core.1/others0 и native publication: ожидает `{{PATCHED_TEMPLATE_PUBLICATION_RECEIPT}}`.\n'
 else:
  t=next(t for t in facts['tools'] if t['repo']==repo);m=facts['ciMeta'][repo];append+=f"Tool {t['tag']}: source `{t['commit']}`, PR#{m['pr']} merged/main CI{m['mainCI']} SUCCESS, immutable Release{t['releaseId']}; actual native remote-tag install{facts['tagInstalls'][repo]['fileCount']} files exact bytes. {m['local']}\n";d=next((d for d in facts['demos'] if d['repo']==repo),None)
  if d:append+=f"Ready {d['tag']}: immutable Release{d['releaseId']} на том же sourceSHA, BUILD.sourceDirty false, native build/check/downloaded archive equality PASS.\n"
  else:append+='Отдельный ready demo не выпускается по принятому маршруту.\n'
 append+='\nШаг16: ожидает `{{COURSE_NEW_OPEN_PR_URL}}` / `{{COURSE_FINAL_HEAD}}` / `{{COURSE_FINAL_CI_RESULT}}`; курс не merge/deploy/branch-cleanup. Шаги17/18 pending до actual before/after cleanup receipts и first durable history commit. Позднейший docs/history main не заменяет опубликованный producer/site sourceSHA.\n'
 dump(f'{repo}/owner-journal-append.md',append)
dump('quarto-course/global-journal-append.md','''\n## Финальные receipts и итоговая передача\n\nШаг12: восемь tool Releases опубликованы/immutable и реально installed по тегам; исходная линия Core4.0.0 сохранена. Course P1 исправлен отдельным Core4.0.1 PR#27, source a9a439bd6e6498806d4d4943efd71232e70170be, PR/main CI SUCCESS, exact63/native book/privacy/full npmtest PASS.\nШаг13: семь текущих producer demo Releases/восемь групп проверены; Core demo-20261008-1, остальные demo-20261008. BUILD/sourceSHA/sourceDirty/архивные bytes/HTML/resources/Source/outputs подтверждены.\nШаги14/15: первая Template publication доказана; actual patched Template recheck/PR/CI/native publish/live receipt ожидает {{PATCHED_TEMPLATE_PUBLICATION_RECEIPT}}.\nШаг16: actual нового OPEN course PR/head/CI/native receipt ожидает {{COURSE_NEW_OPEN_PR_URL}} / {{COURSE_FINAL_NATIVE_RECEIPT}}.\nШаг17 pending {{CLEANUP_BEFORE_AFTER_RECEIPT}} / {{CLEANUP_FINAL_GUARDS_RESULT}}.\nШаг18 pending first durable owner-history SHAs, subsequent exact completed-plan/history removal and active link repair; final finish {{FINAL_FINISH_AND_ELAPSED}}. Ни один pending пункт не отмечается выполненным до actual evidence.\n''')
# The new dated preservation subtree is removed only after exact reachable Git-tree proof.
manifest['datedHistoryTreesToRemoveAfterDurable']=[{'repo':o['repo'],'relativePath':'docs/history/2026-10-08-completion','targetPath':str(base/o['repo']/'docs/history/2026-10-08-completion'),'preservationCommit':hist(o['repo']),'status':'not yet created; exact file inventory must be filled after first durable history commit','requiredGuard':'read reachable durable SHA and SOURCE-MAP; compare full exact path set and every current file byte with git ls-tree/git show; no extra untracked/symlink paths; remove only individually verified files, keep unknown additions; recovery links point to commit, not active tree'} for o in linkmap]
for o in linkmap:
 repo=o['repo']; p=dst/repo/'docs/releases/2026-10-08-implementation.md'
 p.write_text(p.read_text()+f"\nВосстановление финальных снимков: [SOURCE-MAP](https://github.com/Afonenko-Course-Tools/{repo}/blob/{hist(repo)}/docs/history/2026-10-08-completion/SOURCE-MAP.json). После проверки exact Git blobs только этот новый датированный snapshot-каталог удаляется из active docs; архивный commit остаётся reachable. Final cleanup receipts сохраняются отдельно в compact evidence без исторических контрактов.\n")
# Register reports and journal payloads without owner mutation.
for o in linkmap:
 repo=o['repo'];rel='docs/releases/2026-10-08-implementation.md';p=dst/repo/rel
 manifest['writes'].append({'repo':repo,'relativePath':rel,'targetPath':str(base/repo/rel),'sourceSHA256':sha((base/repo/rel).read_bytes()) if (base/repo/rel).exists() else None,'draftSHA256':sha(p.read_bytes()),'draftPath':str(p),'kind':'compact-implementation-report','lateGuard':'resolve exact pending evidence fields before final owner write; preserve current file if it appeared meanwhile'})
manifest['counts']={'owners':len(linkmap),'completedPlanOrStubRemovals':sum(r['kind']=='completed-plan-or-transition' for r in manifest['removals']),'metadataRemovals':sum(r['kind']=='historical-metadata' for r in manifest['removals']),'rootVerifiedHistoryRemovalCandidates':sum(r['repo']=='root' for r in manifest['removals']),'draftOwnerWrites':sum(w['repo']!='root' for w in manifest['writes']),'rootDraftWrites':2}
dump('execution-manifest.json',json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
pending={}
for p in dst.rglob('*.md'):
 if 'current-source' in p.parts:continue
 ts=sorted(set(re.findall(r'\{\{[A-Z0-9_]+\}\}',p.read_text())))
 if ts:pending[str(p.relative_to(dst))]=ts
dump('pending-fields.json',json.dumps(pending,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'counts':manifest['counts'],'pendingMarkdownFiles':len(pending),'writesExecuted':0,'ownerEdits':0,'rootEdits':0},ensure_ascii=False))
