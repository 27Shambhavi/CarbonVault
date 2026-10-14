#!/usr/bin/env node
/**
 * CarbonVault — Automated CI Hardcode Gate
 * Scans codebase for banned static domain constants, fake corporate entities,
 * fabricated climate claims, and mock data arrays outside of tests/ and seed.py.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let candidateDir = path.resolve(__dirname, '..');
if (!fs.existsSync(path.join(candidateDir, 'Backend')) && fs.existsSync(path.join(candidateDir, '..', 'Backend'))) {
  candidateDir = path.resolve(candidateDir, '..');
}
const rootDir = candidateDir;

const EXEMPT_PATHS = [
  'node_modules',
  '.git',
  'dist',
  'docs',
  'scripts',
  'tests',
  'Backend/tests',
  'Backend/seed.py',
  'Backend/routers/config_router.py', // Allowed because it initializes SystemConfig seed schema
  'Backend/test_backend_endpoints.py',
];

const SCAN_DIRS = [
  path.join(rootDir, 'Frontend', 'src'),
  path.join(rootDir, 'Backend'),
  path.join(rootDir, 'src'),
].filter((d) => fs.existsSync(d));

// Rules and banned patterns
const BANNED_PATTERNS = [
  {
    name: 'Hardcoded INR FX Rate (83.5 / 83.50)',
    regex: /(?<!fallback_rate\s*=\s*)(?<!rate\s*else\s*)\b83\.50?\b/g,
    description: 'Use dynamic FX rates from get_current_inr_rate() or fetchLiveFxRate() instead of static 83.5',
    exemptFiles: ['Backend/routers/config_router.py', 'Backend/routers/payment_router.py', 'Backend/credit_calculation/credits_module/funding_engine.py', 'Backend/routers/marketplace_router.py']
  },
  {
    name: 'Fabricated 49,400 tonnes Portfolio Holding',
    regex: /\b49,?400\b/g,
    description: 'Fabricated corporate holding. Aggregate from real database transactions instead.',
  },
  {
    name: 'Fabricated 89 GWh Renewable Generation Claim',
    regex: /\b89\s*GWh\b/i,
    description: 'Fabricated renewable energy metric. Eradicate or query approved project telemetry.',
  },
  {
    name: 'Ungrounded 99.9% Fraud-Free Claim',
    regex: /99\.9%\s*(fraud-free|accuracy|uptime)/i,
    description: 'Unverifiable promotional claim. Use verifiable empirical benchmark figures.',
  },
  {
    name: 'Fabricated ISO 14001 Certified Tick',
    regex: /ISO\s*14001\s*certified/i,
    description: 'Unverified ISO certification. Use informational reporting_frameworks_aligned with disclaimers.',
  },
  {
    name: 'Fake Prototype Entity (GreenForest)',
    regex: /\bGreenForest(\s*Corp)?\b/i,
    description: 'Synthetic company entity. Use real registered user accounts or empty states.',
  },
  {
    name: 'Mock Data Arrays in Production',
    regex: /\bmockPublicLeaderboard\b/g,
    description: 'Hardcoded leaderboard array. Query dynamic GRS leaderboard endpoint.',
  },
];

function shouldExempt(filePath) {
  const relPath = path.relative(rootDir, filePath).replace(/\\/g, '/');
  return EXEMPT_PATHS.some((exempt) => relPath === exempt || relPath.startsWith(exempt + '/'));
}

function scanFile(filePath, violations) {
  const relPath = path.relative(rootDir, filePath).replace(/\\/g, '/');
  const ext = path.extname(filePath);
  if (!['.js', '.jsx', '.ts', '.tsx', '.py', '.json', '.html'].includes(ext)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  for (const rule of BANNED_PATTERNS) {
    if (rule.exemptFiles && rule.exemptFiles.some((ef) => relPath === ef || relPath.endsWith(ef))) {
      continue;
    }

    lines.forEach((lineText, lineIdx) => {
      // Skip pure comments
      const trimmed = lineText.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*')) {
        return;
      }

      rule.regex.lastIndex = 0;
      if (rule.regex.test(lineText)) {
        violations.push({
          file: relPath,
          line: lineIdx + 1,
          rule: rule.name,
          description: rule.description,
          snippet: trimmed.slice(0, 100),
        });
      }
    });
  }
}

function walkDir(dir, violations) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (shouldExempt(fullPath)) continue;

    if (entry.isDirectory()) {
      walkDir(fullPath, violations);
    } else {
      scanFile(fullPath, violations);
    }
  }
}

console.log('🔍 [CarbonVault CI Gate] Scanning codebase for hardcoded constants, fake entities, and mock data...');
const violations = [];
for (const dir of SCAN_DIRS) {
  walkDir(dir, violations);
}

if (violations.length > 0) {
  console.error(`\n❌ CI HARDCODE GATE FAILED: Found ${violations.length} prohibited hardcoded patterns:\n`);
  violations.forEach((v, idx) => {
    console.error(`  ${idx + 1}. [${v.rule}]`);
    console.error(`     File: ${v.file}:${v.line}`);
    console.error(`     Code: ${v.snippet}`);
    console.error(`     Fix:  ${v.description}\n`);
  });
  console.error('All domain values must reside in system_config, database tables, or environment variables.\n');
  process.exit(1);
}

console.log('✅ CI Hardcode Gate Passed: Zero banned domain constants, fake entities, or mock data detected.');
process.exit(0);
