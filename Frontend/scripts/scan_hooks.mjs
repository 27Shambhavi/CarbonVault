import fs from 'fs';
import path from 'path';

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(full));
    } else if (full.endsWith('.jsx') || full.endsWith('.js')) {
      results.push(full);
    }
  });
  return results;
}

const files = walk('./src');
console.log('Scanning', files.length, 'files for possible hook violations...');

const hookRegex = /\buse[A-Z][a-zA-Z0-9]*\s*\(/;

let found = 0;
files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  let hasReturn = false;
  let returnLine = 0;
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (/^if\s*\(.*(loading|error|!user|!project|!profile|!data).*\)\s*return\b/.test(trimmed)) {
      hasReturn = true;
      returnLine = idx + 1;
    }
    // Reset on new function
    if (/^export\s+(default\s+)?function\b/.test(trimmed) || /^function\s+[A-Z]/.test(trimmed)) {
      hasReturn = false;
    }
    if (hasReturn && hookRegex.test(trimmed)) {
      console.log(`[POTENTIAL HOOK VIOLATION] ${file}:${idx + 1} hook after early return (line ${returnLine}):\n  ${trimmed}`);
      found++;
    }
  });
});
console.log('Scan complete. Found:', found);
