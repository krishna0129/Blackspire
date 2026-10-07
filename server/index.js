'use strict';
// Blackspire server. Serves the game's files over HTTP and runs online play over a WebSocket at /ws.
//
//   npm install
//   npm start                     then open http://localhost:8080/
//
// Settings, all optional: PORT (default 8080), DB (default server/data/blackspire.db).

const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {WebSocketServer}=require('ws');
const {open}=require('./db');
const {Game}=require('./game');

const ROOT=path.join(__dirname,'..');
const PORT=+process.env.PORT||8080;
const DB=process.env.DB||path.join(__dirname,'data','blackspire.db');

/* ---------- the game's files ---------- */
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.json':'application/json'};
const PUBLIC=['index.html','css/','js/','assets/'];   // nothing else in the folder is served (no server code, no database)
function serveFile(req,res){
  let rel;try{rel=decodeURIComponent(new URL(req.url,'http://x').pathname).replace(/^\/+/,'')||'index.html';}catch(e){res.writeHead(400).end();return;}
  const file=path.normalize(path.join(ROOT,rel));
  if(!file.startsWith(ROOT+path.sep)||!PUBLIC.some(p=>rel===p||rel.startsWith(p))||rel.includes('..')){res.writeHead(404).end('Not found');return;}
  fs.readFile(file,(err,data)=>{
    if(err){res.writeHead(404).end('Not found');return;}
    res.writeHead(200,{'Content-Type':TYPES[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
    res.end(data);
  });
}

function start({port=PORT,dbFile=DB,quiet=false}={}){
  const db=open(dbFile),game=new Game(db);
  const server=http.createServer(serveFile);
  const wss=new WebSocketServer({server,path:'/ws',maxPayload:128*1024});
  const online=new Map();        // account id -> member, so one account plays from one place at a time
  const failures=new Map();      // ip -> recent failed logins

  wss.on('connection',(ws,req)=>{
    const ip=req.socket.remoteAddress;
    const m={ws,account:null,S:null,party:null,pl:null,out:[],msgs:0,msgT:Date.now()};
    const send=o=>{if(ws.readyState===1)ws.send(JSON.stringify(o));};
    const authed=r=>{
      if(r.error)return send({t:'auth',ok:false,error:r.error});
      // the older connection is saved and closed first, so this one loads the character as it was left
      const old=online.get(r.account);if(old){game.removeMember(old);if(old.ws.readyState===1)old.ws.send(JSON.stringify({t:'kicked',msg:'You logged in somewhere else.'}));old.ws.close();}
      m.account=r.account;m.name=r.name;online.set(r.account,m);
      const s=db.loadChar(r.account);m.S=s?game.R.migrateSave(s):null;
      send({t:'auth',ok:true,token:r.token,name:r.name,char:game.charSummary(m)});
    };
    ws.on('message',raw=>{
      // more than 120 messages a second is not a person playing
      const now=Date.now();if(now-m.msgT>1000){m.msgT=now;m.msgs=0;}if(++m.msgs>120){ws.close(1008,'Too many messages');return;}
      let o;try{o=JSON.parse(raw);}catch(e){return;}if(!o||typeof o.t!=='string')return;
      try{
        if(!m.account){
          if(o.t==='resume')return authed(db.resume(o.token));
          if(o.t!=='login'&&o.t!=='register')return;
          const f=(failures.get(ip)||[]).filter(t=>now-t<60000);
          if(f.length>=10)return send({t:'auth',ok:false,error:'Too many attempts. Wait a minute and try again.'});
          const r=o.t==='login'?db.login(o.name,o.pw):db.register(o.name,o.pw);
          if(r.error){f.push(now);failures.set(ip,f);}
          return authed(r);
        }
        if(o.t==='logout'){if(typeof o.token==='string')db.logout(o.token);ws.close();return;}
        if(o.t==='create'){
          if(m.S)return send({t:'created',ok:false,error:'This account already has a character.'});
          const err=game.createChar(m,o);return send({t:'created',ok:!err,error:err,char:game.charSummary(m)});
        }
        game.handle(m,o);
      }catch(err){console.error('message failed:',err);}
    });
    ws.on('close',()=>{game.removeMember(m);if(m.account&&online.get(m.account)===m)online.delete(m.account);});
  });

  return new Promise(res=>server.listen(port,()=>{
    if(!quiet)console.log(`Blackspire is running at http://localhost:${server.address().port}/`);
    res({server,game,db,port:server.address().port,close(){game.stop();wss.close();server.close();db.close();}});
  }));
}
if(require.main===module){
  start().then(s=>{const stop=()=>{s.close();process.exit(0);};process.on('SIGINT',stop);process.on('SIGTERM',stop);});
}
module.exports={start};
