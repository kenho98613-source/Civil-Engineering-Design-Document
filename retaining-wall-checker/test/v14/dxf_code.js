/* ---------------- v14.0 CR-1: section export to AutoCAD DXF (R2000 ASCII, mm, x = 0 at toe front-bottom, y = mPD × 1000) ----------------
   Template (header / tables / layers / blocks / objects) written once with a DXF library and embedded; entities (LWPOLYLINE, TEXT) are appended here.
   v14.0.1: dimensions are AutoCAD DIMENSION entities (dimstyle "1-<scale>", each with its *D block); all text style S2 (romans.shx, width 0.8), height 2 mm × scale;
   level mark = label / value / ▽ (apex on the level) + short level line. One file per wall type. */
__DXFT__
function dxfText(o){o=o||{};const sc=+o.sc||100,th=2*sc,G=geo(),C=comp(params('k'),null),Zb=+S.Zb,bt=G.bt,Hr=+S.Hr,Hf=+S.Hf,B=G.B,Gv=isG(),XS=G.XS||[],UU=isU(),
 H=Math.max(1,G.top-Zb),CR=typeof scOn=='function'&&scOn(),sb=CR?+S.scb:0,xr=B+Math.max(3,23*th/1000,.6*Math.max(0,Hr-Zb)+1),xL=1000*Math.min(0,pX(G.fr,Hf))-8*th,xL2=xL-6*th,xl=-Math.max(4.5,(CR?sb+2.5:0),.6*Math.max(0,Hf-Zb)+1.5,(-xL2+16*th)/1000),
 E=[],BR=[],BK=[];let hd=0x100,nD=0;const M=v=>(v*1000),N=v=>(Math.round(v*1000)/1000).toFixed(3),
 enc=t=>String(t).replace(/[^\x20-\x7e]/g,ch=>'\\U+'+ch.codePointAt(0).toString(16).toUpperCase().padStart(4,'0')),
 hdr=(ty,ly,sub,A,own,col)=>{const h=(hd++).toString(16).toUpperCase();(A||E).push('0',ty,'5',h,'330',own||'17','100','AcDbEntity','8',ly,...(col?['62',String(col)]:[]),'100',sub);return h},
 // polyline through model points [x m, z mPD]
 PL=(ly,pts,cl)=>{if(pts.length<2)return;hdr('LWPOLYLINE',ly,'AcDbPolyline');E.push('90',String(pts.length),'70',cl?'1':'0');for(const[x,z]of pts)E.push('10',N(M(x)),'20',N(M(z)))},
 // polyline in drawing units (mm) – used for dimension / level graphics
 PLm=(ly,pts,cl)=>{if(pts.length<2)return;hdr('LWPOLYLINE',ly,'AcDbPolyline');E.push('90',String(pts.length),'70',cl?'1':'0');for(const[x,y]of pts)E.push('10',N(x),'20',N(y))},
 // text at mm point; ha 0 left / 1 centre / 2 right; rotation deg
 TX=(ly,x,y,h,t,ha,rot,A,own,col,va)=>{if(!String(t).trim())return;A=A||E;hdr('TEXT',ly,'AcDbText',A,own,col);ha=ha||0;A.push('10',N(x),'20',N(y),'30','0.0','40',N(h),'1',enc(t),'50',N(rot||0),'41','0.8','7','S2');if(ha||va)A.push('72',String(ha),'11',N(x),'21',N(y),'31','0.0');A.push('100','AcDbText');if(va)A.push('73',String(va))},
 // ---- DIMENSION (rotated, rot 0 = horizontal / 90 = vertical) with its anonymous block *Dn (lines magenta, arrows closed filled, text white – as dimstyle 1-<scale>)
 DSN='1-'+sc,ASZ=2*sc,EXO=sc,EXE=sc,GAP=sc,
 DIM=(p1,p2,rot,dl,pre)=>{const V=rot==90,u=p=>V?p[1]:p[0],w=p=>V?p[0]:p[1],P=(uu,ww)=>V?[ww,uu]:[uu,ww],a=Math.min(u(p1),u(p2)),b=Math.max(u(p1),u(p2)),span=b-a;if(!(span>1))return;
  const meas=String(Math.round(span)),txt=(pre||'')+meas,nm='*D'+(++nD),br=(hd++).toString(16).toUpperCase(),A=[],LN=(q1,q2,col)=>{hdr('LINE','0','AcDbLine',A,br,col);A.push('10',N(q1[0]),'20',N(q1[1]),'30','0.0','11',N(q2[0]),'21',N(q2[1]),'31','0.0')},
   AR=(tip,dir)=>{const bs=tip+dir*ASZ,q=[P(tip,dl),P(bs,dl+(V?-1:1)*ASZ/6),P(bs,dl-(V?-1:1)*ASZ/6)];hdr('SOLID','0','AcDbTrace',A,br,6);A.push('10',N(q[0][0]),'20',N(q[0][1]),'30','0.0','11',N(q[1][0]),'21',N(q[1][1]),'31','0.0','12',N(q[2][0]),'22',N(q[2][1]),'32','0.0','13',N(q[2][0]),'23',N(q[2][1]),'33','0.0')};
  BR.push('0','BLOCK_RECORD','5',br,'330','9','100','AcDbSymbolTableRecord','100','AcDbBlockTableRecord','2',nm);
  for(const p of[p1,p2]){const s=Math.sign(dl-w(p))||1;if(Math.abs(dl-w(p))>EXO)LN(P(u(p),w(p)+s*EXO),P(u(p),dl+s*EXE),6)}
  const ins=span>=2.6*ASZ;if(ins){LN(P(a,dl),P(b,dl),6);AR(a,1);AR(b,-1)}else{LN(P(a-2*ASZ,dl),P(b+2*ASZ,dl),6);AR(a,-1);AR(b,1)}
  const tp=V?[dl-GAP,(a+b)/2]:[(a+b)/2,dl+GAP];TX('0',tp[0],tp[1],th,txt,1,V?90:0,A,br,7,1);
  const hB=(hd++).toString(16).toUpperCase(),hE=(hd++).toString(16).toUpperCase();
  BK.push('0','BLOCK','5',hB,'330',br,'100','AcDbEntity','8','0','100','AcDbBlockBegin','2',nm,'70','1','10','0.0','20','0.0','30','0.0','3',nm,'1','',...A,'0','ENDBLK','5',hE,'330',br,'100','AcDbEntity','8','0','100','AcDbBlockEnd');
  const q2=V?[dl,p2[1]]:[p2[0],dl],tm=V?[dl-GAP-th/2,(a+b)/2]:[(a+b)/2,dl+GAP+th/2];hdr('DIMENSION','DIM','AcDbDimension');
  E.push('2',nm,'10',N(q2[0]),'20',N(q2[1]),'30','0.0','11',N(tm[0]),'21',N(tm[1]),'31','0.0','70','32','71','5','42',N(span),'1',pre?enc(pre)+'<>':'','3',DSN,
   '100','AcDbAlignedDimension','13',N(p1[0]),'23',N(p1[1]),'33','0.0','14',N(p2[0]),'24',N(p2[1]),'34','0.0','50',V?'90.0':'0.0','100','AcDbRotatedDimension')},
 rect=(ly,x1,z1,x2,z2)=>PL(ly,[[x1,z1],[x2,z1],[x2,z2],[x1,z2]],1),
 // horizontal dimension between model x1, x2 measured at model level z (object), dimension line at yd (mm)
 dH=(x1,x2,z,yd,pre)=>DIM([M(x1),M(z)],[M(x2),M(z)],0,yd,pre),
 dV=(z1,z2,x,xd,pre)=>DIM([M(x),M(z1)],[M(x),M(z2)],90,xd,pre),
 // level tag: triangle with apex on the level + text "+x.xx mPD"
 // level mark (X mm, z mPD): label line / value line / ▽ with apex on the level; short level line from the mark to toX (mm)
 LV=(X,z,lab,toX)=>{const Y=M(z),w=.8*th,h=.7*th;toX=toX??X;PLm('LEVEL',[[X,Y],[X-w/2,Y+h],[X+w/2,Y+h]],1);PLm('LEVEL',[[Math.min(X-2*th,toX),Y],[Math.max(X+2*th,toX),Y]]);
  const yv=Y+h+.4*th;TX('LEVEL',X,yv,th,(z>=0?'+':'')+z.toFixed(2)+'mPD',1);if(lab)TX('LEVEL',X,yv+1.5*th,th,lab,1)};
 // ---- concrete
 if(Gv){const gbr=+S.gbr||0;PL('RW-BASE',[[0,Zb],[B,Zb],[B-gbr,bt],[gTx(),bt]],1)}else rect('RW-BASE',0,Zb,B,bt);
 G.SG.filter(g=>g.h>1e-9).forEach(g=>PL('RW-STEM',[[g.xf0,g.bot],[g.xb0,g.bot],[g.xb1,g.top],[g.xf1,g.top]],1));
 const KG=keyG();if(KG&&KG.dk>0&&KG.Bk>0)rect('RW-KEY',KG.xk,Zb-KG.dk,KG.xk+KG.Bk,Zb);
 XS.forEach(a=>{a.segs.forEach(g=>{if(g.h>1e-9&&g.t>1e-9)rect('RW-STEMBASE',g.x0,g.bot,g.x1,g.top)});if(a.pp){const gT=a.segs[a.segs.length-1],xc=gT.x0+gT.t/2;PL('RW-PARAPET',[[xc,a.top],[xc,ppZ(a)]]);TX('RW-PARAPET',M(xc)+.5*th,M(ppZ(a))-th,th,'PARAPET / BARRIER (SCHEMATIC)')}});
 {const t0=G.ttw,fx0=G.ftx,g0=G.SG.find(g=>g.h>1e-9),wh=S.wo?+S.wh:0,fxc=g0?(S.fdl&&S.fxo!==''&&Number.isFinite(+S.fxo)?fdX(G):(g0.xf1+g0.xb1)/2):Gv?gTx()+(S.fxo!==''&&Number.isFinite(+S.fxo)?cl(+S.fxo,0,+S.gBt):+S.gBt/2):fx0+.05;
  if(S.wo||(S.bro&&!vStemOn())||fdOn()){const hF=Math.max(wh,S.bro&&!vStemOn()?+S.bhb:0,fdOn()?1:0);rect('RW-FENCE',fxc-.05,G.top,fxc+.05,G.top+hF);TX('RW-FENCE',M(fxc+.05)+.5*th,M(G.top+hF)-th,th,(S.wo?'FENCE':S.bro&&!vStemOn()?'BARRIER':'FENCE')+' (SCHEMATIC)')}}
 // ---- ground lines
 if(S.bon){const tb=Math.tan((+S.br||0)*R),xH=G.xH,pts=[[xH,Hr]];if(tb>0&&+S.brL>0){const xk=xH+(+S.brL);pts.push([xk,Hr+(+S.brL)*tb]);if(xk<xr)pts.push([xr,Hr+(+S.brL)*tb])}else pts.push([xr,Hr+(xr-xH)*tb]);PL('GND-RETAINED',pts)}
 XS.forEach((a,j)=>{if(UU||!(a.zt>bt+1e-9))return;const nx=j<XS.length-1?XS[j+1].x0:pX(G.frM,a.zt);PL('GND-RETAINED',[[a.xb(a.zt),a.zt],[nx,a.zt]])});
 if(Hf>Zb||CR){const xF=pX(G.fr,Hf),tf=S.fon?Math.tan((+S.bf||0)*R):0;const pts=[[xF,Hf]];
  if(tf<0&&CR){pts.push([-sb,Hf]);pts.push([xl,Hf+(-sb-xl)*tf])}
  else if(tf){pts.push([xl,Hf+(xF-xl)*tf])}else pts.push([xl,Hf]);PL('GND-FRONT',pts)}
 if(S.bon&&C.wb>0)PL('GWL',[[pX(G.bk,C.Wb),C.Wb],[xr,C.Wb]]);
 if(S.fon&&C.wf>0)PL('GWL',[[xl,Zb+C.wf],[0,Zb+C.wf]]);
 // ---- reinforcement (schematic: main bars at cover, bar marks; RC elements only)
 const CV=cvAll(),ln=k=>typeof lapReq=='function'?lapReq(k):null,bm=(d,s)=>`T${d}@${s}`;
 if(o.bars!==false){const nS=S.st.length,cb=CV.b/1000,ct=CV.t/1000,cs=CV.s/1000;
  G.SG.forEach((g,i)=>{const s=S.st[i];if(!(g.h>1e-9)||(Gv&&!s.rc))return;const r=rcv('s'+i),dr=r.d/2000,df=r.d3/2000,top=g.top-cs;
   PL('RW-REBAR',[[g.xb0-cs-dr,g.bot],[g.xb1-cs-dr,top]]);PL('RW-REBAR',[[g.xf0+cs+df,g.bot],[g.xf1+cs+df,top]]);
   const zm=(g.bot+g.top)/2;TX('RW-REBAR',M(Math.max(g.xb0,g.xb1))+1.3*th,M(zm),th,`${bm(r.d,r.s)} (REAR, MAIN)`,1,90);TX('RW-REBAR',M(Math.min(g.xf0,g.xf1))-.4*th,M(zm),th,`${bm(r.d3,r.s3)} (FRONT)`,1,90);
   TX('RW-REBAR',M(Math.max(g.xb0,g.xb1))+2.4*th,M(g.top)-1.6*th,th,`${bm(r.d2,r.s2)} EF (HORIZ.)`,0,0);
   if(i==nS-1&&!Gv){const db=rcv('T').d/1000,zs=Zb+cb+db;PL('RW-REBAR',[[g.xb0-cs-dr,g.bot],[g.xb0-cs-dr,zs]]);
    const lp=ln('s'+i);if(lp){const xo=g.xb0-cs-dr-1.5*r.d/1000;PL('RW-REBAR',[[xo,g.bot],[xo,g.bot+lp/1000]]);TX('RW-REBAR',M(xo)-.6*th,M(g.bot+lp/2000),th,`LAP ${lp}`,1,90)}}});
  XS.forEach(a=>a.segs.forEach(sg=>{if(!(sg.h>1e-9))return;const k='x'+a.j+(sg.k?'s'+sg.k:''),r=rcv(k),dr=r.d/2000,df=r.d3/2000,oF=UU?sg.x0:sg.x1,iF=UU?sg.x1:sg.x0,sgn=UU?1:-1;
   PL('RW-REBAR',[[oF+sgn*(cs+dr),sg.bot],[oF+sgn*(cs+dr),sg.top-cs]]);PL('RW-REBAR',[[iF-sgn*(cs+df),sg.bot],[iF-sgn*(cs+df),sg.top-cs]]);
   TX('RW-REBAR',UU?M(sg.x0)-.4*th:M(sg.x1)+1.3*th,M((sg.bot+sg.top)/2),th,`${bm(r.d,r.s)} (MAIN)`,1,90);
   const lp=!sg.k&&ln(k);if(lp)TX('RW-REBAR',M(sg.x0+sg.t/2),M(sg.bot)+1.2*th,th,`LAP ${lp}`,1,0)}));
  if(!Gv){const rT=rcv('T'),rH=rcv('H'),zb=Zb+cb+rT.d/2000,zt=bt-ct-rH.d/2000;PL('RW-REBAR',[[cb,zb],[B-cb,zb]]);PL('RW-REBAR',[[cb,zt],[B-cb,zt]]);
   const yb=M(Zb)-1.4*th,yt=M(bt)+.5*th;if(G.Lt0>0)TX('RW-REBAR',M(G.Lt0/2),yb,th,`${bm(rT.d,rT.s)} B (TOE MAIN)`,1);if(G.hl>0)TX('RW-REBAR',M(G.xb+G.hl/2),yt,th,`${bm(rH.d,rH.s)} T (HEEL MAIN)`,1);
   if(G.Lt0>0)TX('RW-REBAR',M(G.Lt0/2),yt,th,`${bm(rT.d3,rT.s3)} T`,1);if(G.hl>0)TX('RW-REBAR',M(G.xb+G.hl/2),yb,th,`${bm(rH.d3,rH.s3)} B`,1)}}
 // ---- dimensions (mm)
 const kz=KG&&KG.dk>0?KG.dk:0,y1=M(Zb-kz)-6*th,y2=y1-5*th,g0=G.SG.filter(g=>g.h>1e-9),lo=g0.length?g0[g0.length-1]:null;
 if(Gv){const bf=Math.max(0,+S.gbf||0),bT=Math.max(0,+S.gBt||0);const xs=[0,bf,bf+bT,B].filter((x,i,a)=>i==0||x>a[i-1]+1e-6);for(let i=0;i<xs.length-1;i++)dH(xs[i],xs[i+1],Zb,y1)}
 else if(lo){const xs=[0,...XS.flatMap(a=>[a.x0,a.x1]),G.Lt,lo.xb0,B].sort((a,b)=>a-b).filter((x,i,a)=>i==0||x>a[i-1]+1e-6);for(let i=0;i<xs.length-1;i++)dH(xs[i],xs[i+1],Zb,y1)}
 dH(0,B,Zb,y2,'B = ');
 const yT=M(G.top)+5*th;g0.length&&dH(g0[0].xf1,g0[0].xb1,G.top,yT);
 if(KG&&KG.dk>0){dH(KG.xk,KG.xk+KG.Bk,Zb-KG.dk,M(Zb-KG.dk)-2.5*th);dV(Zb-KG.dk,Zb,KG.xk+KG.Bk,M(KG.xk+KG.Bk)+3*th)}
 dV(Zb,bt,0,xL);g0.slice().reverse().forEach(g=>dV(g.bot,g.top,g.xf0,xL));dV(Zb,G.top,0,xL2,'H = ');
 if(S.fon&&Hf>Zb)dV(Zb,Hf,Math.min(0,pX(G.fr,Hf)),xL2-6*th,'Df = ');
 if(S.bon&&Hr>Zb)dV(Zb,Hr,B,M(xr)-3*th);
 if(CR&&sb>0)dH(-sb,0,Hf,M(Hf)+3*th,'b = ');
 // ---- levels
 const mB=M(B),dX=3.5*th,xT=M(G.ftx);LV(Math.min(xT-dX,xL+(xT-xL)/2),G.top,'T.O.W.',xT);LV(mB+8.5*th,Zb,'F.L.',mB);LV(S.bon&&Math.abs(Hr-bt)*1000<4*th?mB+8.5*th:mB+dX,bt,'B.T.',mB);
 if(S.bon){const tb=Math.tan((+S.br||0)*R),xg=tb>0?M(G.xH)+dX:mB+dX;LV(xg,tb>0?Hr+(xg-M(G.xH))/1000*tb:Hr,'G.L.')}
 const xlm=M(xl)+dX;if(Hf>Zb||S.fon)LV(xlm,CR?Hf:Hf+(S.fon?Math.tan((+S.bf||0)*R)*(pX(G.fr,Hf)-xlm/1000):0),'G.L.');
 if(S.bon&&C.wb>0)LV(mB+13.5*th,C.Wb,'GWL');if(S.fon&&C.wf>0)LV(xlm,Zb+C.wf,'GWL');if(KG&&KG.dk>0)LV(M(KG.xk+KG.Bk)+dX,Zb-KG.dk,'',M(KG.xk+KG.Bk));XS.forEach(a=>LV(M(a.x0+a.t/2),a.top,''));
 // ---- title
 const nm=o.name||wtName()||'RW',yt=y2-6*th,tl=[`${nm} - TYPICAL SECTION`,`SCALE 1:${sc}  (UNITS: mm, LEVELS: mPD)`],
  dz=[S.pn?`JOB NO. ${S.pn}`:'',S.jno?String(S.jno):''].filter(Boolean).join('  ');
 TX('TEXT',M(B/2),yt,2*th,tl[0],1);TX('TEXT',M(B/2),yt-3*th,th,tl[1],1);if(dz)TX('TEXT',M(B/2),yt-5*th,th,dz,1);
 TX('TEXT',M(B/2),yt-7*th,th,'SECTION GENERATED FROM THE CALCULATION MODEL - BAR LINES ARE SCHEMATIC; DETAILING TO STRUCTURAL DRAWINGS',1);
 const body=E.join('\n')+'\n';let t=DXFT.replace('\n  2\n*Paper_Space\n340\n1E\n',m=>m+(BR.length?BR.join('\n')+'\n':'')).replace('BLOCK_RECORD\n  5\n9\n330\n0\n100\nAcDbSymbolTable\n 70\n2\n',`BLOCK_RECORD\n  5\n9\n330\n0\n100\nAcDbSymbolTable\n 70\n${2+nD}\n`).replace('\n100\nAcDbBlockEnd\n  0\nENDSEC\n',m=>'\n100\nAcDbBlockEnd\n'+(BK.length?BK.join('\n')+'\n':'')+'  0\nENDSEC\n').replace(/\nENTITIES\n  0\nENDSEC\n/,`\nENTITIES\n${body}  0\nENDSEC\n`).replace(/\n\$HANDSEED\n  5\n[0-9A-F]+\n/,`\n$HANDSEED\n  5\n${hd.toString(16).toUpperCase()}\n`);
 // extents
 return t.replace(/\r?\n/g,'\r\n')}
const dxfName=n=>String(n||wtName()||'RW').replace(/[\\/:*?"<>|]+/g,'_').trim()+'_section.dxf';
async function dxfSave(t,name){if(DESK){const p=await __TAURI__.dialog.save({defaultPath:name,filters:[{name:'AutoCAD DXF',extensions:['dxf']}]});if(!p)return false;await __TAURI__.core.invoke('write_text',{path:p,contents:t});msg('Saved '+p);return true}
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([t],{type:'application/dxf'}));a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),3000);return true}
function dxfDlg(){if(validate().E.length){msg('Fix input errors before export');return}const n=PJ?PJ.types.length:1;
 modal('📐 Export section (DXF)',`<p>AutoCAD DXF (R2000, opens in AutoCAD 2013), units <b>mm</b>, x = 0 at the toe, y = level in mPD × 1000. Layers: RW-STEM, RW-BASE, RW-KEY, RW-STEMBASE, RW-PARAPET, RW-FENCE, GND-RETAINED, GND-FRONT, GWL, RW-REBAR, DIM, LEVEL, TEXT. Dimensions: AutoCAD DIMENSION, dimstyle 1-&lt;scale&gt;; text style S2 (romans.shx), height 2 mm × scale; bar lines are schematic.</p>
 <label>Text sized for plot scale 1: <select id=dxsc>${[20,25,50,100].map(v=>`<option${v==100?' selected':''}>${v}</option>`).join('')}</select></label>${n>1?`<p><label><input type=checkbox id=dxall> All ${n} wall types (one file each)</label></p>`:''}`,[['mclose','Cancel'],['dxfgo','Export',1]])}
async function dxfGo(){const sc=+(($('dxsc')||{}).value||100),all=!!(($('dxall')||{}).checked);mclose();try{
 if(all&&PJ&&PJ.types.length>1){pjPut();let k=0;for(let i=0;i<PJ.types.length;i++){const nm=PJ.types[i].name,t=withS(pjGet(i),()=>{sync();if(validate().E.length)return null;return dxfText({sc,name:nm})});if(!t)continue;if(!await dxfSave(t,dxfName(nm)))break;k++;await new Promise(r=>setTimeout(r,350))}msg(`DXF: ${k} file(s) exported`);return}
 const t=dxfText({sc});if(await dxfSave(t,dxfName()))msg('DXF exported – '+dxfName())}catch(e){msg('DXF export failed: '+e)}}
