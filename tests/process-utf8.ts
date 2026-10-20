import {command} from '../_extensions/course-core/infrastructure/process.ts';
const invoke=(bytes:number[])=>command(Deno.execPath(),['eval','await Deno.stdout.write(new Uint8Array('+JSON.stringify(bytes)+'))'],Deno.cwd());
const original='\uFEFF  Я\n';
if(await invoke([...new TextEncoder().encode(original)])!==original)throw Error('Stock UTF-8 stdout was transformed');
let refused=false;try{await invoke([0xC3,0x28])}catch{refused=true}
if(!refused)throw Error('Invalid UTF-8 stdout accepted');console.log('PASS exact UTF-8 stdout and invalid encoding refusal');
