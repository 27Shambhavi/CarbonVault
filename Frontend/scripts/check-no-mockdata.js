#!/usr/bin/env node
/**
 * Strict CI Check: Ensures zero references to mockData anywhere in Frontend/src
 * Fails the build immediately if mockData is imported or referenced,
 * or if Frontend/src/data/mockData.js exists.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, '../src');
const mockDataFile = path.resolve(srcDir, 'data/mockData.js');

if (fs.existsSync(mockDataFile)) {
  console.error('\n❌ CI CHECK FAILED: Frontend/src/data/mockData.js exists! All mock data must be eliminated.');
  process.exit(1);
}

function scanDir(dir, violations = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath, violations);
    } else if (/\.(jsx?|tsx?|html)$/.test(entry.name)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (/mockData/i.test(content)) {
        violations.push({ file: fullPath, pattern: 'mockData' });
      }
    }
  }
  return violations;
}

const violations = scanDir(srcDir);
if (violations.length > 0) {
  console.error('\n❌ CI CHECK FAILED: Found prohibited mockData references in source files:');
  for (const v of violations) {
    console.error(`  - ${v.file}`);
  }
  console.error('All data must be fetched dynamically from the live database or backend APIs.\n');
  process.exit(1);
}

console.log('✅ CI Check Passed: Zero mockData imports or files detected across Frontend/src.');
process.exit(0);
