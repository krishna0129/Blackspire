'use strict';
// The wiki (docs/wiki) is generated from the game's data. This fails when the data changed but the wiki was not
// regenerated: run `npm run wiki` and commit the result.
const test=require('node:test'),assert=require('node:assert'),{spawnSync}=require('node:child_process'),path=require('node:path');
test('docs/wiki matches the game data',()=>{
  const r=spawnSync(process.execPath,['--no-warnings',path.join(__dirname,'..','..','tools','wiki.js'),'--check'],{encoding:'utf8'});
  assert.strictEqual(r.status,0,r.stderr);
});
