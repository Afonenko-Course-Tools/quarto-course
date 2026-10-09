import {copy} from 'stdlib/fs';
import {dirname,fromFileUrl,join} from 'stdlib/path';
import {collectNativeModel} from '../_extensions/course-core/body-export/collect.ts';
const repository=dirname(dirname(fromFileUrl(import.meta.url))),root=await Deno.makeTempDir({prefix:'core-effective-'});
try{
 await Deno.mkdir(join(root,'bank/topic'),{recursive:true});await Deno.mkdir(join(root,'bank/nested'),{recursive:true});
 await copy(join(repository,'_extensions/course-core'),join(root,'bank/_extensions/course-core'));
 await Deno.writeTextFile(join(root,'_quarto.yml'),'project: {type: default, render: [index.qmd]}\ncourse: {id: defaults-test}\n');await Deno.writeTextFile(join(root,'index.qmd'),'# Root\n');
 await Deno.writeTextFile(join(root,'bank/_quarto.yml'),`project: {type: book}\nbook: {title: Defaults, chapters: [index.qmd, topic/tasks.qmd]}\ncourse: {id: defaults-test}\nexercise-bank: true\ndefault-exercise-target: manual\ndefault-exercise-statement-visibility: open\ndefault-exercise-difficulty: introductory\ndefault-exercise-time: 10\n`);
 await Deno.writeTextFile(join(root,'bank/_quarto-full.yml'),'course: {view: full}\n');
 await Deno.writeTextFile(join(root,'bank/topic/_metadata.yml'),'default-exercise-time: 45\ndefault-exercise-difficulty: intermediate\nsemester: 2\ncategories: [Java]\n');
 await Deno.writeTextFile(join(root,'bank/index.qmd'),'# Root bank {#sec-root}\n\n::: {#exr-root}\n## Root\nCondition\n:::\n');
 await Deno.writeTextFile(join(root,'bank/topic/tasks.qmd'),'---\ndefault-exercise-target: false\n---\n# Directory {#sec-dir}\n\n::: {#exr-dir target=manual time=90 statement-visibility=restricted}\n## Directory\nCondition\n:::\n');
 await Deno.writeTextFile(join(root,'bank/nested/_quarto.yml'),'project: {type: default}\n');await Deno.writeTextFile(join(root,'bank/nested/index.qmd'),'# Nested\n\n::: {#exr-native}\nNative\n:::\n');
 const result=await collectNativeModel(root,{book:'bank'});
 if(result.result.model.exercises.length!==2||result.result.documents.some(d=>d.source.startsWith('nested/')))throw Error('nested project isolation failed');
 const [first,second]=result.result.model.exercises;
 const rootTask=result.result.model.exercises.find(e=>e.id==='exr-root')!,directoryTask=result.result.model.exercises.find(e=>e.id==='exr-dir')!;
 if(rootTask.target!=='manual'||rootTask.authoredTarget!==undefined||rootTask.time!==10)throw Error('root defaults/provenance failed');
 if(directoryTask.difficulty!=='intermediate'||directoryTask.time!==90||directoryTask.statementVisibility!=='restricted'||directoryTask.authoredTarget!=='manual')throw Error('directory/document/explicit precedence failed');
 console.log('PASS root_directory_document_defaults, nested_project_isolation, cleared_target and authored provenance');
}finally{await Deno.remove(root,{recursive:true})}
