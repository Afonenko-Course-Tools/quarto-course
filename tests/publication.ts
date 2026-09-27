import { dirname, fromFileUrl, join } from "stdlib/path";
const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const temporary = await Deno.makeTempDir({prefix: "course-publication-"});
const cue = Deno.env.get("CUE") || "cue";
const cases = [
  {name: "книга с форматом по умолчанию", valid: true, value: {namespace:"site",home:"book",projects:{book:{path:"book"}}}},
  {name: "книга с явным HTML", valid: true, value: {namespace:"site",home:"book",projects:{book:{path:"book",format:"html"}}}},
  {name: "слайды вместо главной книги", valid: false, value: {namespace:"site",home:"book",projects:{book:{path:"book",format:"revealjs"}}}},
  {name: "рефераты без формата", valid: false, value: {namespace:"site",home:"essay",projects:{essay:{path:"essay"}}}},
  {name: "рефераты с явным HTML", valid: true, value: {namespace:"site",home:"essay",projects:{essay:{path:"essay",format:"html"}}}},
  {name: "слайды вместо главных рефератов", valid: false, value: {namespace:"site",home:"essay",projects:{essay:{path:"essay",format:"revealjs"}}}},
  {name: "дополнительный проект без формата", valid: true, value: {namespace:"site",projects:{essay:{path:"essay"}}}},
  {name: "mount для главного проекта", valid: false, value: {namespace:"site",home:"essay",projects:{essay:{path:"essay",format:"html",mount:"essays"}}}},
  {name: "импорт HTTP и явный экспорт", valid: true, value: {namespace:"site",projects:{book:{path:"book"}},imports:{os:{source:"https://example.org/reference-catalog.json",namespace:"book","base-url":"https://example.org/",title:"Операционные системы",style:"external"}},exports:{book:["sec-types"]},publication:{title:"Программирование"}}},
  {name: "локальный каталог", valid: true, value: {namespace:"site",projects:{book:{path:"book"}},imports:{os:{source:"../os/reference-catalog.json",namespace:"book","base-url":"https://example.org/"}}}},
  {name: "пустой экспорт", valid: true, value: {namespace:"site",projects:{book:{path:"book"}},exports:{}}},
  {name: "устаревший file", valid: false, value: {namespace:"site",projects:{book:{path:"book"}},imports:{os:{file:"reference-catalog.json",namespace:"book","base-url":"https://example.org/"}}}},
  {name: "неизвестный стиль", valid: false, value: {namespace:"site",projects:{book:{path:"book"}},imports:{os:{source:"reference-catalog.json",namespace:"book","base-url":"https://example.org/",style:"legacy"}}}},
  {name: "устаревшая версия", valid: false, value: {namespace:"site",projects:{book:{path:"book"}},version:"1.0"}},
  {name: "без корневого namespace", valid: true, value: {home:"book",projects:{book:{path:"book"}}}},
  {name: "нет подпроектов", valid: false, value: {namespace:"site",projects:{}}},
  {name: "экспорт чужого пространства", valid: false, value: {projects:{book:{path:"book"}},exports:{os:["sec-types"]}}},
  {name: "повтор ID экспорта", valid: false, value: {projects:{book:{path:"book"}},exports:{book:["sec-types","sec-types"]}}},
  {name: "пробел в ID экспорта", valid: false, value: {projects:{book:{path:"book"}},exports:{book:["sec types"]}}},
  {name: "пустой ID экспорта", valid: false, value: {projects:{book:{path:"book"}},exports:{book:[""]}}},
  {name: "импорт затеняет проект", valid: false, value: {projects:{book:{path:"book"}},imports:{book:{source:"reference-catalog.json",namespace:"book","base-url":"https://example.org/"}}}},
  {name: "неизвестный главный проект", valid: false, value: {home:"missing",projects:{book:{path:"book"}}}},
];
try {
  for (const item of cases) {
    const input = join(temporary,"input.json");
    await Deno.writeTextFile(input, JSON.stringify(item.value));
    const output = await new Deno.Command(cue,{args:["vet",join(repo,"spec/publication.cue"),input,"-d","#Publication","-c"],stdout:"piped",stderr:"piped"}).output();
    if (output.success !== item.valid) throw new Error(`${item.name}: неожиданный результат проверки\n${new TextDecoder().decode(output.stderr)}`);
  }
  console.log(`Публикация: пройдено ${cases.length} проверок; для главного проекта вне book требуется явный format: html.`);
} finally { await Deno.remove(temporary,{recursive:true}); }
