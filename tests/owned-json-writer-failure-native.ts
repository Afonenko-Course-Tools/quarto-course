/** Публичный экспорт: ошибка после admission сохраняет источник и допускает fresh retry. */
import {copy} from 'stdlib/fs';
import {dirname,fromFileUrl,join} from 'stdlib/path';
import {collectExport} from '../_extensions/course-core/body-export/collect.ts';
import {loadNativeRun} from '../_extensions/course-core/infrastructure/native-run.ts';
const assert=(v:unknown,m:string)=>{if(!v)throw Error(m)};
const mode=Deno.env.get('OWNED_JSON_FAILURE_MODE')||'first';
const repo=dirname(dirname(fromFileUrl(import.meta.url))),out=Deno.env.get('OWNED_JSON_FAILURE_OUTPUT')||await Deno.makeTempDir({prefix:'owned-json-failure-'}),root=join(out,'fixture'),bank=join(root,'bank');
await Deno.mkdir(bank,{recursive:true});await copy(join(repo,'_extensions/course-core'),join(bank,'_extensions/course-core'));
await Deno.writeTextFile(join(root,'_quarto.yml'),'project: {type: default}\ncourse: {id: failure-retry}\n');
const config='project:\n  type: book\n  pre-render: [_extensions/course-core/entrypoints/pre.ts, _extensions/course-core/entrypoints/pre.ts]\n  post-render: [_extensions/course-core/entrypoints/post.ts, _extensions/course-core/entrypoints/post.ts]\nbook: {title: Retry, chapters: ['+(mode==='second'?'index.qmd, other.qmd':'index.qmd')+']}\nformat: html\nfilters: [course-core, fail.lua]\n';
await Deno.writeTextFile(join(bank,'_quarto.yml'),config);
const input='---\nformat: html\nexercise-bank: true\nexercise-statement-visibility: open\nassessment: {id: lab, kind: lab}\n---\n# Работа\n\n::: {#exr-one difficulty=introductory time=10}\nПубличное условие.\n:::\n\n::: {.task-items}\n- @exr-one\n:::\n';
await Deno.writeTextFile(join(bank,'index.qmd'),input);
const cancelMarker=join(out,'native-interrupt-fired');
const cancelCode="import os, signal; open("+JSON.stringify(cancelMarker)+", 'w').write('fired'); os.write(2, b'EXPECTED_NATIVE_INTERRUPT\\n'); os.kill(os.getppid(), signal.SIGINT)";
const failureFilter=mode==='cancel'?"return {{Pandoc=function(doc) pandoc.pipe('python3', {'-c', "+JSON.stringify(cancelCode)+"}, ''); return doc end}}\n":"return {{Pandoc=function(doc) "+(mode==='second'?"if quarto.doc.input_file:match('other.qmd$') then ":'')+"assert(false,'EXPECTED_AFTER_ADMISSION_FAILURE') "+(mode==='second'?"end; return doc":'')+" end}}\n";
await Deno.writeTextFile(join(bank,'fail.lua'),failureFilter);
if(mode==='second')await Deno.writeTextFile(join(bank,'other.qmd'),'# Второй документ\n');
const before=await Deno.lstat(join(bank,'_quarto.yml'));let error:unknown;
try{await collectExport(root,{book:'bank',work:'lab'})}catch(e){error=e}
assert(mode==='cancel'?!!error&&String(error).includes('Pandoc conversion failed'):String(error).includes('EXPECTED_AFTER_ADMISSION_FAILURE'),'Original native failure lost: '+String(error));
if(mode==='cancel')assert(await Deno.readTextFile(cancelMarker)==='fired','Native interrupt did not execute');
assert(await Deno.readTextFile(join(bank,'_quarto.yml'))===config&&await Deno.readTextFile(join(bank,'index.qmd'))===input,'Failure changed authored source');
const after=await Deno.lstat(join(bank,'_quarto.yml'));assert(before.ino===after.ino&&before.dev===after.dev&&before.mode===after.mode&&before.mtime?.getTime()===after.mtime?.getTime(),'Failure changed source entry identity');
const profiles=[];for await(const entry of Deno.readDir(bank))if(entry.name.startsWith('_quarto-course-export-'))profiles.push(entry.name);
assert(profiles.length===0,'OWNED_FAILURE_PROFILE_LEFTOVER '+profiles.join(','));
let refused=false;try{await loadNativeRun(bank)}catch{refused=true}assert(refused,'Failed writer left accepted completion');
try{await Deno.lstat(join(bank,'index.json'));throw Error('Failed writer created temporary JSON')}catch(e){if(!(e instanceof Deno.errors.NotFound))throw e}
await Deno.writeTextFile(join(bank,'fail.lua'),'return {}\n');
const result=await collectExport(root,{book:'bank',work:'lab'});assert(result.result.model.exercises.length===1,'Fresh retry lost exercise');
assert(await Deno.readTextFile(join(bank,'_quarto.yml'))===config&&await Deno.readTextFile(join(bank,'index.qmd'))===input,'Retry changed authored source');
console.log('PASS actual post-admission failure preserves reason/source, retires owned profile, rejects stale completion and permits fresh retry');
