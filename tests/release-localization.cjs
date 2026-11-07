/** @type {Pick<typeof import('playwright'), 'chromium'>} */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox']});try{
for(const lang of ['ru','en','de']){
 const page=await browser.newPage();await page.setContent(`<html lang="${lang}"><body><div id="quarto-search"><div class="aa-Autocomplete" aria-label="Search"></div><button title="Search"></button></div><a class="anchorjs-link" aria-label="Anchor"></a><div class="reveal"><div class="speaker-notes"><div class="notes-placeholder">No notes on this slide.</div></div></div></body></html>`);
 await page.evaluate(()=>{const element = document.querySelector('.reveal');
 if (!(element instanceof HTMLElement)) throw new Error('Нет reveal');
 window.Reveal={isReady:()=>true,isSpeakerNotes:()=>false,getRevealElement:()=>element,configure:()=>{},on:()=>{},off:()=>{},
 getConfig:()=>({}),getCurrentSlide:()=>undefined,getSlides:()=>[],getIndices:()=>({h:0,v:0}),slide:()=>{},
 availableFragments:()=>({prev:false,next:false}),prev:()=>{},next:()=>{},layout:()=>{},toggleOverview:()=>{}}});
 await page.addScriptTag({path:path.resolve(__dirname,'../_extensions/course-presentation/presentation.js')});
 assert.equal(await page.locator('#quarto-search button').getAttribute('title'),lang==='ru'?'Поиск':'Search');
 assert.equal(await page.locator('.anchorjs-link').getAttribute('aria-label'),lang==='ru'?'Ссылка на раздел':'Anchor');
 assert.equal(await page.locator('.notes-placeholder').textContent(),lang==='ru'?'Заметок к этому слайду нет.':'No notes on this slide.');
 await page.evaluate(()=>{const link=document.createElement('a');link.className='anchorjs-link';link.setAttribute('aria-label','Anchor');document.body.append(link)});
 await page.waitForTimeout(30);
 assert.equal(await page.locator('.anchorjs-link').last().getAttribute('aria-label'),lang==='ru'?'Ссылка на раздел':'Anchor');
 await page.close();
}
console.log('PASS русские подписи, динамические якоря и отсутствие вмешательства в en/de');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
