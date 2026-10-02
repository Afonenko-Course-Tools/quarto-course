// Synthetic Source-only fixtures shaped from the authenticated original four declarations.
// No native invocation, owner receipt or output permission is created by this test.
const api = await import(
  "../_extensions/course-core/owner-preflight/native-listing.ts"
).catch(() => ({} as any));
function assert(x: unknown, why: string): asserts x {
  if (!x) throw new Error(why);
}
assert(
  typeof api.auditNativeListings === "function",
  "RED: missing finite NativeListing source contract",
);
const root = await Deno.makeTempDir({ prefix: "native-listing-contracts-" });
const sources = [
  "index.qmd",
  "text/index.qmd",
  "text/representation/index.qmd",
  "text/decoding/index.qmd",
  "text/immutability/index.qmd",
];
const rows = [
  { difficulty: "introductory", semester: 1, categories: ["UTF-8", "Строки"] },
  {
    difficulty: "intermediate",
    semester: 1,
    categories: ["Декодирование", "Контракты"],
  },
  {
    difficulty: "advanced",
    semester: 2,
    categories: ["Массивы", "Границы компонентов"],
  },
];
const listing = (id: string, difficulty?: string, semester?: number) => ({
  id,
  contents: "*/*/index.qmd",
  type: "table",
  fields: ["title", "categories"],
  "field-display-names": {
    title: "Тема исследования",
    categories: "Ключевые слова",
  },
  sort: "title",
  "filter-ui": false,
  "sort-ui": false,
  ...(difficulty ? { include: { difficulty, semester } } : {}),
});
const listings = [
  listing("introductory-topics", "introductory", 1),
  listing("intermediate-topics", "intermediate", 1),
  listing("advanced-topics", "advanced", 2),
];
const fourth = {
  id: "text-topics",
  contents: "*/index.qmd",
  type: "table",
  fields: ["title", "semester", "categories"],
  "field-display-names": {
    title: "Тема исследования",
    semester: "Семестр",
    categories: "Ключевые слова",
  },
  "page-size": 10,
  sort: "title",
  "filter-ui": false,
  "sort-ui": false,
};
const docs: Record<string, any> = {};
for (let i = 0; i < sources.length; i++) {
  const source = sources[i], path = root + "/" + source;
  await Deno.mkdir(path.substring(0, path.lastIndexOf("/")), {
    recursive: true,
  });
  await Deno.writeTextFile(
    path,
    "# " +
      [
        "Исследования",
        "Текст как данные",
        "Символ и его байтовое представление",
        "Строгое декодирование UTF-8",
        "Сохранность данных на границе компонентов",
      ][i] + (i === 2 ? " {#sec-source}" : "") +
      "\n\nSynthetic static Source.\n",
  );
  const metadata = i === 0
    ? { listing: listings }
    : i === 1
    ? { listing: fourth }
    : rows[i - 2];
  docs[source] = {
    engines: ["markdown"],
    formats: {
      html: {
        identifier: { "base-format": "html" },
        execute: { engine: "markdown" },
        render: { "output-ext": "html" },
        pandoc: { "output-file": "index.html", filters: ["course-core"] },
        extensions: { book: { multiFile: true } },
        language: { "listing-page-no-matches": "Нет подходящих элементов" },
        metadata,
      },
    },
    fileInformation: {
      [path]: {
        metadata,
        codeCells: [],
        includeMap: i > 1
          ? [{ source: path, target: "../_prerequisites.qmd" }]
          : [],
      },
    },
  };
}
const project = {
  dir: root,
  engines: ["markdown"],
  files: { input: sources.map((x) => root + "/" + x) },
  extensions: [{
    id: { name: "course-core" },
    path: root + "/_extensions/course-core",
    contributes: { project: {}, formats: {}, engines: [] },
  }],
  config: {
    filters: ["course-core"],
    project: {
      type: "book",
      "lib-dir": "site_libs",
      "pre-render": [
        "_extensions/course-core/entrypoints/pre.ts",
        "_extensions/course-core/entrypoints/owner-freeze.ts",
      ],
      "post-render": ["_extensions/course-core/entrypoints/post.ts"],
    },
    book: {
      render: [
        { type: "chapter", file: "index.qmd", depth: 0 },
        { type: "part", file: "text/index.qmd", depth: 0 },
        { type: "chapter", file: sources[2], number: 1, depth: 1 },
        { type: "chapter", file: sources[3], number: 2, depth: 1 },
        { type: "chapter", file: sources[4], number: 3, depth: 1 },
      ],
    },
  },
};
const provider = { sha256: "a".repeat(64), version: "1.10.18" };
const args = () => ({
  root,
  profile: "student",
  project,
  documents: docs,
  provider,
});
const plans = await api.auditNativeListings(args());
assert(
  Object.keys(plans).join(",") === "student:index.qmd,student:text/index.qmd",
  "all and only Listing emitting Sources planned",
);
assert(
  plans["student:index.qmd"].declarations.length === 3 &&
    plans["student:text/index.qmd"].declarations.length === 1,
  "four native declarations preserved",
);
assert(
  plans["student:index.qmd"].declarations.map((x: any) => x.rows[0].source)
    .join(",") ===
    "text/representation/index.qmd,text/decoding/index.qmd,text/immutability/index.qmd",
  "typed native selectors/include predicates select own inputs",
);
assert(
  plans["student:text/index.qmd"].declarations[0].rows.length === 3,
  "page-size10 retains all three rows",
);
assert(
  plans["student:text/index.qmd"].inputConstructor ===
    "book-part-title-transfer",
  "only proved native book part declares title transfer",
);
assert(
  plans["student:index.qmd"].inputConstructor === "identity",
  "book index retains authored Header",
);
assert(
  plans["student:index.qmd"].selectedWriters.length === 5,
  "all selected writer descriptors frozen, not only rows",
);
assert(
  plans["student:text/index.qmd"].declarations[0].rows[1].sourceHref ===
    "/text/decoding/index.qmd",
  "native source URI retained as address edge, no QMD grant",
);
assert(
  plans["student:text/index.qmd"].declarations[0].rows[1].writer.artifact ===
    "text/decoding/index.html",
  "actual selected native output-file supplies artifact",
);
assert(
  plans["student:index.qmd"].declarations[0].pageSize === 30,
  "native table default retains no active pagination",
);
async function rejects(fn: () => unknown | Promise<unknown>, code: string) {
  let e: any;
  try {
    await fn();
  } catch (x) {
    e = x;
  }
  assert(e?.code === code, `expected ${code}, got ${e?.code || e}`);
}
for (
  const change of [
    (d: any) => {
      d.custom = "authored.ejs";
    },
    (d: any) => {
      d.fields = ["title", "image"];
    },
    (d: any) => {
      d["field-display-names"].title = "<img src=private>";
    },
    (d: any) => {
      d.sort = "semester";
    },
    (d: any) => {
      d["page-size"] = 1;
    },
    (d: any) => {
      d["table-hover"] = true;
    },
    (d: any) => {
      d.include.extra = "secret";
    },
  ]
) {
  const original = docs["index.qmd"].formats.html.metadata.listing;
  const replacement = structuredClone(original);
  change(replacement[0]);
  docs["index.qmd"].formats.html.metadata.listing = replacement;
  docs["index.qmd"].fileInformation[root + "/index.qmd"].metadata.listing =
    replacement;
  await rejects(
    () => api.auditNativeListings(args()),
    "SOURCE.NATIVE_LISTING_UNSUPPORTED",
  );
  docs["index.qmd"].formats.html.metadata.listing = original;
  docs["index.qmd"].fileInformation[root + "/index.qmd"].metadata.listing =
    original;
}
const oldHooks = project.config.project["pre-render"];
project.config.project["pre-render"] = ["unknown-preprocessor.ts", ...oldHooks];
await rejects(
  () => api.auditNativeListings(args()),
  "SOURCE.NATIVE_LISTING_UNSUPPORTED",
);
project.config.project["pre-render"] = oldHooks;
const oldExtension = docs["text/index.qmd"].formats.html.extensions;
docs["text/index.qmd"].formats.html.extensions = {
  book: { multiFile: true, customConstructor: true },
};
await rejects(
  () => api.auditNativeListings(args()),
  "SOURCE.NATIVE_LISTING_UNSUPPORTED",
);
docs["text/index.qmd"].formats.html.extensions = oldExtension;
await rejects(
  () => api.nativeListingPlain("https://private.invalid"),
  "SOURCE.NATIVE_LISTING_UNSUPPORTED",
);
await rejects(
  () => api.nativeListingPlain("[label](closed.txt)"),
  "SOURCE.NATIVE_LISTING_UNSUPPORTED",
);
for (const alternative of ["html4", "dashboard"]) {
  const original = docs["index.qmd"].formats;
  docs["index.qmd"].formats = {
    [alternative]: structuredClone(original.html),
    ...original,
  };
  await rejects(
    () => api.auditNativeListings(args()),
    "SOURCE.NATIVE_LISTING_UNSUPPORTED",
  );
  docs["index.qmd"].formats = original;
}
const htmlPdfFormats = docs["index.qmd"].formats;
docs["index.qmd"].formats = {
  pdf: {
    identifier: { "base-format": "latex" },
    render: { "output-ext": "pdf" },
    pandoc: { "output-file": "course.pdf" },
  },
  ...htmlPdfFormats,
};
const htmlPdfPlans = await api.auditNativeListings(args());
assert(
  htmlPdfPlans["student:index.qmd"].sourceWriter.artifact === "index.html" &&
    htmlPdfPlans["student:index.qmd"].declarations.length === 3,
  "optional PDF first preserves unequivocal stock HTML writer and all tables",
);
docs["index.qmd"].formats = htmlPdfFormats;
const oldCategory = docs[sources[2]].formats.html.metadata.categories;
docs[sources[2]].formats.html.metadata.categories = ["**authored**"];
await rejects(
  () => api.auditNativeListings(args()),
  "SOURCE.NATIVE_LISTING_UNSUPPORTED",
);
docs[sources[2]].formats.html.metadata.categories = oldCategory;
const oldWriter = docs[sources[2]].formats.html.pandoc["output-file"];
docs[sources[2]].formats.html.pandoc["output-file"] = "../../../outside.html";
await rejects(
  () => api.auditNativeListings(args()),
  "SOURCE.NATIVE_LISTING_WRITER_INVALID",
);
docs[sources[2]].formats.html.pandoc["output-file"] = oldWriter;
const oldPart = project.config.book.render[1];
project.config.book.render[1] = { ...oldPart, number: 1 } as any;
await rejects(
  () => api.auditNativeListings(args()),
  "SOURCE.NATIVE_LISTING_INPUT_CONSTRUCTOR_UNSUPPORTED",
);
project.config.book.render[1] = oldPart;
const oldInput = project.files.input.pop();
await rejects(
  () => api.auditNativeListings(args()),
  "SOURCE.NATIVE_LISTING_UNSUPPORTED",
);
project.files.input.push(oldInput!);
const forgedWriter = structuredClone(plans);
forgedWriter["student:index.qmd"].selectedWriters[0].privatePermission = true;
for (const p of Object.values(forgedWriter) as any[]) {
  p.planHash = await api.nativeListingPlanHash(p);
}
await rejects(
  () => api.validateNativeListingPlans(forgedWriter),
  "SOURCE.NATIVE_LISTING_UNSUPPORTED",
);
const aliasWriter = structuredClone(plans);
aliasWriter["student:index.qmd"].selectedWriters[0].artifact = "alias.html";
aliasWriter["student:index.qmd"].selectedWriters[0].outputUri = "/alias.html";
for (const p of Object.values(aliasWriter) as any[]) {
  p.planHash = await api.nativeListingPlanHash(p);
}
await rejects(
  () => api.validateNativeListingPlans(aliasWriter),
  "SOURCE.NATIVE_LISTING_UNSUPPORTED",
);
assert(
  typeof api.nativeListingInitializer === "function",
  "RED: missing finite initializer constructor",
);
const expectedInitializer = `

  window.document.addEventListener("DOMContentLoaded", function (_event) {
    const listingTargetEl = window.document.querySelector('#listing-text-topics .list');
    if (!listingTargetEl) {
      // No listing discovered, do not attach.
      return; 
    }

    const options = {
      valueNames: ['listing-title','listing-semester','listing-categories',{ data: ['index'] },{ data: ['categories'] },{ data: ['listing-date-sort'] },{ data: ['listing-title-sort'] }],
      
      searchColumns: ["listing-title","listing-author"],
    };

    window['quarto-listings'] = window['quarto-listings'] || {};
    window['quarto-listings']['listing-text-topics'] = new List('listing-text-topics', options);

    if (window['quarto-listing-loaded']) {
      window['quarto-listing-loaded']();
    }
  });

  window.addEventListener('hashchange',() => {
    if (window['quarto-listing-loaded']) {
      window['quarto-listing-loaded']();
    }
  })
  `;
assert(
  api.nativeListingInitializer(plans["student:text/index.qmd"]) ===
    expectedInitializer,
  "exact stock inline initialization incl hidden search/sort defaults",
);
const forgedInitializer = structuredClone(plans["student:text/index.qmd"]);
forgedInitializer.declarations[0].id = "x');fetch('private";
await rejects(
  () => api.nativeListingInitializer(forgedInitializer),
  "SOURCE.NATIVE_LISTING_UNSUPPORTED",
);
const pandoc = Deno.env.get("PANDOC") ||
  "/tmp/quarto-tools-recovery-20261002/tooling/quarto-stable-1.10.18/bin/tools/x86_64/pandoc";
const luaModule = new URL(
  "../_extensions/course-core/owner-preflight/native-listing-constructors.lua",
  import.meta.url,
).pathname;
const planPath = root + "/plan.json";
await Deno.writeTextFile(
  planPath,
  JSON.stringify(plans["student:text/index.qmd"]),
);
const base64 = (v: string) => btoa(encodeURIComponent(v));
const syntheticTable = `:::{#quarto-listing-pipeline .hidden}
[$e = mC^2$]{.hidden .quarto-markdown-envelope-contents render-id="cXVhcnRvLWVuYWJsZS1tYXRoLWlubGluZQ=="}

:::{.hidden .quarto-markdown-envelope-contents render-id="cGlwZWxpbmUtbGlzdGluZy10ZXh0LXRvcGljcw=="}

\`\`\`{=html}
<table class="quarto-listing-table table">
<thead>
<tr>

<th>
Тема исследования
</th>

<th>
Семестр
</th>

<th>
Ключевые слова
</th>

</tr>
</thead>
<tbody class="list">

<tr data-index='0' data-categories='${
  base64("UTF-8,Строки")
}' data-listing-file-modified-sort='${
  plans["student:text/index.qmd"].declarations[0].rows[0].mtimeMs
}' data-listing-reading-time-sort='1' data-listing-word-count-sort='10' data-listing-title-sort='Символ и его байтовое представление' data-listing-filename-sort='index.qmd'>
\`\`\`

<td><a href="/text/representation/index.qmd" class="title listing-title">Символ и его байтовое представление</a></td>

<td><span class="listing-semester">1</span></td>

<td><span class="listing-categories">UTF-8, Строки</span></td>

\`\`\`{=html}

</tr>

<tr data-index='1' data-categories='${
  base64("Массивы,Границы компонентов")
}' data-listing-file-modified-sort='${
  plans["student:text/index.qmd"].declarations[0].rows[2].mtimeMs
}' data-listing-reading-time-sort='1' data-listing-word-count-sort='20' data-listing-title-sort='Сохранность данных на границе компонентов' data-listing-filename-sort='index.qmd'>
\`\`\`

<td><a href="/text/immutability/index.qmd" class="title listing-title">Сохранность данных на границе компонентов</a></td>

<td><span class="listing-semester">2</span></td>

<td><span class="listing-categories">Массивы, Границы компонентов</span></td>

\`\`\`{=html}

</tr>

<tr data-index='2' data-categories='${
  base64("Декодирование,Контракты")
}' data-listing-file-modified-sort='${
  plans["student:text/index.qmd"].declarations[0].rows[1].mtimeMs
}' data-listing-reading-time-sort='1' data-listing-word-count-sort='30' data-listing-title-sort='Строгое декодирование UTF-8' data-listing-filename-sort='index.qmd'>
\`\`\`

<td><a href="/text/decoding/index.qmd" class="title listing-title">Строгое декодирование UTF-8</a></td>

<td><span class="listing-semester">1</span></td>

<td><span class="listing-categories">Декодирование, Контракты</span></td>

\`\`\`{=html}

</tr>

</tbody>
</table>
\`\`\`

\`\`\`{=html}
<div class="listing-no-matching d-none">Нет подходящих элементов</div>
\`\`\`

:::
:::
`;
const luaTest = root + "/test.lua";
await Deno.writeTextFile(
  luaTest,
  `local f=io.open(${
    JSON.stringify(luaModule)
  },'rb');assert(f,'RED: missing exact finite Listing constructor');f:close()
local c=dofile(${JSON.stringify(luaModule)})
local function read(path)local f=assert(io.open(path,'rb'));local s=f:read('*all');f:close();return s end
local plan=pandoc.json.decode(read(${JSON.stringify(planPath)}),false)
local function read_headers(reader) local headers={}
for _,r in ipairs(plan.declarations[1].rows) do local bytes=read(plan.root..'/'..r.source);local d=pandoc.read(bytes,reader,PANDOC_READER_OPTIONS);headers[r.source]={header=pandoc.json.decode(pandoc.write(pandoc.Pandoc({d.blocks[1]}),'json'),false).blocks[1],plaintext=pandoc.utils.stringify(d.blocks[1].content),reader=reader,sourceSha1=pandoc.utils.sha1(bytes),sourceBytes=#bytes} end
return headers end
local headers=read_headers('markdown')
local function context(d)return {listingBlock=d.blocks[1],reader='markdown',options=PANDOC_READER_OPTIONS,rowHeaders=headers} end
local function check(d)return c.verify(d,plan,context(d)) end
local function reject(d,code)local ok,err=pcall(check,d);assert(not ok and tostring(err):find(code,1,true),'expected '..code..', got '..tostring(err))end
return {{Pandoc=function(doc)
local before=pandoc.write(doc,'json');local result=check(doc);assert(pandoc.write(doc,'json')==before,'constructor mutated input');assert(#result.carrierOccurrences==29,'complete 3-row semester carrier accounting');assert(#result.addresses==3,'all selected row addresses retained');assert(result.addresses[1].targetSource=='text/representation/index.qmd' and result.addresses[2].targetSource=='text/immutability/index.qmd' and result.addresses[3].targetSource=='text/decoding/index.qmd','native title order bound to source candidates')
local loggedErrors={}
error=function(message) loggedErrors[#loggedErrors+1]=message;return nil end -- exact stock Quarto global error: logger only
local identityHeaders=read_headers('markdown-auto_identifiers')
assert(headers['text/representation/index.qmd'].header.c[2][1]=='sec-source' and identityHeaders['text/representation/index.qmd'].header.c[2][1]=='sec-source','public reader preserves explicit Source Header id in both modes')
assert(headers['text/decoding/index.qmd'].header.c[2][1]~='' and identityHeaders['text/decoding/index.qmd'].header.c[2][1]=='','public reader effective identity disables only implicit ids')
local identityContext={listingBlock=doc.blocks[1],reader='markdown-auto_identifiers',identity=true,options=PANDOC_READER_OPTIONS,rowHeaders=identityHeaders}
local headerBefore=pandoc.json.encode(identityHeaders)
local identityResult=c.verify(doc,plan,identityContext)
assert(#identityResult.carrierOccurrences==29 and #identityResult.addresses==3,'identity effective reader retains exact complete constructor')
assert(pandoc.write(doc,'json')==before and pandoc.json.encode(identityHeaders)==headerBefore,'identity matcher mutated native AST or Source Header witnesses')
local function rejectContext(reader,identity,rowHeaders) local ok,err=pcall(c.verify,doc,plan,{listingBlock=doc.blocks[1],reader=reader,identity=identity,options=PANDOC_READER_OPTIONS,rowHeaders=rowHeaders});assert(not ok and tostring(err):find('SOURCE.NATIVE_LISTING_CONSTRUCTOR_MISMATCH',1,true),'wrong effective reader/context accepted')end
rejectContext('markdown-auto_identifiers',false,identityHeaders)
rejectContext('markdown-auto_identifiers',nil,identityHeaders)
rejectContext('markdown',true,headers)
rejectContext('markdown-auto_identifiers','true',identityHeaders)
rejectContext('gfm',true,identityHeaders)
rejectContext('markdown-auto_identifiers',true,headers)
rejectContext('markdown',false,identityHeaders)
local changed=doc:clone():walk({RawInline=function(r)if r.text:find('href=',1,true) then r.text=r.text:gsub('/text/representation/index.qmd','/raw-private.qmd');return r end end});reject(changed,'SOURCE.NATIVE_LISTING_CONSTRUCTOR_MISMATCH')
local changed=doc:clone():walk({RawBlock=function(r)r.text=r.text:gsub("word%-count%-sort='10'","word-count-sort='999999999'");return r end});reject(changed,'SOURCE.NATIVE_LISTING_NUMERIC_SLOT_INVALID')
local changed=doc:clone():walk({RawBlock=function(r)r.text=r.text:gsub("reading%-time%-sort='1'","reading-time-sort='2'");return r end});reject(changed,'SOURCE.NATIVE_LISTING_NUMERIC_SLOT_INVALID')
local changed=doc:clone();changed.blocks[1].content:insert(pandoc.RawBlock('html','<img src="private">'));reject(changed,'SOURCE.NATIVE_LISTING_CONSTRUCTOR_MISMATCH')
local old=headers['text/representation/index.qmd'].plaintext;headers['text/representation/index.qmd'].plaintext='Different lexical title';reject(doc,'SOURCE.NATIVE_LISTING_CONSTRUCTOR_MISMATCH');headers['text/representation/index.qmd'].plaintext=old
assert(#loggedErrors==0,'constructor refusal used logging-only globalerror instead of builtinassert')
io.stderr:write('PASS pure Listing constructor: exact math/3row/semester/all29 carriers, ordinary+identity Reader/Header proof, wrong-context/href/title/numeric negatives; no native proof\\n')
return doc end}}
`,
);
const command = new Deno.Command(pandoc, {
  args: ["--from=markdown", "--to=json", "--lua-filter=" + luaTest],
  stdin: "piped",
  stdout: "piped",
  stderr: "piped",
}).spawn();
const writer = command.stdin.getWriter();
await writer.write(new TextEncoder().encode(syntheticTable));
await writer.close();
const result = await command.output();
assert(result.code === 0, new TextDecoder().decode(result.stderr));
console.log(new TextDecoder().decode(result.stderr).trim());
await api.currentNativeListingPlans(plans);
await Deno.writeTextFile(
  root + "/" + sources[2],
  "# Renamed or current changed Source\n",
);
await rejects(
  () => api.currentNativeListingPlans(plans),
  "SOURCE.NATIVE_LISTING_SOURCE_CHANGED",
);
console.log(
  "PASS finite NativeListing contracts: original4/selected5 synthetic Source model; strict unsupported fields/URIs/pagination/title branch/current-byte refusals (no native permission)",
);
