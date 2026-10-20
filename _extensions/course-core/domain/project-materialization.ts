import type {Fragment,ProjectFact,ProjectMaterialization} from './model.ts';
import {diagnostic} from './diagnostics.ts';

/** Resolve effective metadata against the whole owner, never one QMD alone. */
export function bindProjectMaterializations(documents:Pick<Fragment,'source'|'projects'|'projectMaterializations'>[]):ProjectFact[]{
 const fail=(message:string):never=>{throw diagnostic('CORE.PROJECT_MATERIALIZATION_INVALID',message)};
 const declarations=new Map<string,ProjectMaterialization>();
 const stable=(value:unknown):string=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
 for(const document of documents){
  for(const [id,value] of Object.entries(document.projectMaterializations??{})){
   if(declarations.has(id)&&stable(declarations.get(id))!==stable(value))fail('Несогласованные materialization declarations: '+id);
   declarations.set(id,value);
  }
 }
 const facts=documents.flatMap(d=>d.projects??[]).map(f=>({...f}));
 for(const [id,value] of declarations){
  const matches=facts.filter(f=>f.exerciseId===id);
  if(matches.length!==1)fail('Materialization требует ровно один действующий project: '+id);
  const fact=matches[0];
  if(fact.materialization&&stable(fact.materialization)!==stable(value))fail('Project fact расходится с captured declaration: '+id);
  fact.materialization=value;
 }
 return facts;
}
