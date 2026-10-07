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
def props(layers):
    # the blacksmith is the side-view body, bald, bearded and aproned, in fixed colours
    sm=canvas(CW,CH)
    for im,t in ((layers['skin'],'#c68d62'),(layers['base'],None),(layers['eyes'],'#1c1c24'),(layers['boots'],'#2a211b'),(layers['leather'],'#4a3524'),(layers['buzz'],'#3a3a44')):
        c=cell(im,0,SIDE); c=colour(c,t) if t else c; sm.alpha_composite(c)
    for r in [(3,6,6,2,'#9a9484'),(4,8,4,1,'#9a9484'),(5,6,2,1,'#c68d62'),(2,9,6,5,'#2b2b33'),(2,9,6,1,'#3d3d48'),(3,8,1,1,'#2b2b33'),(6,8,1,1,'#2b2b33')]:
        rect(sm,*r[:4],hx(r[4]),OX,OY)
    save(sm,'npc/smith')
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
    t=canvas(24,24)                                                    # trinket icon (tinted) and potion icon
    for r in [(9,7,6,1,B),(8,8,1,1,B),(15,8,1,1,B),(7,9,1,6,B),(16,9,1,6,B),(8,15,1,1,DK),(15,15,1,1,DK),(9,16,6,1,DK)]: rect(t,*r,0,0)
    save(t,'icons/trinket_tint')
    p=canvas(24,24)
    for r in [(8,3,8,3,'#050508'),(6,6,12,13,'#050508'),(10,4,4,2,'#e6e1d3'),(7,9,10,9,'#d9534f'),(8,10,2,3,'#f1b0a8')]: rect(p,*r[:4],hx(r[4]),0,0)
    save(p,'icons/potion')

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
    weapons(); shields(); enemies(); props(layers)
    # a ready-made full-colour character sheet people can open in a pixel editor and repaint
    tpl=canvas(4*CW,3*CH)
    for name,t in (('skin','#e0b08a'),('base',None),('eyes','#1c1c24'),('boots','#4a3524'),('tunic','#2b3350'),('short','#1b1b22')):
        tpl.alpha_composite(colour(layers[name],t) if t else layers[name])
    tdir=os.path.join(HERE,'..','assets','templates'); os.makedirs(tdir,exist_ok=True); tpl.save(os.path.join(tdir,'character-template.png'))
    names=sorted(os.path.relpath(os.path.join(d,f),OUT)[:-4].replace(os.sep,'/') for d,_,fs in os.walk(OUT) for f in fs if f.endswith('.png'))
    print(len(names),'sprites written'); return names
if __name__=='__main__': main()
