import { readFileSync } from 'node:fs';
export const credentials = JSON.parse(readFileSync(process.env.VISIONSY_LAYOUT_CREDENTIALS || new URL('../../VisionSY_Daemon/deploy/docker/.split-local/credentials.json',import.meta.url),'utf8'));
export async function unlock(page, { connect = true } = {}) {
  await page.locator('#auth-form').waitFor();
  await page.locator('input[name=username]').fill(credentials.dashboard_username);
  await page.locator('input[name=password]').fill(credentials.dashboard_password);
  if(await page.locator('input[name=confirm]').count())await page.locator('input[name=confirm]').fill(credentials.dashboard_password);
  await page.locator('#auth-form button[type=submit]').click();
  await page.locator('.layout').waitFor();
  if(connect && await page.locator('#node-select option').count()===1) {
    const daemon=new URL(credentials.daemon_url);
    // Use the unchanged connection form, including its test and save operations.
    await page.evaluate(()=>{location.hash='connections';});
    await page.getByRole('heading',{name:'daemon 连接',exact:true}).waitFor();
    await page.getByRole('button',{name:'添加 daemon',exact:true}).click();
    await page.locator('#edit-form input[name=name]').fill('本机媒体服务');
    await page.locator('#edit-form input[name=host]').fill(daemon.hostname);
    await page.locator('#edit-form input[name=port]').fill(daemon.port);
    await page.locator('#edit-form select[name=protocol]').selectOption(daemon.protocol.slice(0,-1));
    await page.locator('#edit-form input[name=token]').fill(credentials.api_key);
    await page.locator('#probe').click();
    await page.locator('#form-message').filter({hasText:'连接成功'}).waitFor();
    await page.locator('#edit-form button[type=submit]').click();
    await page.locator('#dialog').waitFor({state:'hidden'});
  }
}
