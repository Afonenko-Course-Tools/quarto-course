// Contract proof only: no live PrairieLearn import, delivery, or submission claim.
import { v5 } from "./vendor/libraries.js";
import {
  command,
  fail,
  resourceTargets,
  validateBody,
  validatePackage,
  verifyResources,
} from "./transport.ts";
const ns = "69698e87-3a56-553b-83b0-dbc86c7f1c05";
export async function exportPl(
  p: any,
  binding: any,
): Promise<Record<string, string | Uint8Array>> {
  validatePackage(p);
  if (
    !/^[a-z0-9-]+$/.test(binding.courseInstance) || !binding.assessmentSet ||
    !binding.topic || !(binding.points > 0)
  ) fail("courseInstance, assessmentSet, topic and points required");
  for (const q of p.questions) {
    if (!["manual", "single-choice"].includes(q.answerType)) {
      fail("unsupported answer " + q.answerType);
    }
    validateBody(q.condition, p);
    validateBody(q.publicAnswer, p);
  }
  await verifyResources(p);
  const files: Record<string, string | Uint8Array> = {};
  const json = (x: any) => JSON.stringify(x, null, 2) + "\n";
  const qid = (key: string) => v5("question/" + key, ns);
  const html = async (blocks: any[]) => {
    let output = await command(
      "quarto",
      ["pandoc", "--from=json", "--to=html5", "--mathml"],
      JSON.stringify({ "pandoc-api-version": p.apiVersion, meta: {}, blocks }),
    );
    output = output.replaceAll("{", "&#123;").replaceAll("}", "&#125;");
    // Only adapter-owned resource URLs get Mustache; literal source braces are inert.
    for (const r of p.resources) {
      output = output.replaceAll(
        '"' + r.target + '"',
        '"{{ options.client_files_question_url }}/' + r.target + '"',
      );
    }
    return output;
  };
  for (const q of p.questions) {
    const dir = "questions/" + qid(q.key);
    files[dir + "/info.json"] = json({
      uuid: qid(q.key),
      title: q.id,
      topic: binding.topic,
      type: "v3",
      singleVariant: true,
      gradingMethod: q.answerType === "manual" ? "Manual" : "Internal",
      showCorrectAnswer: false,
    });
    let body = "<pl-question-panel>\n" + await html(q.condition) +
      "</pl-question-panel>\n";
    if (q.answerType === "manual") {
      body +=
        '<pl-rich-text-editor file-name="answer.html"></pl-rich-text-editor>\n';
    } else {
      const choices = q.publicAnswer[0]?.c;
      if (
        q.publicAnswer.length !== 1 || q.publicAnswer[0]?.t !== "BulletList" ||
        !Number.isInteger(q.closedKey?.correct) || q.closedKey.correct < 0 ||
        q.closedKey.correct >= choices.length
      ) fail("invalid single-choice mapping");
      const rendered = await Promise.all(choices.map(html));
      if (new Set(rendered).size !== rendered.length) {
        fail("PL duplicate choices unsupported");
      }
      body +=
        '<pl-multiple-choice answers-name="response" order="fixed" number-answers="' +
        choices.length + '">\n';
      for (const [i, c] of rendered.entries()) {
        body += '<pl-answer correct="' + (i === q.closedKey.correct) + '">' +
          c + "</pl-answer>\n";
      }
      body += "</pl-multiple-choice>\n";
    }
    files[dir + "/question.html"] = body;
    const selectedTargets = resourceTargets([q.condition, q.publicAnswer]);
    for (const r of p.resources) {
      if (selectedTargets.has(r.target)) {
        files[dir + "/clientFilesQuestion/" + r.target] = Uint8Array.from(
          atob(r.data),
          (c: string) => c.charCodeAt(0),
        );
      }
    }
  }
  for (const [i, w] of p.works.entries()) {
    files[
      `courseInstances/${binding.courseInstance}/assessments/${
        v5("assessment/" + w.key, ns)
      }/infoAssessment.json`
    ] = json({
      uuid: v5("assessment/" + w.key, ns),
      type: "Homework",
      title: w.title,
      set: binding.assessmentSet,
      number: String(i + 1),
      shuffleQuestions: false,
      zones: [{
        title: "Questions",
        questions: w.items.map((key: string) => ({
          id: qid(key),
          ...(p.questions.find((q: any) => q.key === key).answerType ===
              "manual"
            ? { manualPoints: binding.points }
            : { points: binding.points }),
        })),
      }],
    });
  }
  return files;
}
if (import.meta.main) {
  const [src, bind, out] = Deno.args;
  if (!src || !bind || !out) {
    throw Error("usage: pl.ts package.json binding.json output-directory");
  }
  const files = await exportPl(
    JSON.parse(await Deno.readTextFile(src)),
    JSON.parse(await Deno.readTextFile(bind)),
  );
  for (const [path, data] of Object.entries(files)) {
    const dest = out + "/" + path;
    await Deno.mkdir(dest.slice(0, dest.lastIndexOf("/")), { recursive: true });
    if (typeof data === "string") await Deno.writeTextFile(dest, data);
    else await Deno.writeFile(dest, data);
  }
}
