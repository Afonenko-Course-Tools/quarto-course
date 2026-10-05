import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = '_extensions/course-core/contract-vocabulary.json';
const content = readFileSync(resolve(root, source), 'utf8');
const v = JSON.parse(content), check = process.argv.includes('--check');
const kinds = [...v.implicitKinds, ...Object.keys(v.roles)];
const activities = ['exercise', ...Object.entries(v.roles).filter(([, value]) => value.activity).map(([key]) => key)];
const enums = { ExercisePurpose:Object.entries(v.roles).filter(([,value]) => value.purpose).map(([key]) => key), PedagogicalKind:kinds, Difficulty:Object.keys(v.difficulty), WorkMode:Object.keys(v.workMode), Requirement:Object.keys(v.requirement), AssessmentKind:v.assessmentKinds, MemberKind:v.memberKinds, View:v.views };
function sync(path, value) {
  path = resolve(root, path);
  if (check) { if (readFileSync(path, 'utf8') !== value) throw Error(`Производный контракт устарел: ${path}. Выполните node tools/sync-contract.mjs`); }
  else writeFileSync(path, value);
}
sync('_extensions/course-presentation/modules/vocabulary.json', content);
const union = values => values.map(JSON.stringify).join(' | ');
sync('_extensions/course-core/domain/vocabulary.ts', '// Создано tools/sync-contract.mjs из contract-vocabulary.json; вручную не изменять.\n' + Object.entries(enums).map(([name,values])=>`export type ${name} = ${union(values)};`).join('\n') + '\n');
const cuePath = '_extensions/course-core/spec/core.cue';
const cue = Object.entries(enums).map(([name,values])=>`#${name}: ${union(values)}`).join('\n') + `\n#ActivityKinds: ${JSON.stringify(activities)}\n#MaxMinutes: ${v.maxMinutes}`;
sync(cuePath, readFileSync(resolve(root,cuePath),'utf8').replace(/\/\/ BEGIN GENERATED VOCABULARY[\s\S]*?\/\/ END GENERATED VOCABULARY/, '// BEGIN GENERATED VOCABULARY\n// Производный словарь; изменяйте contract-vocabulary.json.\n'+cue+'\n// END GENERATED VOCABULARY'));
console.log(check ? 'Словари Lua, TypeScript и CUE согласованы.' : 'Производные словари обновлены.');
