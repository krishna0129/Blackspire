#!/usr/bin/env python3
"""Regenerates the default sprite PNGs in assets/sprites/.

The game never draws characters, gear, weapons or enemies in code: it only loads these PNGs.
This script is just how the default art was produced. Edit the PNGs by hand, or change this and re-run:

    python3 tools/make_sprites.py        (needs Pillow: pip install pillow)

Conventions the game relies on
  * Character sheets are 88 x 78: four 22 x 26 frames across (stand, step A, step B, attack),
    three rows down (facing down, facing up, facing right; left is the right row mirrored).
  * A file ending in _tint.png is grey. The game colours it with the item's or character's colour:
    grey 128 becomes exactly that colour, darker greys shade it, lighter greys highlight it.
  * A file without _tint is drawn over the tinted one in its own colours.
  * Leave the outer one-pixel ring of every frame empty. The game adds the dark outline itself.
"""
import os
from PIL import Image
HERE=os.path.dirname(os.path.abspath(__file__)); OUT=os.path.join(HERE,'..','assets','sprites')
CW,CH,OX,OY=22,26,7,4
def hx(h,a=255): h=h.lstrip('#'); return (int(h[0:2],16),int(h[2:4],16),int(h[4:6],16),a)
def g(v): return (v,v,v,255)
B,S,S2,L,L2,DK,VD=g(128),g(87),g(96),g(156),g(166),g(83),g(40)       # tint greys
def save(im,name):
    p=os.path.join(OUT,name+'.png'); os.makedirs(os.path.dirname(p),exist_ok=True); im.save(p)

class Sheet:
    """A character-layout sheet. R() takes body coordinates (head top-left is 1,0)."""
    def __init__(s,cols=4,rows=3): s.cols,s.rows=cols,rows; s.im=Image.new('RGBA',(cols*CW,rows*CH),(0,0,0,0))
    def R(s,col,row,X,Y,w,h,c):
        for y in range(row*CH+OY+Y,row*CH+OY+Y+h):
            for x in range(col*CW+OX+X,col*CW+OX+X+w):
                if col*CW<=x<(col+1)*CW and row*CH<=y<(row+1)*CH: s.im.putpixel((x,y),c)
DOWN,UP,SIDE=0,1,2
def frames():
    """yield (col, leg lift a, leg lift b, arm swing a, arm swing b, attacking)"""
    for f in range(4): yield f,(-1 if f==1 else 0),(-1 if f==2 else 0),(1 if f==1 else 0),(1 if f==2 else 0),f==3
def arms(view,sa,sb,atk):
    """sleeve and hand rectangles, shared by the skin layer and every armor"""
    out=[('sleeve',-1,8,2,4+sa),('hand',-1,12+sa,2,1)]
    if not atk: out+=[('sleeve',9,8,2,4+sb),('hand',9,12+sb,2,1)]
    elif view==SIDE: out+=[('sleeve',9,9,3,2),('hand',12,9,1,2)]      # arm thrust forward
    elif view==DOWN: out+=[('sleeve',9,8,2,5),('hand',9,13,2,2)]      # arm reaching down
    else: out+=[('sleeve',9,5,2,4),('hand',9,4,2,1)]                  # arm raised
    return out

def skin():
    s=Sheet(); SK,SKS=g(128),g(102)
    for view in (DOWN,UP,SIDE):
        for f,la,lb,sa,sb,atk in frames():
            R=lambda *a: s.R(f,view,*a)
            R(2,17+la,3,2,SKS); R(5,17+lb,3,2,SKS)                     # feet
            for part,X,Y,w,h in arms(view,sa,sb,atk): R(X,Y,w,h,SK if part=='hand' else SKS)
            R(1,0,8,8,SK); R(1,7,8,1,SKS); R(2,7,6,1,SK); R(4,8,2,1,SKS)   # head, jaw shade, neck
            if view==UP: R(0,3,1,2,SKS); R(9,3,1,2,SKS)                 # ears
    return s.im
def eyes():
    s=Sheet()
    for f,*_ in frames():
        s.R(f,DOWN,3,4,1,2,B); s.R(f,DOWN,6,4,1,2,B); s.R(f,SIDE,5,4,1,2,B); s.R(f,SIDE,8,4,1,2,B)
    return s.im
def base():
    s=Sheet(); pants,shirt=hx('#24242e'),hx('#34343e')
    for view in (DOWN,UP,SIDE):
        for f,la,lb,sa,sb,atk in frames():
            R=lambda *a: s.R(f,view,*a)
            R(2,14,3,5+la,pants); R(5,14,3,5+lb,pants)
            if view==UP: R(1,8,8,6,shirt)
            else: R(1,8,3,1,shirt); R(6,8,3,1,shirt); R(1,9,8,5,shirt)   # notch shows the neck
            R(1,12,8,1,pants)
    return s.im
def hair(style):
    s=Sheet(); H,HS,HL=g(128),g(90),g(148)
    for f,*_ in frames():
        R=lambda *a: s.R(f,SIDE,*a)
        if style==2: R(0,1,3,11,HS)
        if style==3: R(-1,2,2,2,H); R(-2,4,2,5,H); R(-2,8,1,1,HS)
        if style==5: R(1,-1,8,2,HS); R(1,1,1,2,HS)
        else:
            R(1,-1,8,3,H); R(0,0,2,5,H); R(3,2,2,1,H); R(7,2,1,1,H); R(2,-1,6,1,HL)
            if style==1: R(2,-2,1,1,H); R(4,-3,2,2,H); R(7,-2,2,1,H); R(-1,1,1,2,H); R(9,0,1,2,H)
            if style==2: R(0,0,2,9,H)
            if style==3: R(0,2,1,1,HS)
            if style==4: R(0,0,2,8,H); R(9,1,1,6,H)
        R=lambda *a: s.R(f,DOWN,*a)
        if style==5: R(1,-1,8,2,HS); R(1,1,1,1,HS); R(8,1,1,1,HS)
        else:
            R(1,-1,8,3,H); R(0,0,2,4,H); R(8,0,2,4,H); R(2,2,1,1,H); R(7,2,1,1,H); R(2,-1,6,1,HL)
            if style==1: R(2,-2,1,1,H); R(4,-3,2,2,H); R(7,-2,1,1,H); R(-1,1,1,2,H); R(10,1,1,2,H)
            if style==2: R(0,0,2,11,H); R(8,0,2,11,H); R(0,9,2,2,HS); R(8,9,2,2,HS)
            if style==3: R(9,4,1,3,HS)
            if style==4: R(0,0,2,8,H); R(8,0,2,8,H)
        R=lambda *a: s.R(f,UP,*a)
        if style==5: R(1,-1,8,6,HS)
        elif style==2: R(1,-1,8,13,H); R(0,0,1,11,H); R(9,0,1,11,H); R(3,6,1,6,HS); R(6,6,1,6,HS); R(2,-1,6,1,HL)
        elif style==4: R(1,-1,8,9,H); R(0,0,1,8,H); R(9,0,1,8,H); R(1,7,8,1,HS); R(2,-1,6,1,HL)
        else:
            R(1,-1,8,7,H); R(0,0,1,5,H); R(9,0,1,5,H); R(1,5,8,1,HS); R(2,-1,6,1,HL)
            if style==1: R(2,-2,1,1,H); R(4,-3,2,2,H); R(7,-2,1,1,H); R(-1,1,1,2,H); R(10,1,1,2,H)
            if style==3: R(4,5,2,7,H); R(4,5,2,1,HS); R(4,11,2,1,HS)
    return s.im
def armor(kind):
    s=Sheet(); o=Sheet(); steel,steelL=hx('#aab0bd',150),hx('#dfe3ea',190)
    for view in (DOWN,UP,SIDE):
        for f,la,lb,sa,sb,atk in frames():
            R=lambda *a: s.R(f,view,*a); O=lambda *a: o.R(f,view,*a)
            R(1,8,8,6,B); R(1,12,8,1,S)
            for part,X,Y,w,h in arms(view,sa,sb,atk):
                if part=='sleeve': R(X,Y,w,h,S)
            if kind=='tunic':
                if view!=UP: R(4,8,2,1,S)
                R(1,13,8,1,L)
            elif kind=='leather':
                R(1,8,8,1,L)
                if view==UP: R(2,9,1,3,S); R(7,9,1,3,S)
                else: R(3,9,1,3,S); R(6,9,1,3,S); R(4,12,2,1,L2)
            elif kind=='coat':
                R(1,14,2,4,B); R(7,14,2,4,B); R(1,17,2,1,L); R(7,17,2,1,L)
                if view==SIDE: R(5,8,1,6,VD); R(4,8,1,2,L); R(6,8,1,2,L)
                elif view==DOWN: R(4,8,2,6,VD); R(3,8,1,3,L); R(6,8,1,3,L)
                else: R(1,8,8,1,L); R(1,14,8,3,B); R(1,16,8,1,S); R(4,9,1,7,S2)
            elif kind=='plate':
                R(1,13,8,1,S); O(1,8,8,4,steel); O(-1,8,3,2,steel); O(8,8,3,2,steel)
                if view==UP: O(2,9,6,1,steelL)
                else: O(2,9,3,2,steelL)
    return s.im,(o.im if kind=='plate' else None)
def boots(kind):
    s=Sheet(); o=Sheet(); st,stL=hx('#8d93a0'),hx('#c3cad6')
    for view in (DOWN,UP,SIDE):
        for f,la,lb,sa,sb,atk in frames():
            R=lambda *a: s.R(f,view,*a); O=lambda *a: o.R(f,view,*a)
            R(2,17+la,3,2,B); R(5,17+lb,3,2,B)
            if kind=='striders': R(2,17+la,3,1,L2); R(5,17+lb,3,1,L2)
            if kind=='greaves': O(2,15+la,3,2,st); O(5,15+lb,3,2,st); O(2,15+la,3,1,stL); O(5,15+lb,3,1,stL)
    return s.im,(o.im if kind=='greaves' else None)

# ---------------- weapons: 31 x 11, pointing right, grip at (4,5) ----------------
def canvas(w,h): return Image.new('RGBA',(w,h),(0,0,0,0))
def rect(im,X,Y,w,h,c,ox=1,oy=1):
    for y in range(Y+oy,Y+oy+h):
        for x in range(X+ox,X+ox+w):
            if 0<=x<im.width and 0<=y<im.height: im.putpixel((x,y),c)
WL,WM,WD=g(172),g(128),g(90); wood,guard=hx('#6b4a2c'),hx('#8d8674')
WEAPONS={
 'sword':([(0,4,3,1,wood),(3,2,1,5,guard)],[(4,3,11,1,WM),(4,4,12,1,WL),(4,5,11,1,WD)]),
 'dagger':([(1,4,2,1,wood),(3,3,1,3,guard)],[(4,4,7,1,WL),(4,3,5,1,WM),(4,5,4,1,WD)]),
 'great':([(0,4,4,1,wood),(4,1,1,7,guard)],[(5,2,15,5,WM),(5,4,16,1,WL),(5,6,15,1,WD),(20,3,1,3,WM)]),
 'mace':([(0,4,11,1,wood)],[(11,2,5,5,WM),(12,3,2,2,WL),(13,1,1,1,WD),(13,7,1,1,WD),(16,4,1,1,WD),(11,6,5,1,WD)]),
 'spear':([(0,4,21,1,wood),(19,2,1,5,guard)],[(20,3,4,3,WM),(21,4,4,1,WL),(24,4,1,1,WL)]),
}
def weapons():
    for name,(fixed,tint) in WEAPONS.items():
        a,b=canvas(31,11),canvas(31,11)
        for r in fixed: rect(a,*r)
        for r in tint: rect(b,*r)
        save(a,'weapons/'+name); save(b,'weapons/'+name+'_tint')
    t=canvas(31,11)
    for r in [(1,0,7,9,WM),(1,0,2,9,WD),(3,0,5,1,WL),(3,7,5,1,WD)]: rect(t,*r)
    save(t,'weapons/grimoire_tint')
    for school,acc in (('magic','#f08a3c'),('faith','#dcb65c')):
        f=canvas(31,11); rect(f,8,1,1,7,hx('#e6e1d3')); rect(f,4,3,3,3,hx(acc)); rect(f,5,4,1,1,hx('#ffffff')); save(f,'weapons/grimoire_'+school)
    # bow: three 16 x 17 frames (arrow nocked, drawn back, just loosed), grip at (9,8)
    tint,fixed,over=canvas(48,17),canvas(48,17),canvas(48,17)
    limb=[5,4,4,5,6,7,8,8,8,7,6,5,4,4,5]
    for fr in range(3):
        ox=fr*16+1
        for y,lx in enumerate(limb):
            if y in (0,14): rect(fixed,lx,y,1,1,hx('#d9d4c4'),ox)
            elif 6<=y<=8:
                rect(fixed,lx-1,y,2,1,hx('#3a2c22'),ox)
                if y==7: rect(fixed,lx,y,1,1,hx('#b9a36a'),ox)
            elif 4<=y<=10: rect(tint,lx-1,y,1,1,DK,ox); rect(tint,lx,y,1,1,L2,ox)
            else: rect(tint,lx,y,1,1,WM,ox)
        for y in range(1,14):
            sx=round(3-3*(1-abs(y-7)/6)) if fr==1 else 3
            rect(over,sx,y,1,1,hx('#cfc9b8'),ox)
        if fr<2:
            b=3 if fr==1 else 0
            rect(over,3-b,7,10,1,hx('#b9a36a'),ox); rect(over,12-b,7,2,1,hx('#e6e1d3'),ox); rect(over,13-b,7,1,1,hx('#ffffff'),ox)
            rect(over,3-b,6,2,1,hx('#b0464d'),ox); rect(over,3-b,8,2,1,hx('#b0464d'),ox)
    save(tint,'weapons/bow_tint'); save(fixed,'weapons/bow'); save(over,'weapons/bow_over')

# ---------------- enemies: dark silhouettes, eyes in their own file so they can glow in the dark ----------------
EMAPS={
 'shade':['....####....','...######...','..########..','..#o####o#..','..########..','.##########.','.##########.','############','############','############','############','.##########.','.#.##.##.##.','.#..#..#..#.'],
 'skitter':['#..####..#','.########.','.#o####o#.','##########','.########.','#.#....#.#','#........#'],
 'brute':['....########....','...##########...','..############..','..##o######o##..','.##############.','################','################','################','################','################','.##############.','.##############.','..####....####..','..####....####..','..####....####..','.#####....#####.'],
 'wisp':['...#....','..##....','..###...','.#####..','.#o##o#.','########','########','.######.','..####..','...##...'],
 'skel':['...++++++...','..++++++++..','..+o++++o+..','..++++++++..','...++#+#++..','....++++....','.....##.....','..########..','.##+####+##.','.#.######.#.','.#.+####+.#.','.#.######.#.','...+####+...','...##..##...','...##..##...','...##..##...','..###..###..'],
 'skelarcher':['..++++++..','.++++++++.','.+o++++o+.','.++++++++.','..+#++#+..','...++++...','....##....','.+######..','+.#+##+#..','+.######..','+.#+##+#..','.+.####...','...#..#...','...#..#...','..##..##..'],
 'skelknight':['....++++++++....','...++++++++++...','...++o++++o++...','...++++++++++...','....++#+#+#+....','.....++++++.....','..############..','.##############.','###+########+###','################','###+########+###','################','.##+########+##.','..############..','..####....####..','..####....####..','..####....####..','.#####....#####.'],
}
EYE={'shade':'#e2553f','skitter':'#e2b93b','brute':'#e2553f','wisp':'#6fd6e6','skel':'#9be08a','skelarcher':'#9be08a','skelknight':'#9be08a'}
BODY,BONE=hx('#0d0d13'),hx('#6f6a5a')
def enemy(rows,eye,sc=1,top=1,extra_h=0):
    w,h=len(rows[0])*sc+2,len(rows)*sc+2+extra_h
    body,ey=canvas(w,h),canvas(w,h)
    for y,row in enumerate(rows):
        for X,ch in enumerate(row):
            if ch=='.': continue
            rect(body,1+X*sc,top+y*sc,sc,sc,BONE if ch in '+' else BODY,0,0)
            if ch=='o': rect(ey,1+X*sc,top+y*sc,sc,sc,hx(eye),0,0)
    return body,ey
# ---- shields: three frames side by side (seen from the front, from behind, edge-on) ----
def shields():
    st,sl,sd,wd,wdd,gold=hx('#8d93a0'),hx('#c3cad6'),hx('#5a5e6b'),hx('#6b4a2c'),hx('#3a2c22'),hx('#dcb65c')
    b=canvas(27,9)                                                      # buckler: 9 x 9 frames
    for r in [(2,0,3,1,st),(1,1,5,1,st),(0,2,7,3,st),(1,5,5,1,st),(2,6,3,1,st),(2,1,3,1,wd),(1,2,5,3,wd),(2,5,3,1,wd),(3,3,1,1,sl)]: rect(b,*r)
    for r in [(2,0,3,1,sd),(1,1,5,1,sd),(0,2,7,3,sd),(1,5,5,1,sd),(2,6,3,1,sd),(2,1,3,1,wdd),(1,2,5,3,wdd),(2,5,3,1,wdd),(1,3,5,1,wd)]: rect(b,*r,ox=10)
    for r in [(3,0,1,7,st),(2,1,3,5,st),(3,1,1,5,sl)]: rect(b,*r,ox=19)
    save(b,'weapons/buckler')
    s=canvas(33,13)                                                     # heavy shield: 11 x 13 frames
    for r in [(0,0,9,8,sd),(1,8,7,1,sd),(2,9,5,1,sd),(3,10,3,1,sd),(1,1,7,7,st),(2,8,5,1,st),(3,9,3,1,st),(0,0,9,1,sl),(4,2,1,6,gold),(3,3,3,1,gold)]: rect(s,*r)
    for r in [(0,0,9,8,sd),(1,8,7,1,sd),(2,9,5,1,sd),(3,10,3,1,sd),(1,1,7,7,wdd),(2,8,5,1,wdd),(3,9,3,1,wdd),(1,3,7,1,wd),(1,6,7,1,wd)]: rect(s,*r,ox=12)
    for r in [(3,0,3,10,sd),(4,0,1,11,st),(4,1,1,8,sl)]: rect(s,*r,ox=23)
    save(s,'weapons/shield')

# ---- floor 2 skeletons: sheets of three frames across (step, other step, attack) and three rows (facing down, up, right) ----
STEEL,STEEL_L,BLADE=hx('#5a5e6b'),hx('#8d93a0'),hx('#b9b4a6')
def grid(rows): return [list(r) for r in rows]
def lift(gd,right):                       # one leg a pixel up
    h,w=len(gd),len(gd[0]); cols=range(w//2,w) if right else range(0,w//2)
    for y in range(h-4,h-1):
        for x in cols: gd[y][x]=gd[y+1][x]
    for x in cols: gd[h-1][x]='.'
    return gd
def back(gd,torso):                       # seen from behind: no face, a spine instead of ribs
    w=len(gd[0])
    for y,row in enumerate(gd):
        for x,ch in enumerate(row):
            if ch=='o' or (y<torso and ch=='#'): row[x]='+'
            elif y>=torso and ch=='+': row[x]='#'
    for y in range(torso+1,len(gd)-5,2): gd[y][w//2-1]='+'; gd[y][w//2]='+'
    return gd
def side(gd,torso):                       # facing right: one eye, the far arm hidden
    seen=False
    for y,row in enumerate(gd):
        for x,ch in enumerate(row):
            if ch=='o' and not seen: row[x]='+'; seen=True
        if torso<=y<len(gd)-5:
            for x in (0,1):
                if row[x]!='.': row[x]='.'
    return gd
SKEL={   # name: (frame w, frame h, first torso row, mirror the map for the side view, extras[row][col] = rects in map coordinates)
 'skel':(20,23,7,False,[
   [[(10,11,1,3,'w')],[(10,11,1,3,'w')],[(10,11,1,8,'w')]],
   [[(10,6,1,3,'w')],[(10,6,1,3,'w')],[(10,-2,1,9,'w')]],
   [[(10,10,3,1,'w')],[(10,10,3,1,'w')],[(10,10,7,1,'w')]]]),
 'skelarcher':(18,21,7,True,[
   [[],[],[(0,11,1,6,'w')]],
   [[],[],[(0,-2,1,8,'w')]],
   [[],[],[(9,9,6,1,'w')]]]),
 'skelknight':(24,24,6,False,[
   [[(0,8,7,7,'s'),(0,8,7,1,'S'),(0,8,1,7,'S'),(3,11,1,1,'S'),(14,11,2,3,'w')],None,[(0,8,7,7,'s'),(0,8,7,1,'S'),(0,8,1,7,'S'),(3,11,1,1,'S'),(14,11,2,9,'w')]],
   [[(14,5,2,3,'w')],None,[(14,-3,2,10,'w')]],
   [[(13,7,3,8,'s'),(15,7,1,8,'S'),(2,3,2,4,'w')],None,[(13,7,3,8,'s'),(15,7,1,8,'S'),(12,4,7,2,'w')]]]),
}
COL={'#':BODY,'+':BONE,'o':BONE,'s':STEEL,'S':STEEL_L,'w':BLADE}
def skeleton(name):
    fw,fh,torso,mirror,extras=SKEL[name]; rows=EMAPS[name]; mw,mh=len(rows[0]),len(rows); X0,Y0=(fw-mw)//2,3
    body,ey=canvas(fw*3,fh*3),canvas(fw*3,fh*3)
    for row in range(3):
        for col in range(3):
            gd=grid([r[::-1] for r in rows] if (mirror and row==2) else rows)
            if row==1: gd=back(gd,torso)
            if row==2: gd=side(gd,torso)
            if col<2: gd=lift(gd,col==1)
            ox,oy=col*fw+X0,row*fh+Y0
            for y,r in enumerate(gd):
                for x,ch in enumerate(r):
                    if ch=='.': continue
                    body.putpixel((ox+x,oy+y),COL[ch])
                    if ch=='o': ey.putpixel((ox+x,oy+y),hx(EYE[name]))
            ex=extras[row][col] if extras[row][col] is not None else extras[row][0]
            for (x,y,w,h,ch) in ex: rect(body,ox+x,oy+y,w,h,COL[ch],0,0)
    return body,ey

# ---- floor 3: roots and the restless dead. Its own look: three or four shades per material, roots through the cast.
# Each map is one frame. Characters are colours from F3PAL; 'o' (in the enemy's eye colour) and the enemy's glow
# characters also go on the _eyes layer, so they show through the dark. Designs: docs/design/floor-3.md.
F3PAL={"#":"#0d0d13","a":"#283320","b":"#465434","c":"#6f8050","C":"#98a86a","+":"#6f6a5a","B":"#b9b4a6","K":"#e4dfcf","d":"#211b2a","e":"#352c42","f":"#4b3f5c","v":"#26331c","V":"#43592c","X":"#6c8c42","w":"#3e2c1e","W":"#6b4a2c","t":"#ddd6c0","p":"#4e1520","P":"#8e2a38","Q":"#c44a58","R":"#e9838b","y":"#d9a441","s":"#14232b","S":"#24505a","T":"#3f8a84","U":"#a6e0cf","m":"#7c7789","M":"#b3afc0","N":"#e3dfec","k":"#a0782c","l":"#5e4620","o":"#0d0d13","O":"#283320","L":"#c99a3a","Y":"#5e4620"}
F3={
  "thrall":("#d6f07a",{},[
    ".....vX...........",
    "..v..XVv..........",
    "..Xv.vVv..........",
    "...VvvVbbbb.......",
    "....vVbcccbb......",
    "....abcCcc+Bb.....",
    "....abo#cc#ob.....",
    "....abcc#cB+b.....",
    ".....ab#K#Kba.....",
    ".....abK#K#b......",
    "...aabbcbbbcbba...",
    "..abcbbcbbcbbcba..",
    "..ab+B+Bbcbcbbcb..",
    ".abc#+#+bbbbb.cba.",
    ".ab.+B+Bbbcb..bcb.",
    ".bc.abbbbbba..bcb.",
    ".bc.deeeeed...cC..",
    ".cb.defeeed..ab...",
    "bcc.dedded........",
    ".b..bba.bb........",
    "....bba.abb.......",
    "...abb...bbb......",
    "...##....###......",
  ]),
  "gravecaller":("#9be08a",{"O":"#9be08a"},[
    "......e..........O.",
    ".....eee........OOO",
    "....eefee.......OKO",
    "...eefffee......BWB",
    "...edd#ddde......W.",
    "..eed#BBB#de.....W.",
    "..ed#BoBoB#d.....W.",
    "..ed#BBKBB#de....W.",
    "..ede#K#K#ede....W.",
    ".eeedd#K#ddeee..BW.",
    "eefeeeddddeefee.BW.",
    "efffeefeeeeeeffBB..",
    "eB.feeeffeeeeff.W..",
    "eB.efeefeefeefe.W..",
    ".B.efeefeefeefe.W..",
    "BB.effeefeefeefe.W.",
    "...eefeefeefeefe.W.",
    "...eeffeeffeeffe.W.",
    "..eefeeffeeffeeee.W",
    "..ee.ee.eee.ee.ee.W",
    "..e..e...e...e..e..",
    ".....d.......d.....",
  ]),
  "thornroot":("#f2a03c",{},[
    "..........tPQQPt....",
    ".........tPRRRRPt...",
    "........pQt.tt.tQp..",
    "........P..oooo..P..",
    "........pQt.tt.tQp..",
    ".........tPQQQQPt...",
    "..........pVXXVp....",
    "...t.......vXVv.....",
    "..vVv.....vXVv..t...",
    ".vXVXv...vXVv..vV...",
    "vVvtvXvvvXVv..vXv...",
    "vXv..vVXVVv..vXv....",
    "vVv...vVXVvvvVv...t.",
    "vvVv..vVXXVVv..vvVv.",
    ".vvVvvVvvVvvvvVvXVv.",
    "..vvvvvvvvvvvvvvvvv.",
  ]),
  "bloodbloom":("#9be08a",{"O":"#9be08a"},[
    ".......yty.......",
    "......y.t.y......",
    ".......PRP.......",
    ".....pPQOQPp.....",
    "...pPPQOOOQPPp...",
    "..pPQRPOOOPRQPp..",
    ".pPQp.pPQPp.pQPp.",
    ".pQp...pPp...pQp.",
    ".pP.....V.....Pp.",
    ".p......X......p.",
    "........V........",
    ".......vXv.......",
    ".....VvvVvvV.....",
    "....V.v.V.v.V....",
    "...v..v.v.v..v...",
    "..v...v.v.v...v..",
    "..v..v..v..v..v..",
  ]),
  "hermit":("#f2a03c",{},[
    "........+BBBB+.........",
    "......+BBKKBBBB+.......",
    ".....+BKKBBVXBBBB+.....",
    "....+BKBBBBVBB#BBB+....",
    "....+BB###BBB#B###B+...",
    "...+BB#####BB#####BB+..",
    "...+B##o###BB##o###B+..",
    "...+BB####B#B#####BB+..",
    "...++BB##BB#BB###BB++..",
    "....++BBBB###BBBBB++...",
    ".....++BB+#+#+BB++.....",
    "..ss..+B#B#B#B#B+..ss..",
    ".sS.sSS++++++++SSs..Ss.",
    "sS.sS.sSTTTTTTSs.Ss..Ss",
    "S.sS.s.sS#B.B#Ss.s.Ss.S",
    ".sS.s...s.B.B.s...s.Ss.",
    "sS.s.....s...s.....s.Ss",
  ]),
  "collector":("#9be08a",{"O":"#9be08a","L":"#ffe9a8"},[
    "...................wW.....",
    "..................wWWw....",
    "..................w..wk...",
    "......................k...",
    ".....................lkl..",
    ".....ddeedd.........lLLLl.",
    "....deeeeeed........kLLLk.",
    "...deNNNNmNe........lLLLl.",
    "..deNNMMMMmN.........lkl..",
    "..deNM###MMN..........w...",
    "..deN##o##MN..........w...",
    "..deN#oo##MMN.........w...",
    "..deNM###MMMM#N.......w...",
    "..deNNMMMMmMMMMNN.....w...",
    "...deNNNmmmmmMMMMN....w...",
    "....deeeeee##mmmMMNN..w...",
    ".....ddeeddmm###mmmmN.w...",
    ".............mm.....m.w...",
    "...................mm.w...",
    "...dddeeddd.......mN..w...",
    "..ddeeeeeeedd.....m..Mw...",
    ".ddleeeeeeeeedd.....NMw...",
    ".deelleeeeeeeeedd..NM.w...",
    "ddeekelleeeeeeeedd.mM.w...",
    "deeeOOeelleeeeeeedmm..w...",
    "deefOOeeekelleeeeed...w...",
    "deefeeeeeOOeelleeed...w...",
    "dMefeeeeeOOeeekeled...w...",
    "dMefeeefeeeeeeOOeld...w...",
    ".MefeeefeeeeeeOOeed...w...",
    ".Mefeeefeeeefeeeedd...w...",
    ".Mdefeefeeeefeeeeed...w...",
    ".Mdefeefeeeefeeeeed...w...",
    ".NddefefeeeefeeeeedW..w...",
    ".N.deefeeeefeeeeeeed..w...",
    ".NNdeefeeeefeeeeeeed..w...",
    "MN.deeefeeefeeeeeeed..w...",
    "MN.deeefeeefeeeeeeed..w...",
    "...deeefeeefeeeeeeed..w...",
    "..ddeeefeeefeeeeeeedd.w...",
    "..deeeefeeefeeeeeeeed.w...",
    ".ddeeeffeeeffeeeeeedd.w...",
    ".deeeefeefeeefeeeeeed.w...",
    "dde.edd.dde.ddeed.edd.w...",
    "dd..dd..dd..dd.dd..dd.w...",
    "d...d...d...d...d...d.w...",
  ]),
  "corpse":("#000000",{},[
    ".....V.v........",
    "..ab+BB+.vXv....",
    ".abbB#B+bbbbaa..",
    ".abb+BB+bbcbbbc.",
    "..aa..aaab.bb.b.",
    ".....v...v..V...",
  ]),
}
def floor3():
    for name,(eye,glow,rows) in F3.items():
        w,h=len(rows[0])+2,len(rows)+2
        body,ey=canvas(w,h),canvas(w,h)
        for y,row in enumerate(rows):
            for x,ch in enumerate(row):
                if ch=='.': continue
                body.putpixel((1+x,1+y),hx(F3PAL[ch]))
                g=eye if ch=='o' else glow.get(ch)
                if g: ey.putpixel((1+x,1+y),hx(g))
        save(body,'enemies/'+name)
        if name!='corpse': save(ey,'enemies/'+name+'_eyes')

def enemies():
    for name,rows in EMAPS.items():
        if name in SKEL: b,e=skeleton(name)
        else: b,e=enemy(rows,EYE[name])
        save(b,'enemies/'+name); save(e,'enemies/'+name+'_eyes')
    b,e=enemy(EMAPS['brute'],'#ff4a3d',2,7,6)                         # floor boss: a horned brute at double size
    for r in [(7,1,3,7),(5,1,2,3),(24,1,3,7),(27,1,2,3),(13,4,8,3)]: rect(b,*r,BODY,0,0)
    save(b,'enemies/boss'); save(e,'enemies/boss_eyes')
    b,e=enemy(EMAPS['skelknight'],'#9be08a',2,7,6)                    # the Bone Regent: a crowned knight at double size
    for r in [(9,4,16,3),(9,1,2,3),(16,0,2,4),(23,1,2,3)]: rect(b,*r,hx('#b9a36a'),0,0)
    save(b,'enemies/boneboss'); save(e,'enemies/boneboss_eyes')

# ---------------- props, the blacksmith, icons ----------------
def hard_light(grey,tint):
    """the same blend the game uses to colour a _tint sprite"""
    out=[]
    for i in range(3):
        t,v=tint[i]/255,grey[i]/255
        out.append(round(255*(2*t*v if t<=.5 else 1-2*(1-t)*(1-v))))
    return tuple(out)+(grey[3],)
def colour(im,tint):
    im=im.copy(); t=hx(tint); px=im.load()
    for y in range(im.height):
        for x in range(im.width):
            if px[x,y][3]: px[x,y]=hard_light(px[x,y],t)
    return im
def cell(im,col,row): return im.crop((col*CW,row*CH,(col+1)*CW,(row+1)*CH))
# The trader: side view, facing right, under a pack almost as tall as they are, with a bedroll on top, a pan and a
# lantern hanging off it, a wide hat and a walking stick. Painted as shapes on a character grid, then coloured.
TRADER_PAL={"W":"#7a5a34","w":"#4a3320","L":"#a07844","r":"#8e2a38","R":"#c44a58","g":"#3a2a18","B":"#d9a441","m":"#6f6a5a",
    "M":"#b3afc0","y":"#f5c86a","h":"#4a3324","H":"#6b4a2c","s":"#c68d62","S":"#9a6a48","e":"#1c1c24","c":"#3e5a3a",
    "C":"#5a7a4a","b":"#2b2018","p":"#3a3440","k":"#2a211b","t":"#8a6a3a","T":"#c9a46a"}
def trader():
    W,H=24,27; gd=[['.']*W for _ in range(H)]
    def fill(c,x,y,w,h):
        for yy in range(y,y+h):
            for xx in range(x,x+w): gd[yy][xx]=c
    # the pack
    fill('W',2,3,13,19); fill('w',2,3,1,19); fill('w',14,3,1,19); fill('w',2,3,13,1); fill('w',2,21,13,1)
    fill('L',3,4,11,4); fill('w',3,8,11,1)                         # the flap
    fill('g',8,4,1,9); fill('B',8,7,1,1)                           # strap and buckle
    fill('L',3,13,4,6); fill('w',3,13,4,1); fill('w',6,13,1,6)     # side pocket
    fill('r',4,0,10,3); fill('R',4,0,10,1); fill('g',6,0,1,3); fill('g',11,0,1,3)   # bedroll
    fill('g',1,9,1,1); fill('m',0,10,3,3); fill('M',1,10,1,1)      # a pan
    fill('g',1,15,1,1); fill('m',0,16,2,4); fill('y',0,17,2,2)     # a lantern
    # the trader
    fill('t',23,6,1,21); fill('T',23,5,1,1)                        # walking stick
    fill('c',15,12,7,8); fill('C',20,12,1,8)                       # coat
    fill('g',15,10,2,8)                                            # pack strap over the shoulder
    fill('b',15,15,7,1); fill('B',19,15,1,1)                       # belt
    fill('C',21,12,1,5); fill('s',22,16,1,1)                       # arm, hand on the stick
    fill('r',16,11,6,1)                                            # scarf
    fill('s',17,8,5,3); fill('S',17,8,1,3); fill('e',20,9,1,1); fill('s',22,9,1,1)   # face, looking right
    fill('h',17,4,4,3); fill('H',17,5,4,1); fill('h',15,7,8,1)     # hat
    fill('p',16,20,2,5); fill('p',19,20,2,5)                       # legs
    fill('k',16,25,3,2); fill('k',19,25,3,2)                       # boots
    im=canvas(W+2,H+2)
    for y,row in enumerate(gd):
        for x,ch in enumerate(row):
            if ch!='.': im.putpixel((1+x,1+y),hx(TRADER_PAL[ch]))
    save(im,'npc/trader')
def props(layers):
    # the blacksmith is the side-view body, bald, bearded and aproned, in fixed colours
    sm=canvas(CW,CH)
    for im,t in ((layers['skin'],'#c68d62'),(layers['base'],None),(layers['eyes'],'#1c1c24'),(layers['boots'],'#2a211b'),(layers['leather'],'#4a3524'),(layers['buzz'],'#3a3a44')):
        c=cell(im,0,SIDE); c=colour(c,t) if t else c; sm.alpha_composite(c)
    for r in [(3,6,6,2,'#9a9484'),(4,8,4,1,'#9a9484'),(5,6,2,1,'#c68d62'),(2,9,6,5,'#2b2b33'),(2,9,6,1,'#3d3d48'),(3,8,1,1,'#2b2b33'),(6,8,1,1,'#2b2b33')]:
        rect(sm,*r[:4],hx(r[4]),OX,OY)
    save(sm,'npc/smith')
    trader()
    a=canvas(16,11)
    for r in [(1,0,12,3,'#5a5e6b'),(1,0,12,1,'#8d93a0'),(0,1,1,1,'#5a5e6b'),(13,1,1,1,'#5a5e6b'),(4,3,6,2,'#3d4152'),(2,5,10,3,'#4a4e5c'),(2,7,10,1,'#2b2e3a')]: rect(a,*r[:4],hx(r[4]))
    save(a,'props/anvil')
    b=canvas(12,9)
    for r in [(0,2,10,2,'#3d4152'),(1,4,8,2,'#2b2e3a'),(4,6,2,1,'#2b2e3a'),(1,2,8,1,'#f08a3c')]: rect(b,*r[:4],hx(r[4]))
    save(b,'props/brazier')
    c=canvas(28,11)                                                    # chest: closed, then open
    for op in (0,1):
        ox=op*14+1
        for r in [(0,2,12,7,'#3a2c22'),(0,2,12,1,'#55402f'),(0,5,12,1,'#6f6a5c'),(5,4,2,3,'#1a1a1a' if op else '#dcb65c')]: rect(c,*r[:4],hx(r[4]),ox)
        for r in ([(1,0,10,2,'#0a0a0d'),(0,0,12,1,'#2a2019')] if op else [(0,0,12,2,'#4a382b'),(0,0,12,1,'#6b5340')]): rect(c,*r[:4],hx(r[4]),ox)
    save(c,'props/chest')
    st=canvas(20,16)                                                   # the stash: an iron-bound chest with a blue lock
    for r in [(0,4,18,10,'#2b2e3a'),(0,4,18,1,'#3c4152'),(0,0,18,4,'#3a3f50'),(0,0,18,1,'#5a6070'),(3,0,2,14,'#8d93a0'),(13,0,2,14,'#8d93a0'),
              (0,6,18,1,'#5a6070'),(7,5,4,4,'#14141c'),(8,6,2,2,'#6fd6e6')]: rect(st,*r[:4],hx(r[4]),1,1)
    save(st,'props/stash')
    t=canvas(24,24)                                                    # trinket icon (tinted) and potion icon
    for r in [(9,7,6,1,B),(8,8,1,1,B),(15,8,1,1,B),(7,9,1,6,B),(16,9,1,6,B),(8,15,1,1,DK),(15,15,1,1,DK),(9,16,6,1,DK)]: rect(t,*r,0,0)
    save(t,'icons/trinket_tint')
    p=canvas(24,24)
    for r in [(8,3,8,3,'#050508'),(6,6,12,13,'#050508'),(10,4,4,2,'#e6e1d3'),(7,9,10,9,'#d9534f'),(8,10,2,3,'#f1b0a8')]: rect(p,*r[:4],hx(r[4]),0,0)
    save(p,'icons/potion')

# ---------------- the root village ----------------
# Buildings, stalls and scenery for the village (js/sim/village.js places them). Each is drawn from simple shapes.
# Sizes are in game pixels; a building's bottom edge is where its footprint ends.
from PIL import ImageDraw
def V(w,h): im=canvas(w,h); return im,ImageDraw.Draw(im)
def R2(d,x,y,w,h,c): d.rectangle([x,y,x+w-1,y+h-1],fill=hx(c))
def shingles(d,x0,y0,x1,y1,dark,mid,light,step=4):
    """a sloped roof face: rows of shingles between two edges given as (x0..x1) at the top and bottom row"""
    for y in range(y0,y1):
        c=dark if (y-y0)%step==0 else mid if (y-y0)%step<step-1 else light
        d.line([x0,y,x1,y],fill=hx(c))
def tree(name,dark,mid,light,top):
    im,d=V(46,54)
    R2(d,20,36,6,16,'#3e2c1e'); R2(d,21,36,2,16,'#5a4028'); R2(d,17,49,12,3,'#3e2c1e')   # trunk and roots
    for (cx,cy,r,c) in [(23,24,18,dark),(14,26,11,dark),(32,26,11,dark),(23,20,15,mid),(16,20,9,mid),(30,19,9,mid),(20,14,8,light),(28,13,6,light),(top[0],top[1],4,top[2])]:
        d.ellipse([cx-r,cy-r,cx+r,cy+r],fill=hx(c))
    for i in range(14):   # leaf texture
        x,y=8+(i*37)%30,8+(i*23)%28
        if im.getpixel((x,y))[3]: d.point((x,y),fill=hx(light if i%3 else dark))
    save(im,'village/'+name)
def building(name,w,h,wall,trim,roof,roofd,roofl,door,deco):
    im,d=V(w,h)
    rh=int(h*.48)
    R2(d,4,rh-2,w-8,h-rh+2,wall)                                   # walls
    for y in range(rh+6,h-2,7): d.line([4,y,w-5,y],fill=hx(trim))  # courses of stone or planks
    R2(d,4,h-6,w-8,6,trim)                                         # footing
    d.polygon([(0,rh),(w//2,2),(w-1,rh)],fill=hx(roof))            # the roof, seen from the front
    for y in range(4,rh,4):
        half=int((w//2)*(y-2)/(rh-2)); d.line([w//2-half,y,w//2+half,y],fill=hx(roofd))
    d.line([0,rh,w//2,2],fill=hx(roofl)); d.line([w//2,2,w-1,rh],fill=hx(roofd)); R2(d,0,rh,w,2,roofd)
    dw=18; R2(d,w//2-dw//2,h-30,dw,24,'#2a1d12'); R2(d,w//2-dw//2+2,h-28,dw-4,22,door); R2(d,w//2+3,h-18,2,2,'#d9a441')   # door
    deco(im,d)
    save(im,'village/'+name)
def windows(d,w,h,ys,col='#f5c86a'):
    for x in (14,w-30):
        for y in ys: R2(d,x,y,16,12,'#2a1d12'); R2(d,x+2,y+2,12,8,col); R2(d,x+7,y+2,2,8,'#2a1d12'); R2(d,x+2,y+6,12,1,'#2a1d12')
def inn_deco(im,d):
    w,h=im.size; windows(d,w,h,[h-44,h-26] if False else [h-40])
    R2(d,w-36,8,10,26,'#4a4a52'); R2(d,w-38,6,14,4,'#5e5e68')      # chimney
    R2(d,24,h-62,26,14,'#3e2c1e'); R2(d,26,h-60,22,10,'#a07844'); R2(d,33,h-58,8,7,'#e6e1d3'); R2(d,41,h-57,2,4,'#e6e1d3')   # sign: a mug
    R2(d,36,h-66,2,4,'#2a1d12')
def guild_deco(im,d):
    w,h=im.size; windows(d,w,h,[h-40],'#9fd0f5')
    cx=w//2; R2(d,cx-12,h-66,24,26,'#2b3350'); R2(d,cx-10,h-64,20,22,'#3c4a72')            # a shield over the door
    for i in range(14): d.point((cx-7+i,h-62+i),fill=hx('#c3cad6')); d.point((cx+6-i,h-62+i),fill=hx('#c3cad6'))   # crossed swords
    for x in (10,w-16):                                                                   # banners
        R2(d,x,h-70,6,26,'#6fd6e6'); R2(d,x+1,h-68,4,22,'#2b3350'); d.polygon([(x,h-44),(x+3,h-40),(x+6,h-44)],fill=hx('#6fd6e6'))
    R2(d,cx-14,h-6,28,4,'#5e5e68')                                                        # step
def stall_back():
    im,d=V(84,58)
    for x in (4,76): R2(d,x,10,4,48,'#4a3324'); R2(d,x+1,10,1,48,'#6b4a2c')               # posts
    R2(d,8,22,68,34,'#2a2018'); R2(d,8,22,68,2,'#3e2c1e')                                 # back wall
    for y in (32,44): R2(d,10,y,64,2,'#5e4620')                                           # shelves
    save(im,'village/stall')
    t,td=V(84,58)                                                                         # the awning, grey for tinting
    for i in range(0,84,12):
        R2(td,i,0,6,16,'#a0a0a0'); R2(td,i+6,0,6,16,'#e8e8e8')
    for i in range(0,84,12): td.polygon([(i,16),(i+6,16),(i+3,21)],fill=g(110)); td.polygon([(i+6,16),(i+12,16),(i+9,21)],fill=g(200))
    R2(td,0,0,84,2,'#606060')
    save(t,'village/stall_tint')
def goods(name,items):
    im,d=V(84,58)
    for f in items: f(d)
    save(im,'village/goods_'+name)
def counter():
    im,d=V(84,16); R2(d,2,0,80,4,'#8a6a3a'); R2(d,2,0,80,1,'#c9a46a'); R2(d,4,4,76,12,'#5e4620')
    for x in range(10,80,14): R2(d,x,6,2,10,'#3e2c1e')
    save(im,'village/counter')
def forge():
    im,d=V(84,66)
    R2(d,22,0,16,30,'#4a4a52'); R2(d,20,0,20,4,'#5e5e68')                                 # chimney
    R2(d,6,26,72,40,'#3d3d48'); 
    for y in range(30,66,6):
        for x in range(6+(y//6%2)*6,78,12): R2(d,x,y,11,5,'#4a4a56')                      # stone blocks
    R2(d,14,40,26,20,'#1a1a20'); R2(d,16,46,22,12,'#f08a3c'); R2(d,18,50,18,6,'#ffd86a')  # hearth and coals
    R2(d,48,36,22,3,'#6b4a2c')                                                            # tool rack
    for x,c in ((50,'#8d93a0'),(56,'#c3cad6'),(62,'#8d93a0')): R2(d,x,39,3,12,c)
    R2(d,2,22,80,6,'#3e2c1e'); R2(d,2,22,80,2,'#5a4028')                                  # lintel
    save(im,'village/forge')
def witch():
    im,d=V(84,62)
    d.polygon([(0,20),(42,0),(83,20)],fill=hx('#3a2850')); 
    for y in range(4,20,4): half=int(42*y/20); d.line([42-half,y,42+half,y],fill=hx('#2a1d3a'))
    R2(d,6,20,72,42,'#1d1a2a'); R2(d,6,20,72,2,'#2a2538')
    for y in (30,42): R2(d,10,y,64,2,'#4a3a5a')
    for i,(x,c) in enumerate([(12,'#9be08a'),(20,'#cfc8ff'),(30,'#e9838b'),(40,'#9be08a'),(50,'#5aa7e6'),(60,'#d9a441'),(66,'#cfc8ff')]):
        R2(d,x,24+(i%2),5,6,'#14141c'); R2(d,x+1,25+(i%2),3,4,c)
        R2(d,x+2,36,4,6,'#14141c'); R2(d,x+3,37,2,4,c)
    for x in (16,34,58): R2(d,x,20,1,8,'#43592c'); R2(d,x-2,27,5,4,'#6c8c42')            # hanging herbs
    R2(d,70,46,6,6,'#d9d4c4'); R2(d,71,48,1,1,'#14141c'); R2(d,74,48,1,1,'#14141c')        # a skull
    save(im,'village/witch')
    im,d=V(28,22); d.ellipse([2,6,25,21],fill=hx('#2b2b33')); d.ellipse([3,4,24,10],fill=hx('#9be08a')); d.ellipse([7,5,20,8],fill=hx('#c8f0b8'))
    R2(d,4,19,3,3,'#1a1a20'); R2(d,21,19,3,3,'#1a1a20')
    save(im,'village/cauldron')
def tent():
    im,d=V(52,42)
    d.polygon([(2,40),(26,8),(50,40)],fill=g(128)); d.polygon([(26,8),(50,40),(38,40)],fill=g(96)); d.polygon([(2,40),(26,8),(10,40)],fill=g(150))
    d.polygon([(20,40),(26,24),(32,40)],fill=g(40))
    R2(d,25,0,2,10,'#6b4a2c')
    save(im,'village/tent_tint')
    f,fd=V(52,42); R2(fd,27,1,12,7,'#808080'); fd.polygon([(39,1),(42,4),(39,8)],fill=g(128))
    save(f,'village/flag_tint')
def small():
    im,d=V(28,32)                                                                         # the well
    R2(d,2,4,24,3,'#4a3324'); R2(d,0,2,28,3,'#6b4a2c'); R2(d,4,6,2,14,'#4a3324'); R2(d,22,6,2,14,'#4a3324')
    R2(d,10,8,8,6,'#7a5a34'); R2(d,13,7,2,2,'#b3afc0')
    d.ellipse([2,16,25,31],fill=hx('#5e5e68')); d.ellipse([5,18,22,26],fill=hx('#24505a')); d.ellipse([8,19,19,23],fill=hx('#5aa7e6'))
    for x in range(3,25,5): R2(d,x,26,4,4,'#4a4a52')
    save(im,'village/well')
    im,d=V(12,34); R2(d,1,4,10,30,'#3c4452'); R2(d,0,0,12,5,'#5e6878'); R2(d,0,30,12,4,'#5e6878')   # a gate pillar
    for y in (10,16,22): R2(d,5,y,2,3,'#6fd6e6')
    save(im,'village/pillar')
    im,d=V(26,28); R2(d,4,12,2,16,'#4a3324'); R2(d,20,12,2,16,'#4a3324'); R2(d,1,2,24,16,'#3e2c1e'); R2(d,2,3,22,14,'#6b4a2c')   # notice board
    for (x,y,w,h) in [(4,5,6,7),(12,4,6,5),(12,11,8,5),(5,13,5,3)]: R2(d,x,y,w,h,'#e6e1d3'); R2(d,x+1,y+1,w-2,1,'#8d8b98')
    R2(d,0,0,26,3,'#4a3324')
    save(im,'village/board')
    im,d=V(8,24); R2(d,3,6,2,18,'#3a3a44'); R2(d,1,0,6,7,'#2a2a30'); R2(d,2,2,4,4,'#f5c86a'); R2(d,2,22,4,2,'#3a3a44')   # a lamp
    save(im,'village/lamp')
    im,d=V(22,32); R2(d,10,6,2,26,'#6b4a2c'); R2(d,1,12,20,2,'#6b4a2c')                   # a scarecrow
    d.polygon([(5,13),(17,13),(15,26),(7,26)],fill=hx('#8a6a3a')); R2(d,9,15,4,4,'#6b4a2c')
    d.ellipse([6,3,15,12],fill=hx('#d9c08a')); R2(d,8,6,1,1,'#2a1d12'); R2(d,13,6,1,1,'#2a1d12'); R2(d,9,9,4,1,'#6b4a2c')
    d.polygon([(4,4),(11,0),(18,4)],fill=hx('#4a3324')); R2(d,2,4,18,2,'#4a3324')
    for x in (0,19): R2(d,x,11,3,6,'#d9a441')
    save(im,'enemies/dummy')                                                              # the training yard's scarecrow
    im,d=V(12,16); R2(d,5,6,2,10,'#6b4a2c'); R2(d,0,0,12,8,'#d9a441'); R2(d,1,1,10,6,'#e2b93b'); R2(d,3,3,6,1,'#5e4620'); R2(d,3,5,4,1,'#5e4620')   # "for sale"
    save(im,'village/sign')
def trunk():
    im,d=V(300,96)
    d.polygon([(30,95),(60,40),(70,0),(230,0),(240,40),(270,95)],fill=hx('#1e1824'))
    for x in range(78,226,14): d.line([x,0,x+(x-150)//10,95],fill=hx('#151019'),width=3)
    for x in range(85,226,28): d.line([x+4,0,x+4+(x-150)//12,90],fill=hx('#2c2434'),width=1)
    for (a,b) in [((30,95),(0,95)),((60,70),(10,92)),((240,70),(292,93)),((270,95),(299,95))]:   # roots spreading out
        d.line([a,b],fill=hx('#1e1824'),width=12)
    d.polygon([(130,95),(150,62),(170,95)],fill=hx('#0d0a12'))                            # a hollow at its foot
    save(im,'village/trunk')
def village_art():
    tree('tree_a','#1f3a1c','#2c4f25','#3d6630',(18,10,'#4d7a3a'))
    tree('tree_b','#22301a','#34482a','#4d6233',(27,10,'#6f8050'))
    building('inn',152,124,'#4a3a2c','#3a2c20','#5e2a24','#43201c','#7a3a30','#5e4620',inn_deco)
    building('guild',168,132,'#3d3d48','#2e2e38','#2b3350','#1e2440','#3c4a72','#4a3324',guild_deco)
    stall_back(); counter(); forge(); witch(); tent(); small(); trunk()
    swords=lambda d:[(R2(d,x,26,2,12,'#c3cad6'),R2(d,x-2,36,6,2,'#8d8674')) for x in (14,24,34,44,54,64)]
    goods('weapons',[swords,lambda d:[R2(d,x,47,10,6,'#8d93a0') for x in (14,32,50)]])
    goods('gear',[lambda d:[(R2(d,x,26,10,10,'#5a6070'),R2(d,x+2,28,6,6,'#8d93a0')) for x in (14,30,46,62)],lambda d:[R2(d,x,47,8,6,'#4a3524') for x in (14,26,38,50,62)]])
    goods('potions',[lambda d:[(R2(d,x,26,6,8,'#14141c'),R2(d,x+1,28,4,5,c)) for x,c in ((12,'#d9534f'),(22,'#5aa7e6'),(32,'#d9534f'),(42,'#9be08a'),(52,'#d9534f'),(62,'#cfc8ff'))],
                     lambda d:[(R2(d,x,46,6,8,'#14141c'),R2(d,x+1,48,4,5,'#d9534f')) for x in (14,26,38,50,62)]])
    goods('food',[lambda d:[d.ellipse([x,27,x+10,34],fill=hx('#b07a3a')) for x in (12,26,40)],lambda d:[(R2(d,x,44,7,10,'#7a5a3a'),R2(d,x+1,48,5,4,'#5aa7e6')) for x in (56,66)],
                  lambda d:[d.ellipse([x,46,x+8,53],fill=hx('#c9a46a')) for x in (12,22,32,42)]])

def main():
    layers={'skin':skin(),'eyes':eyes(),'base':base()}
    save(layers['skin'],'character/skin_tint'); save(layers['eyes'],'character/eyes_tint'); save(layers['base'],'character/base')
    for i,n in enumerate(['short','spiked','long','tail','bob','buzz']):
        im=hair(i); save(im,'character/hair_'+n+'_tint'); layers[n]=im
    for k in ('tunic','leather','coat','plate'):
        t,o=armor(k); save(t,'gear/armor_'+k+'_tint'); layers[k]=t
        if o: save(o,'gear/armor_'+k)
    for k in ('boots','greaves','striders'):
        t,o=boots(k); save(t,'gear/boots_'+k+'_tint'); layers[k]=t
        if o: save(o,'gear/boots_'+k)
    weapons(); shields(); enemies(); floor3(); props(layers); village_art()
    # a ready-made full-colour character sheet people can open in a pixel editor and repaint
    tpl=canvas(4*CW,3*CH)
    for name,t in (('skin','#e0b08a'),('base',None),('eyes','#1c1c24'),('boots','#4a3524'),('tunic','#2b3350'),('short','#1b1b22')):
        tpl.alpha_composite(colour(layers[name],t) if t else layers[name])
    tdir=os.path.join(HERE,'..','assets','templates'); os.makedirs(tdir,exist_ok=True); tpl.save(os.path.join(tdir,'character-template.png'))
    names=sorted(os.path.relpath(os.path.join(d,f),OUT)[:-4].replace(os.sep,'/') for d,_,fs in os.walk(OUT) for f in fs if f.endswith('.png'))
    print(len(names),'sprites written'); return names
if __name__=='__main__': main()
