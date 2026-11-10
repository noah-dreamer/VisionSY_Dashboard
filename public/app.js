import { BrowserClient, vaultStorageKey } from './client.js';
const client = new BrowserClient();
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths = {
  collapse:'M3 3h18v18H3z M9 3v18 M17 9l-3 3 3 3', expand:'M3 3h18v18H3z M9 3v18 M14 9l3 3-3 3',
  grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  users:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 3a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  group:'M12 3 3 7l9 4 9-4-9-4z M3 12l9 4 9-4 M3 17l9 4 9-4',
  folder:'M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z',
  image:'M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M3 16l5-5 5 5 3-3 5 5 M15 8h.01',
  server:'M4 3h16v7H4z M4 14h16v7H4z M7 6.5h.01 M7 17.5h.01 M11 6.5h6 M11 17.5h6',
  activity:'M3 12h4l3-8 4 16 3-8h4',
  file:'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h5',
  database:'M21 5c0 2.2-4 4-9 4S3 7.2 3 5s4-4 9-4 9 1.8 9 4z M3 5v14c0 2.2 4 4 9 4s9-1.8 9-4V5 M3 12c0 2.2 4 4 9 4s9-1.8 9-4',
  mail:'M3 5h18v14H3z M3 5l9 7 9-7',
  key:'M15 7a4 4 0 1 1 0 8 4 4 0 0 1 0-8z M11 15l-8 7 M5 20l-2-2 M8 17l-2-2',
  link:'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2 M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2',
  plus:'M12 5v14 M5 12h14', refresh:'M20 7a9 9 0 1 0 1 9 M20 2v5h-5',
  arrow:'M5 12h14 M13 6l6 6-6 6', external:'M15 3h6v6 M10 14 21 3 M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5',
  logout:'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
  search:'M21 21l-6-6 M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0',
  close:'M6 6l12 12 M6 18 18 6', shield:'m12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6l9-4z M8 12l3 3 5-5',
  edit:'m16 3 5 5-12 12H4v-5L16 3z M13 6l5 5', trash:'M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7',
  download:'M12 3v12 M6 9l6 6 6-6 M5 16v5h14v-5', clock:'M12 8v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0', lock:'M6 10V7a6 6 0 0 1 12 0v3 M4 10h16v12H4z M12 14v4', settings:'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8z M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2',
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.grid}"/></svg>`;
const menus = [ ['overview','grid','总览'], ['users','users','用户管理'], ['groups','group','用户组与权限'], ['sources','server','媒体目录'], ['galleries','folder','图库管理'], ['resources','image','媒体素材'], ['tasks','activity','后台任务'], ['audit','file','审计日志'], ['backups','database','数据库备份'], ['mail','mail','邮件服务'], ['connections','link','daemon 连接'], ['settings','settings','控制台设置'] ];
const state = { sidebarCollapsed:readSidebarPreference(), session:null, connections:[], active:null, info:null, online:false, page:'overview', q:'', filters:{}, index:1, rows:[], sources:[], groups:[], ticket:0 };
const labels = { active:'已激活',disabled:'已禁用',pending_activation:'待激活',pending_email_verification:'待验证邮箱', completed:'已完成',pending:'等待处理',running:'处理中',failed:'失败',partial:'部分完成',ready:'已就绪',scanning:'扫描中',processing:'生成中',archived:'已归档',missing:'文件丢失',RUNNING:'运行中',STOPPED:'已停止',EXITED:'已结束',FATAL:'启动失败',STARTING:'启动中',system_admin:'系统管理员',normal_user:'普通用户',propaganda_member:'宣传部成员',wechat_editor_teacher:'官微编辑老师' };
const fmt = n => Number(n || 0).toLocaleString('zh-CN');
const date = n => n ? new Date(typeof n === 'number' ? n*1000 : n).toLocaleString('zh-CN', {hour12:false}) : '—';
const bytes = n => { let value = Number(n || 0), i=0; while(value>=1024 && i<4){ value/=1024;i++; } return `${value.toFixed(i ? 1 : 0)} ${['B','KB','MB','GB','TB'][i]}`; };
const badge = value => `<span class="badge ${['failed','disabled','FATAL','missing'].includes(value)?'bad':['pending','processing','running','scanning','partial','STARTING'].includes(value)?'warn':['STOPPED','EXITED','archived'].includes(value)?'neutral':''}">${esc(labels[value] || value)}</span>`;
const btn = (text, action, id='', type='', glyph='') => `<button class="button ${type}" data-action="${action}" data-id="${esc(id)}">${glyph?icon(glyph):''}${esc(text)}</button>`;
const active = () => state.connections.find(c => c.id === state.active);
const remote = (path, method='GET', data) => client.remote(state.active, path, method, data);
function toast(message, error=false) { const node=$('#toast');node.textContent=message;node.className=`visible${error?' error':''}`;clearTimeout(toast.timer);toast.timer=setTimeout(()=>node.className='',5000); }
const api = (path, method='GET', data) => client.api(path, method, data);
function brand(){return '<img src="/logo.png" alt=""><div><strong>VisionSY<span class="brand-period">.</span></strong><small>MEDIA CONTROL CENTER</small></div>';}
function showAuth(setup) {
  $('#app').innerHTML=`<div class="auth-layout"><section class="auth-art"><div class="brand">${brand()}</div><div class="art-orbit" aria-hidden="true"></div><div class="art-title"><div class="eyebrow">ONE PLACE. ALL YOUR MEDIA.</div><h1>让每一份影像，<br>都有序可寻。</h1><p>连接你的媒体服务，在一个清晰的工作空间里，管理用户、图库与后台任务。</p></div><div class="art-foot">VISIONSY DASHBOARD &nbsp; / &nbsp; INDEPENDENT BY DESIGN</div></section><section class="auth-form-wrap"><form class="auth-form" id="auth-form"><div class="eyebrow">${setup?'WELCOME TO YOUR WORKSPACE':'WELCOME BACK'}</div><h1>${setup?'创建控制台管理员':'登录管理控制台'}</h1><p>${setup?'先设置当前浏览器的解锁账号，再添加你的 daemon。':'解锁当前浏览器保存的连接。daemon 离线时仍可管理配置。'}</p><div class="auth-fields"><label class="field">用户名<input name="username" autocomplete="username" required maxlength="80" placeholder="你的管理员用户名"></label><label class="field">${setup?'设置密码':'密码'}<input name="password" type="password" autocomplete="${setup?'new-password':'current-password'}" minlength="10" maxlength="256" required placeholder="至少 10 个字符"></label>${setup?'<label class="field">确认密码<input name="confirm" type="password" autocomplete="new-password" required placeholder="再次输入密码"></label>':''}</div><div id="auth-error" role="alert"></div><button class="button primary" type="submit">${setup?'创建账号并开始':'登录控制台'} ${icon('arrow')}</button><p class="auth-note">此账号用于解锁当前浏览器的连接配置。<br>清除网站数据或更换浏览器后，需要重新添加连接。</p></form></section></div>`;
  $('#auth-form').onsubmit=async event=>{
    event.preventDefault();const button=event.target.querySelector('button');button.disabled=true;
    const data=Object.fromEntries(new FormData(event.target));
    try{if(setup && data.password!==data.confirm)throw new Error('两次密码不一致。');state.session=await api(setup?'/api/setup':'/api/login','POST',data);await start();}
    catch(error){$('#auth-error').textContent=error.message;$('#auth-error').className='inline-message error';}
    finally{button.disabled=false;}
  };
}
function readSidebarPreference(){
  try{return localStorage.getItem('visionsy.sidebarCollapsed')==='1';}catch{return false;}
}
function fitSidebar(){
  const sidebar=$('.sidebar'),nav=sidebar?.querySelector('nav');
  if(!nav)return;
  sidebar.style.setProperty('--menu-scale','1');
  if(!matchMedia('(min-width:761px)').matches)return;
  let scale=1;
  // Fonts stop shrinking at 11px; tighter spacing absorbs the rest on short windows.
  for(let i=0;i<16 && nav.scrollHeight>nav.clientHeight+1;i++){
    scale=Math.max(.1,scale*(nav.clientHeight-2)/nav.scrollHeight*.98);
    sidebar.style.setProperty('--menu-scale',String(scale));
  }
}
function toggleSidebar(button){
  state.sidebarCollapsed=!state.sidebarCollapsed;
  try{localStorage.setItem('visionsy.sidebarCollapsed',state.sidebarCollapsed?'1':'0');}catch{}
  $('.layout').classList.toggle('sidebar-collapsed',state.sidebarCollapsed);
  button.setAttribute('aria-expanded',String(!state.sidebarCollapsed));
  const label=state.sidebarCollapsed?'展开左侧菜单':'收起左侧菜单';
  button.setAttribute('aria-label',label);button.title=label;
  button.innerHTML=icon(state.sidebarCollapsed?'expand':'collapse');
  fitSidebar();
}
function shell(){
  const previousNav=$('.sidebar nav');
  const navScroll={left:previousNav?.scrollLeft || 0};
  const current=menus.find(x=>x[0]===state.page) || menus[0];
  $('#app').innerHTML=`<div class="layout${state.sidebarCollapsed?' sidebar-collapsed':''}"><aside class="sidebar"><a class="brand" href="#overview" aria-label="VisionSY 总览">${brand()}</a><nav id="dashboard-navigation" aria-label="管理导航">${menus.map(([name,glyph,label],i)=>`${[0,3,6,10].includes(i)?`<div class="nav-label">${{0:'WORKSPACE',3:'MEDIA LIBRARY',6:'OPERATIONS',10:'PREFERENCES'}[i]}</div>`:''}<a class="nav-link ${state.page===name?'active':''}" href="#${name}" aria-label="${label}" title="${label}" ${state.page===name?'aria-current="page"':''}>${icon(glyph)}<span>${label}</span></a>`).join('')}</nav><div class="sidebar-foot"><div class="foot-line"></div><div class="status-line"><span class="dot"></span>独立管理 · 自主连接</div><p>你的影像，井然有序。</p><small>VisionSY Dashboard &nbsp; v0.2.0</small></div></aside><div class="main-wrap"><header class="topbar"><div class="topbar-leading"><button class="icon-btn sidebar-toggle" data-action="toggle-sidebar" aria-controls="dashboard-navigation" aria-expanded="${!state.sidebarCollapsed}" aria-label="${state.sidebarCollapsed?'展开左侧菜单':'收起左侧菜单'}" title="${state.sidebarCollapsed?'展开左侧菜单':'收起左侧菜单'}">${icon(state.sidebarCollapsed?'expand':'collapse')}</button><div class="breadcrumb">工作空间<span>/</span><strong>${current[2]}</strong></div></div><div class="top-actions"><select class="node-select" id="node-select" aria-label="切换 daemon"><option value="">选择 daemon</option>${state.connections.map(c=>`<option value="${c.id}" ${c.id===state.active?'selected':''}>${esc(c.name)}</option>`).join('')}</select><span class="profile"><span class="avatar">${esc((state.session.username || 'A').slice(0,1).toUpperCase())}</span><span>${esc(state.session.username)}</span></span><button class="icon-btn" data-action="logout" title="退出登录" aria-label="退出登录">${icon('logout')}</button></div></header><main class="content" id="main" tabindex="-1"><div id="view"></div><footer class="page-footer"><span>© ${new Date().getFullYear()} VisionSY · 媒体管理控制台</span><span>${icon('shield')} 连接凭据加密保存在当前浏览器</span></footer></main></div></div>`;
  const nav=$('.sidebar nav');
  fitSidebar();
  // On small screens the navigation is a horizontal strip; keep its active item visible.
  if(!matchMedia('(min-width:761px)').matches){
    nav.scrollLeft=navScroll.left;
    const selected=nav.querySelector('.nav-link.active');
    if(selected){
      const area=nav.getBoundingClientRect(),link=selected.getBoundingClientRect();
      if(link.left<area.left)nav.scrollLeft+=link.left-area.left-4;
      else if(link.right>area.right)nav.scrollLeft+=link.right-area.right+4;
    }
  }
  $('#node-select').onchange=async event=>{if(event.target.value){await api(`/api/connections/${event.target.value}/activate`,'POST',{});state.active=event.target.value;state.info=null;state.online=false;await route(true);}};
}
function pageHead(title, description, buttons=''){return `<div class="page-head"><div><div class="eyebrow">VISIONSY / ${esc(state.page.toUpperCase())}</div><h1>${title}</h1><p>${description}</p></div><div class="head-buttons">${buttons}</div></div>`;}
function empty(title, description, action=''){return `<div class="panel empty"><div class="empty-icon">${icon(menus.find(x=>x[0]===state.page)?.[1] || 'folder')}</div><h2>${esc(title)}</h2><p>${esc(description)}</p>${action}</div>`;}
function table(headers, rows){return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${headers.length}"><div class="empty">暂无符合条件的记录</div></td></tr>`}</tbody></table></div>`;}
function pager(data){return data.last_page?`<div class="pager"><span>共 ${fmt(data.total)} 条 · 第 ${data.current_page} / ${data.last_page} 页</span><button class="button small" data-action="page-prev" ${data.current_page<=1?'disabled':''}>上一页</button><button class="button small" data-action="page-next" ${data.current_page>=data.last_page?'disabled':''}>下一页</button></div>`:'';}
function searchBar(placeholder, extra=''){return `<form class="toolbar" id="search-form"><label class="search">${icon('search')}<input name="q" aria-label="搜索" placeholder="${esc(placeholder)}" value="${esc(state.q)}"></label>${extra}<button class="button small" type="submit">查询</button></form>`;}
function bindSearch(){const form=$('#search-form');if(form)form.onsubmit=event=>{event.preventDefault();const data=Object.fromEntries(new FormData(form));state.q=data.q || '';delete data.q;state.filters=data;state.index=1;route();};}
function query(extra={}){return new URLSearchParams({page:state.index,...(state.q?{q:state.q}:{}),...state.filters,...extra}).toString();}
function overview(data){
  const connection=active();const stats=data.stats;const processes=data.runtime.processes.filter(p=>p.name!=='bootstrap');
  const running=processes.filter(p=>p.state==='RUNNING').length;
  const uptime=processes.find(p=>p.name==='web')?.started_at;
  const statItems=[['users','用户总数',stats.users,`${fmt(stats.groups)} 个用户组`],['folder','媒体图库',stats.galleries,`${fmt(stats.sources)} 个媒体目录`],['image','媒体素材',stats.resources,`${fmt(stats.failed_derivatives)} 项预览待处理`],['activity','后台任务',stats.pending_jobs,`${fmt(stats.failed_jobs)} 条失败记录`]];
  return pageHead('工作空间总览','一览媒体服务运行情况，继续今天的管理工作。',btn('打开媒体网站','open-site','','','external')+btn('刷新状态','refresh','','primary','refresh'))+
  `<section class="stats" aria-label="工作空间统计">${statItems.map(([glyph,title,value,foot])=>`<article class="stat"><div class="stat-top"><span>${title}</span><div class="stat-icon">${icon(glyph)}</div></div><div class="stat-value">${fmt(value)}</div><div class="stat-foot">${icon('arrow')}<strong>${foot}</strong><span>当前 daemon</span></div></article>`).join('')}</section><div class="grid-two"><section class="panel daemon-card"><header class="panel-head"><h2>当前连接的 daemon</h2><span class="badge">已连接</span></header><div class="panel-body"><small>${esc(state.info?.name || connection.name)}</small><div class="daemon-address">${esc(connection.host)}<span class="muted">:${connection.port}</span></div><small>通过主机地址连接 · ${esc(connection.protocol.toUpperCase())} · API v1</small><dl class="daemon-meta"><div><dt>服务版本</dt><dd>v${esc(state.info?.version || '—')}</dd></div><div><dt>本次运行</dt><dd>${uptime?`${Math.max(1,Math.floor((Date.now()/1000-uptime)/60))} 分钟`:'—'}</dd></div><div><dt>存储可用空间</dt><dd>${bytes(data.runtime.storage_free_bytes)}</dd></div></dl></div></section><section class="panel"><header class="panel-head"><h2>运行服务</h2><small>${running} / ${processes.length} 正常运行</small></header><div class="panel-body services">${processes.length?processes.map(p=>`<div class="service"><div class="service-name">${icon({database:'database',web:'server',worker:'activity',scheduler:'clock'}[p.name])}<div><strong>${esc({database:'数据库',web:'媒体网站',worker:'队列处理',scheduler:'任务调度'}[p.name] || p.name)}</strong><small>${esc(p.name)} · PID ${p.pid}</small></div></div>${badge(p.state)}</div>`).join(''):'<p class="help">当前部署未提供进程状态；数据库连接正常。</p>'}</div></section></div><div class="grid-two"><section class="panel"><header class="panel-head"><h2>最近更新的图库</h2><a class="help" href="#galleries">查看全部 →</a></header>${table(['图库','素材数量','扫描状态'],data.recent_galleries.map(g=>[`<div class="table-label"><div class="folder-icon">${icon('folder')}</div><div><strong>${esc(g.name)}</strong><small>${date(g.updated_at)}</small></div></div>`,fmt(g.media_count),badge(g.scan_status)]))}</section><section class="panel"><header class="panel-head"><h2>最近动态</h2><a class="help" href="#audit">审计日志 →</a></header><div class="panel-body activity">${data.recent_logs.length?data.recent_logs.map(log=>`<div class="activity-item"><span class="activity-dot"></span><div><p>${esc(actionLabel(log.action))}</p><small>${esc(log.actor_email || '系统')} · ${date(log.created_at)}</small></div></div>`).join(''):'<p class="help">管理操作会记录在这里。</p>'}</div></section></div>`;
}
const actionLabel = action => ({'management.key_created':'创建了管理 API 密钥','admin.user_created':'创建了用户账号','admin.user_updated':'更新了用户信息','admin.user_deleted':'删除了用户账号','admin.user_password_reset':'重置了用户密码','user_group.saved':'保存了用户组权限','user_group.deleted':'删除了用户组','storage_source.saved':'保存了媒体目录','storage_source.scan':'发起了目录扫描','gallery.saved':'更新了图库','gallery.scan':'发起了图库扫描','gallery.scanned':'完成了图库扫描','management.key_revoked':'撤销了管理 API 密钥','database.backup_requested':'创建了数据库备份任务','database.backup_downloaded':'下载了数据库备份','database.backup_deleted':'删除了数据库备份','queue.restart_requested':'请求重启队列进程'}[action] || action);
async function pageContent(){
  if(state.page==='connections')return connectionsPage();
  if(state.page==='settings')return settingsPage();
  if(!active())return pageHead('连接你的媒体服务','Dashboard 已准备就绪。添加一个 daemon，开始管理你的媒体库。')+empty('还没有连接 daemon','输入媒体服务所在主机的 IP 或域名、端口和连接密钥。控制台可以独立运行，连接设置随时可修改。',btn('添加 daemon','connect','','primary','plus'));
  if(!state.info){state.info=await api(`/api/connections/${state.active}/test`,'POST',{});state.online=true;}
  if(state.page==='mail')return mailPage((await remote('mail')).data);
  if(state.page==='overview')return overview(await remote('overview'));
  if(state.page==='users'){
    const data=await remote('users?'+query());state.rows=data.data;
    return pageHead('用户管理','管理媒体网站账号、角色、状态和所属用户组。',btn('创建用户','new','','primary','plus'))+`<section class="panel">${searchBar('搜索姓名或邮箱',`<select name="role" aria-label="角色筛选"><option value="">所有角色</option>${['system_admin','propaganda_member','wechat_editor_teacher','normal_user'].map(r=>`<option value="${r}" ${state.filters.role===r?'selected':''}>${labels[r]}</option>`).join('')}</select><select name="status" aria-label="状态筛选"><option value="">所有状态</option>${['active','disabled','pending_activation','pending_email_verification'].map(r=>`<option value="${r}" ${state.filters.status===r?'selected':''}>${labels[r]}</option>`).join('')}</select>`)}${table(['用户','角色与用户组','状态','创建时间','操作'],data.data.map(u=>[`<div class="table-label"><span class="avatar">${esc(u.display_name?.slice(0,1))}</span><div><strong>${esc(u.display_name)}</strong><small>${esc(u.email)}</small></div></div>`,`${esc(labels[u.role])}<small>${esc(u.user_group?.name || '角色默认权限')}</small>`,badge(u.status),date(u.created_at),`<div class="row-actions">${btn('编辑','edit',u.id,'small')}${btn('重置密码','reset',u.id,'small')}${btn('删除','delete',u.id,'small danger')}</div>`]))}${pager(data)}</section>`;
  }
  if(state.page==='groups'){
    const data=await remote('groups');state.rows=data.data;state.groups=data.data;
    return pageHead('用户组与权限','按组分配媒体权限，设置下载限额和新注册用户默认组。',btn('创建用户组','new','','primary','plus'))+`<section class="panel">${table(['用户组','媒体权限','下载限额','成员','操作'],data.data.map(g=>[`<strong>${esc(g.name)}</strong>${g.is_registration_default?' <span class="badge">注册默认组</span>':''}<small>${esc(g.description || '—')}</small>`,Object.entries(data.flags).filter(([flag])=>g[flag]).map(([,label])=>`<span class="badge neutral">${esc(label[0])}</span>`).join(' ') || '无媒体权限',g.download_limit_per_day?`${fmt(g.download_limit_per_day)} 次 / 天`:'不限额',fmt(g.users_count),`<div class="row-actions">${btn('编辑','edit',g.id,'small')}${btn('删除','delete',g.id,'small danger')}</div>`]))}</section>`;
  }
  if(state.page==='sources'){
    const data=await remote('sources');state.rows=data.data;state.sources=data.data;
    return pageHead('媒体目录','登记 daemon 可以访问的目录，统一扫描已有文件和新上传素材。',btn('添加目录','new','','primary','plus'))+`<div class="info-card">${icon('server')}<div>目录路径属于 daemon 所在服务器。使用 NAS 时，先在该服务器挂载共享目录。<br>当前允许范围：<span class="mono">${esc(data.allowed_roots.join(' · '))}</span></div></div><section class="panel">${table(['媒体目录','可用状态','图库 / 素材','最近扫描','操作'],data.data.map(s=>[`<strong>${esc(s.name)}</strong><small class="mono">${esc(s.root_path)}</small>`,`${badge(s.is_enabled?'active':'disabled')} <span class="badge neutral">${s.is_read_only?'只读':'可写'}</span>`,`${fmt(s.galleries_count)} / ${fmt(s.media_resources_count)}`,`${badge(s.last_scan_status || 'pending')}<small>${date(s.last_scan_finished_at)}</small>`,`<div class="row-actions">${btn('检查','verify',s.id,'small')}${btn('扫描','scan',s.id,'small')}${btn('编辑','edit',s.id,'small')}${btn('移除','delete',s.id,'small danger')}</div>`]))}</section>`;
  }
  if(state.page==='galleries'){
    const [data,sources]=await Promise.all([remote('galleries?'+query()),remote('sources')]);state.rows=data.data;state.sources=sources.data;
    return pageHead('图库管理','管理自动发现和手动创建的图库，查看扫描结果与素材数量。',btn('创建图库','new','','primary','plus'))+`<section class="panel">${searchBar('搜索图库名称',`<select name="source_id" aria-label="媒体目录筛选"><option value="">所有媒体目录</option>${sources.data.map(s=>`<option value="${s.id}" ${String(state.filters.source_id)===String(s.id)?'selected':''}>${esc(s.name)}</option>`).join('')}</select>`)}${table(['图库','媒体目录','素材数量','扫描状态','操作'],data.data.map(g=>[`<div class="table-label"><div class="folder-icon">${icon('folder')}</div><div><strong>${esc(g.name)}</strong>${g.is_visible?'':' <span class="badge neutral">已隐藏</span>'}<small>${esc(g.relative_path || '根图库')}</small></div></div>`,esc(g.storage_source?.name),fmt(g.media_resources_count),`${badge(g.scan_status)}<small>${date(g.last_scanned_at)}</small>`,`<div class="row-actions">${btn('素材','browse',g.id,'small')}${btn('扫描','scan',g.id,'small')}${btn('重建预览','retry',g.id,'small')}${btn('编辑','edit',g.id,'small')}${btn('删除','delete',g.id,'small danger')}</div>`]))}${pager(data)}</section>`;
  }
  if(state.page==='resources'){
    const data=await remote('resources?'+query());state.rows=data.data;
    return pageHead('媒体素材','浏览与管理素材索引；缩略图直接从 daemon 加载。',btn('打开媒体网站','open-site','','','external'))+`<section class="panel">${searchBar('搜索标题、文件名或标签',`<input name="gallery_id" type="number" min="1" aria-label="图库 ID" placeholder="图库 ID（可选）" value="${esc(state.filters.gallery_id || '')}"><select name="derivative_status" aria-label="预览状态"><option value="">所有预览状态</option>${['ready','pending','failed','partial'].map(s=>`<option value="${s}" ${state.filters.derivative_status===s?'selected':''}>${labels[s]}</option>`).join('')}</select>`)}</section><br><section class="media-grid">${data.data.map(m=>`<article class="media-card"><div class="media-image">${m.thumbnail_url?`<img src="${esc(safeUrl(m.thumbnail_url))}" alt="${esc(m.title || m.original_name)}" loading="lazy" referrerpolicy="no-referrer">`:icon('image')}</div><div class="media-body"><h3 title="${esc(m.title || m.original_name)}">${esc(m.title || m.original_name)}</h3><small>${esc(m.gallery?.name || '未归属图库')} · ${bytes(m.size_bytes)}</small><div>${badge(m.derivative_status || 'pending')} ${m.status==='archived'?badge('archived'):''}</div><div class="row-actions">${btn('编辑','edit',m.id,'small')}${btn('重建预览','retry',m.id,'small')}${btn('删除','delete',m.id,'small danger')}</div></div></article>`).join('')}</section>${!data.data.length?empty('暂无素材','选择其他筛选条件，或前往媒体目录发起扫描。'):''}${pager(data)}`;
  }
  if(state.page==='tasks'){
    const data=await remote('tasks');state.rows=data.failed;
    return pageHead('后台任务','查看扫描与处理队列，重试失败任务。此页面会自动刷新。',btn('重启队列进程','restart-worker','','','refresh')+btn('刷新','refresh','','primary','refresh'))+`<div class="stats">${[['等待 / 执行中',data.pending.length],['扫描中的图库',data.scanning.length],['失败任务',data.failed.length],['进行中的备份',data.backups.length]].map(([title,n])=>`<article class="stat"><div class="stat-top">${title}</div><div class="stat-value">${fmt(n)}</div><small>最多显示最近 50 条</small></article>`).join('')}</div><section class="panel"><header class="panel-head"><h2>任务队列</h2></header>${table(['任务 ID','队列','尝试次数','状态','创建时间'],data.pending.map(j=>[`<span class="mono">#${j.id}</span>`,esc(j.queue),j.attempts,badge(j.reserved_at?'running':'pending'),date(j.created_at)]))}</section><br><section class="panel"><header class="panel-head"><h2>失败任务</h2></header>${table(['任务标识','队列','失败时间','操作'],data.failed.map(j=>[`<span class="mono">${esc(j.uuid)}</span>`,esc(j.queue),date(j.failed_at),`<div class="row-actions">${btn('重试','retry-failed',j.uuid,'small')}${btn('删除记录','forget-failed',j.uuid,'small danger')}</div>`]))}</section>`;
  }
  if(state.page==='audit'){
    const data=await remote('audit?'+query());state.rows=data.data;
    return pageHead('审计日志','查看 daemon 上发生的管理操作与业务事件。')+`<section class="panel"><form class="toolbar" id="search-form"><input name="action" aria-label="操作筛选" placeholder="操作名称，例如 database.backup" value="${esc(state.filters.action || '')}"><input name="actor" aria-label="操作者筛选" placeholder="操作者邮箱" value="${esc(state.filters.actor || '')}"><button class="button small">查询</button></form>${table(['时间','操作','操作者','目标','来源 IP'],data.data.map(l=>[date(l.created_at),`<strong>${esc(actionLabel(l.action))}</strong><small class="mono">${esc(l.action)}</small>`,esc(l.actor_email || '系统'),`${esc(l.target_type || '—')}<small>#${esc(l.target_id || '—')}</small>`,`<span class="mono">${esc(l.ip || '—')}</span>`]))}${pager(data)}</section>`;
  }
  if(state.page==='backups'){
    const data=await remote('backups?'+query());state.rows=data.data;
    return pageHead('数据库备份','在 daemon 上创建一致性备份，完成后下载到本地保存。',btn('创建数据库备份','backup','','primary','plus'))+`<div class="info-card">${icon('shield')}<div>备份格式为 MariaDB SQL 压缩文件，包含数据库中的用户、权限和媒体索引。<br>照片原件、预览文件及应用密钥不包含在内，请单独备份。备份文件包含敏感数据，请妥善保存。</div></div><section class="panel">${table(['创建时间','状态','文件大小','完成时间','操作'],data.data.map(b=>[`${date(b.created_at)}<small class="mono">${esc(b.id.slice(0,8))}</small>`,`${badge(b.status)}${b.error?`<small>${esc(b.error)}</small>`:''}`,bytes(b.size_bytes),date(b.finished_at),`<div class="row-actions">${b.status==='completed'?`${btn('下载','download-backup',b.id,'small','download')}`:''}${!['pending','running'].includes(b.status)?btn('删除','delete',b.id,'small danger'):''}</div>`]))}${pager(data)}</section>`;
  }

}
function mailPage(data){
  state.mailConfig=data;
  const fields=[{name:'host',label:'SMTP 服务器',required:true,full:true,placeholder:'smtp.example.com',max:253},
    {name:'port',label:'端口',required:true,placeholder:'587 或 465'},
    {name:'security',label:'加密方式',options:[['starttls','STARTTLS（常用端口 587）'],['smtps','SSL / TLS（常用端口 465）'],['none','无加密（本机邮件中继）']]},
    {name:'username',label:'SMTP 用户名',full:true,max:255,help:'通常是完整的发件邮箱地址。'},
    {name:'password',label:'SMTP 密码或授权码',type:'password',full:true,help:data.has_password?'已保存授权信息。留空保留，输入新值则替换。':'按邮箱服务商要求填写 SMTP 授权码或应用密码。'},
    {name:'from_address',label:'发件邮箱地址',type:'email',required:true,full:true,max:255},
    {name:'from_name',label:'发件人名称',required:true,full:true,max:100},
    {name:'enabled',label:'启用邮件发送',type:'check',full:true},
    {name:'clear_password',label:'清除已保存的 SMTP 授权信息',type:'check',full:true}];
  return pageHead('邮件服务','配置当前 daemon 的发信服务，用于注册验证码和密码重置。')+
    `<div class="info-card">${icon('mail')}<div>${data.enabled?'已保存发信设置，请通过测试邮件确认投递正常。':'当前尚未启用真实邮件发送，注册验证码不会送达邮箱。'}<br>授权信息加密保存在 daemon，保存后不会回显，也不会写入操作审计。</div></div>`+
    `<div class="grid-two"><section class="panel"><header class="panel-head"><h2>发信设置</h2>${badge(data.enabled?'active':'disabled')}</header><form class="panel-body" id="mail-form"><div class="form-grid">${fields.map(f=>field(f,data[f.name] ?? '')).join('')}</div><div class="form-actions"><button class="button primary" type="submit">保存发信设置</button></div></form></section>`+
    `<section class="panel"><header class="panel-head"><h2>发送测试邮件</h2></header><form class="panel-body" id="mail-test-form"><p class="help">先保存左侧配置，再填写你可以接收邮件的地址。发送成功代表邮件服务器已接受，请同时检查收件箱和垃圾箱。</p><br><label class="field">收件邮箱<input name="recipient" type="email" required maxlength="255" placeholder="填写你的收件邮箱"></label><div class="form-actions"><button class="button primary" type="submit" ${data.enabled?'':'disabled'}>发送测试邮件</button></div><div id="mail-test-result" role="status"></div></form></section></div>`;
}
function bindMail(){
  $('#mail-form').onsubmit=async event=>{
    event.preventDefault();const form=event.target,button=form.querySelector('[type=submit]');button.disabled=true;
    const data=Object.fromEntries(new FormData(form));data.enabled=form.elements.enabled.checked;data.clear_password=form.elements.clear_password.checked;data.port=Number(data.port);
    if(!data.password)delete data.password;
    try{toast((await remote('mail','PUT',data)).message);await route();}catch(error){toast(error.message,true);}finally{button.disabled=false;}
  };
  $('#mail-test-form').onsubmit=async event=>{
    event.preventDefault();const button=event.target.querySelector('button');button.disabled=true;const result=$('#mail-test-result');result.className='inline-message';result.textContent='正在连接邮件服务器…';
    try{result.textContent=(await remote('mail/test','POST',Object.fromEntries(new FormData(event.target)))).message;}
    catch(error){result.className='inline-message error';result.textContent=error.message;}finally{button.disabled=false;}
  };
}
function safeUrl(value){try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)?url.href:'#';}catch{return '#';}}
function connectionsPage(){
  return pageHead('daemon 连接','管理独立媒体服务的连接地址与凭据，同机或异机使用相同流程。',btn('添加 daemon','connect','','primary','plus'))+`<div class="info-card">${icon('link')}<div>你的浏览器直接连接 daemon，Dashboard 只提供界面文件。<br>填写管理员电脑可访问的地址，并在 daemon 上允许当前面板来源；127.0.0.1 指向管理员电脑。</div></div><section class="connection-grid">${state.connections.map(c=>`<article class="connection-card ${c.id===state.active?'selected':''}"><div class="connection-top">${icon('server')}${c.id===state.active?'<span class="badge">当前工作空间</span>':'<span class="badge neutral">已保存</span>'}</div><h2>${esc(c.name)}</h2><div class="mono">${esc(c.baseUrl)}</div><p class="help">${esc(c.protocol.toUpperCase())} · 管理 API v1</p><div class="row-actions">${c.id!==state.active?btn('切换连接','activate',c.id,'small primary'):''}${btn('测试连接','test-connection',c.id,'small')}${btn('编辑','edit-connection',c.id,'small')}${btn('移除','delete-connection',c.id,'small danger')}</div></article>`).join('')}<button class="add-connection" data-action="connect">${icon('plus')}<strong>添加一个 daemon</strong><span class="help">输入地址与连接密钥即可连接</span></button></section>`;
}
function settingsPage(){return pageHead('控制台设置','此处修改当前浏览器的连接解锁密码，不会修改媒体网站账号。')+`<section class="panel settings-panel"><header class="panel-head"><h2>修改控制台登录密码</h2><span class="badge neutral">${esc(state.session.username)}</span></header><form id="password-form" class="panel-body"><div class="auth-fields"><label class="field">当前密码<input name="current_password" type="password" autocomplete="current-password" required></label><label class="field">新密码<input name="password" type="password" autocomplete="new-password" minlength="10" maxlength="256" required></label><label class="field">确认新密码<input name="confirm" type="password" autocomplete="new-password" required></label></div><div class="form-actions"><button class="button primary">保存新密码</button></div><p class="help">连接配置使用此密码加密保存在当前浏览器。密码丢失后需重新添加连接。</p></form></section>`;}
function field(f, value){
  const required=f.required?'required':'';const full=f.full?' full':'';
  if(f.type==='check')return `<label class="check${full}"><input type="checkbox" name="${f.name}" ${value?'checked':''}>${esc(f.label)}</label>`;
  let input;
  if(f.options)input=`<select name="${f.name}" ${required}>${f.options.map(([v,l])=>`<option value="${esc(v)}" ${String(value ?? '')===String(v)?'selected':''}>${esc(l)}</option>`).join('')}</select>`;
  else if(f.type==='textarea')input=`<textarea name="${f.name}" maxlength="${f.max || 2000}">${esc(value)}</textarea>`;
  else input=`<input name="${f.name}" type="${f.type || 'text'}" value="${f.type==='password'?'':esc(value)}" ${required} ${f.max?`maxlength="${f.max}"`:''} ${f.type==='number'?'min="0" max="100000"':''} ${f.placeholder?`placeholder="${esc(f.placeholder)}"`:''} ${f.type==='password'?'autocomplete="new-password"':''}>`;
  return `<label class="field${full}">${esc(f.label)}${input}${f.help?`<small>${esc(f.help)}</small>`:''}</label>`;
}
function modal(title, description, fields, values, submit, extra=''){
  const dialog=$('#dialog');dialog.innerHTML=`<header class="dialog-head"><h2 id="dialog-title">${esc(title)}</h2><button class="icon-btn" data-action="close" type="button" aria-label="关闭">${icon('close')}</button></header><form class="dialog-body" id="edit-form"><p class="dialog-subtitle">${esc(description)}</p><div class="form-grid">${fields.map(f=>field(f,values[f.name] ?? f.default ?? '')).join('')}</div><div id="form-message" role="status"></div><div class="form-actions">${extra}<button type="button" class="button" data-action="close">取消</button><button class="button primary" type="submit">保存</button></div></form>`;
  if(!dialog.open)dialog.showModal();
  $('#edit-form').onsubmit=async event=>{
    event.preventDefault();const form=event.target;const button=form.querySelector('[type=submit]');button.disabled=true;
    const data=Object.fromEntries(new FormData(form));for(const f of fields){if(f.type==='check')data[f.name]=form.elements[f.name].checked;if(f.type==='number')data[f.name]=Number(data[f.name]);if(f.type==='password' && !data[f.name])delete data[f.name];if(f.name.endsWith('_id') && !data[f.name])data[f.name]=null;}
    try{const close=await submit(data);if(close!==false)dialog.close();}catch(error){formMessage(error.message,true);}finally{button.disabled=false;}
  };
}
function formMessage(text,error=false){const node=$('#form-message');if(node){node.className=`inline-message${error?' error':''}`;node.textContent=text;}}
async function connectDialog(id){
  const record=state.connections.find(c=>c.id===id);
  const fields=[{name:'name',label:'连接名称',required:true,full:true,max:80,placeholder:'例如：校园媒体服务器'},{name:'host',label:'daemon IP 或域名',required:true,full:true,placeholder:'192.168.110.5',help:'填写管理员电脑可访问的地址，127.0.0.1 指向管理员电脑。'},{name:'protocol',label:'通信协议',options:[['http','HTTP'],['https','HTTPS']]},{name:'port',label:'端口',required:true,default:8000},{name:'token',label:record?'连接密钥（留空保留当前密钥）':'daemon 连接密钥',type:'password',full:true,required:!record,help:'填写 daemon 的连接密钥。保存后不会回显。'}];
  modal(record?'编辑 daemon 连接':'连接你的 daemon','输入地址和管理密钥。你可以先测试连接，再保存；daemon 离线时也能修改配置。',fields,record || {},async data=>{
    await api('/api/connections','POST',{...data,id:record?.id});await loadConnections();state.info=null;state.online=false;toast('连接配置已保存。');await route(true);
  },'<button type="button" class="button" id="probe">测试连接</button>');
  $('#probe').onclick=async event=>{const button=event.currentTarget;button.disabled=true;try{const data=Object.fromEntries(new FormData($('#edit-form')));const info=await api('/api/connections/test','POST',{...data,id:record?.id});formMessage(`连接成功 · ${info.name} · v${info.version} · ${info.latency_ms} ms · ${info.administrator.email}`);}catch(error){formMessage(error.message,true);}finally{button.disabled=false;}};
}
async function editEntity(id){
  const kind=state.page;const row=state.rows.find(r=>String(r.id)===String(id));let fields=[],values=row || {};
  if(kind==='users'){
    const groups=await remote('groups');state.groups=groups.data;
    fields=[{name:'display_name',label:'显示名',required:true,max:50},{name:'real_name',label:'真实姓名',max:50},{name:'email',label:'邮箱',type:'email',required:true,full:true,max:255},{name:'role',label:'角色',options:['normal_user','propaganda_member','wechat_editor_teacher','system_admin'].map(r=>[r,labels[r]]),default:'normal_user'},{name:'status',label:'账号状态',options:['active','disabled','pending_activation','pending_email_verification'].map(r=>[r,labels[r]]),default:'active'},{name:'user_group_id',label:'所属用户组',options:[['','角色默认权限'],...groups.data.map(g=>[g.id,g.name])],full:true},{name:'password',label:row?'新密码（留空不修改）':'初始密码',type:'password',required:!row,full:true,help:'至少 8 个字符，最多 72 个 UTF-8 字节。'}];
  }
  if(kind==='groups')fields=[{name:'name',label:'用户组名称',required:true,full:true,max:60},{name:'description',label:'说明',full:true,max:255},{name:'download_limit_per_day',label:'每日下载限额',type:'number',default:0,help:'0 表示不限额。'},{name:'ip_restriction',label:'允许访问的 IP / CIDR',placeholder:'留空不限制',max:255},{name:'is_registration_default',label:'设为新注册用户默认组',type:'check',full:true},...Object.entries({can_browse:'浏览与检索',can_preview:'查看水印预览',can_download_watermarked:'下载水印图',can_download_original:'下载原图',can_upload:'上传素材',can_manage_media:'管理全部素材'}).map(([name,label])=>({name,label,type:'check'}))];
  if(kind==='sources'){values={...values,is_writable:row?!row.is_read_only:true};fields=[{name:'name',label:'媒体目录名称',required:true,full:true,max:120},{name:'root_path',label:'daemon 内的目录路径',required:true,full:true,placeholder:'/data/visionsy/managed',max:1024,help:'NAS 需先在 daemon 主机完成挂载。此处不使用 Dashboard 主机路径。'},{name:'is_enabled',label:'启用媒体目录',type:'check',default:true},{name:'is_writable',label:'允许上传与写入',type:'check',default:true},{name:'scan_recursive',label:'递归扫描子目录',type:'check',default:true}];}
  if(kind==='galleries'){
    if(!state.sources.length)state.sources=(await remote('sources')).data;
    values={...values,tags:Array.isArray(values.tags)?values.tags.join(', '):values.tags};
    fields=[...(!row?[{name:'storage_source_id',label:'媒体目录',required:true,full:true,options:state.sources.filter(s=>!s.is_read_only).map(s=>[s.id,s.name])},{name:'folder_name',label:'目录名称',required:true,full:true,max:255,help:'在媒体目录下创建新文件夹，不支持 preview、_visionsy 等保留名称。'}]:[]),{name:'name',label:'图库显示名称',required:true,full:true,max:255},{name:'description',label:'说明',type:'textarea',full:true},{name:'tags',label:'标签（逗号分隔）',full:true,max:300},{name:'event_started_at',label:'活动开始日期',type:'date'},{name:'event_ended_at',label:'活动结束日期',type:'date'},...(row?[{name:'cover_media_resource_id',label:'封面素材 ID（可留空）',type:'number',full:true,help:'填写属于此图库的素材 ID。'}]:[]),{name:'is_visible',label:'向普通用户展示图库',type:'check',default:true,full:true}];
    for(const name of ['event_started_at','event_ended_at'])if(values[name])values[name]=values[name].slice(0,10);
  }
  if(kind==='resources'){values={...values,tags:(values.tags || []).join(', ')};fields=[{name:'title',label:'标题',required:true,full:true,max:120},{name:'description',label:'说明',type:'textarea',full:true},{name:'tags',label:'标签（逗号分隔）',full:true,max:300},{name:'status',label:'素材状态',options:[['active','正常'],['archived','已归档']]}];}
  const title={users:'用户',groups:'用户组',sources:'媒体目录',galleries:'图库',resources:'素材'}[kind];
  modal(`${row?'编辑':'创建'}${title}`,'修改将由当前连接的 daemon 校验并执行。',fields,values,async data=>{
    if(kind==='resources')data.tags=data.tags.split(',').map(s=>s.trim()).filter(Boolean);
    await remote(kind+(row?`/${row.id}`:''),row?'PUT':'POST',data);toast(`${title}已保存。`);await route();
  });
}
function confirmAction(title, description, action){
  modal(title,description,[],{},async()=>{await action();await route();});const button=$('#edit-form [type=submit]');button.textContent='确认';button.className='button danger';
}
async function route(rebuild=false,poll=false){
  if(!state.session?.authenticated)return;
  const requested=location.hash.slice(1) || 'overview';
  if(requested==='keys'){location.replace('#connections');return;}
  if(requested!==state.page){state.page=menus.some(x=>x[0]===requested)?requested:'overview';state.index=1;state.q='';state.filters={};rebuild=true;}
  if(rebuild || !$('#view'))shell();
  const ticket=++state.ticket;
  if(!poll)$('#view').innerHTML='<div class="loading-line"></div><div class="skeleton">正在加载工作空间…</div>';
  try{
    const content=await pageContent();if(ticket!==state.ticket)return;
    $('#view').innerHTML=content;bindSearch();if(state.page==='mail')bindMail();
    if(state.page==='settings')$('#password-form').onsubmit=async event=>{event.preventDefault();const data=Object.fromEntries(new FormData(event.target));try{if(data.password!==data.confirm)throw new Error('两次新密码不一致。');const result=await api('/api/password','PUT',data);state.session.csrf=result.csrf;event.target.reset();toast(result.message);}catch(error){toast(error.message,true);}};
  }catch(error){
    if(ticket!==state.ticket)return;state.info=null;state.online=false;
    $('#view').innerHTML=pageHead('暂时无法读取 daemon','控制台仍然可用，你可以检查连接或切换到其他媒体服务。')+`<div class="error-panel"><h2>连接或请求未完成</h2><p>${esc(error.message)}</p><div class="head-buttons">${btn('重新连接','refresh','','primary','refresh')}${btn('编辑连接','edit-connection',state.active,'','edit')}<a class="button" href="#connections">管理连接</a></div></div>`;
  }
}
async function loadConnections(){const data=await api('/api/connections');state.connections=data.data;state.active=data.active_id;}
async function start(){await loadConnections();await route(true);}
async function initialize(){try{state.session=await api('/api/session');if(state.session.authenticated)await start();else showAuth(state.session.setup_required);}catch(error){$('#app').textContent=error.message;}}
document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-action]');if(!button)return;
  const action=button.dataset.action,id=button.dataset.id;button.disabled=true;
  try{
    if(action==='toggle-sidebar')return toggleSidebar(button);
    if(action==='close')return $('#dialog').close();
    if(action==='logout'){await api('/api/logout','POST',{});state.info=null;state.connections=[];state.active=null;state.ticket++;$('#dialog').close();return initialize();}
    if(action==='connect' || action==='edit-connection')return await connectDialog(id);
    if(action==='refresh'){state.info=null;return await route();}
    if(action==='page-prev'){state.index--;return await route();}
    if(action==='page-next'){state.index++;return await route();}
    if(action==='open-site'){if(active())window.open(active().baseUrl+'/media','_blank','noopener,noreferrer');return;}
    if(action==='activate'){await api(`/api/connections/${id}/activate`,'POST',{});state.active=id;state.info=null;return route(true);}
    if(action==='test-connection'){const info=await api(`/api/connections/${id}/test`,'POST',{});toast(`连接成功 · ${info.name} · v${info.version} · ${info.latency_ms} ms`);return;}
    if(action==='delete-connection')return confirmAction('移除 daemon 连接','只删除本控制台保存的连接配置，不修改 daemon 或媒体文件。',async()=>{await api(`/api/connections/${id}`,'DELETE',{});await loadConnections();state.info=null;shell();});
    if(action==='new' || action==='edit')return await editEntity(id);
    if(action==='browse'){location.hash='resources';state.page='resources';state.filters={gallery_id:id};state.q='';state.index=1;return route(true);}
    if(action==='scan' || action==='verify'){const result=await remote(`${state.page}/${id}/${action}`,'POST',{});toast(result.message);return await route();}
    if(action==='retry'){toast((await remote(`${state.page}/${id}/retry-derivatives`,'POST',{})).message);return await route();}
    if(action==='retry-failed' || action==='forget-failed'){const suffix=action==='retry-failed'?'retry':'forget';return confirmAction(suffix==='retry'?'重新执行任务':'删除失败记录',suffix==='retry'?'任务将重新加入 daemon 队列。':'只删除失败记录，不撤销任务已产生的结果。',async()=>{toast((await remote(`tasks/${id}/${suffix}`,'POST',{})).message);});}
    if(action==='restart-worker')return confirmAction('重启队列进程','正在运行的任务完成后，队列进程会退出并由 daemon 重新启动。',async()=>{toast((await remote('worker/restart','POST',{})).message);});
    if(action==='download-backup'){await client.download(state.active,id);return;}
    if(action==='backup'){toast((await remote('backups','POST',{})).message);return await route();}
    if(action==='reset')return modal('重置媒体网站用户密码','新密码由 daemon 保存，密码不会写入审计日志。',[{name:'password',label:'新密码',type:'password',required:true,full:true}],{},async data=>{toast((await remote(`users/${id}/reset-password`,'POST',data)).message);});
    if(action==='delete'){
      const descriptions={users:'删除账号后无法登录。当前连接管理员及最后一名管理员受到保护。',groups:'组内用户将回退到角色默认权限。',sources:'仅移除空目录的登记记录，不删除磁盘文件；有图库或素材的目录无法移除。',galleries:'仅删除空图库记录，不删除磁盘目录。扫描仍启用时，目录可能再次被发现。',resources:'将删除素材及其文件。此操作不可撤销，请确认已经备份。',backups:'永久删除此备份文件，不影响正在运行的数据库。'};
      return confirmAction('确认删除',descriptions[state.page],async()=>{toast((await remote(`${state.page}/${id}`,'DELETE',{})).message);});
    }
  }catch(error){toast(error.message,true);}finally{button.disabled=false;}
});
window.addEventListener('storage',event=>{if(event.key===vaultStorageKey || event.key===null){client.lock();state.ticket++;state.info=null;state.connections=[];state.active=null;$('#dialog').close();initialize();}});
window.addEventListener('resize',fitSidebar);
window.addEventListener('hashchange',()=>route(true));
setInterval(()=>{if(document.visibilityState==='visible' && !$('#dialog').open && state.session?.authenticated && active() && ['overview','tasks','backups'].includes(state.page))route(false,true);},8000);
initialize();
