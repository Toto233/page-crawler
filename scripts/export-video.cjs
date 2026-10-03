const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const input = process.argv[2], name = process.argv[3];
if (!input || !['hunt', 'walk'].includes(name)) { console.error('用法：npm run export:video -- <录制得到的.webm路径> hunt|walk'); process.exit(1); }
const source = path.resolve(input);
if (!fs.existsSync(source)) { console.error('录制文件不存在：' + source); process.exit(1); }
const output = path.join(root, 'assets', 'videos', name + '.mp4');
fs.mkdirSync(path.dirname(output), { recursive: true });
const run = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', source, '-c:v', 'libx264', '-crf', '21', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', output], { stdio: 'inherit' });
if (run.error) console.error('无法运行 ffmpeg，请先安装并加入 PATH。');
if (run.status !== 0 || run.error) process.exit(1);
console.log(output);
