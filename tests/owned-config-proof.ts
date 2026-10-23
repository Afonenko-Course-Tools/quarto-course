const assert=(v:unknown,m:string)=>{if(!v)throw Error(m)};
let api:any;try{api=await import('../_extensions/course-core/infrastructure/owned-config-proof.ts')}catch(e){if(!(e instanceof TypeError))throw e}
assert(typeof api?.overlayReference==='function','RED: no closed overlay reference validation');
const v={kind:'owned-config-overlay-v1',sourceContext:{sha1:'a'.repeat(40),sha256:'b'.repeat(64)}};
assert(api.overlayReference(v).sourceContext.sha256===v.sourceContext.sha256,'valid private overlay ref');
const reject=(f:()=>unknown,m:string)=>{let bad=false;try{f()}catch{bad=true}assert(bad,m)};
for(const wrong of [null,{},'active',{...v,extra:true},{...v,kind:'old'}, {...v,sourceContext:{...v.sourceContext,file:'foreign.json'}},{...v,sourceContext:{sha1:'a'.repeat(64),sha256:'b'.repeat(64)}},{...v,sourceContext:{sha1:'a'.repeat(40),sha256:'B'.repeat(64)}}])reject(()=>api.overlayReference(wrong),'foreign/extra overlay reference accepted');
assert(api.overlayVersions('course-native-run-pointer-v3','course-common-files-path-binding-v2',v,v,'active')==='active','new active versions');
const restoredRef={file:'owned-export-restored-entry.json',sha1:'c'.repeat(40),sha256:'d'.repeat(64)};
assert(api.overlayVersions('course-native-run-pointer-v3','course-common-files-path-binding-v2',v,v,'restored',restoredRef)==='restored','new restored versions');
for(const args of [['course-native-run-pointer-v2','course-common-files-path-binding-v2',v,v,'active'],['course-native-run-pointer-v3','course-common-files-path-binding-v1',v,v,'active'],['course-native-run-pointer-v3','course-common-files-path-binding-v2',v,{...v,sourceContext:{sha1:'c'.repeat(40),sha256:'d'.repeat(64)}},'active'],['course-native-run-pointer-v3','course-common-files-path-binding-v2',v,v,'complete']])reject(()=>api.overlayVersions(...args),'cross-version/ref/state mismatch accepted');
reject(()=>api.overlayVersions('course-native-run-pointer-v3','course-common-files-path-binding-v2',v,v,'active',restoredRef),'active accepted final ref');
reject(()=>api.overlayVersions('course-native-run-pointer-v3','course-common-files-path-binding-v2',v,v,'restored'),'restored without final ref');
console.log('PASS: closed private overlay ref; exact versions/ref/state; no legacy aliases.');
