// node dxftest.js <model.html> <rwall> <outdir>  – writes one DXF per case
const { chromium } = require('playwright');const fs=require('fs'),path=require('path');
const [model,rw,out]=process.argv.slice(2);fs.mkdirSync(out,{recursive:true});
(async()=>{const b=await chromium.launch(),pg=await b.newPage();const errs=[];pg.on('pageerror',e=>errs.push(String(e)));pg.on('dialog',d=>d.dismiss());
await pg.goto('file://'+path.resolve(model));await pg.waitForTimeout(800);
const r=await pg.evaluate(([rwText,SC])=>{const o=[];const go=(n)=>{sync();try{o.push([n,dxfText({sc:SC,name:n})])}catch(e){o.push([n,'ERR '+e.stack])}};
 for(const ty of['T','L','Li','G']){loadDefault(ty);go('default_'+ty)}
 // terraced (stems on base) and U-channel via wizard defaults
 loadDefault('T');const d=wzFromS();d.ty='T';d.lay='t2';try{wizBuild(d);go('terraced_t2')}catch(e){o.push(['terraced_t2','ERR '+e])}
 loadDefault('T');const u=wzFromS();u.ty='T';u.lay='U';try{wizBuild(u);go('uchannel')}catch(e){o.push(['uchannel','ERR '+e])}
 loadDefault('T');S.skon=1;S.skw=.4;S.skd=.5;S.skx=1;S.wo=1;S.wh=1.8;go('T_key_fence');
 loadDefault('L');S.bon=1;S.br=20;S.brL=2;S.fon=1;S.bf=-30;go('L_slopes');
 rwLoad(rwText,'cs.rwall');for(let i=0;i<PJ.types.length;i++){PJ.types[PJ.active].S=S;PJ.active=i;S=pjGet(i);go('cs_'+i)}
 return o},[fs.readFileSync(rw,"utf8"),+(process.env.SC||100)]);
for(const[n,t]of r){fs.writeFileSync(path.join(out,n+'.dxf'),t);console.log(n,t.startsWith('ERR')?t.slice(0,300):t.length)}
console.log('errors',errs);await b.close()})();
