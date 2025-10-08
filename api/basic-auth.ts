import type { VercelRequest, VercelResponse } from '@vercel/node';
import { promises as fs } from 'fs';
import path from 'path';
import mime from 'mime-types';

const DIST_DIRECTORY = path.join(process.cwd(), 'dist');
const INDEX_FILE = path.join(DIST_DIRECTORY, 'index.html');
const REALM = 'Frontline Pricing Demo';

const EXPECTED_USERNAME = process.env.BASIC_AUTH_USERNAME;
const EXPECTED_PASSWORD = process.env.BASIC_AUTH_PASSWORD;

function sendUnauthorized(res: VercelResponse) {
  res.setHeader('WWW-Authenticate', `Basic realm="${REALM}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.status(401).send('Authentication required.');
}

function credentialsAreValid(authHeader: string | undefined): boolean {
  if (!authHeader) {
    return false;
  }

  const [scheme, encoded] = authHeader.split(' ');
  if (scheme !== 'Basic' || !encoded) {
    return false;
  }

  const decoded = Buffer.from(encoded, 'base64').toString('utf8');
  const separatorIndex = decoded.indexOf(':');

  if (separatorIndex === -1) {
    return false;
  }

  const username = decoded.slice(0, separatorIndex);
  const password = decoded.slice(separatorIndex + 1);

  return (
    username === EXPECTED_USERNAME &&
    password === EXPECTED_PASSWORD &&
    typeof EXPECTED_USERNAME === 'string' &&
    typeof EXPECTED_PASSWORD === 'string'
  );
}

async function readStaticAsset(urlPath: string): Promise<{ data: Buffer; contentType: string } | null> {
  const cleanedPath = urlPath.split('?')[0] ?? '/';
  const decodedPath = decodeURI(cleanedPath);
  const relativePath = decodedPath === '/' ? 'index.html' : decodedPath.replace(/^\//, '');
  const normalizedPath = path.normalize(relativePath);

  if (normalizedPath.startsWith('..')) {
    return null;
  }

  const absolutePath = path.join(DIST_DIRECTORY, normalizedPath);

  try {
    const data = await fs.readFile(absolutePath);
    const contentType = mime.contentType(path.extname(absolutePath)) || 'application/octet-stream';
    return { data, contentType };
  } catch (error) {
    if (normalizedPath !== 'index.html') {
      try {
        const data = await fs.readFile(INDEX_FILE);
        return { data, contentType: 'text/html; charset=utf-8' };
      } catch (indexError) {
        return null;
      }
    }

    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!EXPECTED_USERNAME || !EXPECTED_PASSWORD) {
    console.error('Basic auth environment variables are not configured.');
    res.status(500).send('Server configuration error.');
    return;
  }

  if (!credentialsAreValid(req.headers.authorization)) {
    sendUnauthorized(res);
    return;
  }

  if (req.method && !['GET', 'HEAD'].includes(req.method)) {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const asset = await readStaticAsset(req.url ?? '/');

  if (!asset) {
    res.status(404).send('Not Found');
    return;
  }

  res.setHeader('Content-Type', asset.contentType);
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'HEAD') {
    res.status(200).end();
    return;
  }

  res.send(asset.data);
}
