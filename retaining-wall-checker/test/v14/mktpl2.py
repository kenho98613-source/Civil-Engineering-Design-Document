import ezdxf,json
d=ezdxf.readfile('tpl.dxf')
st=d.styles.new('S2',dxfattribs={'font':'romans.shx','width':0.8,'height':0})
for sc in (20,25,50,100):
    ds=d.dimstyles.new(f'1-{sc}')
    for k,v in dict(dimscale=sc,dimasz=2,dimtxt=2,dimexo=1,dimexe=1,dimgap=1,dimtad=1,dimjust=0,dimclrd=6,dimclre=6,dimclrt=7,
                    dimdec=0,dimtih=0,dimtoh=0,dimtix=1,dimtofl=1,dimtmove=2,dimatfit=3,dimdle=0,dimlfac=1,dimrnd=0,dimzin=8,dimlunit=2,dimsah=0,dimtsz=0,dimblk='').items():
        ds.dxf.set(k,v)
    ds.dxf.dimtxsty='S2'
d.header['$DIMSTYLE']='1-100';d.header['$TEXTSTYLE']='S2'
d.saveas('tpl2.dxf')
t=open('tpl2.dxf',encoding='cp1252').read().replace('\r\n','\n')
hs=[int(h,16) for h in __import__('re').findall(r'\n  5\n([0-9A-F]+)\n',t)]+[int(h,16) for h in __import__('re').findall(r'\n105\n([0-9A-F]+)\n',t)]
print('max handle',hex(max(hs)))
open('tpl2.js','w').write('const DXFT='+json.dumps(t)+';')
