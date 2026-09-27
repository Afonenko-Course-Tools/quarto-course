import { dirname, fromFileUrl, join } from "stdlib/path";
import { copy } from "stdlib/fs";
const repo=dirname(dirname(fromFileUrl(import.meta.url)));
const root=await Deno.makeTempDir({prefix:"course-downloads-"});
const quarto=Deno.env.get("QUARTO")||"quarto";
function assert(value:unknown,message:string):asserts value {if(!value)throw new Error(message);}
async function write(path:string,text:string){await Deno.mkdir(dirname(join(root,path)),{recursive:true});await Deno.writeTextFile(join(root,path),text);}
async function run(args:string[],success=true){const result=await new Deno.Command(quarto,{args,cwd:root,stdout:"piped",stderr:"piped"}).output();assert(result.success===success,new TextDecoder().decode(result.stdout)+new TextDecoder().decode(result.stderr));}
const exercise=(id:string)=>`:::: {#${id} target="manual" project="/topics/demo/project"}\n## Starter\n\n{{< project-download ${id} >}}\n::::\n`;
try {
 await copy(join(repo,"_extensions"),join(root,"_extensions"));
 await write("_quarto.yml",'project:\n  type: website\n  output-dir: _site\n  render: [index.qmd, topics/demo/index.qmd]\n  resources: ["!**/project/**"]\ncourse:\n  id: archive-test\n  validate: true\nfilters: [course-core]\nformat: html\n');
 for(const profile of ["student","full"])await write(`_quarto-${profile}.yml`,`course:\n  view: ${profile}\n`);
 await write("index.qmd","# Home\n");
 await write("topics/demo/project/student/README.md","Открытый стартовый проект\n");
 await write("topics/demo/project/reference/Secret.java","PRIVATE_REFERENCE");
 await write("topics/demo/index.qmd","# Demo\n\n"+exercise("exr-1-public")+"\n::::: {.when-full}\n"+exercise("exr-private")+":::::\n");
 await run(["render","--profile","full","--fail-if-warnings"]);
 let files=Array.from(await Array.fromAsync(Deno.readDir(join(root,"_site/_downloads"))));
 assert(files.length===2,"Полный профиль не создал оба запрошенных архива");
 await run(["render","--profile","student","--fail-if-warnings"]);
 files=Array.from(await Array.fromAsync(Deno.readDir(join(root,"_site/_downloads"))));
 assert(files.length===1&&files[0].name==="exr-1-public.zip","Скрытый архив остался после перехода с full на student");
 const html=await Deno.readTextFile(join(root,"_site/topics/demo/index.html"));
 assert(html.includes('href="../../_downloads/exr-1-public.zip"'),"Неверный адрес архива для вложенного документа");
 assert(html.includes("Скачать стартовый проект")&&!html.includes("exr-private"),"Неверная подпись или условие видимости ссылки");
 const model=JSON.parse(await Deno.readTextFile(join(root,"_generated/course-spec/course.json")));
 assert(model.downloads.length===1&&model.downloads[0].source==="topics/demo/index.qmd","Заявки в модели не соответствуют отбору по профилю");
 // Отдельная команда проверки тоже создаёт архив; обработчик после рендера не вызывается рекурсивно.
 await run(["run",join(root,"_extensions/course-core/entrypoints/check.ts"),"."]);
 assert((await Deno.stat(join(root,"_site/_downloads/exr-1-public.zip"))).size>0,"Явная проверка не сохранила собранный архив");
 await write("topics/demo/index.qmd",'# Invalid\n\n{{< project-download exr-missing >}}\n');
 await run(["render","--profile","student"],false);
 let stale=false;try{await Deno.stat(join(root,"_site/_downloads/exr-1-public.zip"));stale=true;}catch{}
 assert(!stale,"После ошибки сборки остался устаревший архив");
 console.log("Скачивание проектов: вложенные адреса, разделение full/student, очистка, явная проверка и отклонение отсутствующего ID — успешно.");
} finally {await Deno.remove(root,{recursive:true});}
