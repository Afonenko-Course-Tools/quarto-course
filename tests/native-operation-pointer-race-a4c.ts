import { join } from "stdlib/path";
import { captureFixture } from "./helpers/native-capture-a4c.ts";
const r = await captureFixture(), foreign = crypto.randomUUID();
const wrapper = await Deno.makeTempFile({
  prefix: "a4c-ordinary-pointer-",
  suffix: ".sh",
});
await Deno.writeTextFile(
  wrapper,
  `#!/bin/bash
/opt/quarto/bin/quarto "$@"
code=$?
if [[ "$1" == inspect && "$code" == 0 ]]; then
python - <<'PY'
import json
from pathlib import Path
p=Path(${JSON.stringify(r.root)})/'_generated/course-spec/native-ts'
(p/'active.json').write_text(json.dumps({'operation':${
    JSON.stringify(foreign)
  },'directory':str(p/${JSON.stringify(foreign)})}))
PY
fi
exit "$code"
`,
);
await Deno.chmod(wrapper, 0o700);
const native = await new Deno.Command("quarto", {
  args: ["render", "index.qmd", "--to", "html"],
  cwd: r.root,
  env: {
    QUARTO: wrapper,
    QUARTO_RUN_NO_NETWORK: "true",
    DENO_NO_PACKAGE_JSON: "1",
  },
  stdout: "piped",
  stderr: "piped",
}).output();
const log = new TextDecoder().decode(native.stdout) +
  new TextDecoder().decode(native.stderr);
const pointer = JSON.parse(
  await Deno.readTextFile(
    join(r.root, "_generated/course-spec/native-ts/active.json"),
  ),
);
if (
  native.success || !log.includes("OPERATION_CHANGED") ||
  pointer.operation !== foreign
) {
  throw Error(
    "ordinary pre overwrote newer active pointer: " +
      JSON.stringify({ code: native.code, pointer, root: r.root }),
  );
}
console.log(
  JSON.stringify({ status: "PASS", root: r.root, foreign, code: native.code }),
);
