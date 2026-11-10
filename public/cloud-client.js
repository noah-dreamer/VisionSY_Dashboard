import { BrowserClient } from './client.js';
import { gcm, sha256 } from './crypto.js';
const encoder=new TextEncoder();
const hex=value=>[...value].map(n=>n.toString(16).padStart(2,'0')).join('');
const random=length=>crypto.getRandomValues(new Uint8Array(length));
const authProof=key=>hex(sha256(new Uint8Array([...encoder.encode('visionsy-dashboard-auth-v1:'),...key])));
const memory=()=>{const map=new Map();return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value)};};
const VAULT='visionsy.browserVault.v1';

export class CloudClient extends BrowserClient {
 constructor(info,{fetchLocal=globalThis.fetch.bind(globalThis),...options}={}){super({...options,storage:memory()});this.cloud=true;this.info=info;this.fetchLocal=fetchLocal;this.csrf=null;this.revision=null;}
 async cloudRequest(path,method='GET',data){
  const response=await this.fetchLocal(path,{method,credentials:'same-origin',cache:'no-store',redirect:'error',headers:{Accept:'application/json',...(data===undefined?{}:{'Content-Type':'application/json'}),...(this.csrf?{'X-CSRF-Token':this.csrf}:{})},body:data===undefined?undefined:JSON.stringify(data)});
  let result;try{result=await response.json();}catch{throw new Error('云端存储返回了无效响应，请稍后重试。');}
  if(!response.ok){if(response.status===401)this.lock();throw new Error(result.message||'云端操作失败。');}return result;
 }
 async unlock(username,password,setup=false,setupToken='') {
  this.lock();this.info=await this.cloudRequest('/api/session');
  if(setup){
   const local=new BrowserClient({storage:memory()});await local.unlock(username,password,true);
   const encrypted=JSON.parse(local.storage.getItem(VAULT));
   const response=await this.cloudRequest('/api/setup','POST',{username,proof:authProof(local.key),vault:encrypted,setup_token:setupToken});
   this.key=local.key;this.salt=local.salt;this.state=local.state;this.version=local.version;this.storage.setItem(VAULT,this.version);
   this.csrf=response.csrf;this.revision=response.revision;this.info.setup_required=false;return this.session();
  }
  if(!this.info.kdf_salt)throw new Error('请先初始化云端管理员账号。');
  const salt=Uint8Array.from(this.info.kdf_salt.match(/../g),n=>parseInt(n,16));
  const key=await this.derive(String(password||''),salt);
  let response;try{response=await this.cloudRequest('/api/login','POST',{username,proof:authProof(key)});}finally{key.fill(0);}
  this.storage.setItem(VAULT,JSON.stringify(response.vault));
  await super.unlock(username,password,false);
  this.csrf=response.csrf;this.revision=response.revision;return this.session();
 }
 session(){return {authenticated:Boolean(this.state),setup_required:this.info.setup_required,username:this.state?.username,cloud:true};}
 async save(){
  const old=this.version;await super.save();
  try{const result=await this.cloudRequest('/api/vault','PUT',{vault:JSON.parse(this.version),revision:this.revision});this.revision=result.revision;}
  catch(error){this.storage.setItem(VAULT,old);this.lock();throw error;}
 }
 async changePassword(data){
  this.assertUnlocked();const current=await this.derive(String(data.current_password||''),this.salt);
  const valid=current.every((n,i)=>n===this.key[i]),currentProof=authProof(current);current.fill(0);
  if(!valid)throw new Error('当前密码不正确。');
  if(typeof data.password!=='string'||data.password.length<10||data.password.length>256)throw new Error('新密码需要 10–256 个字符。');
  const salt=random(16),iv=random(12),key=await this.derive(data.password,salt);
  const vault={v:1,salt:hex(salt),iv:hex(iv),data:hex(gcm(key,iv).encrypt(encoder.encode(JSON.stringify(this.state))))};
  let result;try{result=await this.cloudRequest('/api/password','PUT',{vault,proof:authProof(key),current_proof:currentProof,revision:this.revision});}catch(error){key.fill(0);throw error;}
  this.key.fill(0);this.key=key;this.salt=salt;this.version=JSON.stringify(vault);this.storage.setItem(VAULT,this.version);this.csrf=result.csrf;this.revision=result.revision;
  return {message:'云端管理员密码已更新，其他设备需要重新登录。'};
 }
 async api(path,method='GET',data={}){
  if(path==='/api/session'){this.info=await this.cloudRequest(path);return this.session();}
  if(path==='/api/setup'||path==='/api/login')return this.unlock(data.username,data.password,path==='/api/setup',data.setup_token);
  if(path==='/api/logout'){try{await this.cloudRequest(path,'POST',{});}finally{this.lock();}return {ok:true};}
  if(path==='/api/password')return this.changePassword(data);
  return super.api(path,method,data);
 }
}
export async function createClient(){
 const response=await fetch('/api/session',{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
 if(response.status===404)return new BrowserClient();
 if(!response.ok)throw new Error('云端控制台尚未配置完成或暂时不可用，请稍后刷新。');
 const info=await response.json();if(info.mode!=='cloud')throw new Error('控制台接口版本不兼容。');
 return new CloudClient(info);
}
