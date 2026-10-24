import {withInspectionWriter,withInspectionSnapshot,inspectionSnapshotData,checkInspectionStore} from '../_extensions/course-core/infrastructure/inspection-preimages.ts';
const assert=(v:unknown,s:string)=>{if(!v)throw Error(s)};
const root=await Deno.makeTempDir({prefix:'inspection-binding-phase-'});let refs:Set<string>;
async function refuse(label:string,value:object){let called=false,rejected=false;try{await withInspectionSnapshot(root,refs,value,async()=>{called=true})}catch(e){assert(String(e).includes('NATIVE.COMMON_PATH_BINDING_INVALID'),String(e));rejected=true}assert(rejected&&!called,'Принято '+label);console.log('REFUSED',label)}
function blocked(label:string,write:()=>unknown){let rejected=false;try{rejected=write()===false}catch(e){assert(e instanceof TypeError,String(e));rejected=true}assert(rejected,'Допущена запись '+label)}
try{
 let ref='';await withInspectionWriter(root,async w=>{ref=await w.append('{"quarto":{"version":"fixture"}}')});refs=new Set([ref]);
 const alias={value:'unchanged'},dictionary=Object.assign(Object.create(null),{plain:true});const binding={plain:{length:3,toJSON:'data'},nested:{alias,list:[alias,1,null]},alias,dictionary};
 let fullSerializations=0,deepImmutable=false;const stringify=JSON.stringify;
 (JSON as any).stringify=function(value:any,...args:any[]){if(value===binding)fullSerializations++;return (stringify as any)(value,...args)};
 try{await withInspectionSnapshot(root,refs,binding,async phase=>{
  deepImmutable=[binding,binding.nested,binding.nested.list,alias,dictionary].every(Object.isFrozen);const before=fullSerializations;
  for(let i=0;i<16;i++)inspectionSnapshotData(phase,root,refs,binding);
  const loopSerializations=fullSerializations-before;
  assert(deepImmutable&&loopSerializations===0,`IMMUTABLE_PHASE_CPU_RED deepImmutable=${deepImmutable} loopWholeSerializations=${loopSerializations}`);
  blocked('root',()=>Reflect.set(binding,'alias',{}));blocked('nested alias',()=>Reflect.set(alias,'value','changed'));blocked('delete',()=>Reflect.deleteProperty(alias,'value'));blocked('defineProperty',()=>Object.defineProperty(alias,'value',{value:'changed'}));blocked('array push',()=>binding.nested.list.push('changed' as any));blocked('array length',()=>Reflect.set(binding.nested.list,'length',0));
  assert(alias.value==='unchanged'&&binding.nested.list.length===3,'Изменился frozen alias');inspectionSnapshotData(phase,root,refs,binding);
 });}finally{(JSON as any).stringify=stringify}
 assert(fullSerializations<=2,'Admission сериализует граф более двух раз');
 for(const value of [null,undefined,1,'root',true])await refuse('nonobject root '+String(value),value as any);
 let getterCalls=0;const getter=Object.defineProperty({},'unsafe',{enumerable:true,get(){getterCalls++;return 1}});await refuse('nested accessor',{nested:getter});assert(getterCalls===0,'Getter был вызван');
 for(const [label,value] of [['Map',new Map()],['Set',new Set()],['Date',new Date()],['typed array',new Uint8Array()],['custom prototype',Object.create({inherited:true})],['function',()=>1],['undefined',undefined],['bigint',1n],['symbol value',Symbol('x')],['NaN',NaN],['Infinity',Infinity]] as const)await refuse(String(label),{nested:value});
 await refuse('symbol key',{[Symbol('x')]:1});await refuse('hidden data',Object.defineProperty({},'hidden',{value:1}));await refuse('sparse array',{array:[,1]});await refuse('array extra property',{array:Object.assign([],{extra:1})});
 const cycle:any={};cycle.back=cycle;await refuse('cycle',{nested:cycle});
 const drifting=new Proxy({value:1},{defineProperty(target,key,d){return Reflect.defineProperty(target,key,{...d,enumerable:false})}});await refuse('descriptor drift during freeze',{nested:drifting});
 const revoked=Proxy.revocable({},{});revoked.revoke();await refuse('revoked reflection',revoked.proxy);
 let deep:any={leaf:true};for(let i=0;i<3000;i++)deep={child:deep};await withInspectionSnapshot(root,refs,deep,async phase=>assert(!!inspectionSnapshotData(phase,root,refs,deep),'Нет valid phase после refusal'));
 assert(Object.keys(await checkInspectionStore(root,refs)).length===1,'Store guard изменился');console.log('PASS immutable JSON DAG, nested write refusal, finite admission, zero accessor serialization, refusal recovery');
}finally{await Deno.remove(root,{recursive:true})}
