import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let scriptPath = path.resolve(__dirname, '..', '..', 'scripts', 'check-hardcoded.mjs');
if (!fs.existsSync(scriptPath)) {
  scriptPath = path.resolve(__dirname, 'check-hardcoded.mjs');
}

await import(`file://${scriptPath.replace(/\\/g, '/')}`);
