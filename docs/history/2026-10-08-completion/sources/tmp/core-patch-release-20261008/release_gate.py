"""Dated operation gate, explicit caller-provided repo/tag/SHA only."""
import json, re, subprocess

def api(endpoint):
    p=subprocess.run(['gh','api',endpoint],capture_output=True,text=True,check=True)
    return json.loads(p.stdout)

def published(repo,tag,sha):
    if not re.fullmatch(r'[0-9a-f]{40}',sha):
        raise ValueError('Expected exact lowercase 40-hex release SHA')
    base='repos/Afonenko-Course-Tools/'+repo
    release=api(base+'/releases/tags/'+tag)
    if release.get('tag_name')!=tag or release.get('draft') is not False or release.get('prerelease') is not False or release.get('immutable') is not True or not release.get('published_at'):
        raise ValueError('Expected published immutable stable exact release')
    if release.get('target_commitish')!=sha:
        raise ValueError('Release target_commitish does not equal caller supplied exact SHA')
    ref=api(base+'/git/ref/tags/'+tag)['object']
    for _ in range(4):
        if ref['type']=='commit': break
        if ref['type']!='tag': raise ValueError('Unexpected tag target')
        ref=api(base+'/git/tags/'+ref['sha'])['object']
    if ref['type']!='commit' or ref['sha']!=sha:
        raise ValueError('Resolved actual remote tag does not equal caller SHA')
    return {'repo':repo,'tag':tag,'sha':sha,'releaseId':release['id'],'immutable':True,'publishedAt':release['published_at']}
