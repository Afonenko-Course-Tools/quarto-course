import { dirname, fromFileUrl, join } from "stdlib/path";
const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const temporary = await Deno.makeTempDir({prefix: "course-publication-"});
const cue = Deno.env.get("CUE") || "cue";
const cases = [
  {name: "book default", valid: true, value: {namespace:"site",home:"book",projects:{book:{path:"book"}}}},
  {name: "book explicit html", valid: true, value: {namespace:"site",home:"book",projects:{book:{path:"book",format:"html"}}}},
  {name: "book revealjs home", valid: false, value: {namespace:"site",home:"book",projects:{book:{path:"book",format:"revealjs"}}}},
  {name: "essay omitted format", valid: false, value: {namespace:"site",home:"essay",projects:{essay:{path:"essay"}}}},
  {name: "essay explicit html", valid: true, value: {namespace:"site",home:"essay",projects:{essay:{path:"essay",format:"html"}}}},
  {name: "essay revealjs home", valid: false, value: {namespace:"site",home:"essay",projects:{essay:{path:"essay",format:"revealjs"}}}},
  {name: "non-home default", valid: true, value: {namespace:"site",projects:{essay:{path:"essay"}}}},
  {name: "home mount", valid: false, value: {namespace:"site",home:"essay",projects:{essay:{path:"essay",format:"html",mount:"essays"}}}},
];
try {
  for (const item of cases) {
    const input = join(temporary,"input.json");
    await Deno.writeTextFile(input, JSON.stringify(item.value));
    const output = await new Deno.Command(cue,{args:["vet",join(repo,"spec/publication.cue"),input,"-d","#Publication","-c"],stdout:"piped",stderr:"piped"}).output();
    if (output.success !== item.valid) throw new Error(`${item.name}: unexpected validation outcome\n${new TextDecoder().decode(output.stderr)}`);
  }
  console.log(`Publication: ${cases.length} cases passed; non-book home requires authored format: html.`);
} finally { await Deno.remove(temporary,{recursive:true}); }
