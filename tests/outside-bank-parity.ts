import {copy} from "stdlib/fs";
import {dirname,fromFileUrl,join} from "stdlib/path";
const repo=dirname(dirname(fromFileUrl(import.meta.url)));
const root=await Deno.makeTempDir({prefix:"course-native-parity-"});
const assert=(v:unknown,m:string)=>{if(!v)throw Error(m)};
const config=`project:\n  type: default\n  output-dir: _site\nformat: html\nfail-if-warnings: true\ncourse: {id: parity, view: student}\n`;
const body=`# Native elements

::: {#exr-native for=custom difficulty=custom time=custom statement-visibility=custom}
NATIVE_EXERCISE_CONTENT
:::

::: {#exm-duplicate for=custom}
NATIVE_EXAMPLE_FIRST
:::

::: {#exm-duplicate}
NATIVE_EXAMPLE_SECOND
:::

::: {#sol-unrelated for=custom}
NATIVE_SOLUTION_FIRST
:::

::: {#sol-unrelated}
NATIVE_SOLUTION_SECOND
:::

[Missing native exercise](#exr-missing)
[Missing native example](#exm-missing)
[Missing native solution](#sol-missing)
`;
try{
 await copy(Deno.env.get("COURSE_TEST_EXTENSION")??join(repo,"_extensions/course-core"),join(root,"_extensions/course-core"));
 await Deno.writeTextFile(join(root,"index.qmd"),body);
 const results=[];
 for(const filters of ["","filters: [course-core]\n"]){
  await Deno.writeTextFile(join(root,"_quarto.yml"),config+filters);
  const r=await new Deno.Command(Deno.env.get("QUARTO")||"quarto",{args:["render"],cwd:root,stdout:"piped",stderr:"piped"}).output();
  results.push(r.success);
  assert(r.success,new TextDecoder().decode(r.stderr));
  const html=await Deno.readTextFile(join(root,"_site/index.html"));
  for(const token of ["NATIVE_EXERCISE_CONTENT","NATIVE_EXAMPLE_FIRST","NATIVE_EXAMPLE_SECOND","NATIVE_SOLUTION_FIRST","NATIVE_SOLUTION_SECOND"])assert(html.includes(token),"native payload removed: "+token);
 }
 assert(results[0]===results[1],"Core changed native warning/refusal policy");
 for await(const f of Deno.readDir(join(root,"_generated/course-spec/documents/student"))){const d=JSON.parse(await Deno.readTextFile(join(root,"_generated/course-spec/documents/student",f.name)));assert(d.exercises.length===0&&d.declarations.length===0,"outside-bank facts became canonical")}
 await Deno.writeTextFile(join(root,"index.qmd"),`# Native and explicit Course

:::: {.content-visible when-profile=full}
::: {#exm-owned course-role=discussion}
Explicit Course declaration.
:::
::::

[Hidden Course element](#exm-owned)
`);
 const owned=await new Deno.Command(Deno.env.get("QUARTO")||"quarto",{args:["render"],cwd:root,stdout:"piped",stderr:"piped"}).output();
 assert(!owned.success&&new TextDecoder().decode(owned.stderr).includes("CORE.PROFILE_REFERENCE_INTEGRITY"),"explicit Course-owned hidden reference lost strict guard");
 console.log("PASS native outside-bank parity: custom attributes and unrelated duplicate exm/sol");
}finally{await Deno.remove(root,{recursive:true})}
