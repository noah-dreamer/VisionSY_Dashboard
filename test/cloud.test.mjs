import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { handleAccount } from '../lib/cloud-account.js';
import { CloudClient } from '../public/cloud-client.js';
globalThis.crypto ||= webcrypto;
const secret='test-only-setup-authorization';
const password='test-only-cloud-password';
const token='vsy_0123456789ab.'+'d'.repeat(64);
const hex=value=>Buffer.from(value).toString('hex');
function fixture(){
 const values=new Map();const env={DASHBOARD_KV:{get:async(key,format)=>values.has(key)?format==='json'?JSON.parse(values.get(key)):values.get(key):null,put:async(key,value)=>values.set(key,value)},DASHBOARD_SESSION_SECRET:'test-session-secret-'.repeat(4)};
 return {values,env};
}
function device(env){
 let cookie='';
 const fetchLocal=async(path,options={})=>{
  const response=await handleAccount(new Request('https://panel.example'+path,{...options,headers:{...options.headers,Origin:'https://panel.example',Cookie:cookie,'CF-Connecting-IP':'192.0.2.1'}}),env);
  if(response.headers.has('Set-Cookie'))cookie=response.headers.get('Set-Cookie').split(';')[0];return response;
 };
 return {fetchLocal,client:new CloudClient({setup_required:true},{fetchLocal,fetchRemote:async()=>{throw new Error('Daemon proxy is forbidden');}})};
}
test('cloud accounts synchronize only encrypted connections between devices, support rotation and invalidate old sessions',async()=>{
 const {values,env}=fixture();env.DASHBOARD_SETUP_HASH=hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret)));
 const a=device(env),b=device(env);
 await assert.rejects(()=>a.client.unlock('admin',password,true,'wrong-code'),/授权码无效/);
 await a.client.unlock('admin',password,true,secret);
 const kv=JSON.stringify([...values]);assert.ok(!kv.includes(password));assert.ok(!kv.includes(secret));
 await a.client.api('/api/connections','POST',{name:'Cloud fixture',host:'127.0.0.1',protocol:'http',port:8000,token});
 assert.ok(!JSON.stringify([...values]).includes(token));assert.ok(!JSON.stringify([...values]).includes('127.0.0.1'));
 await b.client.unlock('admin',password,false);
 assert.equal(b.client.connections().data[0].name,'Cloud fixture');const id=b.client.connections().active_id;
 assert.equal(b.client.connection(id).token,token);
 await a.client.api('/api/connections','POST',{id,name:'Changed from A',host:'127.0.0.1',protocol:'http',port:8000,token:''});
 await assert.rejects(()=>b.client.api(`/api/connections/${id}/activate`,'POST',{}),/其他设备修改/);
 await b.client.unlock('admin',password,false);assert.equal(b.client.connections().data[0].name,'Changed from A');
 await a.client.api('/api/password','PUT',{current_password:password,password:password+'-new'});
 await assert.rejects(()=>b.client.api(`/api/connections/${id}/activate`,'POST',{}),/登录已过期/);
 await assert.rejects(()=>b.client.unlock('admin',password,false),/不正确/);
 await b.client.unlock('admin',password+'-new',false);assert.equal(b.client.connection(id).token,token);
 await b.client.api('/api/logout','POST',{});assert.equal(b.client.state,null);
 const session=await (await b.fetchLocal('/api/session')).json();assert.equal(session.authenticated,false);assert.equal(session.mode,'cloud');
});
test('cloud API rejects untrusted origins, missing session, invalid methods and missing bindings',async()=>{
 const {env}=fixture();const call=(path,method='GET',body,headers={})=>handleAccount(new Request('https://panel.example'+path,{method,headers:{Origin:'https://panel.example','Content-Type':'application/json',...headers},body:body?JSON.stringify(body):undefined}),env);
 assert.equal((await call('/api/vault','PUT',{vault:{}})).status,401);
 assert.equal((await call('/api/setup','POST',{}, {Origin:'https://evil.example'})).status,403);
 assert.equal((await call('/api/session','POST',{})).status,405);
 assert.equal((await call('/api/daemon/123/info')).status,404);
 assert.equal((await handleAccount(new Request('https://panel.example/api/session'),{})).status,503);
 assert.equal((await call('/api/setup','POST',{username:'admin',proof:'f'.repeat(64),setup_token:secret})).status,403);
 const session=await call('/api/session');assert.equal(session.headers.get('cache-control'),'no-store');assert.equal(session.headers.get('access-control-allow-origin'),null);
});
