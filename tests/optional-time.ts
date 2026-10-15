import { assembleRelease } from "../_extensions/course-core/domain/release.ts";
import { assessmentTime } from "../_extensions/course-core/entrypoints/preview.ts";
import { validateRelease } from "../_extensions/course-core/infrastructure/validate.ts";
import type { DocumentResult } from "../_extensions/course-core/domain/model.ts";
const assert=(value:unknown,message:string)=>{if(!value)throw Error(message)};
const body=JSON.stringify({"pandoc-api-version":[1,23,1],meta:{},blocks:[]});
function document(time:unknown):DocumentResult {
 const exercise:any={id:"exr-first",target:"manual",project:"",difficulty:"introductory",statementVisibility:"open",hasSolution:false,hasPublicSolution:false,head:{kind:"Header",level:2,title:"Условие"},nested:0,unknownAttributes:[],bodyJson:body};
 if(time!==undefined)exercise.time=time;
 return {scope:"document",source:"bank.qmd",course:{id:"optional-time",view:"student"},document:{source:"bank.qmd",format:"html",output:"bank.html",profiles:["student"]},exercises:[exercise]};
}
const release=(time:unknown)=>assembleRelease(["bank.qmd"],[document(time)],[],{view:"student",profiles:["student"]});
const temp=await Deno.makeTempDir();
let failures=0;
async function test(name:string,fn:()=>unknown){try{await fn();console.log("PASS "+name)}catch(e){failures++;console.error("FAIL "+name+": "+e)}}
await test("Отсутствующая difficulty по-прежнему отвергается",()=>{const doc=document(undefined);delete (doc.exercises[0] as any).difficulty;let error;try{assembleRelease(["bank.qmd"],[doc],[],{view:"student",profiles:["student"]})}catch(e){error=e}assert(String(error).includes("CORE.METADATA_INVALID"),"Принято отсутствие difficulty")});
await test("Отсутствующая оценка сохраняется отсутствующей в release и CUE",async()=>{
 const result=release(undefined);assert(result.model.exercises[0].time===undefined,"Возникла вымышленная оценка");
 await validateRelease(result,temp);
 const fallback=structuredClone(result);delete fallback.model.declarations;await validateRelease(fallback,temp);
});
await test("Положительная оценка проходит без изменения",async()=>{const result=release(15);assert(result.model.exercises[0].time===15,"Оценка изменена");await validateRelease(result,temp)});
await test("Некорректные заданные оценки отвергаются release",()=>{for(const time of [0,-1,1.5,"15",null,Infinity,NaN]){let error;try{release(time)}catch(e){error=e}assert(String(error).includes("CORE.METADATA_INVALID"),"Принято time="+String(time))}});
await test("Некорректные заданные оценки отвергаются CUE",async()=>{for(const time of [0,-1,1.5,"15",null]){const result=release(15);(result.model.exercises[0] as any).time=time;let error;try{await validateRelease(result,temp)}catch(e){error=e}assert(error,"CUE принял time="+String(time))}});
const work:any={slots:[{candidates:["a","b"],assignment:{requirement:"required"}},{candidates:["c"],assignment:{requirement:"optional"}}],theoryTime:5};
const facts=(a:unknown,b:unknown,c:unknown)=>new Map([["a",{time:a}],["b",{time:b}],["c",{time:c}]]) as any;
await test("Полностью оценённые позиции сохраняют min/max и теорию",()=>{assert(JSON.stringify(assessmentTime(work,facts(10,20,7)))===JSON.stringify({required:{min:10,max:20},all:{min:17,max:27},theory:5,sessionRequired:{min:15,max:25},sessionAll:{min:22,max:32}}),"Изменён прежний расчёт")});
await test("Пропуск кандидата или оценки в том числе optional отменяет сводку",()=>{for(const f of [facts(undefined,20,7),facts(10,undefined,7),facts(10,20,undefined),new Map()])assert(assessmentTime(work,f)===undefined,"Показана неполная сводка")});
await Deno.remove(temp,{recursive:true});
if(failures)throw Error(`Не пройдено: ${failures}`);
