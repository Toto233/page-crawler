const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..'), manifest = require('../package.json');
const dist = path.join(root, 'dist'); fs.mkdirSync(dist, { recursive: true });
const output = path.join(dist, `page-crawler-v${manifest.version}.zip`);
const report = { version: manifest.version, createdUtc: new Date().toISOString(),
  sourceSha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'page-crawler.user.js'))).digest('hex'),
  validation: fs.existsSync(path.join(root, 'artifacts/validation/summary.json')) ? JSON.parse(fs.readFileSync(path.join(root, 'artifacts/validation/summary.json'), 'utf8')) : null,
  projectValidation: fs.existsSync(path.join(root, 'artifacts/validation/project-results.json')) ? JSON.parse(fs.readFileSync(path.join(root, 'artifacts/validation/project-results.json'), 'utf8')) : null };
fs.writeFileSync(path.join(root, 'release-manifest.json'), JSON.stringify(report, null, 2) + '\n');
const files = ['index.html', 'gallery.html', 'page-crawler.user.js', 'README.md', 'package.json', 'package-lock.json',
  '.gitignore', '.editorconfig', '.gitattributes', 'release-manifest.json', 'docs', 'scripts', 'tests', 'assets'];
// All archives are made from this explicit list; node_modules, .git and raw
// capture files never enter the package. Arguments are passed without a shell.
let run;
if (process.platform === 'win32') {
  const literal = value => "'" + value.replaceAll("'", "''") + "'";
  const entries = [];
  const collect = relative => {
    const fullPath = path.join(root, relative), stat = fs.lstatSync(fullPath);
    if (stat.isSymbolicLink()) throw new Error('打包目录不接受符号链接：' + relative);
    if (stat.isDirectory()) for (const child of fs.readdirSync(fullPath).sort()) collect(relative + '/' + child);
    else entries.push({ fullPath, name: relative.replaceAll('\\', '/') });
  };
  files.forEach(collect);
  const listing = path.join(dist, 'package-files.json'); fs.writeFileSync(listing, JSON.stringify(entries));
  if (fs.existsSync(output)) fs.unlinkSync(output);
  const command = `$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.IO.Compression; Add-Type -AssemblyName System.IO.Compression.FileSystem; $taskZip=[IO.Compression.ZipFile]::Open(${literal(output)},[IO.Compression.ZipArchiveMode]::Create); try { foreach($taskEntry in (Get-Content -LiteralPath ${literal(listing)} -Raw | ConvertFrom-Json)) { [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($taskZip,$taskEntry.fullPath,$taskEntry.name) | Out-Null } } finally { $taskZip.Dispose() }`;
  run = spawnSync('powershell.exe', ['-NoProfile', '-Command', command], { cwd: root, stdio: 'inherit', windowsHide: true });
  fs.unlinkSync(listing);
} else {
  if (fs.existsSync(output)) fs.unlinkSync(output);
  run = spawnSync('zip', ['-q', '-r', output, ...files], { cwd: root, stdio: 'inherit' });
}
if (run.error) console.error(run.error.message);
if (run.status !== 0 || run.error) process.exit(1);
console.log(output);
