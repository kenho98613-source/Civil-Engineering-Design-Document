// node crtest.js <model>  – slope-crest bearing: dump inputs + results for independent check
const { chromium } = require('playwright');const path=require('path'),fs=require('fs');
(async()=>{const b=await chromium.launch(),pg=await b.newPage();const errs=[];pg.on('pageerror',e=>errs.push(String(e)));pg.on('dialog',d=>d.dismiss());
await pg.goto('file://'+path.resolve(process.argv[2]));await pg.waitForTimeout(800);
const r=await pg.evaluate(()=>{const out=[];
 for(const acc of['gg1','fc'])for(const sb of[null,0,0.5,1.5,3,100]){loadDefault('L');S.acc=acc;S.fon=1;S.bf=-30;S.Hf=7;if(sb!=null){S.scon=1;S.scb=sb}else S.scon=0;
  sync();ri();rr();const R0=window.__RES.R0;const br=acc=='gg1'?R0.A.br:R0.Fc.br,r=acc=='gg1'?br.r:br.rr;
  const P=acc=='gg1'?R0.Pf:null;
  out.push({acc,sb,N:br.b.N,H:acc=='gg1'?br.Hb:br.b.H-(S.ppB?br.b.Hp:0),B:R0.G.B,e:br.b.e,Bp:r.Bp,phi:acc=='gg1'?R0.Pf.phf:+S.f.phi,c:acc=='gg1'?R0.Pf.cF:+S.f.c,gEff:gEffBase(br.C),q:br.ob.q,Zb:+S.Zb,Hf:+S.Hf,
   qu:r.qu,qucap:acc=='gg1'?r.qu:br.qu,sc:r.sc?{qA:r.sc.qA,qB:r.sc.qB,xA:r.sc.xA,L4:r.sc.L4,d:r.sc.d,be:r.sc.be}:null,u:acc=='gg1'?br.u:br.F,
   rep:(document.getElementById('r6')||{}).innerText.split('\n').filter(l=>/Crest|qA|qB|q\(b\)|qult|qu\b|Ultimate/.test(l)).slice(0,8)})}
 return out});
console.log(JSON.stringify(r,null,1));console.log('errors',errs);await b.close()})();
