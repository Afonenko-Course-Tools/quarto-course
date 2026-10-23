import {join} from 'stdlib/path';
import {command,quartoExecutable} from '../_extensions/course-core/infrastructure/process.ts';
const assert=(v:unknown,m:string)=>{if(!v)throw Error(m)};
let api:any;try{api=await import('../_extensions/course-core/infrastructure/owned-config-derive.ts')}catch(e){if(!(e instanceof TypeError))throw e}
assert(typeof api?.deriveExecutionConfig==='function','RED: no closed native-computed input projection');
const root=Deno.env.get('COURSE_CONFIG_DERIVE_ROOT');if(!root)throw Error('Нужен свежий fixture root');await Deno.mkdir(root,{mode:0o700});
const profile='course-export-11111111-1111-4111-8111-111111111111';
let enginePath:string|undefined;
for(const prefix of [false,true]){
 const r=join(root,prefix?'authored-prefix':'automatic-only');await Deno.mkdir(r,{mode:0o700});
 const authored={project:{type:'book','pre-render':'before.ts','post-render':['first.ts','second.ts','third.ts'],resources:['resource.txt'],'execute-dir':'project','lib-dir':'source-libs'},book:{title:'Original title',chapters:['index.qmd']},format:{html:{toc:true},pdf:'default'},course:{id:'derive','custom':'preserved'},...(prefix?{engines:[{path:enginePath}]}:{})};
 const sourceBytes=new TextEncoder().encode(JSON.stringify(authored));await Deno.writeFile(join(r,'_quarto.yml'),sourceBytes,{createNew:true});await Deno.writeTextFile(join(r,'index.qmd'),'# Test\n',{createNew:true});await Deno.writeTextFile(join(r,'resource.txt'),'PUBLIC\n',{createNew:true});
 const evidence=join(r,'_generated/derive-evidence');await Deno.mkdir(evidence,{recursive:true,mode:0o700});await Deno.writeFile(join(evidence,'source-config.raw'),sourceBytes,{createNew:true,mode:0o600});let counter=0;
 const inspect=async(profiles:string[])=>{const raw=await command('timeout',['--signal=TERM','--kill-after=2s','15s',quartoExecutable(),'inspect',r,'--profile',profiles.join(',')],r,{QUARTO_PROFILE:profiles.join(',')});await Deno.writeTextFile(join(evidence,(counter++===0?'source':'execution')+'.json'),raw,{createNew:true,mode:0o600});return JSON.parse(raw)};
 const source=await inspect(['full']);enginePath=source.extensions.flatMap((e:any)=>e.contributes?.engines??[])[0].path;
 const owned={project:{type:'default',render:['index.qmd'],'output-dir':join(r,'_generated/owned-output'),'pre-render':'canonical-pre.ts','post-render':'canonical-post.ts'},course:{id:'derive',view:'full'},'course-export-context':true,format:{json:{}},filters:['course-core'],crossref:{}};
 const result=await api.deriveExecutionConfig(source,owned);
 assert(JSON.stringify(result.config.engines)===JSON.stringify(prefix?[{path:enginePath}]:[]),'authored engine prefix changed');
 assert(!Object.hasOwn(result.config.book,'render')&&JSON.stringify(result.projection.bookRender)===JSON.stringify(source.config.book.render),'computed book.render proof');
 assert(JSON.stringify(result.config.format)===JSON.stringify(source.config.format),'source authored format changed in derived input');
 await Deno.writeTextFile(join(r,'_quarto.yml'),JSON.stringify(result.config));await Deno.writeTextFile(join(r,'_quarto-'+profile+'.yml'),JSON.stringify(owned),{createNew:true});
 const execution=await inspect([profile]);api.assertExecutionMetadata(source,execution,owned,result.projection);
 assert(execution.config.engines.length===(prefix?2:1),'native effective engine multiplicity changed');
 const noSuffix=structuredClone(source);noSuffix.config.engines.pop();if(prefix)noSuffix.config.engines[noSuffix.config.engines.length-1]={path:enginePath+'.FOREIGN'};let rejected=false;try{await api.deriveExecutionConfig(noSuffix,owned)}catch{rejected=true}assert(rejected,'missing suffix accepted');
 const unknown=structuredClone(source);unknown.extensions.push({...unknown.extensions[0],contributes:{engines:[{path:enginePath}]}});rejected=false;try{await api.deriveExecutionConfig(unknown,owned)}catch{rejected=true}assert(rejected,'multiple automatic engine contributions accepted');
 const drift=structuredClone(execution);drift.config.project.resources=[];rejected=false;try{api.assertExecutionMetadata(source,drift,owned,result.projection)}catch{rejected=true}assert(rejected,'nonowned resource loss accepted');
 await Deno.writeTextFile(join(r,'_generated-derivation-observation.json'),JSON.stringify({source:source.config,derived:result.config,projection:result.projection,execution:execution.config},null,2),{createNew:true,mode:0o600});
}
console.log('PASS: stock schema-valid derived input; exact native engine suffix inverse preserves authored identical prefix; effective engines and nonowned metadata; unknown/missing contribution and metadata drift refused.');
