import {copy} from "stdlib/fs";
import {join} from "stdlib/path";
import {collectExport} from "../_extensions/course-core/body-export/collect.ts";
import {buildBodies} from "../_extensions/course-core/body-export/producer.ts";
const assert = (value: unknown, message: string) => {if (!value) throw Error(message);};
const root = await Deno.makeTempDir({prefix: "native-optional-time-"});
try {
  for (const name of ["course-core", "course-presentation"]) {
    await copy(new URL("../_extensions/" + name, import.meta.url).pathname, join(root, "_extensions", name));
  }
  await Deno.writeTextFile(join(root, "_quarto.yml"), `project:
  type: book
  pre-render: _extensions/course-core/entrypoints/pre.ts
  post-render: _extensions/course-core/entrypoints/post.ts
book: {title: Банк, chapters: [index.qmd]}
course: {id: optional-time}
filters: [course-core, course-presentation]
format: html
lang: ru
`);
  const source = `---
title: Работа
exercise-bank: true
exercise-statement-visibility: open
assessment: {id: lab, kind: lab, theory-time: 5}
---
# Работа

::: {#exr-untimed difficulty=introductory}
## Без оценки времени

UNTIMED_CONDITION
:::

::: {#exr-timed difficulty=introductory time=10}
## С оценкой времени

TIMED_CONDITION
:::

::: {#exr-private difficulty=advanced statement-visibility=restricted}
PRIVATE_UNTIMED_CONDITION
:::

::: {.task-items}
1. @exr-timed
1. [@exr-untimed]{requirement=optional}
:::
`;
  await Deno.writeTextFile(join(root, "index.qmd"), source);
  for (const profile of ["student", "full", "student"]) {
    await Deno.writeTextFile(join(root, `_quarto-${profile}.yml`), `course: {view: ${profile}}\n`);
    const render = await new Deno.Command(Deno.env.get("QUARTO") || "quarto", {args: ["render", "--profile", profile], cwd: root, stdout: "piped", stderr: "piped"}).output();
    assert(render.success, new TextDecoder().decode(render.stdout) + new TextDecoder().decode(render.stderr));
    const html = await Deno.readTextFile(join(root, "_book/index.html"));
    assert(html.includes("UNTIMED_CONDITION") && html.includes("TIMED_CONDITION"), `${profile}: потеряно условие`);
    assert(!html.includes('data-course-assessment-time="ready"') && !html.includes("NaN") && !html.includes("null мин"), `${profile}: опубликован неполный итог времени`);
    assert(html.includes("PRIVATE_UNTIMED_CONDITION") === (profile === "full"), `${profile}: нарушена visibility`);
    const collected = await collectExport(root, {book: ".", work: "lab"});
    const body = await buildBodies(collected.result, {projectRoot: root, work: "lab", courseId: collected.courseId});
    const untimed = body.publicPackage.questions.find(q => q.id === "exr-untimed");
    const timed = body.publicPackage.questions.find(q => q.id === "exr-timed");
    assert(untimed && !Object.hasOwn(untimed, "time"), `${profile}: Body подставил time отсутствующему свойству`);
    assert(timed?.time === 10, `${profile}: Body потерял явное time`);
    assert(!JSON.stringify(untimed!.condition).includes("Время"), `${profile}: Body добавил метку времени`);
    assert(await Deno.readTextFile(join(root, "index.qmd")) === source, "Изменён авторский источник");
  }
  console.log("PASS native optional time: student/full current release → Body, omitted time preserved, incomplete totals suppressed");
} finally {await Deno.remove(root, {recursive: true});}
