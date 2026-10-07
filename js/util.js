'use strict';
// Blackspire: Small helpers used everywhere.

/* ---------- util ---------- */
const $ = s => document.querySelector(s);
const TAU = Math.PI * 2;
// The four facings, in the order used everywhere: 0 down, 1 up, 2 left, 3 right.
const DIR_ANGLE=[Math.PI/2,-Math.PI/2,Math.PI,0];
function dirOf(angle){const c=Math.cos(angle),s=Math.sin(angle);return Math.abs(c)>=Math.abs(s)?(c>0?3:2):(s>0?0:1);}
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
// Fisher-Yates: every order equally likely. Shuffles in place and returns the array.
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
const hyp = Math.hypot;
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function hash2(x,y,s){let h=(Math.imul(x,374761393)+Math.imul(y,668265263)+Math.imul(s,1442695041))|0;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296;}
function rgb(hex){const n=parseInt(hex.slice(1),16);return[n>>16,n>>8&255,n&255];}
function hex(r,g,b){return'#'+((1<<24)|(r<<16)|(g<<8)|b).toString(16).slice(1);}
function mix(a,b,t){const A=rgb(a),B=rgb(b);return hex(Math.round(A[0]+(B[0]-A[0])*t),Math.round(A[1]+(B[1]-A[1])*t),Math.round(A[2]+(B[2]-A[2])*t));}
const shade=(c,amt)=>mix(c,amt<0?'#000000':'#ffffff',Math.abs(amt));
function angDiff(a,b){let d=(a-b)%TAU;if(d>Math.PI)d-=TAU;if(d<-Math.PI)d+=TAU;return d;}
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
