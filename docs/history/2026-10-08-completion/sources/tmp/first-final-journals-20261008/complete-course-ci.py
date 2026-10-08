from pathlib import Path
from hashlib import sha256
import json,re,subprocess,datetime
base=Path('/home/tolya/course-tools');out=Path('/tmp/first-final-journals-20261008');receipt=Path('/tmp/cybersecurity-final-pr-20261008/verified-pr-ci.json');ci=json.loads(receipt.read_text());assert ci['state']=='OPEN' and ci['ciConclusion']=='success' and ci['courseHead']=='fd62bdb3de1d2c9fce8a51dde9fcb7636e58cb9c' and ci['courseCIRun']==37742519419 and not ci['courseMergeDeployPerformed']
scope=json.loads((out/'scopehash.json').read_text());sha=lambda raw:sha256(raw).hexdigest()
for row in scope['paths']:
 p=base/row['repo']/row['relativePath'];assert sha(p.read_bytes())==row['afterSHA256'];s=p.read_text()
 s=s.replace('Course PR#4 OPEN/CI IN_PROGRESS','Course PR#4 OPEN/CI SUCCESS').replace('IN_PROGRESS — '+ci['ciURL'],'SUCCESS — '+ci['ciURL'])
 s=s.replace('[Required CI 37742519419]('+ci['ciURL']+') **IN_PROGRESS**; успех ещё не заявляется,\nпоэтому checkbox16 остаётся pending.', '[Required CI 37742519419]('+ci['ciURL']+') **SUCCESS** на exact head\nfd62bdb3de1d2c9fce8a51dde9fcb7636e58cb9c; публикационный uploader student\nSKIPPED, merge/deploy не выполнялись. Шаг16 выполнен.')
 if row['relativePath'].endswith('course-tools-implementation.md'):
  s=s.replace('Дата: 8 октября 2026. Статус: шаги12–15 выполнены; новый Course PR#4 OPEN,\nrequired CI выполняется. Шаг16 ожидает CI; шаги17–18 ещё не завершены.','Дата: 8 октября 2026. Статус: шаги12–16 выполнены; новый Course PR#4 OPEN,\nrequired CI SUCCESS на exact head. Шаги17–18 ещё не завершены.')
  s,n=re.subn(r'^16\. \[ \]','16. [x]',s,count=1,flags=re.M);assert n==1
  s=s.replace('Новый Course PR#4 OPEN; required CI IN_PROGRESS,16 ещё pending;17–18 ожидаются.','Новый Course PR#4 OPEN; required CI SUCCESS на exact head,16 выполнен;17–18 ожидаются.')
 s+='\nПодтверждение07:23 UTC: Course PR#4 остаётся OPEN; CI37742519419 completed SUCCESS\nна headfd62bdb3de1d2c9fce8a51dde9fcb7636e58cb9c. Exact receipt: '+str(receipt)+'.\nШаг16 выполнен;17–18 ещё pending.\n'
 assert 'IN_PROGRESS' not in s and 'checkbox16 остаётся pending' not in s
 p.write_text(s);row['afterSHA256']=sha(p.read_bytes())
for repo in sorted({r['repo'] for r in scope['paths']}):
 allowed={r['relativePath'] for r in scope['paths'] if r['repo']==repo};actual=set(subprocess.check_output(['git','diff','--name-only'],cwd=base/repo,text=True).splitlines());assert actual==allowed
 assert not subprocess.check_output(['git','diff','--cached','--name-only'],cwd=base/repo).strip();subprocess.run(['git','diff','--check','--',*sorted(allowed)],cwd=base/repo,check=True)
scope.update({'finalCIUpdatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'courseCI':{'run':37742519419,'url':ci['ciURL'],'state':'SUCCESS','verifiedExactHead':ci['courseHead']},'courseCIReceipt':str(receipt),'courseCIReceiptSHA256':sha(receipt.read_bytes()),'globalStepCheckboxes':{'12':True,'13':True,'14':True,'15':True,'16':True,'17':False,'18':False},'nextGate':'Root durable nine-owner history commit/push, then actual17 cleanup and18 final docs handoff'})
(out/'scopehash.json').write_text(json.dumps(scope,ensure_ascii=False,indent=2)+'\n')
(out/'report.md').write_text('''# First final owner/global journals

Authorized exact ten files written: nine owner docs/plans/2026-10-08-implementation.md plus Core global docs/plans/2026-10-08-course-tools-implementation.md. Source originals are copied under current-source; exact before/after SHA/HEAD guards are in scopehash.json.

All nine primary owners were clean main with local HEAD/origin equal their actual released source SHA (Core a9a439, Template52316a; other seven published tool SHA) immediately before writing. Only the authorized ten plan files differ afterward. Runtime/README/index/assets/extra worktrees/Course files and all Git refs remain untouched. Scoped whitespace check PASS; staging empty; no commit/push.

Journals contain exact own tool/demo/tag/mainCI/installed/native facts, Core4.0.1/demo-20261008-1, Template PR19/main52316a762da3a9c054b5ac6a7a89620e46c7c150/gh-pages8dc11b599406f65af420aef39babdb15375df61b/native/live proof, Course native618/final cycle/Body and real OPEN PR4. Actual CI37742519419 completed SUCCESS on exact Course headfd62bdb3de1d2c9fce8a51dde9fcb7636e58cb9c, uploader student SKIPPED, no merge/deploy. Exact primary receipt: /tmp/cybersecurity-final-pr-20261008/verified-pr-ci.json.

Global12–16 checkboxes complete;17–18 remain pending. No durable nine-owner preservation or branch cleanup is claimed. Root can now save latest journals plus receipts in reachable owner Git before the exact cleanup/removal sequence.
''')
# Fill only tmp final-report/journal fields; owner final18 files remain untouched.
drafts=Path('/tmp/final-completion-write-20261008')
for p in drafts.rglob('*.md'):
 if 'current-source' in p.parts:continue
 s=p.read_text();s=s.replace('{{COURSE_NEW_OPEN_PR_URL}}',ci['prURL']).replace('{{COURSE_FINAL_HEAD}}',ci['courseHead']).replace('{{COURSE_FINAL_CI_RESULT}}','SUCCESS — '+ci['ciURL']);s=s.replace('Новый OPEN PR/head/required CI ещё ожидаются.','Новый PR#4 OPEN; exact headfd62bdb3de1d2c9fce8a51dde9fcb7636e58cb9c, CI37742519419 SUCCESS.');s=s.replace('Actual OPEN PR/CI ещё ожидаются.','Actual PR#4 OPEN; exact headfd62bdb3de1d2c9fce8a51dde9fcb7636e58cb9c и CI37742519419 SUCCESS.');p.write_text(s)
m=json.loads((drafts/'execution-manifest.json').read_text());m['courseFinalPRCI']={'URL':ci['prURL'],'head':ci['courseHead'],'CIURL':ci['ciURL'],'conclusion':'SUCCESS','state':'OPEN','mergeDeploy':False};m['pending']=[x for x in m['pending'] if not x.startswith('new OPEN Cybersecurity')]
for w in m['writes']:w['draftSHA256']=sha(Path(w['draftPath']).read_bytes())
# Latest ten plans must be preserved and later removed using final current bytes.
for r in m['removals']:
 if r['kind']=='completed-plan-or-transition':
  p=Path(r['path']);r['sha256']=sha(p.read_bytes());r['bytes']=p.stat().st_size
(drafts/'execution-manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
pending={}
for p in drafts.rglob('*.md'):
 if 'current-source' in p.parts:continue
 tokens=sorted(set(re.findall(r'\{\{[A-Z0-9_]+\}\}',p.read_text())))
 if tokens:pending[str(p.relative_to(drafts))]=tokens
(drafts/'pending-fields.json').write_text(json.dumps(pending,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'tenPlanFilesWritten':10,'onlyAuthorizedDelta':True,'diffCheck':'PASS','courseCI':'SUCCESS','global12to16':True,'global17and18':False,'committed':False}))
