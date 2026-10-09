import type {Course} from '../course-core/domain/model.ts';
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function renderExerciseIndex(model:Course,link:(source:string,id:string)=>string):string{
 const grouped=new Map<string,{source:string;categories:string[];exercise:NonNullable<Course['topics']>[number]['exercises'][number]}[]>();
 for(const topic of model.topics??[])for(const exercise of topic.exercises){
  if(model.course.view==='student'&&exercise.statementVisibility!=='open')continue;
  const key=(topic.semester??'')+' / '+(exercise.difficulty??'');
  const list=grouped.get(key)??[];list.push({source:topic.source,categories:topic.categories,exercise});grouped.set(key,list);
 }
 return '<nav class="course-exercise-index" aria-label="Указатель упражнений">'+[...grouped.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([group,items])=>'<section><h2>'+esc(group)+'</h2><ul>'+items.sort((a,b)=>a.exercise.id.localeCompare(b.exercise.id)).map(({source,categories,exercise})=>'<li><code>'+esc(exercise.id)+'</code> — <a href="'+esc(link(source,exercise.id))+'">'+esc(exercise.title)+'</a> — '+esc(categories.join(', '))+' — '+esc(String(exercise.time??'?'))+' мин</li>').join('')+'</ul></section>').join('')+'</nav>';
}
