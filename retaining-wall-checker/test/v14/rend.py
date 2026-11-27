import ezdxf,sys
from ezdxf.addons.drawing import matplotlib as mpl
for f in sys.argv[1:]:
    d=ezdxf.readfile(f); mpl.qsave(d.modelspace(), f.replace('.dxf','.png'), bg='#212830', size_inches=(14,9), dpi=110)
