const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 8825);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT 必须是 1–65535 的整数');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.md': 'text/plain; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.zip': 'application/zip' };
const server = http.createServer((request, response) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
  catch (_) { response.writeHead(400).end(); return; }
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  const relative = path.relative(root, file), pieces = relative.split(/[\\/]/);
  if (relative.startsWith('..') || path.isAbsolute(relative) || pieces.some(p => p.startsWith('.') || p === 'node_modules')) {
    response.writeHead(403).end(); return;
  }
  const type = types[path.extname(file).toLowerCase()];
  if (!type) { response.writeHead(404).end(); return; }
  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) { response.writeHead(404).end(); return; }
    let start = 0, end = stat.size - 1, status = 200;
    const range = request.headers.range;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2])) { response.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }).end(); return; }
      if (!match[1]) start = Math.max(0, stat.size - Number(match[2]));
      else { start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])); }
      if (start > end || start >= stat.size) { response.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }).end(); return; }
      status = 206;
    }
    const headers = { 'Content-Type': type, 'Cache-Control': 'no-store', 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 };
    if (status === 206) headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
    response.writeHead(status, headers);
    if (request.method === 'HEAD') { response.end(); return; }
    const stream = fs.createReadStream(file, { start, end });
    stream.on('error', () => response.destroy()); stream.pipe(response);
  });
});
server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? `端口 ${port} 已占用，请通过 PORT 指定其他端口。` : error.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`Spider Playground: http://127.0.0.1:${port}/`));
