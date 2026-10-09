import {renderExerciseIndex} from '../_extensions/course-navigation/exercise-index.ts';
const model:any={course:{view:'student'},topics:[{source:'topic.qmd',semester:'2',categories:['Java'],exercises:[{id:'exr-open',title:'Open',difficulty:'introductory',time:90,statementVisibility:'open'},{id:'exr-control',title:'Restricted',difficulty:'advanced',time:10,statementVisibility:'restricted'}]}]};
const html=renderExerciseIndex(model,(source,id)=>source+'#'+id);
if(!html.includes('2 / introductory')||!html.includes('90 мин')||!html.includes('Java'))throw Error('semester_difficulty_groups failed');
if(html.includes('exr-control')||html.includes('Restricted'))throw Error('student_index_does_not_include_restricted_control failed');
if(!html.replace(/<[^>]*>/g,'').includes('exr-open'))throw Error('visible_exercise_index_id_missing');
 console.log('PASS semester_difficulty_groups and student_index_does_not_include_restricted_control');
