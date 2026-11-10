import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(frontendRoot, '.env');
const outputPath = resolve(
  frontendRoot,
  'src/app/config/api-url.generated.ts',
);

function parseEnv(contents) {
  return Object.fromEntries(
    contents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const separator = line.indexOf('=');
        if (separator < 0) {
          return ['', ''];
        }

        const key = line.slice(0, separator).trim();
        let value = line.slice(separator + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        return [key, value];
      })
      .filter(([key]) => key),
  );
}

let fileEnv = {};
try {
  fileEnv = parseEnv(await readFile(envPath, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') {
    throw error;
  }
}

const apiUrl = process.env.API_URL ?? fileEnv.API_URL;
if (!apiUrl) {
  throw new Error(
    'API_URL is required. Set it in frontend/.env locally or in the deployment environment.',
  );
}

let parsedUrl;
try {
  parsedUrl = new URL(apiUrl);
} catch {
  throw new Error('API_URL must be an absolute HTTP or HTTPS URL.');
}

if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
  throw new Error('API_URL must use HTTP or HTTPS.');
}

if (process.env.VERCEL && parsedUrl.hostname === 'localhost') {
  throw new Error('Set API_URL to the deployed backend URL in Vercel.');
}

const normalizedUrl = apiUrl.replace(/\/+$/, '');
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  `// Generated from API_URL. Do not edit.\nexport const API_URL = ${JSON.stringify(normalizedUrl)};\n`,
);
