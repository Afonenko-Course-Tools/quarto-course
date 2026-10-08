"""One-off 2026-10-08 producer build; no source rewriting or dependency resolution."""
from pathlib import Path
import subprocess, os, json, argparse, tempfile, re, hashlib

BASE = Path('/home/tolya/course-tools')
REMOTE = 'Afonenko-Course-Tools/'
VERSIONS = {'quarto-course':'4.0.1','quarto-project-publish':'5.0.0','quarto-reference-catalog':'3.0.0','quarto-course-print':'0.3.0','quarto-course-moodle':'0.3.0','quarto-course-prairielearn':'3.0.0','quarto-course-cloud':'3.0.0','quarto-project-download':'2.0.0'}
NAMES = {'quarto-course':['course-core','course-presentation','course-navigation'],'quarto-project-publish':['course-site'],'quarto-reference-catalog':['reference-catalog'],'quarto-course-print':['course-print'],'quarto-course-moodle':['course-moodle'],'quarto-course-prairielearn':['course-prairielearn'],'quarto-course-cloud':['course-cloud']}
# Fixed native producer operations: paths, dependency locations, BUILD version spelling.
SPECS = {
 'core':('quarto-course','examples/course','_book-full','task',[('.', 'quarto-course'),('slides','quarto-course')]),
 'composition':('quarto-project-publish','examples/course','_site','task',[('.','quarto-project-publish'),('.','quarto-reference-catalog'),('book','quarto-reference-catalog'),('materials','quarto-reference-catalog')]),
 'qrc':('quarto-reference-catalog','examples/course','_site','task',[('.','quarto-reference-catalog'),('.','quarto-project-publish'),('book','quarto-reference-catalog'),('lectures','quarto-reference-catalog'),('practice','quarto-reference-catalog')]),
 'external':('quarto-reference-catalog','examples/external','_site','task',[('.','quarto-reference-catalog')]),
 'print':('quarto-course-print','examples/paper','_site','script',[('bank','quarto-course'),('.','quarto-course-print')]),
 'moodle':('quarto-course-moodle','examples/questions','_site','script',[('bank','quarto-course'),('.','quarto-course-moodle')]),
 'prairielearn':('quarto-course-prairielearn','examples/java-gradle','_site','script',[('bank','quarto-course'),('bank','quarto-course-prairielearn')]),
 'cloud':('quarto-course-cloud','examples/course','_book/full','script',[('.','quarto-course'),('.','quarto-course-cloud')]),
}
def require(condition, message):
 if not condition: raise RuntimeError(message)
def get(args, **kwargs): return subprocess.check_output(args, text=True, **kwargs).strip()
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def clean(repo, commit):
 require(re.fullmatch('[0-9a-f]{40}', commit), 'Caller must supply verified full lowercase SHA')
 require(get(['git','branch','--show-current'],cwd=repo)=='main', 'Producer must be on main')
 require(get(['git','rev-parse','HEAD'],cwd=repo)==commit, 'Producer HEAD differs from verified SHA')
 require(not get(['git','status','--porcelain','--untracked-files=normal'],cwd=repo), 'Producer must be clean')
def descriptor_version(path):
 match=re.search(r'^version:\s*[\'"]?([0-9]+\.[0-9]+\.[0-9]+)[\'"]?\s*$',path.read_text(),re.M)
 require(match, 'No plain semver descriptor: '+str(path)); return match.group(1)
def main():
 p=argparse.ArgumentParser(description=__doc__)
 p.add_argument('group',choices=SPECS);p.add_argument('commit',help='Verified clean merged main 40-hex SHA')
 p.add_argument('--release',action='append',required=True,help='Explicit published dependency repo=vX.Y.Z@40hexSHA (repeat, include producer)')
 p.add_argument('--quarto-version',required=True,help='Exact tested quarto --version output')
 p.add_argument('--evidence',type=Path,default=Path('/tmp/core-patch-release-20261008/receipts'))
 p.add_argument('--inspect',action='store_true',help='Print fixed operation only; performs no build/network/mutation')
 a=p.parse_args();owner,folder,output,kind,installs=SPECS[a.group]
 refs={}
 for value in a.release:
  match=re.fullmatch(r'(quarto-[a-z-]+)=(v[0-9]+\.[0-9]+\.[0-9]+)@([0-9a-f]{40})',value)
  require(match, 'Invalid --release: '+value);repo,tag,commit=match.groups()
  require(repo in VERSIONS and tag=='v'+VERSIONS[repo], 'Unexpected planned release: '+value)
  require(repo not in refs, 'Duplicate --release');refs[repo]={'tag':tag,'commit':commit}
 needed={repo for _,repo in installs}
 require(set(refs)==needed, 'Supply exact release set: '+', '.join(sorted(needed)))
 require(re.fullmatch('[0-9a-f]{40}',a.commit), 'Invalid producer SHA')
 require(refs[owner]['commit']==a.commit, 'Own release SHA must equal clean producer SHA')
 deps={repo:('v' if kind=='task' else '')+VERSIONS[repo] for repo in needed if kind=='task' or repo!=owner}
 operation={'group':a.group,'producer':REMOTE+owner,'commit':a.commit,'folder':folder,'output':output,'kind':kind,'installs':installs,'releases':refs,'expectedBuildDependencies':deps,'expectedExtensionVersion':None if kind=='task' else VERSIONS[owner],'quarto':a.quarto_version}
 if a.inspect: print(json.dumps(operation,indent=2));return
 producer=BASE/owner;clean(producer,a.commit)
 require(get(['quarto','--version'])==a.quarto_version, 'Quarto version differs from verified caller version')
 # Never accept absent, draft or mutable release dependencies; record actual responses.
 published={}
 for repo,ref in refs.items():
  release=json.loads(get(['gh','api','repos/'+REMOTE+repo+'/releases/tags/'+ref['tag']]))
  require(release.get('immutable') is True and release.get('draft') is False, 'Dependency must be published immutable: '+repo)
  require(release.get('target_commitish')==ref['commit'],'Published dependency SHA differs: '+repo)
  published[repo]=release
 stage=a.evidence.resolve()/'builds'/a.group
 require(not stage.exists(),'Fresh staging required; preserve earlier receipts')
 stage.mkdir(parents=True)
 with tempfile.NamedTemporaryFile(suffix='.tar') as source:
  subprocess.run(['git','archive','--format=tar','-o',source.name,a.commit,folder],cwd=producer,check=True)
  subprocess.run(['tar','-xf',source.name,'--strip-components=2','-C',str(stage)],check=True)
 require(not (stage/'.git').exists(), 'Source archive must not be a Git checkout')
 env=dict(os.environ,DEMO_SOURCE_COMMIT=a.commit,DEMO_SOURCE_DIRTY='false',XDG_CACHE_HOME=str(a.evidence.resolve()/'cache'/a.group),DENO_DIR=str(a.evidence.resolve()/'deno'),CUE=str(BASE/'local-tools/cue/cue'))
 def run(args,cwd=stage): subprocess.run(args,cwd=cwd,env=env,check=True)
 if kind=='task':
  task=stage/'Taskfile.yml'
  actual=re.findall(r'quarto add '+re.escape(REMOTE)+r'(quarto-[a-z-]+)@(v[0-9]+\.[0-9]+\.[0-9]+) --no-prompt',task.read_text())
  require(len(actual)==len(installs) and sorted(actual)==sorted((repo,refs[repo]['tag']) for _,repo in installs),'Producer Taskfile pins differ from fixed release operation')
  run([str(BASE/'local-tools/task/task'),'install'])
 else:
  for directory,repo in installs: run(['quarto','add',REMOTE+repo+'@'+refs[repo]['tag'],'--no-prompt'],stage/directory)
 installed={}
 for directory,repo in installs:
  for name in NAMES[repo]:
   candidates=[stage/directory/'_extensions'/name/'_extension.yml',stage/directory/'_extensions'/'Afonenko-Course-Tools'/name/'_extension.yml']
   found=[path for path in candidates if path.is_file()]
   require(len(found)==1,'Installed namespace missing or ambiguous: '+directory+'/'+name)
   require(descriptor_version(found[0])==VERSIONS[repo], 'Installed descriptor version differs: '+str(found[0]))
   installed[str(found[0].relative_to(stage))]={'sha256':sha(found[0]),'version':VERSIONS[repo]}
 run([str(BASE/'local-tools/task/task'),'render'] if kind=='task' else ['quarto','run','build.ts'])
 ready=stage/output;build=json.loads((ready/'BUILD.json').read_text())
 require(build.get('commit')==a.commit and build.get('sourceDirty') is False,'BUILD provenance differs from verified clean producer')
 require(build.get('producer',build.get('sourceRepository'))==REMOTE+owner,'BUILD producer differs')
 expected=dict(deps)
 if kind=='task': expected['quarto']=a.quarto_version
 require(build.get('dependencies')==expected,'BUILD dependencies must match exact producer spelling and current installed versions')
 if kind=='script': require(build.get('extensionVersion')==VERSIONS[owner],'BUILD own extensionVersion differs')
 require((ready/'index.html').is_file(), 'Native producer did not generate ready index.html')
 clean(producer,a.commit)
 require(not any(path.is_symlink() for path in ready.rglob('*')), 'Ready assets must not contain symlinks')
 files={str(path.relative_to(ready)):sha(path) for path in sorted(ready.rglob('*')) if path.is_file()}
 receipt={'files':files,'operation':operation,'publishedDependencies':published,'installedDescriptors':installed,'build':build,'ready':str(ready)}
 (stage/'operation-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
 print('READY',a.group,a.commit,ready,flush=True)
if __name__=='__main__': main()
