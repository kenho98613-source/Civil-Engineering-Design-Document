/* ---------------- v14.0 CR-3: BMD / SFD (ULS envelope), curtailment and lap length ----------------
   Diagrams: same load functions and combinations as Section 7 (rcActions with a diagram collector); value at the stem base / stem face = Section 7 value.
   Above the stem base the eccentric self-weight moment Me is taken as max(0, Me at the base) (conservative).
   Curtailment (CoP SUC 2013 Cl 9.2.1.6): 50 % of the main bars stop where the remaining 50 % satisfy bending and the minimum steel; bars extend beyond that
   theoretical point by max(d, 12φ) and, being stopped in a tension zone, by the anchorage length ℓb (Cl 8.4) – the greater governs.
   Lap length (CoP SUC 2013 Cl 8.7.4.1): ≥ tension anchorage length ℓb (factor 1.0 – lap not at the top of a pour with small cover, not at a corner, laps staggered), ≥ 15φ, ≥ 300 mm. */
function dgPut(dg,k,pts){if(!dg[k]){dg[k]=pts.map(p=>({...p}));return}dg[k].forEach((q,j)=>{const p=pts[j];if(!p)return;if(Math.abs(p.M)>Math.abs(q.M))q.M=p.M;if(Math.abs(p.V)>Math.abs(q.V))q.V=p.V})}
function dgCalc(R0){if(!R0||!R0.RS||!R0.RS.length)return null;const Pk=R0.Pk,ko=R0.ko,dK=Pk.d,kSet=S.rck=='ka'?[[Pk.Kah,dK]]:S.rck=='ko'?[[ko,0]]:[[Pk.Kah,dK],[ko,0]],DG={};
 for(const[K,d]of kSet)rcActions(K,d,DG);return DG}
const lbOf=phi=>{const fy=+S.fy,fcu=Math.min(+S.fcu,60),be=fy==250?.28:.5;return .87*fy*phi/(4*be*Math.sqrt(fcu))};
function lapReq(k,face){if(!/^s\d+$/.test(k)&&!/^x\d+$/.test(k))return null;if(/^s\d+$/.test(k)&&isG()&&!(S.st[+k.slice(1)]||{}).rc)return null;const r=rcv(k),phi=face==3?r.d3:r.d;if(!(phi>0))return null;
 const lb=lbOf(phi),L=Math.ceil(lb/phi-1e-9)*phi;return Math.ceil(Math.max(L,15*phi,300)/50-1e-9)*50}
function stemT(k,z,G){let m;if((m=k.match(/^s(\d+)$/))){const g=G.SG[+m[1]];if(!g)return null;const t0=g.xb0-g.xf0,t1=g.xb1-g.xf1;return z<=g.bot+1e-9?g.ts||t0:t0+(t1-t0)*(z-g.bot)/Math.max(g.h,1e-9)}
 if((m=k.match(/^x(\d+)(?:s(\d+))?$/))){const a=G.XS[+m[1]],sg=a&&a.segs[+(m[2]||0)];return sg?sg.t:null}return null}
// curtailment of 50 % of the main (tension) bars of a stem element
function curt(r,pts,G){if(!pts||pts.length<2||r.gv)return null;const bars=rcv(r.k),phi=bars.d,top=pts[pts.length-1].z,ok=[];
 for(const p of pts){if(p.M<0){ok.push(false);continue}const c=dsg({k:r.k,M:p.M,V:p.V,h:(stemT(r.k,p.z,G)||r.h/1000)*1000,cm:r.cm,co:r.co,ty:'s',gv:false,fn:r.fn});ok.push(c.okK&&Math.max(c.Asr,c.Asm)<=.5*c.Asp+1e-9?c:null)}
 let j=ok.length;while(j>0&&ok[j-1])j--;if(j>=ok.length){const pT=pts[pts.length-1],cT=dsg({k:r.k,M:Math.max(0,pT.M),V:pT.V,h:(stemT(r.k,pT.z,G)||r.h/1000)*1000,cm:r.cm,co:r.co,ty:'s',gv:false,fn:r.fn});
  return{none:1,why:cT.Asm>.5*cT.Asp?`50 % of the main bars (${f(.5*cT.Asp,0)} mm²/m) < minimum steel ${f(cT.Asm,0)} mm²/m – run full height`:'50 % of the main bars not sufficient below the top – run full height',phi,s:bars.s}}
 const c=ok[j],zt=pts[j].z,lb=lbOf(phi),ext=Math.max(c.d,12*phi,lb),zc=zt+ext/1000;
 if(zc>=top-1e-6)return{none:1,why:`theoretical point +${f(zt)} + ${f(ext,0)} mm reaches the top – run full height`,phi,s:bars.s,zt,ext,lb,d:c.d};
 return{phi,s:bars.s,zt,ext,lb,d:c.d,zc,need:Math.max(c.Asr,c.Asm),half:.5*c.Asp}}
// diagram panels (SVG) – stems: vertical axis = level; base: horizontal axis = x from the toe
function dgSvg(R0,DG,big,CU){CU=CU||dgCU(R0,DG);if(!DG)return'';const G=R0.G,RS=R0.RS.filter(r=>DG[r.k]),W=big?300:230,Hh=big?330:240,pan=[];const F=(v,d)=>f(v,d==null?1:d);
 for(const r of RS){if(!(/^[sx]/.test(r.k)))continue;const pts=DG[r.k],z0=pts[0].z,z1=pts[pts.length-1].z,C=CU[r.k];
  for(const[key,u,col]of[['M','kNm/m','#2563eb'],['V','kN/m','#dc2626']]){const mx=Math.max(1e-6,...pts.map(p=>Math.abs(p[key]))),x0=W/2-10,sx=(W/2-34)/mx,sy=(Hh-50)/Math.max(z1-z0,1e-6),X=v=>x0+v*sx,Y=z=>Hh-24-(z-z0)*sy;
   let o=`<svg viewBox="0 0 ${W} ${Hh}" class=dgp><text x="${W/2}" y="13" text-anchor="middle" class=dgt>${esc(r.n.replace(/ \(RC\)$/,''))} – ${key=='M'?'BMD':'SFD'}</text>`;
   o+=`<line x1="${x0}" y1="${Y(z0)}" x2="${x0}" y2="${Y(z1)}" stroke="#64748b" stroke-width="1.4"/>`;
   o+=`<polygon points="${[[0,z0],...pts.map(p=>[p[key],p.z]),[0,z1]].map(([v,z])=>f(X(v),1)+','+f(Y(z),1)).join(' ')}" fill="${col}" fill-opacity=".15" stroke="${col}" stroke-width="1.3"/>`;
   const pb=pts[0];o+=`<text x="${W-4}" y="${Y(z0)+14}" text-anchor="end" class=dgv>base: ${F(pb[key])} ${u}</text>`;
   o+=`<text x="4" y="${Y(z0)+4}" class=dgl>+${f(z0)}</text><text x="4" y="${Y(z1)+4}" class=dgl>+${f(z1)}</text>`;
   if(key=='M'&&C&&!C.none){o+=`<line x1="${x0-6}" x2="${W-6}" y1="${Y(C.zc)}" y2="${Y(C.zc)}" stroke="#16a34a" stroke-dasharray="4 3"/><text x="${W-6}" y="${Y(C.zc)-3}" text-anchor="end" class=dgl style="fill:#16a34a">50% stop +${f(C.zc)}</text>`;
    o+=`<line x1="${x0-6}" x2="${W-60}" y1="${Y(C.zt)}" y2="${Y(C.zt)}" stroke="#16a34a" stroke-dasharray="1 3"/>`}
   pan.push(o+'</svg>')}}
 for(const k of['T','H']){const pts=DG[k],r=R0.RS.find(e=>e.k==k);if(!pts||!r)continue;
  for(const[key,u,col]of[['M','kNm/m','#2563eb'],['V','kN/m','#dc2626']]){const mx=Math.max(1e-6,...pts.map(p=>Math.abs(p[key]))),xa=pts[0].x,xb=pts[pts.length-1].x,y0=Hh/2,sy=(Hh/2-40)/mx,sx=(W-40)/Math.max(Math.abs(xb-xa),1e-6),X=x=>20+(x-Math.min(xa,xb))*sx,Y=v=>y0+v*sy;
   let o=`<svg viewBox="0 0 ${W} ${Hh}" class=dgp><text x="${W/2}" y="13" text-anchor="middle" class=dgt>${k=='T'?'Toe':'Heel'} – ${key=='M'?'BMD':'SFD'}</text><line x1="${X(xa)}" x2="${X(xb)}" y1="${y0}" y2="${y0}" stroke="#64748b" stroke-width="1.4"/>`;
   o+=`<polygon points="${[[xa,0],...pts.map(p=>[p.x,p[key]]),[xb,0]].map(([x,v])=>f(X(x),1)+','+f(Y(v),1)).join(' ')}" fill="${col}" fill-opacity=".15" stroke="${col}" stroke-width="1.3"/>`;
   const pe=k=='T'?pts[pts.length-1]:pts[0];o+=`<text x="${k=='T'?W-4:4}" y="${Y(pe[key])+(pe[key]>=0?14:-5)}" text-anchor="${k=='T'?'end':'start'}" class=dgv>${F(pe[key])} ${u}</text>`;
   o+=`<text x="${X(xa)}" y="${y0-6}" text-anchor="middle" class=dgl>x ${f(xa)}</text><text x="${X(xb)}" y="${y0-6}" text-anchor="middle" class=dgl>x ${f(xb)}</text>`;pan.push(o+'</svg>')}}
 return pan.length?`<div class=dgw>${pan.join('')}</div>`:''}
const dgCU=(R0,DG)=>{const o={};if(DG)for(const r of R0.RS)if(DG[r.k]&&/^[sx]/.test(r.k))o[r.k]=curt(r,DG[r.k],R0.G);return o};
function dgSec(R0,DG,no){if(!DG)return'';const RS=R0.RS.filter(r=>DG[r.k]&&/^[sx]/.test(r.k));if(!RS.length&&!DG.T&&!DG.H)return'';
 const CU=dgCU(R0,DG);
 const rows=RS.map(r=>{const C=CU[r.k],b=rcv(r.k),l1=lapReq(r.k),l3=lapReq(r.k,3),pts=DG[r.k];
  return[esc(r.n),`${f(pts[0].M)} / ${f(pts[0].V)}`,C?(C.none?`No – ${C.why}`:`T${C.phi}@${2*C.s} stop at <b>+${f(C.zc)}</b> (theoretical +${f(C.zt)} + max(d ${f(C.d,0)}, 12φ ${12*C.phi}, ℓb ${f(C.lb,0)}) = ${f(C.ext,0)} mm)`):'–',
   l1?`T${b.d}: <b>${l1}</b>${b.d3!=b.d&&l3?` · T${b.d3}: <b>${l3}</b>`:''}`:'–']});
 return`<h3>${no} Bending moment and shear force diagrams, curtailment and laps</h3>`
  +`<p class="mu xp">ULS envelope of the Section 7 load combinations${S.rck=='env'||!S.rck||(S.rck!='ka'&&S.rck!='ko')?' (active and at-rest)':''}; the value at the base of each stem / face of the stem is the Section 7 design value. Above the stem base the self-weight eccentricity moment is taken as max(0, value at the base).</p>`
  +dgSvg(R0,DG,0,CU)
  +(RS.length?T(['Element','M / V at base (kNm/m, kN/m)','Curtailment of 50 % main bars'+CX(' (CoP Cl 9.2.1.6)'),'Lap length, mm'+CX(' (CoP Cl 8.7.4.1)')],rows,'l')
  +`<p class="mu xp">Curtailment: the remaining 50 % of the main bars satisfy bending and the minimum steel above the theoretical point; the stopped bars extend beyond it by the greater of d, 12φ and the anchorage length ℓb = 0.87fy·φ/(4β√fcu) (bars stopped in a tension zone). Lap length = max(ℓb, 15φ, 300 mm), rounded up to 50 mm; factor 1.0 – laps not at the top of a pour with cover &lt; 2φ, not at corners, staggered (×1.4 / ×2.0 otherwise).</p>`:'')}
