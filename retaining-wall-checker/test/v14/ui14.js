// node ui14.js <model> <rwall>: real clicks on v14 features + screenshots
const { chromium } = require('playwright');const path=require('path'),fs=require('fs');
(async()=>{const b=await chromium.launch(),ctx=await b.newContext({acceptDownloads:true,viewport:{width:1500,height:1000}}),pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(String(e)));pg.on('dialog',d=>d.dismiss());
await pg.goto('file://'+path.resolve(process.argv[2]));await pg.waitForTimeout(800);
await pg.evaluate(()=>{const m=document.getElementById('mdl');if(m&&!m.hidden)mclose()});
await pg.evaluate(()=>{loadDefault('T');S.jno='Test';S.pn='CS0000';ri();sv();rr()});
// DXF via menu
await pg.click('summary:has-text("File")');await pg.click('button[data-a="dxf"]');await pg.waitForTimeout(200);
const [dl]=await Promise.all([pg.waitForEvent('download'),pg.click('#mdl button[data-a="dxfgo"]')]);await dl.saveAs('ui_dxf.dxf');console.log('dxf download',dl.suggestedFilename());
// BMD view
await pg.click('#fg button[data-v="bmd"]');await pg.waitForTimeout(300);await (await pg.$('#fg')).screenshot({path:'shot_bmd.png'});
await pg.click('#fg button[data-v="all"]');
// crest: front slope + tick in Step 3
await pg.evaluate(()=>{S.fon=1;S.bf=-30;S.Hf=7;ri();sv();rr();goStep(3)});await pg.waitForTimeout(200);
const ck=await pg.$('input[data-p="scon"]');console.log('crest checkbox',!!ck);await ck.click();await pg.waitForTimeout(300);
const ib=await pg.$('input[data-p="scb"]');await ib.fill('1.5');await ib.press('Enter');await pg.waitForTimeout(400);
console.log('S.scon',await pg.evaluate(()=>[S.scon,S.scb,scOn()]));await (await pg.$('#fg')).screenshot({path:'shot_crest.png'});
const txt=await pg.evaluate(()=>document.getElementById('r6').innerText);const i=txt.indexOf('Crest');console.log(txt.slice(i,i+520));
console.log('sec8 has crest item',await pg.evaluate(()=>/Bearing near slope crest/.test(document.body.innerText)));
await pg.click('summary:has-text("More")');await pg.click('#pvb');await pg.waitForTimeout(300);const r7=await pg.$('#r7');const hh=await pg.evaluate(()=>{const e=[...document.querySelectorAll('#r7 h3')].find(h=>/Bending moment/.test(h.textContent));e.scrollIntoView();return true});
await pg.waitForTimeout(200);await pg.screenshot({path:'shot_r7.png'});
console.log('errors',errs);await b.close()})();
