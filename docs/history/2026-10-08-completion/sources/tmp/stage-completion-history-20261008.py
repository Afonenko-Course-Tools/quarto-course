import hashlib,json,pathlib,shutil

stage=pathlib.Path('/tmp/implementation-final-preservation-20261008');stage.mkdir(exist_ok=True)
inventory=json.loads(pathlib.Path('/tmp/final-handoff-preservation-prep-20261008/inventory.json').read_text())
inputs={(r['recommendedOwner'],r['path']) for r in inventory['essentialPreservationInputs'] if r['exists']}
core='quarto-course';template='quarto-template-course';base=pathlib.Path('/tmp')
for name in ['core-final-review-20261008','core-bundle-review-20261008','consumers-final-integration-20261008','adapters-final-matrix-20261008','consumer-release-review-20261008','consumer-ci-pin-review-20261008','independent-consumer-releases-20261008','publisher-release-20261008','qrc-release-20261008','release-dependency-staging-20261008']:
    directory=base/name
    for p in directory.glob('*'):
        if p.is_file() and p.suffix in {'.md','.json'} and p.stat().st_size<250000:inputs.add((core,str(p)))
for name in ['template-release-finalize-20261008','template-final-review-20261008','template-main-prepublish-20261008','template-pages-20261008','task-demo-builds-20261008','adapter-demo-builds-20261008','ready-asset-verifier-review-20261008','print-demo-visual-20261008']:
    for p in (base/name).glob('*'):
        if p.is_file() and p.suffix in {'.md','.json'} and p.stat().st_size<250000:inputs.add((template,str(p)))
for name in ['ready-asset-qrc-reveal-guards-20261008.py','ready-asset-cloud-native-guard-20261008.py','ready-asset-qrc-cloud-fix-20261008.md','ready-asset-qrc-reveal-fix-20261008.md','verify-template-pages-20261008.py']:
    inputs.add((template,str(base/name)))
for p in pathlib.Path('/tmp/course-release-20261008/receipts/releases').glob('*/*/*'):
    if p.name in {'RELEASE.json','download-verified.json','published.json'}: inputs.add((p.parents[1].name,str(p)))
for p in pathlib.Path('/tmp/course-release-20261008/receipts/checks').glob('*/verified-demo-checks.json'): inputs.add((p.parent.name,str(p)))
for p in pathlib.Path('/tmp/course-release-20261008/receipts/builds').glob('*/operation-receipt.json'):inputs.add((template,str(p)))
for name in ['all-tools-published-verified.json','all-demo-published-verified.json']:inputs.add((core,str(pathlib.Path('/tmp/course-release-20261008')/name)))
for name in ['core-assignment-fix-20261008','core-assignment-fix-docs-20261008','core-assignment-fix-review-20261008','cybersecurity-link-diagnosis-review-20261008','final-cleanup-execution-prep-20261008','cybersecurity-runtime-review-20261008','cybersecurity-final-author-review-20261008']:
    for p in (base/name).glob('*'):
        if p.is_file() and p.suffix in {'.md','.json'} and p.stat().st_size<250000:inputs.add((core,str(p)))
for name in ['core-patch-release-20261008','template-core-patch-20261008','template-patch-final-review-20261008','template-patch-pages-20261008','template-patch-main-prepublish-20261008','branch-cleanup-final-20261008']:
    for p in (base/name).glob('*'):
        owner=core if name in {'core-patch-release-20261008','branch-cleanup-final-20261008'} else template
        if p.is_file() and p.suffix in {'.md','.json','.py','.patch'} and p.stat().st_size<350000:inputs.add((owner,str(p)))
for p in (base/'core-patch-release-20261008/receipts').rglob('*'):
    if p.is_file() and p.name in {'RELEASE.json','download-verified.json','published.json','operation-receipt.json','verified-demo-checks.json'}:
        inputs.add((core,str(p)))
for name in ['step17-dry-run-20261008.py','execute-step17-20261008.py','stage-completion-history-20261008.py','save-completion-history-20261008.py','commit-course-final-20261008.py','complete-course-history-commit-20261008.py','cleanup-course-docs-20261008.py']:inputs.add((core,str(base/name)))
for name in ['final-history-operation-review-20261008','cybersecurity-core-patch-20261008','cybersecurity-final-gate-review-20261008','cybersecurity-final-patch-author-20261008','cybersecurity-final-author-patch-review-20261008','cybersecurity-final-pr-20261008','cybersecurity-docs-cleanup-20261008','first-final-journals-20261008']:
    for p in (base/name).glob('*'):
        if p.is_file() and p.suffix in {'.md','.json','.py','.ts'} and p.stat().st_size<350000:inputs.add((core,str(p)))
for name in ['afterbody-publicstage-native-proof.json','link-repro-results.json']:inputs.add((core,str(base/'cybersecurity-migration-20261008'/name)))
for name in ['publish-verified-release.py','build-verified-demo.py']:inputs.add((template,str(pathlib.Path('/home/tolya/course-tools/local-tools')/name)))
ledger=pathlib.Path('/home/tolya/course-tools/quarto-course/.superpowers/sdd/2026-10-08-course-tools-implementation')
for p in ledger.glob('*'):
    if p.is_file() and p.suffix in {'.md','.json'}:inputs.add((core,str(p)))
for name in ['START-CODEX.md','AGENTS.md']:inputs.add((core,str(pathlib.Path('/home/tolya/course-tools')/name)))
records=[]
for owner,source in sorted(inputs):
    p=pathlib.Path(source)
    assert p.is_file(),source
    relative=str(p).lstrip('/');target=stage/owner/'sources'/relative
    target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,target)
    records.append({'owner':owner,'source':source,'stagedPath':str(target.relative_to(stage/owner)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size})
(stage/'SOURCE-MAP.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'stagedFiles':len(records),'bytes':sum(r['bytes'] for r in records),'owners':sorted({r['owner'] for r in records})}))
