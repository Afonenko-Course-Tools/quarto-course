import { decodeProjectRequests } from "../_extensions/course-core/contracts/project.ts";
const request=(owner:string,directories:string[])=>({owner,directories,profiles:[],format:"html"});
const many=Array.from({length:300},(_,i)=>`projects/p${i}`);
if(decodeProjectRequests([request("/owner",many)])[0].directories.length!==300)throw Error("Необоснованный input count cap");
const owners=Array.from({length:65},(_,i)=>request(`/owner${i}`,["code"]));
if(decodeProjectRequests(owners).length!==65)throw Error("Необоснованный owner request count cap");
for(const value of [[{...owners[0],unknown:true}],Array.from({length:5000},()=>owners[0])]){let refused=false;try{decodeProjectRequests(value)}catch{refused=true}if(!refused)throw Error("Потерян closed/bounded input guard")}
console.log("PASS 300 inputs/65 owner requests without arbitrary small caps; closed/overall input bounds retained");
