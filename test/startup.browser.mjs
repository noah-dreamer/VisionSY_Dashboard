/** Slow/failing login-state requests must not leave a blank page. */
import assert from 'node:assert/strict';
import { createDashboard } from '../server.mjs';
const { chromium }=await import(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const {server}=createDashboard();server.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const base=`http://127.0.0.1:${server.address().port}`;
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});let release;const gate=new Promise(r=>release=r);let count=0;
 await page.route('**/api/session',async route=>{count++;await gate;await route.fulfill({json:{mode:'cloud',setup_required:false,authenticated:false}});});
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.locator('#startup-shell').waitFor();assert.ok(await page.locator('.auth-art .brand').isVisible());assert.ok(await page.locator('#startup-button').isDisabled());
 release();await page.locator('#auth-form').waitFor();assert.equal(count,1,'Initial rendering should require only one session lookup');
 console.log('PASS: full login layout is visible while session lookup waits; only one startup request');
 const retry=await browser.newPage();let attempts=0;
 await retry.route('**/api/session',route=>{attempts++;return attempts===1?route.fulfill({status:503,json:{message:'Temporary failure'}}):route.fulfill({json:{mode:'cloud',setup_required:false,authenticated:false}});});
 await retry.goto(base);await retry.getByRole('button',{name:'重新连接',exact:true}).waitFor();assert.ok(await retry.locator('.auth-art .brand').isVisible());
 await retry.getByRole('button',{name:'重新连接',exact:true}).click();await retry.locator('#auth-form').waitFor();assert.equal(attempts,2);
 console.log('PASS: failed startup keeps the login layout and offers a working retry');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
