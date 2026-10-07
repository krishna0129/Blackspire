'use strict';
// Blackspire: the browser side. The local save store and the client's own state.

const $ = s => document.querySelector(s);
/* ---------- save store ----------
   Local save now; set SYNC_URL (same-origin endpoint on your own server)
   and every autosave is also POSTed there as JSON. */
const Store={
  KEY:'blackspire.save.v1',
  SYNC_URL:null,
  lastSync:0,
  load(){try{const r=localStorage.getItem(this.KEY);return r?migrateSave(JSON.parse(r)):null;}catch(e){return null;}},
  save(s){
    s.t=Date.now();let ok=true;
    try{localStorage.setItem(this.KEY,JSON.stringify(s));}catch(e){ok=false;}
    if(this.SYNC_URL&&Date.now()-this.lastSync>15000){this.lastSync=Date.now();
      try{fetch(this.SYNC_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(s),keepalive:true}).catch(()=>{});}catch(e){}}
    return ok;
  },
  clear(){try{localStorage.removeItem(this.KEY);}catch(e){}}
};

/* ---------- the client's own state ---------- */
let mode='title'; // title | online | creator | play | panel | ask | debug | pause | travel | dead
let AV=null, WSPR=null; // the character's outlined sprite sheet, and the equipped weapon's sprite
let muted=false, saveOk=true;
const NET={on:false};   // online mode replaces this (net.js)
