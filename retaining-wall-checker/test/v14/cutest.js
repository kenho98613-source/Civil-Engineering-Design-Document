const { chromium } = require('playwright');const path=require('path');
(async()=>{const b=await chromium.launch(),pg=await b.newPage();const errs=[];pg.on('pageerror',e=>errs.push(String(e)));
await pg.goto('file://'+path.resolve(process.argv[2]));await pg.waitForTimeout(800);
const r=await pg.evaluate(()=>{loadDefault('L');S.smb='slab';S.st[1].t=0.45;S.rc=S.rc||{};S.rc.s1={...rcv('s1'),d:25,s:150};sync();ri();rr();const R0=window.__RES.R0,DG=dgCalc(R0),e=R0.RS.find(x=>x.k=='s1'),G=R0.G,g=G.SG[1];
 return{fcu:+S.fcu,fy:+S.fy,rmin:+S.rmin,am:aMin(),gpA:gpF('gpA'),cm:e.cm,h:e.h,t0:g.xb0-g.xf0,t1:g.xb1-g.xf1,ts:g.ts,bot:g.bot,top:g.top,pts:DG.s1,cu:dgCU(R0,DG).s1,bars:rcv('s1'),lap:lapReq('s1'),
  row:[...document.querySelectorAll('#r7 table')].pop().innerText.split('\n').slice(0,4)}});
console.log(JSON.stringify(r));console.log('errors',errs);await b.close()})();
