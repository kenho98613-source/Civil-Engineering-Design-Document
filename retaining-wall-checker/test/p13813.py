import sys
src,dst=sys.argv[1],sys.argv[2]
s=open(src,encoding='utf-8').read()
def rep(old,new,cnt=1):
    global s
    n=s.count(old)
    assert n==cnt,(n,old[:90])
    s=s.replace(old,new)
# version
rep('Checker v13.8.12','Checker v13.8.13',4)
rep("const MVER='v13.8.12'","const MVER='v13.8.13'")
# defaults
rep("fxo:'',xs:[]","fxo:'',fdl:0,fdP:5,fdS:3,xs:[]")
# helpers
rep("const vSOn=()=>","""// v13.8.13 CR-1: fence self-weight (permanent) – P per post ÷ post spacing s (blank s → P in kN/m), on the wall top at the fence offset (blank = centre).
// Ignored where favourable (sliding, overturning); bearing, eccentricity and stem design take the worse of fence present / absent.
const fdW=()=>{const P=+S.fdP,s=S.fdS===''||S.fdS==null?0:+S.fdS;return Number.isFinite(P)&&P>0?(s>0?P/s:P):0},fdOn=()=>!!(S.fdl&&fdW()>0),
 fdX=G=>G.ftx+(S.fxo!==''&&S.fxo!=null&&Number.isFinite(+S.fxo)?cl(+S.fxo,0,G.ttw):G.ttw/2),fdK=(o,v)=>fdOn()?{...o,fdl:v}:o,fdV=()=>fdOn()?[1,0]:[null],
 fdA=(fa,v)=>v==null?fa:{...fa,fdl:v},fdL=v=>v==null?'':`, fence DL ${v?'present':'absent'}`;
const vSOn=()=>""")
# load item
rep("""const KG=keyG();if(KG&&KG.dk>0&&KG.Bk>0)add('W','Shear key'""","""if(fdOn())add('Wf','Fence self-weight (permanent – ignored in sliding / overturning)',+S.fdS>0?`P/s = ${f(+S.fdP,2)}/${f(+S.fdS,2)}`:`line load ${f(fdW(),2)} kN/m`,fdW(),'fdl','v',fdX(G),G.top);
 const KG=keyG();if(KG&&KG.dk>0&&KG.Bk>0)add('W','Shear key'""")
# SLS middle third
rep("""for(const sh of[0,1])for(const pv of[0,1]){const fa={sheel:sh,pvq:pv},s=ev""","""for(const sh of[0,1])for(const pv of[0,1])for(const fd of fdV()){const fa=fdA({sheel:sh,pvq:pv},fd),s=ev""")
# GG1
rep("""const faS={sur:gq,sheel:0,pvq:0,wind:gq,bar:gq,pas:1,pwat:1},faB""","""const faS=fdK({sur:gq,sheel:0,pvq:0,wind:gq,bar:gq,pas:1,pwat:1},0),faB""")
rep("""['q_in absent, Pav,q γf = '+gq,{...faS,pvq:gq}]]){const b=ev(C,fa,{ppM:S.ppO}),ob=overburden(C,null),""",
    """['q_in absent, Pav,q γf = '+gq,{...faS,pvq:gq}]])for(const fd of fdV()){const fa=fdA(fa0,fd),lab=lab0+fdL(fd),b=ev(C,fa,{ppM:S.ppO}),ob=overburden(C,null),""")
rep("""for(const[lab,fa]of[['q_in on heel γf = '""","""for(const[lab0,fa0]of[['q_in on heel γf = '""")
# FC17
rep("""for(const tc of topCases()){const C=comp(Pk,tc),dead={sheel:0,pvq:0,pas:1};""","""for(const tc of topCases()){const C=comp(Pk,tc),dead=fdK({sheel:0,pvq:0,pas:1},0);""")
rep("""for(const[sh,pv]of[[1,1],[0,0],[1,0],[0,1]]){if(sh&&!(C.qi>0||C.qt>0)&&!pv)continue;""","""for(const[sh,pv]of[[1,1],[0,0],[1,0],[0,1]])for(const fd of fdV()){if(sh&&!(C.qi>0||C.qt>0)&&!pv)continue;""")
rep("""const fa={sheel:sh,pvq:pv,pas:1},b=ev""","""const fa=fdA({sheel:sh,pvq:pv,pas:1},fd),b=ev""")
rep("""lab=`q_in ${sh?'present':'absent'}, Pav,q ${pv?'present':'absent'}`;""","""lab=`q_in ${sh?'present':'absent'}, Pav,q ${pv?'present':'absent'}`+fdL(fd);""")
# accidental
rep("""C=comp(Pk,{k:'bar',F:b.F,z:b.z}),dead={sheel:0,pvq:0,pas:1},""","""C=comp(Pk,{k:'bar',F:b.F,z:b.z}),dead=fdK({sheel:0,pvq:0,pas:1},0),""")
rep("""for(const[sh,pv]of[[1,1],[0,0],[1,0],[0,1]]){const fa={sheel:sh,pvq:pv,pas:1},bb=ev""","""for(const[sh,pv]of[[1,1],[0,0],[1,0],[0,1]])for(const fd of fdV()){const fa=fdA({sheel:sh,pvq:pv,pas:1},fd),bb=ev""")
# secLoads: fence contribution per section (kept separate: W, Me unchanged)
rep("""return{W,Me}},""","""if(!fdOn())return{W,Me};const Wd=fdW();return{W,Me,Wf:Wd,Mef:Wd*(xc-fdX(G))}},""")
# RC stems / block: envelope fence present / absent
rep("""const cant=(Ls,cb,tc,me)=>{""","""const cantF=(Ls,cb,tc,sc)=>{const a=cant(Ls,cb,tc,sc.Me);if(!sc.Wf)return[a,sc.Me];const m2=sc.Me+sc.Mef,b=cant(Ls,cb,tc,m2);return Math.abs(b.M)>Math.abs(a.M)+1e-12?[b,m2]:[a,sc.Me]};
  const cant=(Ls,cb,tc,me)=>{""")
rep("""const a=cant(+s.bot,cb,tc,SEC[i].Me);put('s'+i,""","""const[a,meU]=cantF(+s.bot,cb,tc,SEC[i]);put('s'+i,""")
rep("""ty:'s',gv:Gv&&!s.rc,me:SEC[i].Me},cb,tc.k)});""","""ty:'s',gv:Gv&&!s.rc,me:meU},cb,tc.k)});""")
rep("""if(Gv&&!qv){const a=cant(+S.Zb,cb,tc,SEC.blk.Me);""","""if(Gv&&!qv){const[a,meU]=cantF(+S.Zb,cb,tc,SEC.blk);""")
rep("""ty:'s',gv:1,me:SEC.blk.Me},cb,tc.k)}""","""ty:'s',gv:1,me:meU},cb,tc.k)}""")
rep("""pvq:cb.gQ,pvs:cb.gE,dead:cb.gGa,fill:cb.gGa,tsoil:cb.gGa,wind:cb.gW,bar:cb.gQ,pas:0,pwat:0},""","""pvq:cb.gQ,pvs:cb.gE,dead:cb.gGa,fill:cb.gGa,tsoil:cb.gGa,wind:cb.gW,bar:cb.gQ,pas:0,pwat:0,...(fd==null?{}:{fdl:fd?cb.gGa:0})},""")
# mass-concrete section middle third: fence present / absent
rep("""for(const[sq,pv]of[[1,0],[1,1],[0,0]]){const Pv=(AK.Hs+pv*AK.Hq)*FK.tD,MRk=Mw0,""","""for(const fd of SL[i].Wf?[0,1]:[0])for(const[sq,pv]of[[1,0],[1,1],[0,0]]){const Pv=(AK.Hs+pv*AK.Hq)*FK.tD,MRk=Mw0+(fd?SL[i].Wf*h/2-SL[i].Mef:0),""")
rep("""-Pv*h,N=W+Pv,""","""-Pv*h,N=W+(fd?SL[i].Wf:0)+Pv,""")
rep("""for(const tc of tops)for(const qv of(qi>0||(XS.length&&!UU)?[1,0]:[0])){""","""for(const tc of tops)for(const qv of(qi>0||(XS.length&&!UU)?[1,0]:[0]))for(const fd of fdV()){ // v13.8.13: fence DL present / absent for the base (stems enveloped in cantF)""")
rep("""if(!qv)S.st.forEach""","""if(!qv&&fd!==0)S.st.forEach""")
rep("""if(!qv)XS.forEach""","""if(!qv&&fd!==0)XS.forEach""")
rep("""if(Gv&&!qv){const[a,meU]=cantF""","""if(Gv&&!qv&&fd!==0){const[a,meU]=cantF""")
# validation
rep("""if(S.wo&&!(+S.wh>0))E.push('Fence height must be > 0.');""","""if(S.wo&&!(+S.wh>0))E.push('Fence height must be > 0.');if(S.fdl&&!(fdW()>0))E.push('Fence self-weight P must be > 0.');""")
# UI step 4c
rep("""(isG()&&!S.st.length&&(S.wo||S.bro)?Ic('Fence / barrier offset from block front edge','fxo','m',null,'Position of the fence / barrier on the block top, measured from the front edge of the block top. Blank = centre. Figure only – does not change the loads.'):'')""",
    """(S.fdl?Ic('Fence offset from wall-top front edge','fxo','m',null,'Position of the fence on the wall top, measured from the front edge of the wall (stem / block) top. Blank = centre. Used for the fence self-weight (eccentricity, bearing, stem moment) and the figure.'):isG()&&!S.st.length&&(S.wo||S.bro)?Ic('Fence / barrier offset from block front edge','fxo','m',null,'Position of the fence / barrier on the block top, measured from the front edge of the block top. Blank = centre. Figure only – does not change the loads.'):'')""")
rep("""+`<div id=wtxt class=mu></div>`:'')""","""+`<div id=wtxt class=mu></div>`:'')
   +Ck('<b>Fence self-weight</b> on wall top (permanent)','fdl','Dead load of the fence: P per post ÷ post spacing s (blank s → P is taken as kN/m). Included in bearing, eccentricity and the stem design (worse of fence present / absent); ignored where favourable (sliding, overturning).')
   +(S.fdl?R2(Ic('P per post','fdP','kN'),Ic('Post spacing s','fdS','m',null,'Blank = P is a line load in kN/m'))+`<p class=mu>w<sub>f</sub> = ${fdW()>0?F0(fdW(),2)+' kN/m':'–'}</p>`:'')
""")
# figure: fence position / drawing
rep("""fxc=g0?(g0.xf1+g0.xb1)/2:isG()""","""fxc=g0?(S.fdl&&S.fxo!==''&&Number.isFinite(+S.fxo)?fdX(c.G):(g0.xf1+g0.xb1)/2):isG()""")
rep("""if(S.wo||(S.bro&&!vStemOn())){o+=rc(fxc-.05,top,fxc+.05,top+Math.max(wh,S.bro&&!vStemOn()?+S.bhb:0),`fill="${S.wo?CL.wd:CL.b}" fill-opacity=".55"`);if(SG_)lb.push([X(fxc+.05)+6,Y(top+Math.max(wh,S.bro&&!vStemOn()?+S.bhb:0)*.6),S.wo?`Fence ${f(wh)}`:`Barrier`,'start',CL.l,'lv'])}""",
    """if(S.wo||(S.bro&&!vStemOn())||fdOn()){const hF=Math.max(wh,S.bro&&!vStemOn()?+S.bhb:0,fdOn()?1:0);o+=rc(fxc-.05,top,fxc+.05,top+hF,`fill="${S.wo||!S.bro?CL.wd:CL.b}" fill-opacity=".55"`);if(SG_)lb.push([X(fxc+.05)+6,Y(top+hF*.6),S.wo?`Fence ${f(wh)}`:S.bro&&!vStemOn()?`Barrier`:'Fence','start',CL.l,'lv'])}""")
rep("""const VG=[['dead','W','g'],""","""const VG=[['dead','W','g'],['fdl','Wf','g'],""")
rep("""if(ex)NT.push(`* ${id} not included in the middle-third case (included for bearing).`)""","""if(ex)NT.push(ct=='fdl'?`* Wf (fence self-weight) not included in the middle-third case drawn (fence absent governs).`:`* ${id} not included in the middle-third case (included for bearing).`)""")
# section 5 group
rep("""V:'variable – bearing only',""","""V:'variable – bearing only',F:'fence self-weight – bearing / eccentricity / RC only',""")
rep("""p.dir=='v'?(['sheel','pvq'].includes(p.cat)?'V'""","""p.dir=='v'?(p.cat=='fdl'?'F':['sheel','pvq'].includes(p.cat)?'V'""")
# report load list + basis note
rep("""w5?['Fence wind (Wind Code 2019)','F_w',`${f(w5.F,2)} kN/m (h = ${S.wh} m, φ = ${S.wsd})`]:null,""","""w5?['Fence wind (Wind Code 2019)','F_w',`${f(w5.F,2)} kN/m (h = ${S.wh} m, φ = ${S.wsd})`]:null,fdOn()?['Fence self-weight (permanent)','W_f',`${f(fdW(),2)} kN/m${+S.fdS>0?` (P = ${S.fdP} kN per post @ ${S.fdS} m)`:''}`]:null,""")
rep("""...(S.wo||S.bro?[`Wall-top loads (""","""...(fdOn()?['Fence self-weight W_f is a permanent load: ignored in sliding and overturning (favourable); bearing, eccentricity and the stem design take the worse of fence present / absent.']:[]),...(S.wo||S.bro?[`Wall-top loads (""")
rep("""${S.wo?' · fence':''}${S.bro""","""${S.wo?' · fence':''}${fdOn()?' · fence DL':''}${S.bro""")
open(dst,'w',encoding='utf-8').write(s)
print('ok')
s2=open(dst,encoding='utf-8').read()
o="V = variable, used for bearing only · P = passive."
assert s2.count(o)==1
s2=s2.replace(o,"V = variable, used for bearing only${fdOn()?' · F = fence self-weight, bearing / eccentricity / RC only (ignored in sliding / overturning)':''} · P = passive.")
open(dst,'w',encoding='utf-8').write(s2)
print('legend ok')
