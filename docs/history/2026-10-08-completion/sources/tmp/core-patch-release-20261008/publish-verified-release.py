"""One-off 2026-10-08 compact package or producer demos; draft/download/hash then immutable publish."""
from pathlib import Path
import subprocess, json, hashlib, argparse, tempfile, re

BASE=Path('/home/tolya/course-tools');REMOTE='Afonenko-Course-Tools/'
VERSIONS={'quarto-course':'4.0.1','quarto-project-publish':'5.0.0','quarto-reference-catalog':'3.0.0','quarto-course-print':'0.3.0','quarto-course-moodle':'0.3.0','quarto-course-prairielearn':'3.0.0','quarto-course-cloud':'3.0.0','quarto-project-download':'2.0.0'}
GROUPS={'quarto-course':{'core':'course.tar.gz'},'quarto-project-publish':{'composition':'composite-course.tar.gz'},'quarto-reference-catalog':{'qrc':'catalog-cross-project.tar.gz','external':'external-catalog.tar.gz'},'quarto-course-print':{'print':'paper.tar.gz'},'quarto-course-moodle':{'moodle':'moodle-questions.tar.gz'},'quarto-course-prairielearn':{'prairielearn':'java-gradle.tar.gz'},'quarto-course-cloud':{'cloud':'cloud.tar.gz'}}
def require(condition,message):
 if not condition: raise RuntimeError(message)
def run(args,**kwargs): return subprocess.run(args,check=True,**kwargs)
def get(args,**kwargs): return subprocess.check_output(args,text=True,**kwargs).strip()
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def clean(repo,commit):
 require(re.fullmatch('[0-9a-f]{40}',commit),'Caller must supply exact verified lowercase 40-hex SHA')
 require(get(['git','branch','--show-current'],cwd=repo)=='main','Producer must be on main')
 require(get(['git','rev-parse','HEAD'],cwd=repo)==commit,'Build from verified clean merged SHA')
 require(not get(['git','status','--porcelain','--untracked-files=normal'],cwd=repo),'Producer must be clean')
def absent(endpoint):
 result=subprocess.run(['gh','api',endpoint],capture_output=True,text=True)
 if result.returncode==0: raise RuntimeError('Existing tag/release will never be overwritten: '+endpoint)
 require('HTTP 404' in result.stderr,'Could not establish absence: '+result.stderr)
def matching_releases(remote,tag):
 pages=json.loads(get(['gh','api','repos/'+remote+'/releases','--paginate','--slurp']))
 return [release for page in pages for release in page if release.get('tag_name')==tag]
def find_draft(remote,tag,commit):
 matches=matching_releases(remote,tag)
 require(len(matches)==1,'Expected exactly one release with intended draft tag')
 draft=matches[0]
 require(draft.get('draft') is True and draft.get('target_commitish')==commit,'Draft target mismatch')
 draft=json.loads(get(['gh','api','repos/'+remote+'/releases/'+str(draft['id'])]))
 require(draft.get('draft') is True and draft.get('tag_name')==tag and draft.get('target_commitish')==commit,'Draft identity changed')
 return draft
def verify_downloads(remote,draft,assets):
 require(sorted(asset['name'] for asset in draft['assets'])==sorted(f.name for f in assets),'Draft asset set differs')
 with tempfile.TemporaryDirectory(prefix='release-verify-20261008-') as temp:
  for asset in draft['assets']:
   local=next(f for f in assets if f.name==asset['name'])
   require(asset.get('state')=='uploaded' and asset.get('size')==local.stat().st_size,'Draft asset state/size mismatch')
   require(asset.get('digest')=='sha256:'+sha(local),'Draft asset digest mismatch')
   downloaded=Path(temp)/local.name
   with downloaded.open('wb') as stream:
    run(['gh','api','repos/'+remote+'/releases/assets/'+str(asset['id']),'-H','Accept: application/octet-stream'],stdout=stream)
   require(downloaded.stat().st_size==local.stat().st_size and sha(downloaded)==sha(local),'Downloaded hash/size differs: '+local.name)
def main():
 p=argparse.ArgumentParser(description=__doc__)
 p.add_argument('repo',choices=VERSIONS);p.add_argument('tag');p.add_argument('commit',help='Caller verified clean merged main 40-hex SHA')
 p.add_argument('--demo',action='append',default=[],help='Fixed group=ready-web-root (QRC requires qrc and external together)')
 p.add_argument('--verified-demo-checks',type=Path,help='Explicit final local checks receipt JSON; required for demos')
 p.add_argument('--evidence',type=Path,default=Path('/tmp/core-patch-release-20261008/receipts'))
 p.add_argument('--inspect',action='store_true',help='Print fixed operation only; no network or mutations')
 a=p.parse_args();repo=BASE/a.repo;remote=REMOTE+a.repo
 require(re.fullmatch('[0-9a-f]{40}',a.commit),'Invalid verified SHA')
 require(a.tag==('demo-20261008-1' if a.demo else 'v'+VERSIONS[a.repo]),'Tag differs from dated planned operation')
 demos={}
 for value in a.demo:
  group,directory=value.split('=',1);require(group not in demos,'Duplicate demo group');demos[group]=Path(directory).resolve()
 if demos: require(set(demos)==set(GROUPS.get(a.repo,{})),'Supply all fixed producer demo groups together')
 operation={'producer':remote,'tag':a.tag,'commit':a.commit,'kind':'ready-demos' if demos else 'extension','demos':{key:str(value) for key,value in demos.items()},'plannedVersion':VERSIONS[a.repo]}
 if a.inspect: print(json.dumps(operation,indent=2));return
 if demos:
  require(a.verified_demo_checks is not None, 'Supply explicit final local demo checks receipt')
  gates=json.loads(a.verified_demo_checks.read_text())
  require(gates.get('producer')==remote and gates.get('commit')==a.commit and gates.get('sourceDirty') is False, 'Final demo checks provenance mismatch')
  require(set(gates.get('groups',{}))==set(demos), 'Final checks must cover exact producer group set')
 clean(repo,a.commit)
 require(json.loads(get(['gh','api','repos/'+remote+'/immutable-releases'])).get('enabled') is True,'Repository immutable releases must be enabled')
 require(subprocess.run(['git','show-ref','--verify','--quiet','refs/tags/'+a.tag],cwd=repo).returncode==1,'Existing local tag prohibited')
 absent('repos/'+remote+'/git/ref/tags/'+a.tag);absent('repos/'+remote+'/releases/tags/'+a.tag)
 require(not matching_releases(remote,a.tag),'Existing draft/release will never be overwritten')
 out=a.evidence.resolve()/'releases'/a.repo/a.tag
 require(not out.exists(),'Fresh operation evidence required; never overwrite an earlier attempt')
 out.mkdir(parents=True)
 assets=[];provenance={}
 if demos:
  for group,root in demos.items():
   require((root/'index.html').is_file(),'Missing ready index.html')
   build=json.loads((root/'BUILD.json').read_text())
   require(build.get('commit')==a.commit and build.get('sourceDirty') is False,'Demo BUILD must match clean producer SHA')
   require(build.get('producer',build.get('sourceRepository'))==remote,'BUILD producer mismatch')
   # Receipt from the dated native builder, adjacent to group staging, never inside published web root.
   receipt_path=a.evidence.resolve()/'builds'/group/'operation-receipt.json'
   receipt=json.loads(receipt_path.read_text());op=receipt['operation']
   require(op['group']==group and op['producer']==remote and op['commit']==a.commit and Path(receipt['ready']).resolve()==root,'Build receipt differs from fixed producer operation')
   require(receipt['build']==build,'BUILD changed after native verification')
   expected=dict(op['expectedBuildDependencies'])
   if op['kind']=='task': expected['quarto']=op['quarto']
   require(build.get('dependencies')==expected,'BUILD dependencies differ from verified explicit versions')
   for dependency,value in op['releases'].items():
    require(value['tag']=='v'+VERSIONS[dependency],'Receipt contains an old release pin')
    released=json.loads(get(['gh','api','repos/'+REMOTE+dependency+'/releases/tags/'+value['tag']]))
    require(released.get('immutable') is True and released.get('draft') is False and released.get('target_commitish')==value['commit'],'Dependency provenance changed')
   if op['kind']=='script': require(build.get('extensionVersion')==VERSIONS[a.repo],'Own adapter version mismatch')
   require(not any(path.is_symlink() for path in root.rglob('*')),'Ready assets cannot include symlinks')
   files={str(path.relative_to(root)):sha(path) for path in sorted(root.rglob('*')) if path.is_file()}
   require(files==receipt['files'],'Ready content changed since native build verification')
   gate=gates['groups'][group]
   require(gate.get('passed') is True and gate.get('files')==files, 'Final group checks must pass for exact ready file tree')
   require(all(gate.get('checks',{}).get(name) is True for name in ['html','resources','sourceLinks','outputs']), 'Final checks must cover HTML/resources/source links/real outputs')
   archive=out/GROUPS[a.repo][group];run(['tar','-czf',str(archive),'-C',str(root),'.']);assets.append(archive)
   provenance[group]={'nativeBuild':receipt,'finalLocalChecks':gate}
 else:
  descriptors=list((repo/'_extensions').glob('*/_extension.yml'));require(descriptors,'No extension descriptors')
  for descriptor in descriptors:
   match=re.search(r'^version:\s*[\'"]?([0-9]+\.[0-9]+\.[0-9]+)[\'"]?\s*$',descriptor.read_text(),re.M)
   require(match and match.group(1)==VERSIONS[a.repo],'Descriptor version differs from planned release: '+str(descriptor))
  archive=out/(a.repo+'-'+a.tag+'.tar.gz')
  tracked=get(['git','ls-files','README.md','LICENSE','LICENSE.md'],cwd=repo).splitlines()
  run(['git','archive','--format=tar.gz','-o',str(archive),a.commit,'_extensions',*tracked],cwd=repo);assets.append(archive)
  with tempfile.TemporaryDirectory(prefix='extension-package-install-20261008-') as temp:
   run(['quarto','add',str(archive),'--no-prompt'],cwd=temp)
   actual=list(Path(temp).rglob('_extension.yml'));require(len(actual)==len(descriptors),'Installed descriptor count differs')
   for descriptor in descriptors:
    installed=Path(temp)/'_extensions'/descriptor.parent.name/'_extension.yml'
    require(installed.is_file() and installed.read_bytes()==descriptor.read_bytes(),'Installed compact descriptor differs from merged source')
 manifest={**operation,'provenance':provenance,'assets':{f.name:{'sha256':sha(f),'bytes':f.stat().st_size} for f in assets}}
 meta=out/'RELEASE.json';meta.write_text(json.dumps(manifest,indent=2)+'\n');assets.append(meta)
 notes=out/'notes.md';notes.write_text('Verified merged revision `'+a.commit+'`.\n\n'+('Ready HTML, resources and BUILD.json were prepared by native producer commands with exact published immutable releases.\n' if demos else 'Compact extension bundle verified by native quarto add. Ready demos are published separately in demo-20261008-1.\n')+'\nRELEASE.json records SHA-256, size and provenance. Every draft asset is downloaded and hash-verified before immutable publication.\n')
 clean(repo,a.commit)
 # Repeat absence immediately before the first remote mutation; no clobber/update paths exist.
 absent('repos/'+remote+'/git/ref/tags/'+a.tag);absent('repos/'+remote+'/releases/tags/'+a.tag)
 require(not matching_releases(remote,a.tag),'Existing draft/release will never be overwritten')
 latest='false' if demos else 'true'
 run(['gh','release','create',a.tag,*map(str,assets),'--repo',remote,'--target',a.commit,'--draft','--latest='+latest,'--title',a.repo+' '+a.tag,'--notes-file',str(notes)])
 draft=find_draft(remote,a.tag,a.commit)
 require(sorted(asset['name'] for asset in draft['assets'])==sorted(f.name for f in assets),'Draft asset set differs')
 (out/'draft.json').write_text(json.dumps(draft,indent=2)+'\n')
 verify_downloads(remote,draft,assets)
 (out/'download-verified.json').write_text(json.dumps({f.name:{'sha256':sha(f),'bytes':f.stat().st_size} for f in assets},indent=2)+'\n')
 clean(repo,a.commit)
 current=find_draft(remote,a.tag,a.commit);require(current==draft,'Draft metadata changed after download verification')
 require(json.loads(get(['gh','api','repos/'+remote+'/immutable-releases'])).get('enabled') is True,'Immutable releases setting changed')
 absent('repos/'+remote+'/git/ref/tags/'+a.tag)
 run(['gh','api','--method','PATCH','repos/'+remote+'/releases/'+str(draft['id']),'-F','draft=false','-f','make_latest='+latest],stdout=subprocess.DEVNULL)
 release=json.loads(get(['gh','api','repos/'+remote+'/releases/tags/'+a.tag]))
 require(release.get('immutable') is True and release.get('draft') is False,'Immutable publication not confirmed')
 require(release.get('id')==draft['id'] and release.get('tag_name')==a.tag and release.get('target_commitish')==a.commit,'Published source/identity mismatch')
 (out/'published.json').write_text(json.dumps(release,indent=2)+'\n')
 print('PUBLISHED',release['html_url'],flush=True)
if __name__=='__main__': main()
