const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const names = ['preview-desktop.png', 'preview-mobile.png', 'preview-hunt-airborne.png', 'preview-hunt-feeding.png', 'preview-hunt.png', 'preview-motion.png', 'preview-cyber.png', 'preview-ghost.png', 'preview-ghost-dark.png', 'preview-ghost-pounce.png', 'preview-marbled.png'];
for (const name of names) {
  const source = path.join(root, 'artifacts', 'validation', name);
  if (fs.existsSync(source)) { fs.copyFileSync(source, path.join(root, 'assets', 'images', name)); console.log(name); }
}
