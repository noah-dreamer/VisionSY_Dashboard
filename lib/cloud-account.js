const ACCOUNT = 'dashboard:account:v1';
const enc = new TextEncoder();
const hex = bytes => [...new Uint8Array(bytes)].map(n => n.toString(16).padStart(2,'0')).join('');
const random = () => hex(crypto.getRandomValues(new Uint8Array(32)));
const digest = async text => hex(await crypto.subtle.digest('SHA-256',enc.encode(text)));
function equal(a,b) { if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0; }
class HttpError extends Error { constructor(status,message){super(message);this.status=status;} }
const fail=(status,message)=>{throw new HttpError(status,message);};
const json=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',...extra}});
const cookie = value => `__Host-visionsy_dashboard=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${value?43200:0}`;
function vault(value) {
  if(!value||value.v!==1||!/^[a-f0-9]{32}$/.test(value.salt)||!/^[a-f0-9]{24}$/.test(value.iv)||typeof value.data!=='string'||value.data.length<32||value.data.length>1048576||value.data.length%2!==0||!/^[a-f0-9]+$/.test(value.data))fail(422,'加密连接配置格式无效或过大。');
  return {v:1,salt:value.salt,iv:value.iv,data:value.data};
}
const proof = value => typeof value==='string' && /^[a-f0-9]{64}$/.test(value);
async function sign(secret,payload) {
  const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return hex(await crypto.subtle.sign('HMAC',key,enc.encode(payload)));
}
async function session(request,env,account) {
  const value=/(?:^|;\s*)__Host-visionsy_dashboard=([^;]+)/.exec(request.headers.get('Cookie')||'')?.[1];
  if(!value||!account)return null;
  const [payload,signature,...extra]=value.split('.');
  if(extra.length||!equal(signature,await sign(env.DASHBOARD_SESSION_SECRET,payload)))return null;
  try { const parsed=JSON.parse(atob(payload));if(parsed.expires<=Date.now()||parsed.version!==account.version||!parsed.id)return null;return await env.DASHBOARD_KV.get('revoked:'+parsed.id)?null:parsed; }catch{return null;}
}
async function issue(env,account) {
  const data={id:random(),expires:Date.now()+43200000,version:account.version,csrf:random()};
  const payload=btoa(JSON.stringify(data));return {csrf:data.csrf,cookie:cookie(payload+'.'+await sign(env.DASHBOARD_SESSION_SECRET,payload))};
}
async function readBody(request) {
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))fail(415,'需要 JSON 请求。');
  if(Number(request.headers.get('Content-Length'))>1100000)fail(413,'请求过大。');
  const reader=request.body?.getReader();if(!reader)fail(400,'请求内容为空。');
  const chunks=[];let size=0;
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1100000){await reader.cancel();fail(413,'请求过大。');}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  try{return JSON.parse(new TextDecoder().decode(bytes));}catch{fail(400,'JSON 格式无效。');}
}
async function checkProof(account,value){return proof(value)&&equal(account.verifier,await digest(account.authSalt+':'+value));}

export async function handleAccount(request,env) {
 try {
  const url=new URL(request.url),path=url.pathname,method=request.method;
  const allowed={'/api/session':['GET'],'/api/setup':['POST'],'/api/login':['POST'],'/api/logout':['POST'],'/api/vault':['PUT'],'/api/password':['PUT']};
  if(!allowed[path])return json({message:'接口不存在。'},404);
  if(!allowed[path].includes(method))return json({message:'请求方法不支持。'},405);
  if(!env.DASHBOARD_KV||!env.DASHBOARD_SESSION_SECRET)fail(503,'控制台云端存储尚未配置，请联系部署管理员。');
  if(method!=='GET'&&request.headers.get('Origin')!==url.origin)fail(403,'请求来源无效。');
  const account=await env.DASHBOARD_KV.get(ACCOUNT,'json');
  const current=await session(request,env,account);
  if(path==='/api/session')return json({mode:'cloud',authenticated:Boolean(current),setup_required:!account,kdf_salt:account?.vault.salt,csrf:current?.csrf});
  const data=await readBody(request);
  if(path==='/api/setup'||path==='/api/login') {
    // KV counters are a coarse abuse limit, not an atomic distributed lock.
    const ip=request.headers.get('CF-Connecting-IP')||'unknown';
    const bucket=Math.floor(Date.now()/600000),key='login:'+await digest(ip+':'+bucket);
    const attempts=Number(await env.DASHBOARD_KV.get(key)||0);
    if(attempts>=10)fail(429,'尝试次数过多，请十分钟后重试。');
    const username=String(data.username||'').trim();
    if(!username||username.length>80||!proof(data.proof))fail(422,'登录信息格式无效。');
    if(path==='/api/setup') {
      if(account)fail(409,'控制台已初始化，请使用管理员账号登录。');
      if(!env.DASHBOARD_SETUP_HASH||!equal(await digest(String(data.setup_token||'')),env.DASHBOARD_SETUP_HASH)) {
        await env.DASHBOARD_KV.put(key,String(attempts+1),{expirationTtl:600});fail(403,'初始化授权码无效，请使用部署管理员提供的授权码。');
      }
      const value={username,vault:vault(data.vault),authSalt:random(),version:random(),revision:random()};
      value.verifier=await digest(value.authSalt+':'+data.proof);
      await env.DASHBOARD_KV.put(ACCOUNT,JSON.stringify(value));
      const auth=await issue(env,value);return json({vault:value.vault,revision:value.revision,csrf:auth.csrf},200,{'Set-Cookie':auth.cookie});
    }
    if(!account||!equal(username,account.username)||!await checkProof(account,data.proof)) {
      await env.DASHBOARD_KV.put(key,String(attempts+1),{expirationTtl:600});fail(401,'用户名或密码不正确。');
    }
    const auth=await issue(env,account);return json({vault:account.vault,revision:account.revision,csrf:auth.csrf},200,{'Set-Cookie':auth.cookie});
  }
  if(!current)fail(401,'登录已过期，请重新登录。');
  if(!equal(request.headers.get('X-CSRF-Token'),current.csrf))fail(403,'登录校验无效，请重新登录。');
  if(path==='/api/logout'){await env.DASHBOARD_KV.put('revoked:'+current.id,'1',{expirationTtl:43260});return json({ok:true},200,{'Set-Cookie':cookie('')});}
  if(data.revision!==account.revision)fail(409,'连接配置已在其他设备修改，请重新登录后再操作。');
  const updated={...account,vault:vault(data.vault),revision:random()};
  if(path==='/api/password') {
    if(!await checkProof(account,data.current_proof)||!proof(data.proof))fail(422,'当前密码不正确。');
    updated.authSalt=random();updated.verifier=await digest(updated.authSalt+':'+data.proof);updated.version=random();
  }else if(updated.vault.salt!==account.vault.salt)fail(422,'修改连接不能改变解锁密钥。');
  await env.DASHBOARD_KV.put(ACCOUNT,JSON.stringify(updated));
  if(path==='/api/password'){const auth=await issue(env,updated);return json({revision:updated.revision,csrf:auth.csrf},200,{'Set-Cookie':auth.cookie});}
  return json({revision:updated.revision});
 }catch(error){return json({message:error.status?error.message:'云端操作暂时失败，请稍后重试。'},error.status||503);}
}
