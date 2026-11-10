import { gcm, pbkdf2Async, sha256 } from './crypto.js';

const VAULT = 'visionsy.browserVault.v1';
const encoder = new TextEncoder(), decoder = new TextDecoder();
const hex = value => Array.from(value, n => n.toString(16).padStart(2, '0')).join('');
const unhex = value => {
  if (typeof value !== 'string' || !/^(?:[a-f0-9]{2})+$/.test(value)) throw new Error('连接存储已损坏。');
  return Uint8Array.from(value.match(/../g), n => parseInt(n, 16));
};
const random = length => globalThis.crypto.getRandomValues(new Uint8Array(length));
const blank = username => ({ username, connections: [], activeId: null });
export function validateConnection(data, previous) {
  const name = String(data.name ?? '').trim(), host = String(data.host ?? '').trim().replace(/^\[|\]$/g, '');
  const protocol = data.protocol ?? 'http', port = Number(data.port ?? (protocol === 'https' ? 443 : 80));
  if (!name || name.length > 80) throw new Error('连接名称应为 1–80 个字符。');
  if (!['http', 'https'].includes(protocol) || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error('请填写有效的协议和端口。');
  if (!host || host.length > 253 || !/^[a-zA-Z0-9.:[\]_-]+$/.test(host) || /^(0\.0\.0\.0|169\.254\.|fe80:)/i.test(host)) throw new Error('请输入 daemon 的 IP 或域名，不包含协议、路径或用户名。');
  let baseUrl;
  try { baseUrl = new URL(`${protocol}://${host.includes(':') ? `[${host}]` : host}:${port}`).origin; }
  catch { throw new Error('daemon 地址格式无效。'); }
  const token = String(data.token || previous?.token || '');
  if (!/^vsy_[a-f0-9]{12}\.[a-f0-9]{64}$/.test(token)) throw new Error('请填写 daemon 生成的完整连接密钥。');
  return { name, host, protocol, port, baseUrl, token };
}

export class BrowserClient {
  constructor({ storage = globalThis.localStorage, fetchRemote = globalThis.fetch.bind(globalThis), pageProtocol = globalThis.location?.protocol } = {}) {
    this.storage = storage; this.fetchRemote = fetchRemote; this.pageProtocol = pageProtocol;
    this.state = null; this.key = null; this.salt = null; this.version = null;
  }
  session() { return { authenticated: Boolean(this.state), setup_required: !this.storage.getItem(VAULT), username: this.state?.username }; }
  lock() { this.key?.fill(0); this.key = null; this.state = null; this.salt = null; this.version = null; }
  async derive(password, salt) { return pbkdf2Async(sha256, encoder.encode(password), salt, { c: 600000, dkLen: 32, asyncTick: 10 }); }
  async unlock(username, password, setup = false) {
    username = String(username || '').trim(); password = String(password || '');
    if (!username || username.length > 80 || password.length < 10 || password.length > 256) throw new Error('请输入用户名和 10–256 个字符的密码。');
    const raw = this.storage.getItem(VAULT);
    if (setup && raw) throw new Error('当前浏览器已初始化，请登录。');
    const saved = raw ? JSON.parse(raw) : null;
    if (!setup && !saved) throw new Error('请先创建当前浏览器的控制台账号。');
    if (saved && saved.v !== 1) throw new Error('连接存储版本不兼容。');
    const salt = saved ? unhex(saved.salt) : random(16), key = await this.derive(password, salt);
    let value;
    try { value = saved ? JSON.parse(decoder.decode(gcm(key, unhex(saved.iv)).decrypt(unhex(saved.data)))) : blank(username); }
    catch { key.fill(0); throw new Error('用户名或密码不正确，或连接存储已损坏。'); }
    if (value.username !== username) { key.fill(0); throw new Error('用户名或密码不正确。'); }
    // Another tab may have changed the vault while password derivation was running.
    if (this.storage.getItem(VAULT) !== raw) { key.fill(0); throw new Error('连接配置已在其他标签页更新，请重试。'); }
    this.key = key; this.salt = salt; this.state = value; this.version = raw;
    if (setup) await this.save();
    return this.session();
  }
  assertUnlocked() {
    if (!this.state) throw new Error('请先解锁当前浏览器的管理控制台。');
    if (this.storage.getItem(VAULT) !== this.version) { this.lock(); throw new Error('连接配置已在其他标签页更新，请重新登录。'); }
  }
  async save() {
    this.assertUnlocked();
    const iv = random(12), encrypted = gcm(this.key, iv).encrypt(encoder.encode(JSON.stringify(this.state)));
    const serialized = JSON.stringify({ v: 1, salt: hex(this.salt), iv: hex(iv), data: hex(encrypted) });
    try { this.storage.setItem(VAULT, serialized); this.version = serialized; }
    catch { this.lock(); throw new Error('浏览器无法保存连接，请检查网站存储权限及剩余空间。'); }
  }
  connections() { return { data: this.state.connections.map(({ token, ...record }) => ({ ...record, has_token: Boolean(token) })), active_id: this.state.activeId }; }
  connection(id) { const record = this.state.connections.find(c => c.id === id); if (!record) throw new Error('未找到 daemon 连接。'); return record; }
  candidate(data) { return validateConnection(data, data.id ? this.connection(data.id) : null); }
  async request(connection, path, method = 'GET', data, download = false) {
    if (!/^(info|overview|mail(?:\/test)?|users(?:\/\d+(?:\/reset-password)?)?|groups(?:\/\d+)?|sources(?:\/\d+(?:\/(?:scan|verify))?)?|galleries(?:\/\d+(?:\/(?:scan|retry-derivatives))?)?|resources(?:\/\d+(?:\/retry-derivatives)?)?|tasks(?:\/[a-f0-9-]{36}\/(?:retry|forget))?|worker\/restart|audit|backups(?:\/[a-f0-9-]{36}(?:\/download)?)?)(?:\?[^#]*)?$/.test(path)) throw new Error('管理接口不存在。');
    if (this.pageProtocol === 'https:' && connection.protocol !== 'https') throw new Error('当前面板使用 HTTPS，请为 daemon 配置 HTTPS，或在本机测试时使用 HTTP 面板。');
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), download ? 3600000 : 30000);
    try {
      const response = await this.fetchRemote(`${connection.baseUrl}/api/management/v1/${path}`, {
        method, mode: 'cors', credentials: 'omit', redirect: 'error', cache: 'no-store', signal: controller.signal,
        headers: { Accept: 'application/json', Authorization: `Bearer ${connection.token}`, ...(data === undefined ? {} : { 'Content-Type': 'application/json' }) },
        body: data === undefined ? undefined : JSON.stringify(data),
      });
      if (download && response.ok) return { blob: await response.blob(), disposition: response.headers.get('content-disposition') };
      let result;
      try { result = await response.json(); } catch { throw new Error('daemon 未返回有效的管理 API 响应，请检查地址。'); }
      if (!response.ok) throw new Error(response.status >= 500 ? 'daemon 处理失败，请检查服务状态。' : (result.errors ? Object.values(result.errors).flat().join('；') : result.message) || `请求失败（${response.status}）`);
      return result;
    } catch (error) {
      if (error.name === 'TypeError' || error.name === 'AbortError') throw new Error('浏览器无法连接 daemon，请检查地址、端口、HTTPS 证书、允许的面板来源及浏览器本地网络权限。');
      throw error;
    } finally { clearTimeout(timer); }
  }
  async probe(connection) {
    const started = Date.now(), info = await this.request(connection, 'info');
    if (info.product !== 'visionsy-daemon' || info.api_version !== 1) throw new Error('daemon 的管理 API 版本与此控制台不兼容。');
    return { ...info, latency_ms: Date.now() - started };
  }
  async api(path, method = 'GET', data = {}) {
    if (path === '/api/session') return this.session();
    if (path === '/api/setup' || path === '/api/login') return this.unlock(data.username, data.password, path === '/api/setup');
    if (path === '/api/logout') { this.lock(); return { ok: true }; }
    this.assertUnlocked();
    if (path === '/api/password' && method === 'PUT') {
      const verified = await this.derive(String(data.current_password || ''), this.salt);
      const matches = verified.every((n, i) => n === this.key[i]); verified.fill(0);
      if (!matches) throw new Error('当前密码不正确。');
      if (typeof data.password !== 'string' || data.password.length < 10 || data.password.length > 256) throw new Error('新密码需要 10–256 个字符。');
      const salt = random(16), key = await this.derive(data.password, salt);
      this.assertUnlocked(); this.key.fill(0); this.key = key; this.salt = salt; await this.save();
      return { message: '当前浏览器的连接解锁密码已更新。' };
    }
    if (path === '/api/connections/test') return this.probe(this.candidate(data));
    if (path === '/api/connections') {
      if (method === 'GET') return this.connections();
      const connection = this.candidate(data), id = data.id || hex(random(16)).replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
      const index = this.state.connections.findIndex(c => c.id === id), record = { ...connection, id };
      if (index < 0) this.state.connections.push(record); else this.state.connections[index] = record;
      this.state.activeId = id; await this.save(); return this.connections();
    }
    const match = /^\/api\/connections\/([a-f0-9-]{36})(?:\/(activate|test))?$/.exec(path);
    if (match) {
      const connection = this.connection(match[1]);
      if (match[2] === 'test') return this.probe(connection);
      if (match[2] === 'activate') this.state.activeId = connection.id;
      else if (method === 'DELETE') { this.state.connections = this.state.connections.filter(c => c.id !== connection.id); if (this.state.activeId === connection.id) this.state.activeId = this.state.connections[0]?.id || null; }
      else throw new Error('操作不存在。');
      await this.save(); return { ok: true };
    }
    throw new Error('操作不存在。');
  }
  async remote(id, path, method = 'GET', data) { this.assertUnlocked(); return this.request(this.connection(id), path, method, data); }
  async download(id, backupId) {
    this.assertUnlocked();
    const { blob, disposition } = await this.request(this.connection(id), `backups/${backupId}/download`, 'GET', undefined, true);
    const filename = /filename="?([^";]+)"?/i.exec(disposition || '')?.[1] || 'visionsy-backup.sql.gz';
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = filename.replace(/[\\/\x00-\x1f]/g, '_');
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}
export const vaultStorageKey = VAULT;
