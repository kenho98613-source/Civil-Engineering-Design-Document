import sys
src,dst=sys.argv[1],sys.argv[2]
s=open(src,encoding='utf-8').read()
def rep(old,new,cnt=1):
    global s
    n=s.count(old)
    assert n==cnt,(n,old[:90])
    s=s.replace(old,new)
# defaults
rep("fxo:'',fdl:0,fdP:5,fdS:3,xs:[]","fxo:'',fdl:0,fdP:5,fdS:3,scon:0,scb:2,xs:[]")
# helper + interpolated bearing (after brg)
rep("function overburden(C,cap){","""/* v14.0 CR-4: foundation near the crest of a slope – GG1 Fig. A4 / CoP Foundations 2017 Fig. 2.3 (linear interpolation of the ultimate bearing capacity).
   x measured from the slope crest, positive into the level ground; d = crest (front ground) level − founding level; β = front slope angle.
   A: foundation at the edge of the slope, x = −d·cotβ – ground slope factors with ω = β, no overburden (q′ = 0, default);
   B: x = 4B′ (GG1, B′ of the case) / 4B (FC 2017, B_f) – level ground at depth d (overburden as for level ground);
   qult(b) = qA + (qB − qA)·(b + d·cotβ)/(4B′ + d·cotβ); b ≥ 4B′ → qB. */
const scOn=()=>!!(S.scon&&S.fon&&+S.bf<0);
function brgX(N,H,B,e,phi,c,gEff,qo,omega,negE0,fcB){if(!scOn())return brg(N,H,B,e,phi,c,gEff,qo,omega,negE0);
 const be=-(+S.bf),d=Math.max(0,+S.Hf-(+S.Zb)),b=Math.max(0,+S.scb||0),rA=brg(N,H,B,e,phi,c,gEff,0,be,negE0),rB=brg(N,H,B,e,phi,c,gEff,qo,0,negE0),
  Bw=fcB?B:rB.Bp,L4=4*Bw,xA=-d/Math.tan(be*R),t=b>=L4?1:cl((b-xA)/Math.max(L4-xA,1e-9),0,1),qu=rA.qu+(rB.qu-rA.qu)*t;
 return{...rB,qu,Qu:qu*rB.Bp,sc:{be,d,b,xA,L4,Bw,fcB:!!fcB,qA:rA.qu,qB:rB.qu,rA,rB,t}}}
const scRows=(r,fc)=>{const k=r.sc;if(!k)return[];const BL=fc?'4B':'4B′';return[
 ['Crest','Foundation near the crest of a slope'+(fc?' (FC 2017 Fig. 2.3)':' (GG1 Fig. A4)'),`b = ${f(k.b)} m (toe to crest), d = ${f(k.d)} m (crest − founding level), β = ${f(k.be,1)}°`,`${BL} = ${f(k.L4,3)} m`],
 ['qA',`At the edge of the slope, x = −d·cotβ = ${f(k.xA,3)} m`,`ground slope factor${fc?'':'s'} ω = β: ${fc?'ζqg = ζγg':'gq = gγ'} = ${f(k.rA.gq,3)}${fc?'':`, gc = ${f(k.rA.gc,3)}`}; q′ = 0`,`${f(k.qA)} kPa`],
 ['qB',`At x = ${BL} – level ground, depth d`,`ω = 0; q′ as below`,`${f(k.qB)} kPa`],
 ['q(b)','Linear interpolation at x = b',k.b>=k.L4?`b ≥ ${BL} → qB`:`qA + (qB − qA)(b + d·cotβ)/(${BL} + d·cotβ)`,`${f(r.qu)} kPa`]]};
function overburden(C,cap){""")
# GG1 / FC17 / accidental bearing calls
rep("""r=brg(b.N,Hb,C.G.B,b.e,Pf.phf,Pf.cF,gEffBase(C),ob.q,omg(),true)""","""r=brgX(b.N,Hb,C.G.B,b.e,Pf.phf,Pf.cF,gEffBase(C),ob.q,omg(),true)""")
rep("""rr=brg(b.N,Hb,C.G.B,b.e,S.f.phi,S.f.c,gEffBase(C),ob.q,omg(),false)""","""rr=brgX(b.N,Hb,C.G.B,b.e,S.f.phi,S.f.c,gEffBase(C),ob.q,omg(),false,1)""")
rep("""r=brg(bb.N,Hb,C.G.B,bb.e,S.f.phi,S.f.c,gEffBase(C),ob.q,omg(),false)""","""r=brgX(bb.N,Hb,C.G.B,bb.e,S.f.phi,S.f.c,gEffBase(C),ob.q,omg(),false,1)""")
# report rows – GG1
rep("""...(omg()>0?[['gq = gγ / gc','Ground slope factors',`ω = ${f(omg(),1)}°`,`${f(r.gq,3)} / ${f(r.gc,3)}`]]:[]),""",
    """...(omg()>0&&!r.sc?[['gq = gγ / gc','Ground slope factors',`ω = ${f(omg(),1)}°`,`${f(r.gq,3)} / ${f(r.gc,3)}`]]:[]),""")
rep("""['qult','Ultimate bearing pressure','c′Nc·ic·gc + ½γ′B′Nγ·iγ·gγ + q′Nq·iq·gq',`${f(r.qu)} kPa`],""",
    """...(r.sc?scRows(r,0):[['qult','Ultimate bearing pressure','c′Nc·ic·gc + ½γ′B′Nγ·iγ·gγ + q′Nq·iq·gq',`${f(r.qu)} kPa`]]),""")
# report rows – FC 2017
rep("""...(omg()>0?[['ζqg = ζγg','Ground slope factor',`(1 − tanω)², ω = ${f(omg(),1)}°`,f(r.gq,3)]]:[]),""",
    """...(omg()>0&&!r.sc?[['ζqg = ζγg','Ground slope factor',`(1 − tanω)², ω = ${f(omg(),1)}°`,f(r.gq,3)]]:[]),""")
rep("""['qu','Ultimate bearing capacity',`c′Ncζc + ½γ′B′Nγζγ + q′Nqζq${r.qu>3000?' (≤ 3000)':''}`,`${f(bF2.qu)} kPa`],""",
    """...scRows(r,1),['qu','Ultimate bearing capacity',r.sc?`interpolated q(b)${r.qu>3000?' (≤ 3000)':''}`:`c′Ncζc + ½γ′B′Nγζγ + q′Nqζq${r.qu>3000?' (≤ 3000)':''}`,`${f(bF2.qu)} kPa`],""")
# Section 8: item no longer "not checked" when the crest option is used
rep("""['Bearing near slope crest (interpolation)','GG1 Fig. A4; FC 2017 Fig. 2.3'],""","""...(scOn()?[]:[['Bearing near slope crest (interpolation)','GG1 Fig. A4; FC 2017 Fig. 2.3']]),""")
# input (Step 3, front soil)
rep("""R2(Ck('= foundation soil','fsm'),Ic('β_front','bf','°',null,'Ground slope in front, positive = uphill (taken as 0 for Kp)'))""",
    """R2(Ck('= foundation soil','fsm'),Ic('β_front','bf','°',null,'Ground slope in front, positive = uphill (taken as 0 for Kp)'))+(+S.bf<0?R2(Ck('Slope crest in front','scon','Level ground in front of the toe for a distance b, then the slope β_front downwards. Bearing: GG1 Fig. A4 / FC 2017 Fig. 2.3 – linear interpolation of qult between the edge of the slope (x = −d·cotβ) and x = 4B′.'),S.scon?Ic('b toe → crest','scb','m',null,'Horizontal distance from the toe of the base to the slope crest'):''):'')""")
# validation
rep("""if(S.wo&&!(+S.wh>0))E.push('Fence height must be > 0.');""","""if(S.wo&&!(+S.wh>0))E.push('Fence height must be > 0.');if(scOn()&&!(+S.scb>=0))E.push('Slope crest: distance b must be ≥ 0.');""")
# figure: level berm of width b, then the front slope
rep("""xl=GM?-2.9:-Math.max(.9+lm+1.8,4.1)""","""xl=Math.min(GM?-2.9:-Math.max(.9+lm+1.8,4.1),scOn()?-(+S.scb)-1.6:0)""")
rep("""if(Hf>Zb){const tf=S.fon?Math.tan((+S.bf)*R):0,zf=x=>Hf+(xF-x)*tf,poly=PT(tf?[[xl,Zb],[xl,zf(xl)],[0,zf(0)],[0,Zb]]:[[xl,Zb],[xl,Hf],[0,Hf],[0,Zb]])""",
    """if(Hf>Zb){const tf=S.fon?Math.tan((+S.bf)*R):0,SC=scOn(),xc_=SC?-(+S.scb):xF,zf=x=>Hf+Math.max(0,xc_-x)*tf,poly=PT(tf?[[xl,Zb],[xl,zf(xl)],...(SC&&xc_>xl&&xc_<0?[[xc_,Hf]]:[]),[0,zf(0)],[0,Zb]]:[[xl,Zb],[xl,Hf],[0,Hf],[0,Zb]])""")
rep("""if(tf){o+=`<line x1="${f(X(xl),1)}" y1="${f(Y(zf(xl)),1)}" x2="${f(X(xF),1)}" y2="${f(Y(Hf),1)}" stroke="#8a7f5a" stroke-width="1.2"/>`;""",
    """if(tf){o+=SC?`<polyline points="${PT([[xl,zf(xl)],[xc_,Hf],[xF,Hf]])}" fill="none" stroke="#8a7f5a" stroke-width="1.2"/>`+(SG_?(lb.push([X(xc_),Y(Hf)-8,`crest, b = ${f(+S.scb)} m`,'middle','#8a5a00','lv']),''):''):`<line x1="${f(X(xl),1)}" y1="${f(Y(zf(xl)),1)}" x2="${f(X(xF),1)}" y2="${f(Y(Hf),1)}" stroke="#8a7f5a" stroke-width="1.2"/>`;""")
open(dst,'w',encoding='utf-8').write(s)
print('ok')
s=open(dst,encoding='utf-8').read()
old="RERENDER=new Set(['fdl',"
assert s.count(old)==1
s=s.replace(old,"RERENDER=new Set(['scon','bf','fdl',")
open(dst,'w',encoding='utf-8').write(s)
print('rerender ok')
