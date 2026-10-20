'use strict';
// Blackspire server: accounts, login sessions, characters, the tower's seed and the market's stock, in one SQLite file
// (server/data/blackspire.db).
// Passwords are stored only as salted scrypt hashes.

const {DatabaseSync}=require('node:sqlite');
const crypto=require('node:crypto');
const fs=require('node:fs'),path=require('node:path');

const SESSION_DAYS=30;

function open(file){
  if(file!==':memory:')fs.mkdirSync(path.dirname(file),{recursive:true});
  const db=new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS accounts(id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      salt BLOB NOT NULL, hash BLOB NOT NULL, created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, account INTEGER NOT NULL REFERENCES accounts(id), created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS characters(account INTEGER PRIMARY KEY REFERENCES accounts(id), save TEXT NOT NULL, updated INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);
  const q={
    addAccount:db.prepare('INSERT INTO accounts(name,salt,hash,created) VALUES(?,?,?,?)'),
    accountByName:db.prepare('SELECT * FROM accounts WHERE name=?'),
    accountById:db.prepare('SELECT id,name FROM accounts WHERE id=?'),
    addSession:db.prepare('INSERT INTO sessions(token,account,created) VALUES(?,?,?)'),
    session:db.prepare('SELECT account,created FROM sessions WHERE token=?'),
    dropSession:db.prepare('DELETE FROM sessions WHERE token=?'),
    getChar:db.prepare('SELECT save FROM characters WHERE account=?'),
    putChar:db.prepare('INSERT INTO characters(account,save,updated) VALUES(?,?,?) ON CONFLICT(account) DO UPDATE SET save=excluded.save, updated=excluded.updated'),
    getMeta:db.prepare('SELECT value FROM meta WHERE key=?'),
    putMeta:db.prepare('INSERT INTO meta(key,value) VALUES(?,?)'),
    setMeta:db.prepare('INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value'),
  };
  const hashPw=(pw,salt)=>crypto.scryptSync(pw,salt,64,{N:16384,r:8,p:1});
  const newSession=account=>{const token=crypto.randomBytes(32).toString('hex');q.addSession.run(token,account,Date.now());return token;};
  return{
    // Returns {account, name, token} or {error}.
    register(name,pw){
      if(typeof name!=='string'||!/^[A-Za-z0-9_\- ]{3,16}$/.test(name)||name.trim()!==name)return{error:'Names are 3 to 16 letters, digits, spaces, - or _.'};
      if(typeof pw!=='string'||pw.length<8||pw.length>200)return{error:'Passwords need at least 8 characters.'};
      if(q.accountByName.get(name))return{error:'That name is taken.'};
      const salt=crypto.randomBytes(16),id=Number(q.addAccount.run(name,salt,hashPw(pw,salt),Date.now()).lastInsertRowid);
      return{account:id,name,token:newSession(id)};
    },
    login(name,pw){
      const a=typeof name==='string'&&typeof pw==='string'?q.accountByName.get(name):null;
      // the hash is computed even for unknown names, so a reply's timing does not tell whether a name exists
      const h=hashPw(typeof pw==='string'?pw:'',a?a.salt:Buffer.alloc(16));
      if(!a||!crypto.timingSafeEqual(h,Buffer.from(a.hash)))return{error:'Wrong name or password.'};
      return{account:a.id,name:a.name,token:newSession(a.id)};
    },
    resume(token){
      const s=typeof token==='string'&&q.session.get(token);
      if(!s||Date.now()-s.created>SESSION_DAYS*864e5){if(s)q.dropSession.run(token);return{error:'Please log in again.'};}
      const a=q.accountById.get(s.account);return a?{account:a.id,name:a.name,token}:{error:'Please log in again.'};
    },
    logout(token){q.dropSession.run(token);},
    loadChar(account){const r=q.getChar.get(account);return r?JSON.parse(r.save):null;},
    saveChar(account,save){q.putChar.run(account,JSON.stringify(save),Date.now());},
    // The seed every floor of this server's tower is built from. Picked once, the first time the database is used,
    // and kept with it, so floor n is the same place for every party and after every restart.
    worldSeed(){
      const r=q.getMeta.get('worldSeed');if(r)return Number(r.value);
      const seed=crypto.randomInt(2**31);q.putMeta.run('worldSeed',String(seed));return seed;
    },
    // The market's book for a region: what its exchange holds of each good (js/sim/market.js). One for everybody.
    loadMarket(region){const r=q.getMeta.get('market:'+region);try{const b=r&&JSON.parse(r.value);return b&&typeof b==='object'&&b.stock&&typeof b.stock==='object'?b:null;}catch(e){return null;}},
    saveMarket(region,book){q.setMeta.run('market:'+region,JSON.stringify(book));},
    close(){db.close();},
  };
}
module.exports={open};
