import test from 'node:test';
import assert from 'node:assert/strict';
import { createDashboard } from '../server.mjs';

test('dashboard serves static files with direct-connect CSP and has no API backend', async t => {
  const { server } = createDashboard(); server.listen(0,'127.0.0.1'); await new Promise(r=>server.once('listening',r));
  t.after(()=>{server.closeAllConnections();server.close();});
  const base=`http://127.0.0.1:${server.address().port}`;
  for (const path of ['/','/app.js','/client.js','/cloud-client.js','/crypto.js','/style.css','/logo.png']) assert.equal((await fetch(base+path)).status,200,path);
  const page = await fetch(base+'/'); assert.match(page.headers.get('content-security-policy'),/connect-src 'self' http: https:/);
  for(const path of ['/api/session','/api/setup','/api/login','/api/connections','/api/daemon/any/info','/../server.mjs']) {
    const response=await fetch(base+path);assert.equal(response.status,404,path);assert.equal(response.headers.get('set-cookie'),null);
  }
  assert.equal((await fetch(base+'/',{method:'POST',body:'secret'})).status,404);
});
