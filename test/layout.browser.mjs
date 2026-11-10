/** Read-only layout regression checks against the local split-test dashboard.
 * PLAYWRIGHT_MODULE can point to an external playwright-core installation.
 * Credentials are read from the ignored local test file and never logged.
 */
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const root = fileURLToPath(new URL('../../', import.meta.url));
const { credentials, unlock } = await import('./browser-fixture.mjs');
const output = process.env.VISIONSY_LAYOUT_SCREENSHOTS || join(tmpdir(), 'visionsy-sidebar-qa');
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const errors = [];
const pages = [['overview','工作空间总览'],['users','用户管理'],['groups','用户组与权限'],['sources','媒体目录'],['galleries','图库管理'],['resources','媒体素材'],['tasks','后台任务'],['audit','审计日志'],['backups','数据库备份'],['mail','邮件服务'],['connections','daemon 连接'],['settings','控制台设置']];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 720 }, locale: 'zh-CN' });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(credentials.dashboard_url+'/#users');
  await unlock(page);
  await page.locator('a.nav-link[href="#users"]').click();
  await page.getByRole('heading', { name: '用户管理', exact: true }).waitFor();
  assert.equal(await page.locator('a.nav-link[href="#keys"]').count(),0,'Key-management menu must be removed');
  await page.goto(credentials.dashboard_url+'/#keys');
  await page.getByRole('heading',{name:'daemon 连接',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'创建新密钥',exact:true}).count(),0);
  console.log('PASS: removed key-management menu and old URL redirects to connections');
  for (const [width,height] of [[1440,900],[1440,720],[1280,600],[1024,450],[844,390],[1024,300]]) {
    await page.setViewportSize({width,height});
    for (const [name,title] of pages) {
      await page.locator(`a.nav-link[href="#${name}"]`).click();
      await page.getByRole('heading',{name:title,exact:true}).waitFor();
      const geometry = await page.evaluate(() => {
        const sidebar=document.querySelector('.sidebar'),nav=sidebar.querySelector('nav'),foot=sidebar.querySelector('.sidebar-foot');
        const content=document.querySelector('.content'),topbar=document.querySelector('.topbar');
        const rect=element=>{const r=element.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height};};
        return {viewport:innerHeight,sidebar:rect(sidebar),footer:rect(foot),nav:rect(nav),active:rect(nav.querySelector('.active')),main:rect(content),header:rect(topbar),
          footerVisible:getComputedStyle(foot).display!=='none',menuOverflow:nav.scrollHeight-nav.clientHeight,menuScroll:nav.scrollTop,menuFont:parseFloat(getComputedStyle(nav.querySelector('a')).fontSize),last:rect(nav.querySelector('a:last-child')),sidebarOverflow:sidebar.scrollHeight-sidebar.clientHeight,bodyOverflow:document.scrollingElement.scrollHeight-innerHeight,horizontalOverflow:document.documentElement.scrollWidth-innerWidth};
      });
      assert.ok(Math.abs(geometry.sidebar.height-height)<=1, `${width}x${height}/${name}: sidebar height`);
      if(geometry.footerVisible)assert.ok(geometry.footer.bottom<=height+1 && geometry.footer.top>=0, `${name}: footer outside sidebar`);
      if(geometry.footerVisible)assert.ok(geometry.nav.bottom<=geometry.footer.top+1, `${name}: menu overlaps footer`);
      assert.ok(geometry.menuOverflow<=1,`${width}x${height}/${name}: menu requires scrolling (${geometry.menuOverflow}px)`);
      assert.equal(geometry.menuScroll,0,`${name}: menu was scrolled to hide content`);
      assert.ok(geometry.menuFont>=11,`${name}: menu text shrank below 11px`);
      assert.ok(geometry.last.bottom<=geometry.nav.bottom+1,`${name}: bottom menu is clipped`);
      assert.ok(geometry.active.top>=geometry.nav.top-1 && geometry.active.bottom<=geometry.nav.bottom+1, `${name}: selected navigation item inaccessible`);
      assert.ok(geometry.sidebarOverflow<=1 && geometry.bodyOverflow<=1 && geometry.horizontalOverflow<=1, `${name}: viewport overflow`);
      assert.ok(geometry.main.top>=geometry.header.bottom-1 && geometry.main.bottom<=height+1, `${name}: main scroll area`);
      // Scrolling a long page must leave the entire sidebar in place.
      const independent = await page.evaluate(() => {
        const sidebar=document.querySelector('.sidebar'),content=document.querySelector('.content');
        const before=sidebar.getBoundingClientRect().top;content.scrollTop=content.scrollHeight;
        return {before,after:sidebar.getBoundingClientRect().top,navScroll:sidebar.querySelector('nav').scrollTop};
      });
      assert.equal(independent.before,independent.after,`${name}: page scroll moves the sidebar`);
      assert.equal(independent.navScroll,0,`${name}: page scroll changes the menu`);
      if(width===1440 && height===720 && ['users','overview'].includes(name)) {
        if(name==='users') {
          const filters=await page.locator('.toolbar > select').evaluateAll(elements=>elements.map(e=>({width:e.getBoundingClientRect().width,top:e.getBoundingClientRect().top})));
          assert.equal(filters.length,2);
          assert.ok(filters.every(f=>f.width<=230) && Math.abs(filters[0].top-filters[1].top)<1, 'User filters unnecessarily wrap to full rows');
        }
        await page.screenshot({path:join(output,`${name}-${width}x${height}.png`)});
      }
    }
    console.log(`PASS: ${width}x${height}, all ${pages.length} pages; complete unscrolled menu, readable text, bounded sidebar and independent content scroll`);
  }
  // Collapsing retains all navigation actions and survives page changes and reloads.
  await page.setViewportSize({width:1440,height:720});
  await page.getByRole('button',{name:'收起左侧菜单',exact:true}).click();
  assert.ok(await page.locator('.layout').evaluate(el=>el.classList.contains('sidebar-collapsed')));
  for(const [name,title] of pages){
    await page.locator(`a.nav-link[href="#${name}"]`).click();
    await page.getByRole('heading',{name:title,exact:true}).waitFor();
    const rail=await page.locator('.sidebar').boundingBox();
    assert.ok(rail.width<=80,'Collapsed sidebar did not release space');
    assert.ok(await page.locator('.sidebar nav').evaluate(nav=>nav.scrollHeight<=nav.clientHeight+1),'Collapsed icons require scrolling');
  }
  await page.reload();
  await unlock(page);
  await page.getByRole('heading',{name:'控制台设置',exact:true}).waitFor();
  assert.ok(await page.locator('.layout').evaluate(el=>el.classList.contains('sidebar-collapsed')),'Collapse preference lost on reload');
  await page.screenshot({path:join(output,'collapsed-1440x720.png')});
  await page.getByRole('button',{name:'展开左侧菜单',exact:true}).click();
  assert.ok(await page.locator('.sidebar').evaluate(el=>el.getBoundingClientRect().width>180));
  await page.locator('a.nav-link[href="#settings"]').focus();
  await page.keyboard.press('Enter');
  await page.getByRole('heading',{name:'控制台设置',exact:true}).waitFor();
  console.log('PASS: collapse/expand, all icon links, remembered preference and keyboard access');
  for(const [width,height] of [[390,844],[760,600]]) {
    await page.setViewportSize({width,height});
    for(const [name,title] of pages) {
      await page.locator(`a.nav-link[href="#${name}"]`).click();
      await page.getByRole('heading',{name:title,exact:true}).waitFor();
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${name}: mobile horizontal overflow`);
    }
    await page.screenshot({path:join(output,`mobile-${width}x${height}.png`)});
    console.log(`PASS: ${width}x${height}, all ${pages.length} pages; responsive navigation remains usable`);
  }
  assert.deepEqual(errors,[],'Browser exceptions');
} finally {
  await browser.close();
}
