from pathlib import Path
import json,hashlib,subprocess,datetime,shutil,re
B=Path('/home/tolya/course-tools');O=Path('/tmp/final-completion-write-20261008');M=json.loads((O/'execution-manifest.json').read_text());D=json.loads(Path('/tmp/durable-completion-history-20261008.json').read_text());H=D['historyCommits']
def sha(b):return hashlib.sha256(b).hexdigest()
def git(repo,*args):return subprocess.check_output(['git','-C',str(repo),*args])
def dump(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
# Reversible preparation is limited to ten journals and a dated Core archival payload.
for n,h in H.items():
 r=B/n;assert git(r,'rev-parse','HEAD').decode().strip()==h,n;assert not git(r,'status','--porcelain').strip(),n
for x in M['writes']:
 p=Path(x['targetPath']);assert (sha(p.read_bytes()) if p.exists() else None)==x['sourceSHA256'],str(p)
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
append=f'''\n\n## Финальный архивный checkpoint: шаги 17–18 ({now})\n\nШаг 17 выполнен: 46 LOCAL и 11 REMOTE веток удалены; 11 checkout переведены\nв detached HEAD без изменения HEAD/bytes/status. Все tags и 61 Releases\nсохранены; main, native serving gh-pages и API-confirmed OPEN bot heads\nсохранены. Все 13 исходных пользовательских checkout и Course исключены\nиз удаления. Квитанции before/after/operations/verified-cleanup сохраняются\nв Core архивном checkpoint до очистки активных исторических документов.\n\nШаг 18: итоговый маршрут подготовлен к проверенной передаче. Последние планы,\nROOT START/AGENTS, root ledger и квитанции сохранены этим Git checkpoint\nдо удаления exact known completed plans/stub/metadata/root snapshots и\nновых датированных completion trees. Текущие контракты остаются в spec/index;\nитоговые факты — docs/releases/2026-10-08-implementation.md. Финальная\nпроверка удаления и ссылок записывается после операции; итоговый docs commit\nи push выполняются после независимого review.\n\nТекущий Course PR #4 OPEN: b6b085cf0541785d11159bd9a106cd131dfabaf0,\nCI 37743840665 SUCCESS, publication SKIPPED. Course docs отсутствует:\n36 файлов сохранены в Git fd62bdb3de1d2c9fce8a51dde9fcb7636e58cb9c\nдо удаления по прямому указанию пользователя. Course не merge/deploy;\nего README, 667 runtime и 43 authored источника не менялись при очистке.\n'''
plans={n:[] for n in H}
for x in M['removals']:
 if x['kind']=='completed-plan-or-transition' and x['relativePath'].startswith('docs/plans/'):
  p=Path(x['path']);assert sha(p.read_bytes())==x['sha256'];t=p.read_text();t=re.sub(r'^(17|18)\. \[ \]',r'\1. [x]',t,flags=re.M);p.write_text(t+append);plans[x['repo']].append(x['relativePath'])
assert sum(map(len,plans.values()))==10
core=B/'quarto-course';a=core/'docs/history/2026-10-08-completion/final-cleanup';a.mkdir()
sources=[Path('/tmp/branch-cleanup-final-20261008')/n for n in ['before.json','after.json','operations.json','verified-cleanup.json']]
sources += [Path('/tmp/execute-step17-20261008.py'),Path('/tmp/step17-dry-run-20261008.py'),Path('/tmp/durable-completion-history-20261008.json'),Path('/tmp/step17-history-gate-20261008.json'),Path('/tmp/implementation-final-preservation-20261008/SOURCE-MAP.json'),B/'START-CODEX.md',B/'AGENTS.md',core/'.superpowers/sdd/2026-10-08-course-tools-implementation/progress.md',core/'.superpowers/sdd/2026-10-08-course-tools-implementation/preparation-state.json',Path('/tmp/cybersecurity-docs-cleanup-20261008/verified-cleanup.json'),Path('/tmp/cybersecurity-docs-cleanup-20261008/verified-pr-ci.json')]
rows=[]
for i,p in enumerate(sources):
 assert p.is_file() and not p.is_symlink(),str(p);b=p.read_bytes();q=a/f'{i:02d}-{p.name}';q.write_bytes(b);rows.append({'source':str(p),'savedPath':q.relative_to(core).as_posix(),'sha256':sha(b),'bytes':len(b)})
dump(a/'SOURCE-MAP.json',{'capturedAt':now,'purpose':'exact archival checkpoint before active historical cleanup','inputs':rows})
(a/'README.md').write_text('Исторический checkpoint перед финальной очисткой. Последние ROOT маршруты, root ledger и exact cleanup17 квитанции сохранены по SOURCE-MAP; текущие правила публикуются отдельно.\n')
# Snapshot the final journal bytes in the same dated tree. Existing first archive stays untouched.
for n,rels in plans.items():
 for rel in rels:
  q=B/n/'docs/history/2026-10-08-completion/final-journals'/Path(rel).name;q.parent.mkdir(exist_ok=True);q.write_bytes((B/n/rel).read_bytes())
commits={};guards=[]
for n,rels in plans.items():
 r=B/n;stage=rels+['docs/history/2026-10-08-completion/final-journals']
 if n=='quarto-course':stage+=['docs/history/2026-10-08-completion/final-cleanup']
 git(r,'add','-f','--',*stage);git(r,'diff','--cached','--check');subprocess.run(['git','-C',str(r),'commit','-m','docs: preserve final journals and cleanup checkpoint'],check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 commits[n]=git(r,'rev-parse','HEAD').decode().strip();assert not git(r,'status','--porcelain').strip(),n
 for rel in rels:
  b=(r/rel).read_bytes();assert git(r,'show',commits[n]+':'+rel)==b;guards.append({'repo':n,'path':rel,'commit':commits[n],'sha256':sha(b)})
 for q in (r/'docs/history/2026-10-08-completion').rglob('*'):
  assert not q.is_symlink(),str(q)
  if q.is_file():assert git(r,'show',commits[n]+':'+q.relative_to(r).as_posix())==q.read_bytes(),str(q)
dump(O/'checkpoint-commits.json',{'at':now,'commits':commits,'journalGuards':guards,'archiveInputs':rows,'localOnly':True,'finalDocumentationChangesNotCommitted':True})
print(json.dumps({'localCheckpointCommits':commits,'journals':len(guards),'newArchiveInputs':len(rows)},ensure_ascii=False))
