#!/usr/bin/env python3
"""Packs the whole game into one self-contained file: dist/blackspire.html.

You do not need this to run or develop the game (open index.html, or serve the folder).
It is for places that can only take a single file: the CSS and scripts are inlined and
every sprite PNG is embedded as a data URL.

    python3 tools/build.py
"""
import base64, json, os, re
ROOT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..')
def read(p):
    with open(os.path.join(ROOT,p),encoding='utf-8') as f: return f.read()
html=read('index.html')
html=html.replace('<link rel="stylesheet" href="css/style.css">','<style>\n'+read('css/style.css')+'</style>')
sprites={}
sdir=os.path.join(ROOT,'assets','sprites')
for d,_,files in os.walk(sdir):
    for f in sorted(files):
        if f.endswith('.png'):
            name=os.path.relpath(os.path.join(d,f),sdir)[:-4].replace(os.sep,'/')
            sprites[name]='data:image/png;base64,'+base64.b64encode(open(os.path.join(d,f),'rb').read()).decode()
scripts=re.findall(r'<script src="(js/[^"]+)"></script>',html)
bundle='window.SPRITE_DATA='+json.dumps(sprites,separators=(',',':'))+';\n'+'\n'.join('// ---- '+s+' ----\n'+read(s) for s in scripts)
first=html.index('<script src="'); last=html.rindex('</script>')+len('</script>')
html=html[:first]+'<script>\n'+bundle+'</script>'+html[last:]
html=re.sub(r'<!-- Scripts are plain files.*?-->\n','',html)
os.makedirs(os.path.join(ROOT,'dist'),exist_ok=True)
with open(os.path.join(ROOT,'dist','blackspire.html'),'w',encoding='utf-8') as f: f.write(html)
print('dist/blackspire.html',len(html)//1024,'KB,',len(scripts),'scripts,',len(sprites),'sprites')
