import sys
src,dst=sys.argv[1],sys.argv[2]
s=open(src,encoding='utf-8').read()
def rep(old,new,cnt=1):
    global s
    n=s.count(old)
    assert n==cnt,(n,old[:90])
    s=s.replace(old,new)
rep("function rcActions(Kh,dDeg){","function rcActions(Kh,dDeg,dg){")
rep("""   if(!qv&&fd!==0)XS.forEach(a=>a.segs.forEach(sg=>{const L=xsLat(a,cb,sg.bot)""","""   // v14.0 CR-3: diagram collector (stems: level from the stem base to the top; first point = Section 7 design value)
   if(dg&&!qv&&fd!==0)S.st.forEach((s,i)=>{if(!s.rc&&!Gv)return;if(Gv&&!s.rc)return;const g=G.SG[i];if(!(g.h>1e-9))return;const sc=SEC[i],meA=Math.max(0,sc.Me,sc.Wf?sc.Me+sc.Mef:-1e9),pts=[];
    for(let j=0;j<=20;j++){const z=g.bot+g.h*j/20,a=j?cant(z,cb,tc,meA):cantF(g.bot,cb,tc,sc)[0];pts.push({z,M:a.M,V:a.V})}dgPut(dg,'s'+i,pts)});
   if(dg&&!qv&&fd!==0)XS.forEach(a=>a.segs.forEach(sg=>{const k='x'+a.j+(sg.k?'s'+sg.k:''),pts=[];for(let j=0;j<=20;j++){const z=sg.bot+sg.h*j/20,L=xsLat(a,cb,z);pts.push({z,M:L.M,V:L.H})}dgPut(dg,k,pts)}));
   if(!qv&&fd!==0)XS.forEach(a=>a.segs.forEach(sg=>{const L=xsLat(a,cb,sg.bot)""")
rep("""ty:'T',bad,gv:Gv},cb,tc.k)}""","""ty:'T',bad,gv:Gv},cb,tc.k);
    if(dg){const pts=[];for(let j=0;j<=20;j++){const xs=G.Lt0*j/20;pts.push({x:xs,M:ints(0,xs,x=>(qb(x)+uf(x)-cb.gGb*dn)*(xs-x)),V:ints(0,xs,x=>qb(x)+uf(x)-cb.gGb*dn)})}dgPut(dg,'T',pts)}}""")
rep("""ty:'H',bad,gv:Gv},cb,tc.k);""","""ty:'H',bad,gv:Gv},cb,tc.k);
    if(dg){const pts=[];for(let j=0;j<=20;j++){const xs=xb+(B-xb)*j/20;pts.push({x:xs,M:ints(xs,B,x=>(cb.gGa*dd+cb.gQ*dq-qb(x)-uf(x))*(x-xs)),V:ints(xs,B,x=>cb.gGa*dd+cb.gQ*dq-qb(x)-uf(x))})}dgPut(dg,'H',pts)}""")
code=open('dg_code.js',encoding='utf-8').read()
rep("/* ---------------- gravity: minimum / anti-crack steel schedule ---------------- */",code+"\nlet DGC=null;const DG14=R0=>{if(DGC&&DGC.R0===R0)return DGC.DG;const DG=dgCalc(R0);DGC={R0,DG};return DG};\n/* ---------------- gravity: minimum / anti-crack steel schedule ---------------- */")
# figure view
rep("""[['all','All'],['geo','Geometry'],['load','Loads']].map(([v,t])=>`<button data-a="fgm" data-v="${v}" class="${m==v?'on':''}">${t}</button>`)""",
    """[['all','All'],['geo','Geometry'],['load','Loads'],...(R0.RS&&R0.RS.length?[['bmd','BMD / SFD']]:[])].map(([v,t])=>`<button data-a="fgm" data-v="${v}" class="${m==v?'on':''}">${t}</button>`)""")
rep("""+fig({G,C:E.C,s:E.s,fa:E.fa,sB:ev(E.C,{sheel:1,pvq:1},{ppM:S.ppO}),mode:m})}""",
    """+(m=='bmd'&&R0.RS&&R0.RS.length?`<div class=dgfig>${dgSvg(R0,DG14(R0),1)||'<p class=mu>No RC elements.</p>'}</div>`:fig({G,C:E.C,s:E.s,fa:E.fa,sB:ev(E.C,{sheel:1,pvq:1},{ppM:S.ppO}),mode:m=='bmd'?'all':m}))}""")
# Section 7
rep(""" $('r7').innerHTML=h7;""",""" if(S.xrc&&R0.RS&&R0.RS.length)h7+=dgSec(R0,DG14(R0),isG()?'7.4':'7.2');
 $('r7').innerHTML=h7;""")
# CSS
rep("</style>",""".dgw{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}.dgp{width:230px;max-width:48%;height:auto;border:1px solid var(--bd,#cbd5e1);border-radius:4px;background:#fff}.dgfig .dgp{width:300px}
.dgt{font-size:11px;font-weight:600;fill:#0f172a}.dgv{font-size:10px;fill:#0f172a}.dgl{font-size:9px;fill:#475569}
@media print{.dgp{width:31%;max-width:31%;break-inside:avoid}.dgw{break-inside:avoid}}
</style>""")
open(dst,'w',encoding='utf-8').write(s)
print('ok')
