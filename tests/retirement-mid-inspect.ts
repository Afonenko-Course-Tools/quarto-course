import {readCommonPathBinding} from '../_extensions/course-core/infrastructure/common-path-binding.ts';
export async function checkMidInspect(root:string,out:string){await Deno.mkdir(out,{recursive:true});
const p=JSON.parse(await Deno.readTextFile(root+'/_generated/course-spec/active-native-run.json')),native=JSON.parse(await Deno.readTextFile(p.directory+'/native-run.json'));
const originalQuarto=Deno.env.get('QUARTO')||'/usr/bin/quarto',control=out+'/control.json',wrapper=out+'/quarto-wrapper',script=out+'/quarto-wrapper.mjs';
await Deno.writeTextFile(script,`const f=${JSON.stringify(control)};const c=JSON.parse(await Deno.readTextFile(f));if(Deno.args[0]==='inspect'&&!c.triggered){c.triggered=true;if(c.mode==='document'){const j=JSON.parse(await Deno.readTextFile(c.path));j.course.id+='-MID_INSPECT';await Deno.writeTextFile(c.path,JSON.stringify(j))}else await Deno.rename(c.path,c.path+'.held');await Deno.writeTextFile(f,JSON.stringify(c))}const r=await new Deno.Command(${JSON.stringify(originalQuarto)},{args:Deno.args,stdin:'inherit',stdout:'inherit',stderr:'inherit'}).spawn().status;Deno.exit(r.code);`);
const quote=(s:string)=>"'"+s.replaceAll("'","'\\''")+"'";
await Deno.writeTextFile(wrapper,'#!/bin/sh\nexec '+quote(Deno.execPath())+' run --allow-all --no-config '+quote(script)+' "$@"\n',{mode:0o700});await Deno.chmod(wrapper,0o700);
const paths={document:p.directory+'/documents/'+[...Deno.readDirSync(p.directory+'/documents')][0].name,output:native.outputFiles[0]},results=[];
for(const mode of ['document','output'] as const){const path=paths[mode],before=await Deno.readFile(path);await Deno.writeTextFile(control,JSON.stringify({mode,path,triggered:false}));Deno.env.set('QUARTO',wrapper);let accepted=false,error='';try{await readCommonPathBinding(p);accepted=true}catch(e){error=String(e)}finally{Deno.env.set('QUARTO',originalQuarto);if(mode==='output'){try{await Deno.rename(path+'.held',path)}catch{}}await Deno.writeFile(path,before)}const triggered=JSON.parse(await Deno.readTextFile(control)).triggered;results.push({mode,path,triggered,accepted,error,restored:JSON.stringify([...await Deno.readFile(path)])===JSON.stringify([...before])});console.log(JSON.stringify(results.at(-1)))}
await readCommonPathBinding(p);console.log('RESTORED_POSITIVE');await Deno.writeTextFile(out+'/result.json',JSON.stringify({results,restoredPositive:true},null,2)+'\n');

if(results.some(r=>!r.triggered||r.accepted||!r.restored||!r.error.includes('NATIVE.')))throw Error('Mid-inspect mutation не отвергнута');return results;
}
if(import.meta.main)await checkMidInspect(Deno.args[0],Deno.args[1]);
