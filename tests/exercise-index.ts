import {renderExerciseIndex} from '../_extensions/course-navigation/exercise-index.ts';
const exercise=(id:string,source:string,purpose?:string,statementVisibility='open')=>({id,source,purpose,statementVisibility,head:{title:id==='exr-open'?'Canonical title':id},difficulty:'introductory',time:90});
const model:any={course:{view:'student'},topics:[{source:'topic.qmd',semester:'2',categories:['Java']},{source:'other.qmd',semester:'3',categories:['Other']}],exercises:[exercise('exr-open','topic.qmd','independent-study'),exercise('exr-ordinary','topic.qmd'),exercise('exr-demo','topic.qmd','demonstration'),exercise('exr-restricted','topic.qmd','independent-study','restricted'),exercise('exr-other','other.qmd','independent-study')]};
const request={role:'independent-study' as const,groupBy:['semester','difficulty'] as ('semester'|'difficulty')[]};
const html=renderExerciseIndex(model,(source,id)=>source+'#'+id,request);
if(!html.includes('2 / introductory')||!html.includes('90 мин')||!html.includes('Java')||!html.includes('Canonical title'))throw Error('semester_difficulty_groups failed');
if(html.includes('exr-restricted')||html.includes('exr-ordinary')||html.includes('exr-demo'))throw Error('mixed_role_and_student_visibility_filter failed');
if(!html.includes('topic.qmd#exr-open')||!html.includes('other.qmd#exr-other')||!html.includes('Other'))throw Error('canonical_source_join_and_native_links failed');
if(!html.replace(/<[^>]*>/g,'').includes('exr-open'))throw Error('visible_exercise_index_id_missing');
model.course.view='full';if(!renderExerciseIndex(model,(s,id)=>s+'#'+id,request).includes('exr-restricted'))throw Error('full index lost restricted canonical exercise');
console.log('PASS canonical_source_join, mixed role filter, semester_difficulty_groups and student restricted exclusion');

// Native kwargs, completed post marker and current canonical/source join.
const {copy}=await import('stdlib/fs');
const {dirname,fromFileUrl,join}=await import('stdlib/path');
const repo=dirname(dirname(fromFileUrl(import.meta.url))),root=await Deno.makeTempDir({prefix:'core-index-review-'});
try{
 for(const extension of ['course-core','course-navigation'])await copy(join(repo,'_extensions',extension),join(root,'_extensions',extension));
 await Deno.writeTextFile(join(root,'_quarto.yml'),`project:
  type: website
  output-dir: _site
  pre-render: _extensions/course-core/entrypoints/pre.ts
  post-render: _extensions/course-core/entrypoints/post.ts
course: {id: index-review}
filters: [course-core]
format: html
`);
 await Deno.writeTextFile(join(root,'_quarto-student.yml'),'course: {view: student}\n');
 await Deno.writeTextFile(join(root,'_quarto-full.yml'),'course: {view: full}\n');
 await Deno.writeTextFile(join(root,'index.qmd'),'# Essays {#sec-index}\n\n{{< course-exercise-index role="independent-study" group-by="semester,difficulty" >}}\n');
 await Deno.writeTextFile(join(root,'topic.qmd'),`---
exercise-bank: true
default-exercise-target: manual
default-exercise-statement-visibility: open
default-exercise-difficulty: introductory
default-exercise-time: 90
semester: 2
categories: [Java]
---
# Topic {#sec-topic}

::: {#exr-essay course-role=independent-study}
## Native Essay
Essay body
:::

::: {#exr-ordinary}
## Ordinary
Ordinary body
:::

::: {#exr-demo course-role=demonstration}
## Demo
Demo body
:::

::: {#exr-restricted course-role=independent-study statement-visibility=restricted}
## Restricted
Restricted body
:::
`);
 for(const profile of ['student','full','student']){
  const output=await new Deno.Command(Deno.env.get('QUARTO')??'quarto',{args:['render','--profile',profile,'--fail-if-warnings'],cwd:root,stdout:'piped',stderr:'piped'}).output();
  if(!output.success)throw Error(new TextDecoder().decode(output.stdout)+new TextDecoder().decode(output.stderr));
  const page=await Deno.readTextFile(join(root,'_site/index.html'));
  const index=page.match(/<nav class="course-exercise-index"[\s\S]*?<\/nav>/)?.[0];
  if(!index||!index.includes('Native Essay')||!index.includes('topic.html#exr-essay')||!index.includes('2 / introductory')||!index.includes('Java')||index.includes('exr-demo')||index.includes('exr-ordinary')||page.includes('<!--course-exercise-index'))throw Error('native_index_kwargs_post_join failed: '+profile+' '+index+' marker='+page.includes('<!--course-exercise-index'));
  if(index.includes('exr-restricted')!==(profile==='full'))throw Error('native_index_current_audience failed: '+profile);
 }
 console.log('PASS exact installed shortcode native student/full/student canonical role index');
}finally{await Deno.remove(root,{recursive:true})}
