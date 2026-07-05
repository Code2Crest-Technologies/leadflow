const fs = require('fs');
const path = require('path');

const root = path.join(process.cwd(), 'apps/backend/src');
const changed = [];

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const file = path.join(dir, name);
    const stat = fs.statSync(file);

    if (stat.isDirectory()) {
      walk(file);
      continue;
    }

    if (!file.endsWith('.ts')) continue;

    const before = fs.readFileSync(file, 'utf8');
    const after = before.replace(
      /(\b(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"])(\.{1,2}\/[^'"]+?)(['"])/g,
      (match, prefix, specifier, quote) => {
        if (/\.(?:js|json|css|node|png|jpg|jpeg|svg)$/.test(specifier)) return match;
        return `${prefix}${specifier}.js${quote}`;
      },
    );

    if (after !== before) {
      fs.writeFileSync(file, after);
      changed.push(path.relative(process.cwd(), file).replace(/\\/g, '/'));
    }
  }
}

walk(root);
console.log(changed.join('\n'));
