/** Browser test with isolated in-memory KV; never initializes the production account. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { webcrypto } from 'node:crypto';
import { createDashboard } from '../server.mjs';
import { handleAccount } from '../lib/cloud-account.js';
globalThis.crypto ||= webcrypto;
const { chromium }=await import(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const values=new Map(),bodies=[],errors=[];
const setup='local-browser-test-setup-code',password='local-browser-test-password';
const token='vsy_0123456789ab.'+'a'.repeat(64);
const env={DASHBOARD_KV:{get:async(k,type)=>values.has(k)?type==='json'?JSON.parse(values.get(k)):values.get(k):null,put:async(k,v)=>values.set(k,v)},DASHBOARD_SESSION_SECRET:'local-browser-test-signing-key-'.repeat(3),DASHBOARD_SETUP_HASH:Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(setup))).toString('hex')};
const handler=createDashboard().server.listeners('request')[0];
const server=createServer(async(req,res)=>{
 if(!req.url.startsWith('/api/'))return handler(req,res);
 const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks);bodies.push(body.toString());
 const response=await handleAccount(new Request(`http://${req.headers.host}${req.url}`,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:body}),env);
 res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
});
server.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const base=`http://localhost:${server.address().port}`;
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
async function signIn(page,first){
 page.on('pageerror',error=>errors.push(error.message));await page.goto(base+'/#connections');await page.locator('#auth-form').waitFor();
 await page.locator('input[name=username]').fill('cloud-admin');await page.locator('input[name=password]').fill(password);
 if(first){await page.locator('input[name=setup_token]').fill(setup);await page.locator('input[name=confirm]').fill(password);}
 await page.locator('#auth-form button[type=submit]').click();await page.locator('.layout').waitFor();
 await page.getByRole('heading',{name:'daemon 连接',exact:true}).waitFor();
}
try{
 const first=await browser.newContext(),second=await browser.newContext();const a=await first.newPage(),b=await second.newPage();
 await signIn(a,true);await a.getByRole('button',{name:'添加 daemon',exact:true}).click();
 for(const [field,value]of Object.entries({name:'跨设备同步测试',host:'192.0.2.10',port:'8000',token}))await a.locator(`#edit-form input[name=${field}]`).fill(value);
 await a.locator('#edit-form button[type=submit]').click();await a.locator('#dialog').waitFor({state:'hidden'});
 await signIn(b,false);assert.equal(await b.locator('.connection-card h2').textContent(),'跨设备同步测试');
 assert.ok(!bodies.some(body=>body.includes(token)),'Cleartext daemon token reached Pages');
 const local=await b.evaluate(()=>JSON.stringify({...localStorage}));assert.ok(!local.includes(token));assert.ok(!local.includes('visionsy.browserVault.v1'),'Cloud vault should not persist in browser storage');
 await b.reload();await b.locator('#auth-form').waitFor();assert.equal(await b.locator('input[name=setup_token]').count(),0);
 await a.getByRole('button',{name:'退出登录',exact:true}).click();await a.locator('#auth-form').waitFor();
 assert.deepEqual(errors,[]);
 console.log('PASS: cloud setup form, real browser cookies/CSRF, second-device login and encrypted connection sync, refresh/logout lock');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
