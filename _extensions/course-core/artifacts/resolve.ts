import {resolve,relative,join,dirname} from 'stdlib/path';
import type {NativeRun} from '../infrastructure/native-run.ts';
import {diagnostic} from '../domain/diagnostics.ts';
import {evaluateResources,projectedResourceUses} from '../infrastructure/resources.ts';
import {command,quartoExecutable} from '../infrastructure/process.ts';
export interface ArtifactRequest {source:string;exerciseId:string;kind?:'starter'|'full'|'conditions'}
export interface ResolvedArtifact {kind:'starter'|'full'|'conditions';projectRoot:string;partition?:'student';files?:{name:string;bytes:Uint8Array}[]}
const attributes=(node:any)=>node.t==='Header'?node.c[1]:['Div','Span','CodeBlock','Code','Link','Image'].includes(node.t)?node.c[0]:undefined;
const field=(node:any,key:string)=>attributes(node)?.[2].find((pair:string[])=>pair[0]===key)?.[1];
const omitted=Symbol('omitted');
function project(value:any):any{
 if(Array.isArray(value))return value.map(project).filter(v=>v!==omitted);
 if(!value||typeof value!=='object')return value;
 const attr=attributes(value),classes=attr?.[1]??[];
 if(attr?.[0]?.startsWith('sol-')||classes.some((c:string)=>['solution','course-answer-solution','grading-notes','answer-spec','answer','project-download','project-download-link'].includes(c)))return omitted;
 if(value.t==='Str'&&value.c.includes('{{<'))throw diagnostic('ARTIFACT.UNRESOLVED_CONDITIONS','Необработанный shortcode в условии');
 if(value.t==='Cite'||value.t==='RawBlock'||value.t==='RawInline')throw diagnostic('ARTIFACT.UNRESOLVED_CONDITIONS','Conditions требует разрешённый native AST');
 const result=Object.fromEntries(Object.entries(value).map(([k,v])=>[k,project(v)]));
 if(attr?.[1]?.includes('correct'))attributes(result)[1]=attr[1].filter((c:string)=>c!=='correct');
 return result;
}
function walk(value:any,visit:(node:any)=>void){if(Array.isArray(value)){value.forEach(v=>walk(v,visit));return;}if(!value||typeof value!=='object')return;visit(value);Object.values(value).forEach(v=>walk(v,visit));}
async function writeHtml(ast:any,cwd:string){
 const child=new Deno.Command(quartoExecutable(),{args:['pandoc','--from','json','--to','html'],cwd,stdin:'piped',stdout:'piped',stderr:'piped'}).spawn();
 const input=child.stdin.getWriter();await input.write(new TextEncoder().encode(JSON.stringify(ast)));await input.close();
 const result=await child.output();if(!result.success)throw diagnostic('ARTIFACT.WRITER_FAILED',new TextDecoder().decode(result.stderr));return new TextDecoder().decode(result.stdout);
}
export async function resolveArtifact(run:NativeRun,request:ArtifactRequest):Promise<ResolvedArtifact>{
 if(run.schema!=='course-native-run-v1'||!run.documents.length)throw diagnostic('ARTIFACT.TRUSTED_RUN_REQUIRED','Требуется текущий NativeRun');
 const doc=run.documents.find(d=>d.source===request.source);
 const fact=doc?.projects?.find(p=>p.exerciseId===request.exerciseId);
 if(!doc||!fact)throw diagnostic('ARTIFACT.PROJECT_MISSING','Проект упражнения отсутствует в текущей модели',{source:request.source,id:request.exerciseId});
 const audience=doc.course.view;
 if(audience!=='student'&&audience!=='full')throw diagnostic('ARTIFACT.AUDIENCE_REQUIRED','NativeRun должен иметь student/full audience');
 const kind=request.kind??(audience==='full'?'full':fact.artifactPolicy.student);
 if(!kind||kind==='full'&&audience==='student'&&!(fact.purpose==='demonstration'&&fact.statementVisibility==='open')||audience==='student'&&fact.statementVisibility!=='open')throw diagnostic('ARTIFACT.ACCESS_DENIED','Комплект недоступен в текущем audience',{source:request.source,id:request.exerciseId});
 const path=resolve(run.projectRoot,fact.projectRoot),location=relative(run.projectRoot,path);
 if(!location||location==='..'||location.startsWith('../')||location.startsWith('..\\'))throw diagnostic('ARTIFACT.PROJECT_OUTSIDE_OWNER','Проект находится вне native owner');
 if(await Deno.realPath(path)!==path)throw diagnostic('ARTIFACT.SYMLINK_FORBIDDEN','Project root не должен содержать symlink');
 if(kind!=='conditions')return {kind,projectRoot:fact.projectRoot,...(kind==='starter'?{partition:'student' as const}:{})};
 if(audience==='student'&&!fact.artifactPolicy.conditions)throw diagnostic('ARTIFACT.ACCESS_DENIED','Условия недоступны');
 const output=join(run.outputDirectory,doc.document.output);
 if(!/\.html$/.test(output)||!run.outputFiles.includes(output))throw diagnostic('ARTIFACT.NATIVE_HTML_REQUIRED','Conditions требуют resolved текущий HTML output');
 // Pandoc reads Quarto's already resolved HTML. Its AST owns nesting/attributes;
 // no authored QMD/include/Cite/shortcode is parsed or copied into the bundle.
 const native=JSON.parse(await command(quartoExecutable(),['pandoc',output,'--from','html','--to','json'],run.projectRoot));
 let selected:any;const preparation:any[]=[];
 walk(native.blocks,node=>{
  if(attributes(node)?.[0]===request.exerciseId)selected=node;
  const dependency=field(node,'data-course-artifact-dependency')??field(node,'course-artifact-dependency');if(dependency==='*'||dependency===request.exerciseId)preparation.push(node);
 });
 if(!selected)throw diagnostic('ARTIFACT.CONDITIONS_MISSING','Native output не содержит условие',{id:request.exerciseId});
 const inside=new Set<any>();walk(selected,node=>inside.add(node));
 const ast={...native,meta:{},blocks:project([...preparation.filter(node=>!inside.has(node)),selected])};
 const files:{name:string;bytes:Uint8Array}[]=[];
 const resources=doc.resources,uses=projectedResourceUses(ast);
 const resourceUses=uses.filter(p=>!p.split(/[?#]/)[0].endsWith('.html'));
 const assets=resources?await evaluateResources({projectRoot:run.projectRoot,facts:[{...resources,rawUses:resourceUses,projectedUses:resourceUses}],selected:resourceUses.map(use=>relative(run.projectRoot,use.startsWith("/")?resolve(run.projectRoot,use.slice(1)):resolve(resources!.effectiveBase,use.split(/[?#]/)[0])))}):{files:[]};
 const replacements=new Map<string,string>();
 for(const asset of assets.files){
  const name='assets/'+asset.target.replace(/^[/\\]+/,'');
  if(name.split('/').includes('..'))throw diagnostic('ARTIFACT.RESOURCE_PATH_INVALID','Unsafe asset target');
  files.push({name,bytes:await Deno.readFile(asset.path)});
  for(const use of resourceUses){const source=use.startsWith('/')?resolve(run.projectRoot,use.slice(1)):resolve(resources!.effectiveBase,use.split(/[?#]/)[0]);if(source===asset.path)replacements.set(use,name);}
 }
 let siteUrl:string|undefined;
 const links:any[]=[];walk(ast,node=>{if(node.t==='Link'||node.t==='Image')links.push(node);});
 for(const node of links){
  const href=node.c[2][0];
  if(replacements.has(href)){node.c[2][0]=replacements.get(href);continue;}
  if(/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(href))continue;
  if(/\.qmd(?:[?#]|$)/.test(href))throw diagnostic('ARTIFACT.SOURCE_LINK_FORBIDDEN','Conditions не должны ссылаться на source QMD');
  if(/\.html(?:[?#]|$)/.test(href)){
   siteUrl??=JSON.parse(await command(quartoExecutable(),['inspect',run.projectRoot],run.projectRoot)).config.website?.['site-url'];
   if(!siteUrl)throw diagnostic('ARTIFACT.SITE_URL_REQUIRED','Для междокументной ссылки conditions требуется website.site-url');
   node.c[2][0]=new URL(href,new URL(dirname(doc.document.output)+'/',siteUrl.endsWith('/')?siteUrl:siteUrl+'/')).href;
  }else throw diagnostic('ARTIFACT.RESOURCE_UNRESOLVED','Conditions содержит неупакованный local href/src: '+href);
 }
 const content=await writeHtml(ast,run.projectRoot);
 files.unshift({name:'index.html',bytes:new TextEncoder().encode('<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>'+request.exerciseId+'</title></head><body>'+content+'</body></html>')});
 return {kind,projectRoot:fact.projectRoot,files};
}
