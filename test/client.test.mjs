import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { BrowserClient, validateConnection, vaultStorageKey } from '../public/client.js';
globalThis.crypto ||= webcrypto;
const password='browser-only-test-password';
const token='vsy_0123456789ab.'+'c'.repeat(64);
const connection={name:'Test daemon',host:'127.0.0.1',port:8000,protocol:'http',token};
function fixture(fetchRemote=()=>{throw new Error('Unexpected network request');}) {
  const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
  return {storage,client:new BrowserClient({storage,fetchRemote})};
}
test('browser vault encrypts connections, locks, rejects wrong password, preserves tokens on blank edit and rotates password',async()=>{
  const {client,storage}=fixture();
  await client.api('/api/setup','POST',{username:'admin',password});
  await client.api('/api/connections','POST',connection);
  const id=client.connections().active_id;
  const exposed=client.connections();assert.equal(exposed.data[0].token,undefined);
  assert.ok(!storage.getItem(vaultStorageKey).includes(token));assert.ok(!storage.getItem(vaultStorageKey).includes(password));assert.ok(!storage.getItem(vaultStorageKey).includes(connection.host));
  await client.api('/api/connections','POST',{...connection,id,token:'',name:'Updated'});
  assert.equal(client.connection(id).token,token);
  client.lock();await assert.rejects(()=>client.remote(id,'info'),/解锁/);
  await assert.rejects(()=>client.unlock('admin','incorrect-password'),/不正确/);
  await client.unlock('admin',password);
  assert.equal(client.connection(id).name,'Updated');
  await client.api('/api/password','PUT',{current_password:password,password:password+'-new'});
  client.lock();await assert.rejects(()=>client.unlock('admin',password),/不正确/);
  await client.unlock('admin',password+'-new');assert.equal(client.connection(id).token,token);
  await client.api(`/api/connections/${id}`,'DELETE');assert.equal(client.connections().active_id,null);
});
test('all operations go directly to selected daemon with Bearer auth, no cookies or redirects',async()=>{
  let calls=0;
  const {client}=fixture(async(url,options)=>{
    calls++;assert.equal(url,'http://127.0.0.1:8000/api/management/v1/info');
    assert.equal(options.headers.Authorization,'Bearer '+token);assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');
    return new Response(JSON.stringify({product:'visionsy-daemon',api_version:1}));
  });
  await client.unlock('admin',password,true);assert.equal(calls,0);
  await client.api('/api/connections','POST',connection);assert.equal(calls,0);
  assert.equal((await client.remote(client.connections().active_id,'info')).product,'visionsy-daemon');assert.equal(calls,1);
  await assert.rejects(()=>client.remote(client.connections().active_id,'keys'),/不存在/);assert.equal(calls,1);
  client.pageProtocol='https:';await assert.rejects(()=>client.remote(client.connections().active_id,'info'),/HTTPS/);
});
test('another tab changing the vault invalidates the unlocked state',async()=>{
  const {client,storage}=fixture();await client.unlock('admin',password,true);
  storage.setItem(vaultStorageKey,'changed');await assert.rejects(()=>client.api('/api/connections'),/其他标签页/);assert.equal(client.session().authenticated,false);
});
test('browser connection validation accepts local loopback and rejects malformed targets',()=>{
  assert.equal(validateConnection(connection).baseUrl,'http://127.0.0.1:8000');
  assert.equal(validateConnection({...connection,host:'::1'}).baseUrl,'http://[::1]:8000');
  for(const change of [{host:'evil/path'},{host:'user@host'},{port:0},{protocol:'file'},{token:'bad'},{host:'0.0.0.0'}]) assert.throws(()=>validateConnection({...connection,...change}));
});
