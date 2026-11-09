import json,sys,difflib,re
a=json.load(open(sys.argv[1]));b=json.load(open(sys.argv[2]))
same=0
for x,y in zip(a['C'],b['C']):
    assert x['name']==y['name']
    if x['num']==y['num']: same+=1
    else: print('NUM DIFF',x['name'])
print(f"numeric {same}/{len(a['C'])} SAME; errors new: {b['errs']}")
ba=json.loads(a['bench']);bb=json.loads(b['bench'])
print('bench', [all(r['ok'] for r in x['rows']) for x in bb], 'same' if [[r['m'] for r in x['rows']] for x in ba]==[[r['m'] for r in x['rows']] for x in bb] else 'CHANGED')
def tx(h): return [l for l in re.sub(r'>\s*<','>\n<',h).split('\n')]
show=sys.argv[3] if len(sys.argv)>3 else None
for x,y in zip(a['C'],b['C']):
    for k in x['html']:
        if x['html'][k]!=y['html'][k]:
            d=[l for l in difflib.unified_diff(tx(x['html'][k]),tx(y['html'][k]),n=0,lineterm='') if l[:1] in '+-' and l[:3] not in('+++','---')]
            print(f"HTML {x['name']} [{k}] {len(d)} lines")
            if show and show in x['name']: print('\n'.join(l[:400] for l in d[:40]))
    if x['inp']!=y['inp']: print('INPUT PANEL', x['name'])
if a['sum']!=b['sum']: print('SUMMARY changed')
