import {join,resolve} from 'stdlib/path';
/** Фиксирует фактический CLI до установки тестового счётного wrapper. */
export async function quartoExecutableForTest():Promise<string>{
 const bin=Deno.env.get('QUARTO_BIN_PATH'),requested=Deno.env.get('QUARTO')||(bin?join(bin,'quarto'):'quarto');
 const paths=requested.includes('/')||requested.includes('\\')?[resolve(requested)]:(Deno.env.get('PATH')||'').split(Deno.build.os==='windows'?';':':').map(dir=>resolve(dir||'.',requested));
 if(requested==='quarto'&&bin)paths.push(resolve(bin,'quarto'));
 for(const path of paths)try{if((await Deno.stat(path)).isFile)return await Deno.realPath(path)}catch(e){if(!(e instanceof Deno.errors.NotFound))throw e}
 throw Error('Не найден исполняемый Quarto: '+requested);
}
