import {strict as assert} from 'node:assert';
const root=await Deno.makeTempDir(),key=Symbol.for('course.performance.agent.v1');
const registry=globalThis as unknown as Record<symbol,unknown>;
const names=['COURSE_PERF_MODE','QUARTO','COURSE_PERF_PARENT_SPAN_ID'];
const prior=names.map(name=>Deno.env.get(name));
let active:string|undefined;
const observed:any[]=[];
const wrap=(spec:any,value:Function)=>{observed.push(spec);return value};
try {
 Deno.env.set('COURSE_PERF_MODE','summary');Deno.env.set('QUARTO',Deno.execPath());
 Deno.env.set('COURSE_PERF_PARENT_SPAN_ID','stale-inherited');
 registry[key]={abiVersion:1,metrics:{wrapSync:wrap,wrapAsync:wrap,wrapWalk:wrap,childEnv:(base:Record<string,string>)=>{const env={...base};delete env.COURSE_PERF_PARENT_SPAN_ID;if(active)env.COURSE_PERF_PARENT_SPAN_ID=active;return env}}};
 const {command}=await import('../_extensions/course-core/infrastructure/process.ts?context-test');
 const args=['eval',"console.log(JSON.stringify([Deno.env.get('COURSE_PERF_PARENT_SPAN_ID')??null,Deno.env.get('FUNCTIONAL'),Deno.env.get('QUARTO_PROFILE'),Deno.ppid]));"],env={FUNCTIONAL:'keep',QUARTO_PROFILE:'student'};
 active='observed-parent';
 assert.deepEqual(JSON.parse(await command(Deno.execPath(),args,root,env)),['observed-parent','keep','student',Deno.pid]);
 active=undefined;
 assert.deepEqual(JSON.parse(await command(Deno.execPath(),args,root,env)),[null,'keep','student',Deno.pid]);
 assert.deepEqual(env,{FUNCTIONAL:'keep',QUARTO_PROFILE:'student'});
 assert.equal(observed.find(spec=>spec.id==='course-core.infrastructure.process.command').attributes.extension_id,'course-core');
 console.log('PASS actual child parent, stale removal, extension context, functional env');
}finally{
 Reflect.deleteProperty(registry,key);names.forEach((name,i)=>prior[i]===undefined?Deno.env.delete(name):Deno.env.set(name,prior[i]!));await Deno.remove(root,{recursive:true});
}

// Native command inheritance must also work when the parent cannot enumerate env.
const restrictedRoot=await Deno.makeTempDir();
try {
 const entry=restrictedRoot+'/parent.ts';
 const processModule=new URL('../_extensions/course-core/infrastructure/process.ts',import.meta.url).href;
 await Deno.writeTextFile(entry,`import {command} from ${JSON.stringify(processModule)};
 const env={CORE_PERF_OVERRIDE:'explicit'};
 const output=await command('/bin/sh',['-c','printf "%s|%s|%s" "$CORE_PERF_INHERITED" "$CORE_PERF_OVERRIDE" "$QUARTO_PROFILE"'],${JSON.stringify(restrictedRoot)},env);
 if(env.CORE_PERF_OVERRIDE!=='explicit')throw Error('caller env mutated');
 console.log(output);`);
 for(const [mode,permission] of [['summary','--deny-env'],['off','--allow-env=COURSE_PERF_MODE'],['summary','--allow-env=COURSE_PERF_MODE']]){
  const child=await new Deno.Command(Deno.execPath(),{
   args:['run','--no-config','--no-lock','--no-prompt',permission,'--allow-run=/bin/sh',entry],
   env:{COURSE_PERF_MODE:mode,CORE_PERF_INHERITED:'inherited',CORE_PERF_OVERRIDE:'outer',QUARTO_PROFILE:'student'},
   stdout:'piped',stderr:'piped',
  }).output();
  assert(child.success,mode+'/'+permission+': '+new TextDecoder().decode(child.stderr));
  assert.equal(new TextDecoder().decode(child.stdout),'inherited|explicit|student\n');
 }
 console.log('PASS denied env, off and no-agent parents preserve native inheritance and explicit override');
}finally{await Deno.remove(restrictedRoot,{recursive:true})}
