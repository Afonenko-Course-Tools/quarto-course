import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = '_extensions/course-core/contract-vocabulary.json';
const content = readFileSync(resolve(root, source), 'utf8');
/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
/** @param {unknown} value @param {string} field @returns {string[]} */
function strings(value, field) {
  if (!Array.isArray(value)) throw new TypeError(`Некорректный словарь: ${field}`);
  /** @type {unknown[]} */ const items = value;
  return items.map(item => {
    if (typeof item !== 'string') throw new TypeError(`Некорректное значение словаря: ${field}`);
    return item;
  });
}
/** @param {unknown} value @param {string} field @returns {Record<string, unknown>} */
function dictionary(value, field) {
  if (!isRecord(value)) throw new TypeError(`Некорректный словарь: ${field}`);
  return value;
}
/** @type {unknown} */ const parsed = JSON.parse(content);
const raw = dictionary(parsed, 'корень');
const roles = Object.fromEntries(Object.entries(dictionary(raw.roles, 'roles')).map(/** @returns {[string, {label: string, activity: boolean, purpose: boolean | undefined}]} */ ([key, value]) => {
  const role = dictionary(value, `roles.${key}`);
  if (typeof role.label !== 'string' || typeof role.activity !== 'boolean' || (role.purpose !== undefined && typeof role.purpose !== 'boolean')) throw new TypeError(`Некорректная роль: ${key}`);
  return [key, {label: role.label, activity: role.activity, purpose: role.purpose}];
}));
const v = {roles, implicitKinds: strings(raw.implicitKinds, 'implicitKinds'), difficulty: dictionary(raw.difficulty, 'difficulty'),
  workMode: dictionary(raw.workMode, 'workMode'), requirement: dictionary(raw.requirement, 'requirement'),
  assessmentKinds: strings(raw.assessmentKinds, 'assessmentKinds'), memberKinds: strings(raw.memberKinds, 'memberKinds'),
  views: strings(raw.views, 'views'), stages: strings(raw.stages, 'stages'), statementVisibility: strings(raw.statementVisibility, 'statementVisibility')};
const check = process.argv.includes('--check');
const kinds = [...v.implicitKinds, ...Object.keys(v.roles)];
const activities = ['exercise', ...Object.entries(v.roles).filter(([, value]) => value.activity).map(([key]) => key)];
const enums = { ExercisePurpose:Object.entries(v.roles).filter(([,value]) => value.purpose).map(([key]) => key), PedagogicalKind:kinds, Difficulty:Object.keys(v.difficulty), WorkMode:Object.keys(v.workMode), Requirement:Object.keys(v.requirement), AssessmentKind:v.assessmentKinds, MemberKind:v.memberKinds, View:v.views, Stage:v.stages, StatementVisibility:v.statementVisibility };
/** @param {string} path @param {string} value */
function sync(path, value) {
  path = resolve(root, path);
  if (check) { if (readFileSync(path, 'utf8') !== value) throw Error(`Производный контракт устарел: ${path}. Выполните node tools/sync-contract.mjs`); }
  else writeFileSync(path, value);
}
sync('_extensions/course-presentation/modules/vocabulary.json', content);
/** @param {string[]} values */
const union = values => values.map(value => JSON.stringify(value)).join(' | ');
sync('_extensions/course-core/domain/vocabulary.ts', '// Создано tools/sync-contract.mjs из contract-vocabulary.json; вручную не изменять.\n' + Object.entries(enums).map(([name,values])=>`export type ${name} = ${union(values)};`).join('\n') + '\n');
console.log(check ? 'Словари Lua и TypeScript согласованы.' : 'Производные словари обновлены.');
