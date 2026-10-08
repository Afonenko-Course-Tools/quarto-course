import type { AssessmentComposition, DocumentResult, ExerciseDeclaration } from "../domain/model.ts";
import type { NativeRun } from "../infrastructure/native-run.ts";
import { resolve } from "stdlib/path";
export function assessmentTime(work:AssessmentComposition,facts:Map<string,ExerciseDeclaration>) {
  if(work.items.some(id=>!facts.has(id)))return undefined;
  let required=0,all=0;
  for(const id of work.items){const time=facts.get(id)!.time;all+=time;if(work.assignments[id].requirement==="required")required+=time;}
  const theory=work.theoryTime??0;
  return {required,all,theory,sessionRequired:required+theory,sessionAll:all+theory};
}
function projection(value:any,facts:Map<string,ExerciseDeclaration>):any {
  if(Array.isArray(value))return value.map(v=>projection(v,facts)).filter(v=>v!==undefined);
  if(!value||typeof value!=="object")return value;
  if(value.t==="RawBlock"&&value.c?.[0]==="html"&&value.c[1]?.startsWith("<!--course-assignment:"))return undefined;
  if(value.t==="Div"&&value.c?.[0]?.[1]?.includes("task-items")){
    const copy=structuredClone(value);
    for(const list of copy.c[1]){
      if(!["OrderedList","BulletList"].includes(list.t))continue;
      const index=list.t==="OrderedList"?1:0,items=list.t==="OrderedList"?list.c[1]:list.c;
      const kept=items.filter((item:any)=>{
        let member:string|undefined;
        const walk=(node:any)=>{
          if(Array.isArray(node))node.forEach(walk);
          else if(node&&typeof node==="object"){
            if(node.t==="Cite")member=node.c[0]?.[0]?.citationId;
            if(node.t==="Link")member=node.c[2]?.[0]?.split("#")[1]??member;
            Object.values(node).forEach(walk);
          }
        };walk(item);
        return member&&facts.get(member)?.statementVisibility==="open";
      });
      if(index)list.c[index]=kept;else list.c=kept;
    }
    return Object.fromEntries(Object.entries(copy).map(([k,v])=>[k,projection(v,facts)]));
  }
  return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,projection(v,facts)]));
}
function cleanBodies(doc:DocumentResult,facts:Map<string,ExerciseDeclaration>){
  const body=(value:string)=>JSON.stringify(projection(JSON.parse(value),facts));
  const work=(value:DocumentResult["assessment"])=>{
    if(!value)return value;
    const items=value.items.filter(id=>facts.get(id)?.statementVisibility==="open");
    if(!items.length)return null;
    return {...value,items,memberSizes:items.map(()=>1),assignments:Object.fromEntries(items.map(id=>[id,value.assignments[id]])),bodyJson:body(value.bodyJson)};
  };
  doc.assessment=work(doc.assessment);
  if(doc.body)doc.body.publicAssessment=work(doc.body.publicAssessment);
  for(const e of [...doc.exercises,...doc.body?.publicExercises??[]])e.bodyJson=body(e.bodyJson);
  for(const element of doc.pedagogy?.elements??[])element.bodyJson=body(element.bodyJson);
}
export async function finalizeAssessmentPreview(run:NativeRun){
  const facts=new Map(run.documents.flatMap(doc=>(doc.declarations??[]).map(fact=>[fact.id,fact] as const)));
  for(const doc of run.documents){
    const work=doc.rawAssessment;
    if(doc.course.view==="student")cleanBodies(doc,facts);
    if(!/\.html?$/i.test(doc.document.output))continue;
    const path=resolve(run.outputDirectory,doc.document.output);
    let html=await Deno.readTextFile(path);
    // Delimiters are produced by Core around native-rendered assignment content.
    // Keep Quarto's exact link markup; no HTML parser or synthesized address.
    html=html.replace(/<!--course-assignment:(exr-[a-z0-9-]+):start-->([\s\S]*?)<!--course-assignment:\1:end-->/g,(_match,id,content)=>facts.get(id)?.statementVisibility==="open"?content:'<span class="course-assignment-omitted"></span>');
    if(work){
      const time=assessmentTime(work,facts);
      if(time){
        const marker='<!--course-assessment-time-->';
        const text=`<aside class="course-assessment-time" data-course-assessment-time="ready">Задачи: обязательные ${time.required} мин; все ${time.all} мин. Теория: ${time.theory} мин. Занятие: обязательные ${time.sessionRequired} мин; все ${time.sessionAll} мин.</aside>`;
        html=html.replace(marker,text);
      }else html=html.replace('<!--course-assessment-time-->','');
    }
    await Deno.writeTextFile(path,html);
  }
}
