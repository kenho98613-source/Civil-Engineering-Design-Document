import sys
src,dst=sys.argv[1],sys.argv[2]
s=open(src,encoding='utf-8').read()
def rep(old,new,cnt=1):
    global s
    n=s.count(old)
    assert n==cnt,(n,old[:90])
    s=s.replace(old,new)
# version
rep('Checker v13.8.13','Checker v14.0.1',4)
rep("const MVER='v13.8.13'","const MVER='v14.0.1'")
# CR-1 menu + dispatcher
rep('''<button data-a="dwopen" title="Read a DXF (section / elevation) and build the model from it">📐 Import drawing (DXF)…</button>''',
    '''<button data-a="dwopen" title="Read a DXF (section / elevation) and build the model from it">📐 Import drawing (DXF)…</button><button data-a="dxf" title="Write the wall section to an AutoCAD DXF (mm, levels in mPD)">📐 Export section (DXF)…</button>''')
rep("""else if(a=='dwopen'){mclose();dwOpen();return}""","""else if(a=='dwopen'){mclose();dwOpen();return}
 else if(a=='dxf'){dxfDlg();return}
 else if(a=='dxfgo'){dxfGo();return}""")
code=open('dxf_code.js',encoding='utf-8').read().replace('__DXFT__',open('tpl2.js',encoding='utf-8').read())
rep("/* figure drag handles: transform frozen","%s\n/* figure drag handles: transform frozen"%code)
open(dst,'w',encoding='utf-8').write(s)
print('ok')
