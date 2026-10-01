import {build} from 'esbuild';
import {copyFile,mkdir,writeFile} from 'node:fs/promises';
await build({stdin:{contents:"export {parseDocument,isAlias} from 'yaml'; export {v5} from 'uuid';",resolveDir:import.meta.dirname},bundle:true,format:'esm',platform:'neutral',outfile:'vendor/libraries.js',minify:true});
for (const pkg of ['yaml','uuid']) { await copyFile(`node_modules/${pkg}/LICENSE${pkg==='yaml'?'':'.md'}`,`vendor/${pkg}-LICENSE`); }
