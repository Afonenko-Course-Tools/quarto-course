#!/usr/bin/env python3
"""Native remote Quarto install of one explicit published tool; every byte checked."""
import argparse, pathlib, json, subprocess, hashlib, tempfile, re
from release_gate import published
O=pathlib.Path(__file__).resolve().parent; B=pathlib.Path('/home/tolya/course-tools')
T=json.loads((O/'tool-tags.json').read_text())
p=argparse.ArgumentParser(); p.add_argument('repo',choices=list(T)); p.add_argument('--sha'); p.add_argument('--execute',action='store_true'); a=p.parse_args(); tag=T[a.repo]
if not a.execute:
 print(json.dumps({'mode':'inspect-no-api-no-install','repo':a.repo,'tag':tag,'command':['quarto','add','Afonenko-Course-Tools/'+a.repo+'@'+tag,'--no-prompt'],'compare':'Every tracked _extensions file byte, path set, installed extension set, no symlinks; Git source at caller SHA, resolved actual immutable release tag equals SHA'},indent=2)); raise SystemExit(0)
if not a.sha: p.error('--sha is required for --execute')
gate=published(a.repo,tag,a.sha); repo=B/a.repo
# Pure source reads; no fetch/tag/checkout/local repository mutations.
listing=subprocess.check_output(['git','ls-tree','-r','-z',a.sha,'--','_extensions'],cwd=repo)
expected={}
for line in listing.split(b'\0'):
 if not line: continue
 attrs,name=line.split(b'\t',1); mode,kind,blob=attrs.decode().split(); path=name.decode()
 if kind!='blob' or mode not in ['100644','100755']: raise ValueError('Unsupported extension symlink/gitlink source '+path)
 parts=path.split('/'); extension=parts[1]; relative='/'.join(parts[2:])
 expected.setdefault(extension,{})[relative]=subprocess.check_output(['git','cat-file','blob',blob],cwd=repo)
if not expected or any('_extension.yml' not in files for files in expected.values()): raise ValueError('Incomplete extension source set')
version=subprocess.check_output(['quarto','--version'],text=True).strip()
if version!='1.11.5': raise ValueError('Expected Quarto 1.11.5, got '+version)
stage=pathlib.Path(tempfile.mkdtemp(prefix=a.repo+'-'+tag+'-',dir=O)); (stage/'_quarto.yml').write_text('project:\n  type: default\n')
proc=subprocess.run(['quarto','add','Afonenko-Course-Tools/'+a.repo+'@'+tag,'--no-prompt'],cwd=stage,capture_output=True,text=True)
(stage/'install.stdout.log').write_text(proc.stdout); (stage/'install.stderr.log').write_text(proc.stderr)
if proc.returncode: raise RuntimeError('Native remote install failed; retained '+str(stage))
base=stage/'_extensions'; actual={}; receipts={}; located=[]
for extension,files in expected.items():
 candidates=[base/extension,base/'Afonenko-Course-Tools'/extension]; candidates=[d for d in candidates if d.is_dir()]
 if len(candidates)!=1: raise ValueError('Expected exactly one actual installed extension namespace for '+extension)
 directory=candidates[0]; located.append(directory); installed={}
 for path in directory.rglob('*'):
  if path.is_symlink(): raise ValueError('Installed symlink '+str(path))
  if path.is_file(): installed[path.relative_to(directory).as_posix()]=path.read_bytes()
 if set(installed)!=set(files): raise ValueError('Installed file path set differs: '+extension+' missing='+str(set(files)-set(installed))+' extra='+str(set(installed)-set(files)))
 for path,data in files.items():
  if installed[path]!=data: raise ValueError('Installed file bytes differ '+extension+'/'+path)
 receipts[extension]={path:hashlib.sha256(data).hexdigest() for path,data in files.items()}
# An unexpected installed extension or foreign file also fails the exact installed tree gate.
covered={path for d in located for path in d.rglob('*') if path.is_file()}
all_files={path for path in base.rglob('*') if path.is_file()}
if covered!=all_files: raise ValueError('Unexpected installed extension/files '+str(all_files-covered))
# Check the tag again after fetching its package to detect any race.
if published(a.repo,tag,a.sha)!=gate: raise ValueError('Release metadata changed during install')
receipt={'gate':gate,'quarto':version,'passed':True,'command':['quarto','add','Afonenko-Course-Tools/'+a.repo+'@'+tag,'--no-prompt'],'source':a.sha,'files':receipts,'fileCount':sum(map(len,receipts.values())),'stage':str(stage)}
(stage/'verified-install.json').write_text(json.dumps(receipt,indent=2)+'\n'); print(json.dumps(receipt,indent=2))
