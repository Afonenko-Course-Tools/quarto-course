from pathlib import Path
from hashlib import sha256
import json,re,subprocess,datetime,difflib
root=Path('/home/tolya/Cybersecurity');out=Path('/tmp/cybersecurity-final-patch-author-20261008')
hashbytes=lambda b:sha256(b).hexdigest()
orig={p:(root/p).read_text() for p in ['README.md','docs/plans/2026-10-08-extension-refresh.md']}
for p,s in orig.items():
 q=out/'current-source'/p;q.parent.mkdir(parents=True,exist_ok=True);q.write_text(s)
readme=orig['README.md'].replace('v4.0.0','v4.0.1').replace('Core 4.0.0','Core 4.0.1')
old='''[PR #3](https://github.com/BSU-RFCT-Afonenko-Courses/Cybersecurity/pull/3) уже
слит. Эта миграция оформляется новым PR, который остаётся OPEN после проверок.
Курс в этом этапе не сливается и не публикуется; PR workflow сохраняет отдельные
guards публикации для `master` и `COURSE_PUBLISH_PAGES`.'''
new='''PR workflow выполняет проверки курса. Публикация требует отдельно
разрешённого запуска из `master` с `COURSE_PUBLISH_PAGES`; проверки PR
курс не публикуют.'''
assert readme.count(old)==1;readme=readme.replace(old,new)
(out/'README.new.md').write_text(readme)
plan=orig['docs/plans/2026-10-08-extension-refresh.md']
# Current route uses new release; retain the dated first authoring-read section as true history.
current,history=plan.split('## Авторская документация — 8 октября 2026',1)
current=current.replace('v4.0.0','v4.0.1').replace('Core 4.0.0','Core 4.0.1')
plan=current+'## Авторская документация — 8 октября 2026'+history
plan=plan.replace('Здесь сохранить финальный head SHA, версии, проверки и URL нового OPEN PR.','''## Core 4.0.1 — финальные pins и проверки

Выпущенный Core 4.0.1: source
`a9a439bd6e6498806d4d4943efd71232e70170be`, immutable Release 406473961,
[PR #27](https://github.com/Afonenko-Course-Tools/quarto-course/pull/27),
[PR CI SUCCESS](https://github.com/Afonenko-Course-Tools/quarto-course/actions/runs/37734271246) и
[main CI SUCCESS](https://github.com/Afonenko-Course-Tools/quarto-course/actions/runs/37734901545).
Нативная установка тега upstream проверила все 63 пути/bytes bundle.
Новый Core demo `demo-20261008-1`, Release 406475550 на том же source SHA,
проверен как полный native готовый результат; прежние immutable выпуски сохранены.
Авторская модель, схемы и NativeRun/Body API сохраняют контракт Core 4.0.0.

В course payload предусмотрены четыре exact Core 4.0.1 bundle по 63 файла,
QRC 3.0.0 в каждом проекте, Publisher 5.0.0 в корне и Download 2.0.0 в task:
**618 файлов**. Фактический installed proof ожидает
`{{COURSE_CORE401_INSTALLED_RECEIPT}}`; до его получения этот раздел не
объявляет новую установку курса успешной. CI/install-extensions.sh должен
закреплять фактически установленный v4.0.1; overlays не добавляются.

Повторная публикация руководства с Core 4.0.1 ожидает
`{{PATCHED_TEMPLATE_PUBLICATION_RECEIPT}}`: source main
`{{PATCHED_TEMPLATE_SOURCE_MAIN}}`, native gh-pages
`{{PATCHED_TEMPLATE_GH_PAGES}}`, Pages/live проверки
`{{PATCHED_TEMPLATE_LIVE_RESULT}}`. Ранее прочитанные страницы Core 4.0.0
выше остаются историческим свидетельством первой публикации.

Итоговый замороженный курс: **ожидает `{{COURSE_FINAL_HEAD}}`**.
NativeRun 48 / project-local CUE 8: `{{COURSE_FINAL_FIXTURE_RESULT}}`.
Student → full → student: `{{COURSE_FINAL_CYCLE_RESULT}}`.
Site/source/search/QRC/resources: `{{COURSE_FINAL_SITE_RESULT}}`.
Выбранный backup Body: `{{COURSE_FINAL_BODY_RESULT}}`.
Точные commands/exits/durations/файл-SHA maps:
`{{COURSE_FINAL_NATIVE_RECEIPT}}`. Эти gates повторяются на фактическом Core 4.0.1;
первый Core 4.0.0 student href отказ не подставляется как успешный итог.

Авторские QMD/YAML сохранены: одна реальная backup-задача с собственной
оценкой 90 минут, одна лабораторная required/individual без stage, узкий bank
и root-only id. Checksum/контрольные остаются черновиками; новые решения,
ответы, project/binding/ZIP не создаются. Native warning streams учитываются
вместе с actual exit; Windows/hosted LMS/Cloud исполнение не заявляется.

Новый OPEN PR: `{{COURSE_NEW_OPEN_PR_URL}}`; required CI:
`{{COURSE_FINAL_CI_RESULT}}`. Курс остаётся в OPEN PR без merge/deploy;
публикационные guards и все ветки/пользовательские worktrees сохранены.''')
(out/'plan.new.md').write_text(plan)
body='''Student-ссылка лабораторной на задачу банка теряла нативный адрес при
отложенной проекции. Курс закрепляет выпущенный Core 4.0.1, который сохраняет
адрес и числовую подпись Quarto. Банк включён только для `task/data-integrity`;
существующая задача о четырёх видах бекапов и восстановлении назначена одной
лабораторной `sec-work-data-integrity-backup`. Required/individual остаются
значениями по умолчанию, stage отсутствует; 90 минут — авторская оценка опытов.

Core 4.0.1 и QRC 3.0.0 закреплены для корня и трёх подпроектов, Publisher 5.0.0
для корня, Download 2.0.0 для task. README и команды selected Body описывают
фактическую задачу. Корневой course.id, namespaces, профили и strict настройки
публичных частей сохранены. Пустой checksum и две контрольные остаются
черновиками; новые вопросы, решения, ZIP или LMS/Cloud задания не добавлены.

Проверки окончательного дерева:

- Native tag install: 618 файлов, включая четыре Core bundle по 63 файла,
  равны exact upstream source Git objects — `{{COURSE_CORE401_INSTALLED_RECEIPT}}`.
- NativeRun 48 / project-local CUE 8 — `{{COURSE_FINAL_FIXTURE_RESULT}}`.
- Student → full → student — `{{COURSE_FINAL_CYCLE_RESULT}}`.
- `python3 CI/site.py _site-student _site-full`, нативные ссылки, поиск и
  отсутствие служебных/закрытых ресурсов — `{{COURSE_FINAL_SITE_RESULT}}`.
- Selected backup participant/teacher Body — `{{COURSE_FINAL_BODY_RESULT}}`.
- Required CI на окончательном head — `{{COURSE_FINAL_CI_RESULT}}`.

Команды, длительности и source hashes: `{{COURSE_FINAL_NATIVE_RECEIPT}}`.
Публикационный workflow сохраняет master/не-PR/COURSE_PUBLISH_PAGES guards;
проверки этого PR курс не публикуют. Нативный Windows прогон и live LMS/Cloud
исполнение не заявляются. Локальные overlays поверх выпусков отсутствуют.
'''
(out/'pr-body.md').write_text(body)
paths=subprocess.check_output(['git','ls-files','--','*.qmd','*.yml','*.yaml'],cwd=root,text=True).splitlines();author=[p for p in paths if '_extensions/' not in p and not p.startswith('.github/')]
extra='task/data-integrity/_metadata.yml'
if (root/extra).exists() and extra not in author:author.append(extra)
authors=[{'path':p,'sha256':hashbytes((root/p).read_bytes()),'bytes':(root/p).stat().st_size} for p in sorted(author) if (root/p).is_file()]
assert len([p for p in authors if p['path'].endswith('.qmd')])==30
assert len(authors)==43
payload={}
for scope in ['.','theory','task','seminars']:
 d=root/scope/'_extensions/Afonenko-Course-Tools';payload[scope]={'currentFileCount':sum(p.is_file() for p in d.rglob('*')),'currentCoreDescriptorVersion':re.search(r'^version: (.+)$',(d/'course-core/_extension.yml').read_text(),re.M)[1]}
report={'mode':'preparation only; no course/source writes','capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'courseHEAD':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),'courseBranch':subprocess.check_output(['git','branch','--show-current'],cwd=root,text=True).strip(),'ownedFinalPaths':['README.md','docs/plans/2026-10-08-extension-refresh.md'],'sourceGuards':{p:hashbytes(s.encode()) for p,s in orig.items()},'draftHashes':{'README.new.md':hashbytes(readme.encode()),'plan.new.md':hashbytes(plan.encode()),'pr-body.md':hashbytes(body.encode())},'preservedAuthorFiles':authors,'authorQmdCount':30,'authorYamlCount':13,'authorSourceTotal':43,'currentInstalledAtPreparation':payload,'futureExpectedInstalledFiles':618,'futureExpectedCoreBundleCount':4,'futureExpectedCoreBundleFiles':63,'releasedCoreToolTag':'v4.0.1','releasedCoreSourceSHA':'a9a439bd6e6498806d4d4943efd71232e70170be','releasedCoreNative63Proof':'/tmp/core-patch-release-20261008/verified-releases.json','applyGates':['actual patched Template native gh-pages/live proof','actual course Core4.0.1 pin installer and 618 exact path/byte proof','actual final course student/full/student/site/Body/fixture receipts','recheck README/plan and all43 author source SHA guards','independent ultra doc review of actual final two files'],'pendingFields':sorted(set(re.findall(r'\{\{[A-Z0-9_]+\}\}',plan+body))),'noCourseEdits':True,'noQmdYamlEdits':True,'noCommitsOrExternalActions':True}
(out/'source-hash-guards.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
diff=''.join(''.join(difflib.unified_diff(orig[p].splitlines(True),s.splitlines(True),fromfile='a/'+p,tofile='b/'+p)) for p,s in [('README.md',readme),('docs/plans/2026-10-08-extension-refresh.md',plan)])
(out/'author-docs.diff').write_text(diff)
assert 'PR #3' not in body and 'указанию пользователя' not in body and 'разрешил' not in body
assert 'Core4.' not in readme+plan+body and '618 файлов' in plan+body
print(json.dumps({'ownedPaths':report['ownedFinalPaths'],'authorSourceFiles':len(authors),'currentInstalledTotal':sum(v['currentFileCount'] for v in payload.values()),'currentCoreVersion':'4.0.0','futureExpected618IsPending':True,'sourceWrites':0,'pendingFields':len(report['pendingFields'])},ensure_ascii=False))
