'use strict';
// End-to-end tests for the online server: real WebSocket clients against a server on a free port with a throwaway
// in-memory database.  Run with: npm test
const test=require('node:test'),assert=require('node:assert');
const WebSocket=require('ws');
const {start}=require('../index');
const {validSheet}=require('../game');

const LOOK={skin:'#e0b08a',hair:'#1b1b22',style:0,eyes:'#1c1c24'};
function client(port){
  const ws=new WebSocket(`ws://localhost:${port}/ws`),msgs=[],waiters=[];
  ws.on('message',raw=>{const o=JSON.parse(raw);msgs.push(o);for(const w of waiters.splice(0))w();});
  const c={ws,msgs,
    send:o=>ws.send(JSON.stringify(o)),
    // resolves with the first message (from now on, or already received if since is given) that matches
    wait(pred,ms=3000,since=msgs.length){return new Promise((res,rej)=>{const to=setTimeout(()=>rej(new Error('timed out waiting')),ms);
      const look=()=>{for(let i=since;i<msgs.length;i++)if(pred(msgs[i])){clearTimeout(to);res(msgs[i]);return;}waiters.push(look);};look();});},
    last:t=>[...msgs].reverse().find(o=>o.t===t),
  };
  return new Promise(res=>ws.on('open',()=>res(c)));
}
async function player(port,name,weapon='sword'){
  const c=await client(port);
  c.send({t:'register',name,pw:'correct horse'});const a=await c.wait(o=>o.t==='auth');assert.ok(a.ok,a.error);c.token=a.token;
  c.send({t:'create',name,look:LOOK,weapon,outfit:'#23232b'});const cr=await c.wait(o=>o.t==='created');assert.ok(cr.ok,cr.error);
  c.send({t:'play'});c.floor=await c.wait(o=>o.t==='floor');await c.wait(o=>o.t==='s');
  return c;
}

test('online play',async t=>{
  const s=await start({port:0,dbFile:':memory:',quiet:true});
  t.after(()=>s.close());
  const A=await player(s.port,'Alpha'),B=await player(s.port,'Bravo','bow');

  await t.test('accounts: duplicate names, wrong passwords and sessions',async()=>{
    const c=await client(s.port);
    c.send({t:'register',name:'alpha',pw:'something long'});assert.match((await c.wait(o=>o.t==='auth')).error,/taken/);
    c.send({t:'login',name:'Alpha',pw:'wrong password'});assert.match((await c.wait(o=>o.t==='auth',3000,c.msgs.length)).error,/Wrong/);
    c.send({t:'register',name:'x',pw:'short'});assert.ok(!(await c.wait(o=>o.t==='auth',3000,c.msgs.length)).ok);
    c.ws.close();
    const d=await client(s.port);d.send({t:'resume',token:'nope'});assert.ok(!(await d.wait(o=>o.t==='auth')).ok);d.ws.close();
  });

  const member=name=>[...s.game.parties.values()].flatMap(p=>p.members).find(q=>q.S.char.name===name);

  await t.test('new characters arrive in the root village, each in their own party, sharing one channel',async()=>{
    assert.strictEqual(A.floor.n,0);assert.strictEqual(B.floor.n,0);
    assert.notStrictEqual(A.last('party').code,B.last('party').code);
    assert.strictEqual(A.floor.ch,B.floor.ch);
    const wa=await A.wait(o=>o.t==='world'&&o.people.some(q=>q.name==='Bravo'),3000,0);assert.strictEqual(wa.ch,A.floor.ch);
    const sa=await A.wait(o=>o.t==='s'&&o.pl.length===1);assert.strictEqual(sa.pl[0].id,B.floor.id);
  });

  await t.test('joining by code makes one party, still in the village',async()=>{
    const code=A.last('party').code,since=B.msgs.length;
    B.send({t:'join',code});
    const fl=await B.wait(o=>o.t==='floor',3000,since);assert.strictEqual(fl.n,0);
    const pa=await A.wait(o=>o.t==='party'&&o.members.length===2);
    assert.deepStrictEqual(pa.members.map(m=>m.name).sort(),['Alpha','Bravo']);
  });

  await t.test('the leader takes the party up through the Teleport Gate, but only from the gate',async()=>{
    const ma=member('Alpha'),since=A.msgs.length,sb=B.msgs.length;
    A.send({t:'travel',n:1});await new Promise(r=>setTimeout(r,150));
    assert.ok(!A.msgs.slice(since).some(o=>o.t==='floor'),'not from across the square');
    const G=ma.w.G;ma.pl.x=G.home.x;ma.pl.y=G.home.y;
    A.send({t:'travel',n:1});
    const fa=await A.wait(o=>o.t==='floor',3000,since),fb=await B.wait(o=>o.t==='floor',3000,sb);
    assert.strictEqual(fa.n,1);assert.strictEqual(fb.n,1);assert.strictEqual(fa.seed,fb.seed);
    const sa=await A.wait(o=>o.t==='s'&&o.pl.length===1);assert.strictEqual(sa.pl[0].id,fb.id);
    A.floor=fa;
  });

  await t.test('hunger and thirst come down in the snapshot, and eating is a key the server runs',async()=>{
    const s0=A.last('s').me;assert.strictEqual(typeof s0.food,'number');assert.strictEqual(typeof s0.drink,'number');
    await A.wait(o=>o.t==='s'&&o.me.drink<s0.drink,4000);
    // a full meter refuses food, so make Alpha hungry on the server first
    for(const p of s.game.parties.values())for(const m of p.members)if(m.pid===A.floor.id)m.pl.food=10;
    const r0=A.last('save').s.rations;A.send({t:'p',a:'eat'});
    await A.wait(o=>o.t==='save'&&o.s.rations===r0-1,4000);
    await A.wait(o=>o.t==='s'&&o.me.food>=49,4000);   // 10 + a ration's 40
  });

  await t.test('a reachable position is accepted, a teleport is refused',async()=>{
    const me=A.last('s').me;
    A.send({t:'in',mx:1,my:0,x:me.x+1.5,y:me.y,tp:me.tp});
    const ok=await A.wait(o=>o.t==='s'&&o.me.x>me.x+1);assert.strictEqual(ok.me.tp,me.tp);
    A.send({t:'in',mx:1,my:0,x:ok.me.x+400,y:ok.me.y,tp:ok.me.tp});
    const bad=await A.wait(o=>o.t==='s'&&o.me.tp>ok.me.tp);
    assert.ok(Math.abs(bad.me.x-ok.me.x)<5,'the server kept the player where they were');
  });

  await t.test('gear and attribute actions run on the server; the shop needs a trader nearby',async()=>{
    const g=s.game,m=[...g.parties.values()][0].members.find(q=>q.S.char.name==='Alpha');
    m.S.char.pts=2;
    A.send({t:'act',id:1,name:'spend',args:['str']});
    assert.strictEqual((await A.wait(o=>o.t==='ar'&&o.id===1)).r,true);
    assert.strictEqual(m.S.char.str,1);
    m.pl.x+=200;   // walk away from the start room's trader
    A.send({t:'act',id:2,name:'openShop',args:[0]});assert.strictEqual((await A.wait(o=>o.t==='ar'&&o.id===2)).r,false);
    A.send({t:'act',id:3,name:'nope',args:[]});assert.strictEqual((await A.wait(o=>o.t==='ar'&&o.id===3)).r,false);
  });

  await t.test('a kill rewards both players, and loot is only sent to its owner',async()=>{
    const g=s.game,p=[...g.parties.values()].find(q=>q.members.length===2),R=g.R;
    const [ma,mb]=p.members,xa=ma.S.char.xp,xb=mb.S.char.xp;
    const G=p.floorW.G;R.setWorld(G);R.setPlayer(ma.pl);const e=G.enemies.find(q=>!q.boss&&!q.elite);e.elite=true;R.killEnemy(e);
    assert.ok(ma.S.char.xp>xa&&mb.S.char.xp>xb,'both gained experience');
    const owners=new Set(G.drops.map(d=>d.owner));assert.deepStrictEqual([...owners].sort(),[ma.pid,mb.pid].sort());
    const sa=await A.wait(o=>o.t==='s'&&o.dr.length>0);
    assert.ok(sa.dr.every(d=>G.drops.find(q=>q.uid===d.uid).owner===ma.pid));
  });

  await t.test('only the leader picks the floor',async()=>{
    const since=B.msgs.length;B.send({t:'travel',n:0});
    assert.match((await B.wait(o=>o.t==='err',3000,since)).msg,/leader/);
  });

  await t.test('the floor gate takes the party home to the village',async()=>{
    const ma=member('Alpha'),G=ma.w.G,since=A.msgs.length;ma.pl.x=G.home.x;ma.pl.y=G.home.y;
    A.send({t:'travel',n:0});
    const fa=await A.wait(o=>o.t==='floor',3000,since);assert.strictEqual(fa.n,0);assert.ok(fa.ch>=1);
    assert.strictEqual(member('Bravo').w,ma.w,'the party shares a channel');
  });

  await t.test('online characters enhance at the village forge',async()=>{
    const ma=member('Alpha'),q=ma.w.G.smiths[0];ma.pl.x=q.x;ma.pl.y=q.y+16;
    ma.S.mats={scrap:99,ember:99,crystal:99};ma.S.shards=99999;
    A.send({t:'act',id:40,name:'enhance',args:['eq','weapon']});
    assert.strictEqual((await A.wait(o=>o.t==='ar'&&o.id===40)).r,'up');
    assert.strictEqual(ma.S.equip.weapon.plus,1);
  });

  await t.test('a full channel opens another',async()=>{
    const g=s.game,w=member('Alpha').w,pad=[];
    while(w.members.length+pad.length<30)pad.push({});
    w.members.push(...pad);const other=g.channelFor(1);w.members.splice(w.members.length-pad.length,pad.length);
    assert.notStrictEqual(other,w);assert.strictEqual(other.kind,'village');assert.notStrictEqual(other.ch,w.ch);
    g.worlds.delete(other);
  });

  await t.test('party notices at the guild: the leader posts, someone else joins from it',async()=>{
    let since=B.msgs.length;B.send({t:'notice',text:'not mine to post'});
    assert.match((await B.wait(o=>o.t==='err',3000,since)).msg,/leader/);
    since=A.msgs.length;A.send({t:'notice',text:'  Two for floor 3, <healer> wanted  '});
    const mine=await A.wait(o=>o.t==='notices'&&o.list.length===1,3000,since);
    assert.strictEqual(mine.list[0].text,'Two for floor 3, healer wanted','trimmed, and no markup');assert.ok(mine.list[0].own);
    const C=await player(s.port,'Charlie');C.send({t:'notices'});
    const seen=await C.wait(o=>o.t==='notices'&&o.list.length===1);
    assert.strictEqual(seen.list[0].name,'Alpha');assert.ok(!seen.list[0].own);assert.strictEqual(seen.list[0].size,2);
    since=C.msgs.length;C.send({t:'join',code:seen.list[0].code});
    const fl=await C.wait(o=>o.t==='floor',3000,since);assert.strictEqual(fl.n,0);
    await A.wait(o=>o.t==='party'&&o.members.length===3);
    since=A.msgs.length;A.send({t:'unnotice'});
    assert.strictEqual((await A.wait(o=>o.t==='notices',3000,since)).list.length,0);
    C.ws.close();await new Promise(r=>setTimeout(r,100));
  });

  await t.test('characters are saved and come back on the next login',async()=>{
    const g=s.game,m=[...g.parties.values()].flatMap(p=>p.members).find(q=>q.S.char.name==='Alpha');
    m.S.shards=1234;A.ws.close();await new Promise(r=>setTimeout(r,150));
    const c=await client(s.port);c.send({t:'login',name:'Alpha',pw:'correct horse'});
    const a=await c.wait(o=>o.t==='auth');assert.ok(a.ok);assert.strictEqual(a.char.name,'Alpha');
    c.send({t:'play'});const sv=await c.wait(o=>o.t==='save');assert.strictEqual(sv.s.shards,1234);assert.strictEqual(sv.s.char.str,1);
    c.ws.close();B.ws.close();
  });
});

test('character sheet uploads must be 88 x 78 PNGs, or a whole multiple up to x4 for finer art',()=>{
  const png=(w,h)=>{const b=Buffer.alloc(33);b.writeUInt32BE(0x89504e47,0);b.write('IHDR',12,'ascii');b.writeUInt32BE(w,16);b.writeUInt32BE(h,20);return'data:image/png;base64,'+b.toString('base64');};
  assert.ok(validSheet(png(88,78)));assert.ok(!validSheet(png(64,64)));
  assert.ok(validSheet(png(176,156)));assert.ok(validSheet(png(352,312)));   // ratio 2 and 4
  assert.ok(!validSheet(png(440,390)));assert.ok(!validSheet(png(176,78)));assert.ok(!validSheet(png(132,117)));   // x5, stretched, x1.5assert.ok(!validSheet('data:text/html;base64,AAAA'));assert.ok(validSheet(null));
});
