const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const suites = ['check', 'gait-check', 'collision-check', 'follow-scroll-check', 'navigation-check', 'articulation-check', 'hunt-check', 'appearance-check', 'performance-check'];
const results = [];
for (const suite of suites) {
  const started = Date.now(); console.log(`\n[验证] ${suite}`);
  const run = spawnSync(process.execPath, [path.join(root, 'tests', suite + '.cjs')], { cwd: root, stdio: 'inherit' });
  results.push({ suite, passed: run.status === 0 && !run.error, elapsedSeconds: (Date.now() - started) / 1000 });
  if (run.error) console.error(run.error.message);
}
const report = { version: require('../package.json').version, createdUtc: new Date().toISOString(),
  sourceSha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'page-crawler.user.js'))).digest('hex'),
  allPassed: results.every(result => result.passed), results };
const output = path.join(root, 'artifacts', 'validation'); fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`\n${report.allPassed ? '全部通过' : '存在失败'}：${results.filter(r => r.passed).length}/${results.length}，详见 artifacts/validation/summary.json`);
process.exitCode = report.allPassed ? 0 : 1;
