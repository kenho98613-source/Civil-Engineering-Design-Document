const { chromium } = require('playwright');const fs=require('fs'),path=require('path');
const [model,rw]=process.argv.slice(2);
(async()=>{const b=await chromium.launch(),pg=await b.newPage();const errs=[];pg.on('pageerror',e=>errs.push(String(e)));pg.on('dialog',d=>d.dismiss());
await pg.goto('file://'+path.resolve(model));await pg.waitForTimeout(800);
const r=await pg.evaluate(rwText=>{rwLoad(rwText,'x.rwall');const out=[];const nT=PJ.types.length;
 const snap=()=>{sync();ri();rr();const R=window.__RES,R0=R?R.R0:calcAll(),Fc=R0.Fc,A=R0.A;
  const rc=(R0.D0||R0.RS||[]);return{Fs:Fc.sl.F,uS:Fc.sl.u,Fo:Fc.ot.F,uO:Fc.ot.u,FbB:Fc.br.F,Nbr:Fc.br.b.N,ebr:Fc.br.b.e,brlab:Fc.br.lab,eS:A.sls.s.e,NS:A.sls.s.N,gS:A.sl.u,gO:A.ot.F,gB:A.br.u,gBlab:A.br.lab,
   stem:JSON.stringify((R0.RS||[]).filter?.(c=>c.k&&String(c.k).startsWith('s')).map(c=>[c.k,+c.M.toFixed(2),c.gov]))}};
 for(let i=0;i<nT;i++){PJ.types[PJ.active].S=S;PJ.active=i;S=pjGet(i);const nm=PJ.types[i].name;
  const a=snap();S.fdl=1;S.fdP=/Bay2/.test(nm)?2.55:5;S.fdS=3.26;const c=snap();S.fxo=0;const d=snap();S.fdl=0;S.fxo='';out.push({nm,off:a,on:c,front:d})}
 return out},fs.readFileSync(rw,'utf8'));
for(const x of r){console.log('\n##',x.nm);for(const k of Object.keys(x.off))console.log(k.padEnd(6),String(x.off[k]).slice(0,90).padEnd(30),'|',String(x.on[k]).slice(0,90),'| front:',String(x.front[k]).slice(0,90))}
console.log('errors',errs);await b.close()})();
