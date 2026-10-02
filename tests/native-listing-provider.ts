import { dirname, fromFileUrl, join } from "stdlib/path";
const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const moduleURL = new URL(
  "../_extensions/course-core/owner-preflight/native-listing-provider.ts",
  import.meta.url,
);
const provider: any = await import(moduleURL.href);
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
let checks = 0;
async function rejects(
  operation: () => unknown | Promise<unknown>,
  message: string,
) {
  let rejected = false;
  try {
    await operation();
  } catch (error) {
    assert(
      (error as { code?: string }).code ===
        "LISTING.NATIVE_PROVIDER_UNSUPPORTED",
      "Provider refusal must retain structured code: " + message,
    );
    rejected = true;
  }
  assert(rejected, message);
  checks++;
}
const state = await Deno.makeTempDir({
  prefix: "native-listing-provider-policy-",
});
try {
  // Skipping unknown first PATH candidate or trusting --paths/version breaks this.
  const shadow = join(state, "shadow");
  await Deno.mkdir(shadow);
  const marker = join(state, "wrapper-executed");
  await Deno.writeTextFile(
    join(shadow, "quarto"),
    `#!/bin/sh\nprintf called > '${marker}'\nprintf '/claimed/bin\n/claimed/share\n'\n`,
  );
  await Deno.chmod(join(shadow, "quarto"), 0o755);
  await rejects(
    () =>
      provider.resolveNativeListingProvider("quarto", {
        cwd: repo,
        env: { PATH: shadow + ":" + (Deno.env.get("PATH") || "") },
      }),
    "First PATH candidate custom launcher must refuse before --paths execution",
  );
  assert(!await exists(marker), "Unsupported launcher was executed");
  checks++;
  const fixtures: Record<string, any[]> = {
    "1.10.18": [
      {
        "relative": "bin/quarto",
        "bytes": 8061,
        "sha256":
          "72632b5b855ffec9db28a098cf62b9b83a80c57174bfa733b2b399a7bdef037f",
      },
      {
        "relative": "bin/quarto.js",
        "bytes": 7294091,
        "sha256":
          "34f291359d2fc61c308193e546b76efba6f0ffcd74d1d3be0ae9264f30ce6b1d",
      },
      {
        "relative": "share/version",
        "bytes": 7,
        "sha256":
          "0ab5f9190cba41c6e6d3629fd39ddb8edc91602fbb789f22e61df7b35fb15637",
      },
      {
        "relative": "share/projects/website/listing/listing-table.ejs.md",
        "bytes": 2670,
        "sha256":
          "2b951ca1471824d894b8826de254d775900510e88db62b613233460acaa5c57b",
      },
      {
        "relative": "share/projects/website/listing/_filter.ejs.md",
        "bytes": 1657,
        "sha256":
          "c6996b536bcd9614b0de4e166bf800657686af74b6e3e4a37af7d676235269e2",
      },
      {
        "relative": "share/projects/website/listing/_pagination.ejs.md",
        "bytes": 320,
        "sha256":
          "b6a38bc5965b76b9a2b458ae624d7f6ad2c324f0f8622817b79fbe99564dd648",
      },
      {
        "relative": "share/projects/website/listing/_metadata.ejs.md",
        "bytes": 410,
        "sha256":
          "f66c18667dbad660657227639e377650d25ae98791c97be772e60346ed95fd3b",
      },
      {
        "relative": "share/projects/website/listing/list.min.js",
        "bytes": 19446,
        "sha256":
          "1efd7641f4c65889093d8410037e78791c9ce951b2d71457777caaa40b816b77",
      },
      {
        "relative": "share/projects/website/listing/quarto-listing.js",
        "bytes": 7111,
        "sha256":
          "48c09833376066bdeafd898d8e56b5992c6b756e4d44acaada2cc0e73bcbcfe2",
      },
      {
        "relative": "share/filters/qmd-reader.lua",
        "bytes": 568,
        "sha256":
          "8ac561d3e954894cc35dd968740e9155f74a953fbcdafb089bf3210f360ca08f",
      },
      {
        "relative": "share/filters/main.lua",
        "bytes": 844251,
        "sha256":
          "7f55875abad8c72bdbad3862bd907874d2f038b4fc513c8afdeb52be7820258d",
      },
      {
        "relative": "share/language/_language.yml",
        "bytes": 4140,
        "sha256":
          "a8a58c1db2ba3af735160ef9d29e26e1830c109a10cc351def7d8f2a75a3ac6e",
      },
      {
        "relative": "share/env/env.defaults",
        "bytes": 128,
        "sha256":
          "84571ff6332a99c0e9cbe6826ac362a9f15b1c7114b258c0fb4947296053f353",
      },
      {
        "relative": "bin/tools/x86_64/deno",
        "bytes": 124242912,
        "sha256":
          "83ae80d34812cb7a4f246a21f707901b71fa937461500f5f0a2e19865115f3fb",
      },
      {
        "relative": "bin/tools/x86_64/pandoc",
        "bytes": 162316016,
        "sha256":
          "8fedc028b2314cd649b6cabf363c94a7c940aff352a1c20753ffb0875f083cac",
      },
      {
        "relative": "bin/tools/x86_64/deno_dom/libplugin.so",
        "bytes": 4856624,
        "sha256":
          "3885e8d6443955bdf6f2b2630dbd4b0d7e0d5fef255a23bae34f1d26f577dec5",
      },
      {
        "relative": "share/pandoc/datadir/readqmd.lua",
        "bytes": 8999,
        "sha256":
          "dc35388e9f18602f6e2a672c90fb3bcbc9734e3f5c0f02ac9f94ab37eec32123",
      },
      {
        "relative": "share/pandoc/datadir/lpegshortcode.lua",
        "bytes": 12779,
        "sha256":
          "b2585b0c4ac4fde573a4e62ee8c41c3c9a41c684435cc4f402250f0c964b42c8",
      },
      {
        "relative": "share/pandoc/datadir/lpegfenceddiv.lua",
        "bytes": 5070,
        "sha256":
          "a390b9f9a076c93692c9b0b6d6d9bf4291756aacb0524b352790ca0b1d185159",
      },
      {
        "relative": "share/pandoc/datadir/init.lua",
        "bytes": 35438,
        "sha256":
          "e2a234ce9fdca0c0bff1712b1fe95b64e06db32fdefbcdd2ebd4587e9b222fea",
      },
      {
        "relative": "share/formats/html/quarto.js",
        "bytes": 26830,
        "sha256":
          "4ecb60f215d96b2af0fe9d985c71e32863b1c993a64725a416ac18b5991c59c6",
      },
    ],
    "1.11.5": [
      {
        "relative": "bin/quarto",
        "bytes": 8061,
        "sha256":
          "72632b5b855ffec9db28a098cf62b9b83a80c57174bfa733b2b399a7bdef037f",
      },
      {
        "relative": "bin/quarto.js",
        "bytes": 7372723,
        "sha256":
          "fe7a7982126244c432986898f3a7c6750b8c518c45a3433c3809f2a39705daf3",
      },
      {
        "relative": "share/version",
        "bytes": 6,
        "sha256":
          "968e6f0aed8a073a0d1d710d79713808bfdd613f8ce6e29460513192f012b466",
      },
      {
        "relative": "share/projects/website/listing/listing-table.ejs.md",
        "bytes": 2670,
        "sha256":
          "2b951ca1471824d894b8826de254d775900510e88db62b613233460acaa5c57b",
      },
      {
        "relative": "share/projects/website/listing/_filter.ejs.md",
        "bytes": 1657,
        "sha256":
          "c6996b536bcd9614b0de4e166bf800657686af74b6e3e4a37af7d676235269e2",
      },
      {
        "relative": "share/projects/website/listing/_pagination.ejs.md",
        "bytes": 320,
        "sha256":
          "b6a38bc5965b76b9a2b458ae624d7f6ad2c324f0f8622817b79fbe99564dd648",
      },
      {
        "relative": "share/projects/website/listing/_metadata.ejs.md",
        "bytes": 410,
        "sha256":
          "f66c18667dbad660657227639e377650d25ae98791c97be772e60346ed95fd3b",
      },
      {
        "relative": "share/projects/website/listing/list.min.js",
        "bytes": 19446,
        "sha256":
          "1efd7641f4c65889093d8410037e78791c9ce951b2d71457777caaa40b816b77",
      },
      {
        "relative": "share/projects/website/listing/quarto-listing.js",
        "bytes": 7111,
        "sha256":
          "48c09833376066bdeafd898d8e56b5992c6b756e4d44acaada2cc0e73bcbcfe2",
      },
      {
        "relative": "share/filters/qmd-reader.lua",
        "bytes": 568,
        "sha256":
          "8ac561d3e954894cc35dd968740e9155f74a953fbcdafb089bf3210f360ca08f",
      },
      {
        "relative": "share/filters/main.lua",
        "bytes": 845380,
        "sha256":
          "96686a69be52aaa96aea645c3c35db7325fa045cd2bc665335015e10cafbfd85",
      },
      {
        "relative": "share/language/_language.yml",
        "bytes": 4695,
        "sha256":
          "df8176a7fb1bceb1edd48419fdd4921fb2011b190c2ce7ec9aee60677a9b887c",
      },
      {
        "relative": "share/env/env.defaults",
        "bytes": 128,
        "sha256":
          "84571ff6332a99c0e9cbe6826ac362a9f15b1c7114b258c0fb4947296053f353",
      },
      {
        "relative": "bin/tools/x86_64/deno",
        "bytes": 124242912,
        "sha256":
          "83ae80d34812cb7a4f246a21f707901b71fa937461500f5f0a2e19865115f3fb",
      },
      {
        "relative": "bin/tools/x86_64/pandoc",
        "bytes": 162316016,
        "sha256":
          "8fedc028b2314cd649b6cabf363c94a7c940aff352a1c20753ffb0875f083cac",
      },
      {
        "relative": "bin/tools/x86_64/deno_dom/libplugin.so",
        "bytes": 4856624,
        "sha256":
          "3885e8d6443955bdf6f2b2630dbd4b0d7e0d5fef255a23bae34f1d26f577dec5",
      },
      {
        "relative": "share/pandoc/datadir/readqmd.lua",
        "bytes": 8999,
        "sha256":
          "dc35388e9f18602f6e2a672c90fb3bcbc9734e3f5c0f02ac9f94ab37eec32123",
      },
      {
        "relative": "share/pandoc/datadir/lpegshortcode.lua",
        "bytes": 12779,
        "sha256":
          "b2585b0c4ac4fde573a4e62ee8c41c3c9a41c684435cc4f402250f0c964b42c8",
      },
      {
        "relative": "share/pandoc/datadir/lpegfenceddiv.lua",
        "bytes": 5070,
        "sha256":
          "a390b9f9a076c93692c9b0b6d6d9bf4291756aacb0524b352790ca0b1d185159",
      },
      {
        "relative": "share/pandoc/datadir/init.lua",
        "bytes": 36499,
        "sha256":
          "f02efaefe1fa494d5c60d4d4f918c12352fb3cc7263de05e64e182dfc0a03233",
      },
      {
        "relative": "share/formats/html/quarto.js",
        "bytes": 26830,
        "sha256":
          "4ecb60f215d96b2af0fe9d985c71e32863b1c993a64725a416ac18b5991c59c6",
      },
    ],
  };
  // Independent facts recorded from both verified official archives.
  for (const [version, facts] of Object.entries(fixtures)) {
    assert(
      provider.matchNativeListingProviderCatalog(facts).version === version,
      "Known exact native constructor set must select its own channel",
    );
    checks++;
    for (const fact of facts) {
      const changed = structuredClone(facts);
      changed.find((x: any) => x.relative === fact.relative).sha256 = "0"
        .repeat(64);
      await rejects(
        () => provider.matchNativeListingProviderCatalog(changed),
        "Changed critical constructor/tool/reader/asset must refuse: " +
          fact.relative,
      );
    }
    await rejects(
      () => provider.matchNativeListingProviderCatalog(facts.slice(1)),
      "Omitted provider witness must refuse",
    );
    await rejects(
      () => provider.matchNativeListingProviderCatalog([...facts, facts[0]]),
      "Duplicate provider witness must refuse",
    );
    const extra = structuredClone(facts);
    extra[0].relative = "share/custom/reader.lua";
    await rejects(
      () => provider.matchNativeListingProviderCatalog(extra),
      "Unknown substituted provider witness must refuse",
    );
  }
  const paths = {
    executable: "/selected/bin/quarto",
    binPath: "/selected/bin",
    sharePath: "/selected/share",
    denoPath: "/selected/bin/tools/x86_64/deno",
    pandocPath: "/selected/bin/tools/x86_64/pandoc",
    domPath: "/selected/bin/tools/x86_64/deno_dom/libplugin.so",
  };
  provider.assertNativeListingProviderEnvironment(paths, {});
  checks++;
  const generated = {
    QUARTO_BIN_PATH: paths.binPath,
    QUARTO_SHARE_PATH: paths.sharePath,
    QUARTO_DENO: paths.denoPath,
    QUARTO_PANDOC: paths.pandocPath,
    QUARTO_DENO_DOM: paths.domPath,
  };
  provider.assertNativeListingProviderEnvironment(paths, generated);
  checks++;
  for (const key of Object.keys(generated)) {
    await rejects(() =>
      provider.assertNativeListingProviderEnvironment(paths, {
        ...generated,
        [key]: "/other/provider",
      }), "Mixed selected roots must refuse: " + key);
  }
  for (
    const [key, value] of Object.entries({
      QUARTO_DEV_MODE: "true",
      QUARTO_FORCE_VERSION: "1.10.18",
      QUARTO_IMPORT_MAP_ARG: "--import-map=/other.json",
      QUARTO_DENO_EXTRA_OPTIONS: "--eval=arbitrary",
      QUARTO_DENO_V8_OPTIONS: "--allow-natives-syntax",
      QUARTO_TS_PROFILE: "true",
      QUARTO_LUA_CPATH: "/other/?.so",
    })
  ) {
    await rejects(
      () =>
        provider.assertNativeListingProviderEnvironment(paths, {
          [key]: value,
        }),
      "Effective source/runtime override must refuse: " + key,
    );
  }
  // Known release launcher overwrites these, so they cannot redirect it.
  provider.assertNativeListingProviderEnvironment(paths, {
    QUARTO_TARGET: "/ignored.ts",
    QUARTO_ACTION: "eval",
    QUARTO_DENO_OPTIONS: "--ignored",
  });
  checks++;
  const stockBin = Deno.env.get("QUARTO_BIN_PATH");
  assert(
    stockBin,
    "Integration must run in actual stock Quarto run environment",
  );
  const stock = join(stockBin, "quarto");
  const current = await provider.resolveNativeListingProvider(stock, {
    cwd: repo,
  });
  assert(
    current.executable === await Deno.realPath(stock),
    "Binding must select actual canonical launcher",
  );
  assert(
    current.files.length === 21,
    "Binding must cover all required witnesses",
  );
  assert(
    current.assets.listMin.librarySubpath === "quarto-listing/list.min.js" &&
      current.assets.listingJS.librarySubpath ===
        "quarto-listing/quarto-listing.js" &&
      current.assets.htmlJS.librarySubpath === "quarto-html/quarto.js",
    "Native dependency destinations must match stock",
  );
  checks += 3;
  await provider.validateNativeListingProviderBinding(current, { cwd: repo });
  checks++;
  const forged = structuredClone(current);
  forged.assets.listingJS.librarySubpath = "author/other.js";
  await rejects(
    () => provider.validateNativeListingProviderBinding(forged, { cwd: repo }),
    "Forged asset destination must refuse",
  );
  const link = join(state, "stock-quarto");
  await Deno.symlink(stock, link);
  const viaLink = await provider.resolveNativeListingProvider(link, {
    cwd: repo,
  });
  assert(
    viaLink.sha256 === current.sha256,
    "Validated launcher symlink resolves same canonical binding",
  );
  checks++;
  // Isolated byte-exact copy. Replace its template link before mutation.
  const clone = join(state, "package");
  await Deno.mkdir(join(clone, "bin"), { recursive: true });
  for (const fact of current.files) {
    const target = join(clone, fact.relative);
    await Deno.mkdir(dirname(target), { recursive: true });
    await Deno.link(fact.path, target);
  }
  const cloneEnv = {
    QUARTO_BIN_PATH: join(clone, "bin"),
    QUARTO_SHARE_PATH: join(clone, "share"),
    QUARTO_DENO: join(clone, "bin/tools/x86_64/deno"),
    QUARTO_PANDOC: join(clone, "bin/tools/x86_64/pandoc"),
    QUARTO_DENO_DOM: join(clone, "bin/tools/x86_64/deno_dom/libplugin.so"),
  };
  const cloned = await provider.resolveNativeListingProvider(
    join(clone, "bin/quarto"),
    { cwd: repo, env: cloneEnv },
  );
  const table = join(
    clone,
    "share/projects/website/listing/listing-table.ejs.md",
  );
  const bytes = await Deno.readFile(table);
  await Deno.remove(table);
  await rejects(
    () =>
      provider.validateNativeListingProviderBinding(cloned, {
        cwd: repo,
        env: cloneEnv,
      }),
    "Missing actual critical file must refuse with the provider structured code",
  );
  await Deno.writeFile(table, bytes);
  await Deno.remove(table);
  await Deno.writeFile(table, new Uint8Array([...bytes, 32]));
  await rejects(
    () =>
      provider.validateNativeListingProviderBinding(cloned, {
        cwd: repo,
        env: cloneEnv,
      }),
    "Current actual critical template byte drift must refuse",
  );
  const outside = join(state, "outside-template");
  await Deno.writeFile(outside, bytes);
  await Deno.remove(table);
  await Deno.symlink(outside, table);
  await rejects(
    () =>
      provider.resolveNativeListingProvider(join(clone, "bin/quarto"), {
        cwd: repo,
        env: cloneEnv,
      }),
    "Exact bytes through outside critical-file symlink must refuse",
  );
  console.log(
    JSON.stringify({
      status: "PASS",
      checks,
      version: current.version,
      nativeRenders: 0,
      publicCLI: "--paths only",
      criticalFiles: current.files.length,
    }),
  );
} finally {
  await Deno.remove(state, { recursive: true });
}
async function exists(path: string) {
  try {
    await Deno.stat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return false;
    throw error;
  }
}
