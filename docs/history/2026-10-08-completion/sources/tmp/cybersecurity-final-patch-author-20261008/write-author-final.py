from pathlib import Path
from hashlib import sha256
import json,subprocess,datetime,sys
assert sys.argv[1:]==['--execute']
root=Path('/home/tolya/Cybersecurity');prep=Path('/tmp/cybersecurity-final-patch-author-20261008');proof=Path('/tmp/cybersecurity-core-patch-20261008');hist=root/'docs/history/2026-10-08-final-refresh'
digest=lambda b:sha256(b).hexdigest()
g=json.loads((prep/'source-hash-guards.json').read_text());frozen=json.loads((proof/'final-scope-hashes.json').read_text());native=json.loads((proof/'verified-final-native.json').read_text())
assert native['passed'] and native['installedExactFiles']==618 and not native['pendingSessions'];assert len(frozen)==667
assert not subprocess.check_output(['git','diff','--cached','--name-only'],cwd=root).strip()
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()==g['courseHEAD']
for rel,sha in g['sourceGuards'].items():assert digest((root/rel).read_bytes())==sha,rel
for rel,sha in frozen.items():assert digest((root/rel).read_bytes())==sha,rel
for row in g['preservedAuthorFiles']:assert digest((root/row['path']).read_bytes())==row['sha256'],row['path']
assert not hist.exists(),str(hist)
payload=[]
files=['verified-final-native.json','final-scope-hashes.json','installed-exact-byte-proof.json','commands.json','install-command.json','actual-native-link-verified.json','selected-backup-verified.json','student-before-export-hashes.json','authored-inputs-before-final-render.json','report.md','commands.md','native-run.log','cue-validation.log','site.log','student-first.log','full.log','student-after-full.log','native-install.log','selected-backup-export.log']
helpers=['freeze-final-success.py','check-native-link.py','install-core-patch.py','verify-installed.py','probe-native-task.ts','selected-export.py','native-checks.py']
for name in files:
 p=proof/name;raw=p.read_bytes();payload.append(('receipts/'+name,raw,str(p),'final-native-receipt'))
for name in helpers:
 p=proof/name;raw=p.read_bytes();payload.append(('helpers/'+name,raw,str(p),'dated-verification-helper'))
owned=[('README.md','README.new.md'),('docs/plans/2026-10-08-extension-refresh.md','plan.new.md')]
for rel,draft in owned:
 before=(root/rel).read_bytes();after=(prep/draft).read_bytes();assert digest(after)==g['draftHashes'][draft];assert b'{{' not in after
 payload.append(('documents/original/'+rel,before,str(root/rel),'historical-original-doc-snapshot'))
 payload.append(('documents/current/'+rel,after,str(root/rel),'final-current-doc-snapshot'))
rows=[{'path':rel,'source':source,'kind':kind,'bytes':len(raw),'sha256':digest(raw),'historical':kind.endswith('snapshot')} for rel,raw,source,kind in payload]
sourceMap={'type':'historical-evidence-map','status':'historical','createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceCourseHEADBeforeDocWrite':g['courseHEAD'],'nativeFrozenScopeCount':667,'authoredSourceCount':43,'runtimeAuthorFilesUnchanged':True,'records':rows,'durability':'files only; Root must Git-save before claiming durable preservation','snapshotCleanup':'after reachable Git blob equality proof, original/current snapshot copies may be removed from active docs; compact receipts/maps remain without a conflicting normative contract'}
readme='''# Проверки курса 8 октября 2026

Эта папка сохраняет точные native receipts, исходные verification helpers и
SHA256-карту после установки Core 4.0.1 и финального student/full/student/Body
цикла. Она не задаёт нормативный контракт. Правила — в опубликованном
Core v4.0.1 spec/index.md; команды курса — в текущем README.

SOURCE-MAP.json связывает каждый файл с источником и digest. Снимки двух
документов в documents/original и documents/current исторические; после
Git-сохранения Root может убрать их из active docs только после byte-equality
проверки reachable Git blobs. До commit эта папка не является durable Git
историей. Полные native output trees, caches и архивы сюда не копируются.
'''
# No source mutation occurs until all exact guards and complete payload reads pass.
for rel,raw,source,kind in payload:
 target=hist/rel;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(raw)
(hist/'SOURCE-MAP.json').write_text(json.dumps(sourceMap,ensure_ascii=False,indent=2)+'\n');(hist/'README.md').write_text(readme)
for rel,draft in owned:(root/rel).write_bytes((prep/draft).read_bytes())
for rel,sha in frozen.items():assert digest((root/rel).read_bytes())==sha,rel
for row in g['preservedAuthorFiles']:assert digest((root/row['path']).read_bytes())==row['sha256'],row['path']
for row in rows:assert digest((hist/row['path']).read_bytes())==row['sha256']
subprocess.run(['git','diff','--check','--',*[p for p,_ in owned]],cwd=root,check=True)
assert not subprocess.check_output(['git','diff','--cached','--name-only'],cwd=root).strip()
created=[{'path':str(p.relative_to(root)),'bytes':p.stat().st_size,'sha256':digest(p.read_bytes())} for p in sorted(hist.rglob('*')) if p.is_file()]
result={'writtenAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'courseHEADUnchanged':g['courseHEAD'],'ownedDocPaths':[{'path':rel,'beforeSHA256':g['sourceGuards'][rel],'afterSHA256':digest((root/rel).read_bytes())} for rel,_ in owned],'historyRoot':str(hist.relative_to(root)),'historyFiles':created,'historyFileCount':len(created),'historyBytes':sum(p['bytes'] for p in created),'nativeSourceRuntime667Unchanged':True,'authored43Unchanged':True,'installed618Receipt':str(hist.relative_to(root)/Path('receipts/installed-exact-byte-proof.json')),'finalNativeReceipt':str(hist.relative_to(root)/Path('receipts/verified-final-native.json')),'allSavedReceiptAndSnapshotHashesMatch':True,'diffCheck':'PASS','sourceMapSHA256':digest((hist/'SOURCE-MAP.json').read_bytes()),'pendingFields':0,'stagedBeforeAndAfterEmpty':True,'gitAddCommitPushPRMergeDeployPerformed':False,'sourceSetExclusions':'new approved docs/history evidence tree; original 667 runtime/43 author files unchanged','nextGate':'Root independent ultra review of two current docs and preservation scope; Git-save historical snapshots before any exact subsequent active cleanup; then new OPEN PR/CI'}
(prep/'write-final.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k not in ('historyFiles','ownedDocPaths')},ensure_ascii=False,indent=2))
