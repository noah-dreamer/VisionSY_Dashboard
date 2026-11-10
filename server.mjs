// Optional static-file server for local use. No accounts, credentials, proxy or API backend.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), 'public');
const files = { '/': ['index.html','text/html; charset=utf-8'], '/index.html':['index.html','text/html; charset=utf-8'], '/app.js':['app.js','text/javascript; charset=utf-8'], '/client.js':['client.js','text/javascript; charset=utf-8'], '/cloud-client.js':['cloud-client.js','text/javascript; charset=utf-8'], '/crypto.js':['crypto.js','text/javascript; charset=utf-8'], '/style.css':['style.css','text/css; charset=utf-8'], '/logo.png':['logo.png','image/png'], '/favicon.ico':['favicon.ico','image/x-icon'] };
export function createDashboard() {
  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');res.setHeader('Cache-Control','no-store');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: http: https:; connect-src 'self' http: https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    const path = new URL(req.url,'http://dashboard').pathname;
    if (path === '/health' && req.method === 'GET') { res.writeHead(200,{'Content-Type':'application/json'});res.end('{"ok":true,"mode":"static"}');return; }
    const file = ['GET','HEAD'].includes(req.method) && files[path];
    if (!file) { res.writeHead(404);res.end('Not found');return; }
    try { const content = await readFile(join(root,file[0]));res.writeHead(200,{'Content-Type':file[1]});res.end(req.method === 'HEAD' ? undefined : content); }
    catch { res.writeHead(500);res.end('Static asset unavailable'); }
  });
  return { server };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { server } = createDashboard();
  server.listen(Number(process.env.PORT || 8090), process.env.HOST || '0.0.0.0',()=>console.log('VisionSY Dashboard static server ready'));
  for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>process.exit(0)));
}
