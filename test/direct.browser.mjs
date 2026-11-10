/** Integration test against the isolated local daemon. Never prints credentials. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createDashboard } from '../server.mjs';
import { credentials, unlock } from './browser-fixture.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const browser = await chromium.launch({executablePath:process.env.CHROME_BIN || '/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const requests=[],errors=[];
let backupId,userId;
const page = await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true});
const dashboardOrigin=new URL(credentials.dashboard_url).origin,daemonOrigin=new URL(credentials.daemon_url).origin;
page.on('request',request=>requests.push({url:request.url(),method:request.method(),origin:new URL(request.url()).origin}));
page.on('pageerror',error=>errors.push(error.message));
const run = async (path, method='GET', data) => page.evaluate(async({credentials,path,method,data})=>{
  const { BrowserClient }=await import('/client.js');
  const client=new BrowserClient();await client.unlock(credentials.dashboard_username,credentials.dashboard_password);
  return client.remote(client.connections().active_id,path,method,data);
},{credentials,path,method,data});
try {
  await page.goto(credentials.dashboard_url+'/#connections');await unlock(page);
  await page.locator('a.nav-link[href="#overview"]').click();
  await page.getByRole('heading',{name:'工作空间总览',exact:true}).waitFor();
  assert.ok(requests.some(r=>r.origin===daemonOrigin&&r.url.endsWith('/info')));
  assert.equal(requests.filter(r=>r.origin===dashboardOrigin&&(new URL(r.url).pathname.startsWith('/api/')||r.method!=='GET')).length,0,'Dashboard must receive only static GET requests');
  assert.equal(await page.evaluate(()=>document.cookie.includes('visionsy_dashboard=')),false);
  console.log('PASS: unchanged UI loads with browser-to-daemon requests, no Dashboard API requests or session cookies');
  // Wrong key must be rejected by daemon and readable as a CORS JSON error.
  const wrong=await page.evaluate(async({credentials})=>{
    const response=await fetch(credentials.daemon_url+'/api/management/v1/info',{credentials:'omit',headers:{Authorization:'Bearer vsy_000000000000.'+'0'.repeat(64)}});
    return {status:response.status,json:await response.json()};
  },{credentials});
  assert.equal(wrong.status,401);assert.ok(wrong.json.message);
  console.log('PASS: browser preflight and authenticated requests work; wrong daemon key returns a readable 401');
  const suffix=Date.now();
  const user=await run('users','POST',{display_name:'直连测试'+suffix,email:`direct-${suffix}@example.test`,role:'normal_user',status:'active',password:'temporary-direct-test-only'});
  userId=user.data.id;
  await run(`users/${userId}`,'PUT',{display_name:'已修改'+suffix,email:`direct-${suffix}@example.test`,role:'normal_user',status:'active'});
  assert.equal((await run('users?q='+encodeURIComponent(`direct-${suffix}`))).data[0].display_name,'已修改'+suffix);
  await run(`users/${userId}`,'DELETE',{});userId=null;
  console.log('PASS: browser directly creates, updates, lists and deletes a synthetic user');
  const backup=await run('backups','POST',{});backupId=backup.data.id;
  let complete=false;
  for(let i=0;i<45;i++) {
    const record=(await run('backups')).data.find(b=>b.id===backupId);
    assert.notEqual(record?.status,'failed','Backup failed');
    if(record?.status==='completed'){complete=true;break;}
    await page.waitForTimeout(1000);
  }
  assert.ok(complete,'Backup did not complete');
  await page.locator('a.nav-link[href="#backups"]').click();
  const downloadButton=page.locator(`[data-action="download-backup"][data-id="${backupId}"]`);await downloadButton.waitFor();
  const downloadPromise=page.waitForEvent('download');await downloadButton.click();const download=await downloadPromise;
  assert.equal(await download.failure(),null);const sql=gunzipSync(readFileSync(await download.path())).toString('utf8');
  assert.match(sql,/CREATE TABLE/);assert.match(download.suggestedFilename(),/\.sql\.gz$/);
  await run(`backups/${backupId}`,'DELETE',{});backupId=null;
  console.log('PASS: async MariaDB backup, authenticated browser download and valid gzip SQL; temporary backup deleted');
  await page.route(daemonOrigin+'/**',route=>route.abort());
  await page.locator('a.nav-link[href="#users"]').click();
  await page.getByRole('heading',{name:'连接或请求未完成',exact:true}).waitFor();
  await page.locator('a.nav-link[href="#connections"]').click();await page.getByRole('heading',{name:'daemon 连接',exact:true}).waitFor();
  await page.unroute(daemonOrigin+'/**');
  console.log('PASS: browser can still open and manage saved connections while daemon requests are unavailable');
  await page.reload();await page.locator('#auth-form').waitFor();
  assert.equal(await page.locator('input[name=confirm]').count(),0,'Refresh must lock existing vault, not reset it');
  await unlock(page);assert.equal(await page.locator('#node-select option').count(),2);
  await page.getByRole('button',{name:'退出登录',exact:true}).click();await page.locator('#auth-form').waitFor();
  assert.equal(await page.locator('input[name=confirm]').count(),0);
  await unlock(page);
  const secrets=await page.evaluate(()=>JSON.stringify({...localStorage}));
  assert.ok(!secrets.includes(credentials.api_key));assert.ok(!secrets.includes(credentials.dashboard_password));
  console.log('PASS: refresh and logout lock the local vault, saved connection persists encrypted and unlocks correctly');
  // A different, unlisted static panel origin cannot read management API data.
  const {server}=createDashboard();server.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  try {
    const other=await browser.newPage();await other.goto(`http://127.0.0.1:${server.address().port}`);
    const result=await other.evaluate(async({url,token})=>{try{await fetch(url+'/api/management/v1/info',{headers:{Authorization:'Bearer '+token},credentials:'omit'});return 'allowed';}catch{return 'blocked';}},{url:credentials.daemon_url,token:credentials.api_key});
    assert.equal(result,'blocked');await other.close();
  }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
  console.log('PASS: unlisted Dashboard origin is blocked by daemon CORS');
  assert.equal(requests.filter(r=>r.origin===dashboardOrigin&&new URL(r.url).pathname.startsWith('/api/')).length,0);
  assert.deepEqual(errors,[]);
} finally {
  if(userId)await run(`users/${userId}`,'DELETE',{}).catch(()=>{});
  if(backupId)await run(`backups/${backupId}`,'DELETE',{}).catch(()=>{});
  await browser.close();
}
