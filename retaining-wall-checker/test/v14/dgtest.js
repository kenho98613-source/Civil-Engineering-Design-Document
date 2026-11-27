const { chromium } = require('playwright');const path=require('path'),fs=require('fs');
(async()=>{const b=await chromium.launch(),pg=await b.newPage();const errs=[];pg.on('pageerror',e=>errs.push(String(e)));pg.on('dialog',d=>d.dismiss());
await pg.goto('file://'+path.resolve(process.argv[2]));await pg.waitForTimeout(800);
const r=await pg.evaluate(rwText=>{const out=[];const chk=n=>{sync();ri();rr();const R0=window.__RES.R0,DG=dgCalc(R0);if(!DG){out.push([n,'no DG']);return}
  for(const e of R0.RS){const p=DG[e.k];if(!p){out.push([n,e.k,'no diag']);continue}const v=/^[sx]/.test(e.k)?p[0]:e.k=='T'?p[p.length-1]:e.k=='H'?p[0]:null;if(!v)continue;
   out.push([n,e.k,+e.M.toFixed(4),+v.M.toFixed(4),+e.V.toFixed(4),+v.V.toFixed(4),Math.abs(e.M-v.M)<1e-9&&Math.abs(e.V-v.V)<1e-9?'OK':'DIFF'])}};
 for(const acc of['fc','gg1'])for(const ty of['T','L','Li','G']){S.acc=acc;loadDefault(ty);S.acc=acc;chk(`def ${ty} ${acc}`)}
 loadDefault('T');const d=wzFromS();d.ty='T';d.lay='t2';wizBuild(d);chk('terraced');
 loadDefault('T');S.wo=1;S.wh=2;chk('T wind fence');loadDefault('T');S.qin=10;chk('T qin');loadDefault('T');S.rck='ka';chk('T ka');
 rwLoad(rwText,'cs.rwall');for(let i=0;i<PJ.types.length;i++){PJ.types[PJ.active].S=S;PJ.active=i;S=pjGet(i);chk('cs'+i)}
 return out},fs.readFileSync(process.argv[3],'utf8'));
for(const x of r)console.log(x.join(' | '));console.log('errors',errs);await b.close()})();
