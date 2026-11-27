import ezdxf,sys,glob
from ezdxf.addons.drawing import matplotlib as mpl
for f in sorted(glob.glob(sys.argv[1]+'/*.dxf')):
    d=ezdxf.readfile(f); a=d.audit()
    msp=d.modelspace(); from collections import Counter
    c=Counter(e.dxf.layer for e in msp)
    print(f.split('/')[-1], 'ver',d.dxfversion,'units',d.units,'errors',len(a.errors),'fixes',len(a.fixes), dict(c))
    for e in a.errors[:3]: print('  ERR',e.message)
    if len(sys.argv)>2: mpl.qsave(msp, f.replace('.dxf','.png'), bg='#FFFFFF', size_inches=(10,8), dpi=90)
