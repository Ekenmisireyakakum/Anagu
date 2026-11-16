/**
 * Install TypeScript by downloading from registry with Node.js http directly
 * and extracting the tarball - no npm needed.
 */
const https = require('https');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const targetDir = 'C:/Users/StarLab/Desktop/Library/Anagu/node_modules/typescript';

// First get the registry metadata to find the tarball URL
const registryUrl = 'https://registry.npmjs.org/typescript/5.5.4';

console.log('Fetching typescript@5.5.4 metadata from registry...');

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 15000 }, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        return resolve(httpsGet(res.headers.location));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    req.on('error', reject);
  });
}

function extractTar(tarBuffer, destDir) {
  let offset = 0;
  let fileCount = 0;
  
  while (offset + 512 <= tarBuffer.length) {
    const header = tarBuffer.slice(offset, offset + 512);
    if (header.every(b => b === 0)) break;
    
    let filename = header.slice(0, 100).toString('ascii').replace(/\0/g, '');
    const typeflag = String.fromCharCode(header[156]);
    const sizeStr = header.slice(124, 136).toString('ascii').replace(/\0/g, '').trim();
    let size = parseInt(sizeStr, 8) || 0;
    
    offset += 512;
    
    if (typeflag === 'L') {
      const longName = tarBuffer.slice(offset, offset + size).toString('ascii').replace(/\0/g, '');
      filename = longName;
      offset += Math.ceil(size / 512) * 512;
      const rh = tarBuffer.slice(offset, offset + 512);
      size = parseInt(rh.slice(124, 136).toString('ascii').replace(/\0/g, '').trim(), 8) || 0;
      offset += 512;
    }
    
    if (typeflag === '0' || typeflag === '' || typeflag === '\0' || typeflag === '\x00') {
      const content = tarBuffer.slice(offset, offset + size);
      const relPath = filename.replace(/^package\//, '');
      if (relPath) {
        const destPath = path.join(destDir, relPath.replace(/\//g, path.sep));
        const dirPath = path.dirname(destPath);
        if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
        fs.writeFileSync(destPath, content);
        fileCount++;
        if (fileCount % 100 === 0) process.stdout.write(`\r  Extracted ${fileCount} files...`);
      }
    } else if (typeflag === '5') {
      const relPath = filename.replace(/^package\//, '');
      if (relPath) {
        const destPath = path.join(destDir, relPath.replace(/\//g, path.sep));
        if (!fs.existsSync(destPath)) fs.mkdirSync(destPath, { recursive: true });
      }
    }
    
    offset += Math.ceil(size / 512) * 512;
  }
  return fileCount;
}

async function main() {
  try {
    const metaRaw = await httpsGet(registryUrl);
    const meta = JSON.parse(metaRaw.toString());
    const tarball = meta.dist.tarball;
    console.log(`Downloading tarball: ${tarball}`);
    
    const compressed = await httpsGet(tarball);
    console.log(`Downloaded ${Math.round(compressed.length/1024)}KB`);
    
    const tarData = zlib.gunzipSync(compressed);
    console.log(`Decompressed to ${Math.round(tarData.length/1024)}KB`);
    
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
    const count = extractTar(tarData, targetDir);
    console.log(`\nExtracted ${count} files`);
    
    const libPath = path.join(targetDir, 'lib/lib.es2021.full.d.ts');
    console.log('lib check:', fs.existsSync(libPath) ? 'OK' : 'MISSING');
    console.log('SUCCESS');
  } catch (e) {
    console.error('FAILED:', e.message);
    process.exit(1);
  }
}

main();
