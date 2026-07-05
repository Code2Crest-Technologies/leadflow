const fs = require('fs');
const path = require('path');

const bad = [];

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const file = path.join(dir, name);
    const stat = fs.statSync(file);
    if (stat.isDirectory()) {
      walk(file);
      continue;
    }
    if (!file.endsWith('.ts')) continue;

    const text = fs.readFileSync(file, 'utf8');
    for (const match of text.matchAll(/(?:from\s+['"]|import\(['"])(\.{1,2}\/[^'"]+)/g)) {
      if (!/\.(js|json|css|node|png|jpg|jpeg|svg)$/.test(match[1])) {
        bad.push(`${file}: ${match[1]}`);
      }
    }
  }
}

walk('apps/backend/src');
console.log(bad.join('\n'));
process.exit(bad.length ? 1 : 0);
