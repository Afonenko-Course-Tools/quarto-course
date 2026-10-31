import { validateAnswer, projectChoice } from "../_extensions/course-core/body-export/answer.ts";
const assert=(v:unknown,m:string)=>{if(!v)throw Error(m)};
const original=Deno.Command; let children=0;
(Deno as any).Command=class{constructor(){children++;throw Error("Ответ не должен запускать процесс")}};
const forms=["type: manual\nsubmission: text", "type: numeric\nkey: {value: 1.25, tolerance: {absolute: 0}}", "type: multipart\nparts: [{name: a, label: A, type: manual, submission: text}]", "type: matching\nprompts: [A]\noptions: [B]\nkey: {pairs: {A: B}}"];
let accepted=0,rejected=0;
try{
 for(const yaml of forms){const answer=await validateAnswer(yaml,{source:"question.qmd",id:"exr-a"});assert(answer.closedKey.type===answer.answerType,"Неправильный ключ/тип");assert(!JSON.stringify(answer.publicAnswer).includes('"key"'),"Утечка ключа");accepted++;}
 for(const yaml of ["type: manual\nsubmission: text\nextra: true","type: manual\ntype: numeric", "type: numeric\nkey: {value: .inf, tolerance: {absolute: 0}}", "type: numeric\nkey: {value: 2, tolerance: {absolute: -1}}", "type: manual\nsubmission: &x text", "type: manual\nsubmission: !custom text", "type: manual\nsubmission: *missing", "[]", "type: multipart\nparts: [{name: a, label: A, type: manual, submission: text}, {name: a, label: B, type: manual, submission: text}]", "type: matching\nprompts: [A, B]\noptions: [X]\nkey: {pairs: {A: X}}"]){let e:any;try{await validateAnswer(yaml,{source:"question.qmd",id:"exr-a"})}catch(x){e=x}assert(e?.code?.startsWith("ANSWER_")&&e.message.includes("question.qmd")&&e.message.includes("exr-a")&&e.cause,"Отказ потерял source/id/cause: "+e);rejected++;}
 const choice=(marks:number[])=>({t:"Div",c:[["",["answer"],[["type","single-choice"]]],[{t:"BulletList",c:[0,1].map(i=>[{t:"Plain",c:[marks.includes(i)?{t:"Span",c:[["",["correct"],[]],[{t:"Str",c:String(i)}]]}:{t:"Str",c:String(i)}]}])}]]});
 const yes=await projectChoice(choice([1]) as any);assert(yes.closedKey.correct===1&&!JSON.stringify(yes.publicAnswer).includes('"correct"'),"Выбор/публичная проекция");accepted++;
 for(const marks of [[],[0,1]]){let e:any;try{await projectChoice(choice(marks) as any,{source:"question.qmd",id:"exr-a"})}catch(x){e=x}assert(e?.code==="ANSWER_INVALID","Число отметок");rejected++;}
 assert(children===0,"Ответ создал child");console.log(JSON.stringify({accepted,rejected,children,status:"PASS"}));
}finally{(Deno as any).Command=original}
