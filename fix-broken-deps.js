/**
 * Iteratively fix broken npm packages by downloading them from registry.
 * Run repeatedly until no more missing packages.
 */
const https = require('https');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const nodeModulesDir = 'C:/Users/StarLab/Desktop/Library/Anagu/node_modules';

// Packages specified on command line, or find broken ones automatically
const toFix = process.argv.slice(2);

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 30000 }, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        return resolve(httpsGet(res.headers.location));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout: ' + url)); });
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

async function getLatestVersion(pkgName) {
  // Try to get version from installed dependents
  // Fall back to registry
  const metaRaw = await httpsGet(`https://registry.npmjs.org/${pkgName}/latest`);
  const meta = JSON.parse(metaRaw.toString());
  return meta.version;
}

async function installPackage(pkgName, version) {
  if (!version) {
    version = await getLatestVersion(pkgName);
    console.log(`[${pkgName}] Latest version: ${version}`);
  }
  
  const registryUrl = `https://registry.npmjs.org/${pkgName}/${version}`;
  console.log(`[${pkgName}@${version}] Downloading...`);
  
  const metaRaw = await httpsGet(registryUrl);
  const meta = JSON.parse(metaRaw.toString());
  const tarball = meta.dist.tarball;
  
  const compressed = await httpsGet(tarball);
  const tarData = zlib.gunzipSync(compressed);
  const destDir = path.join(nodeModulesDir, pkgName);
  
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  const count = extractTar(tarData, destDir);
  
  const pkgJsonPath = path.join(destDir, 'package.json');
  if (fs.existsSync(pkgJsonPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    console.log(`[${pkgName}] OK - version ${pkg.version}, ${count} files`);
  } else {
    console.error(`[${pkgName}] ERROR - package.json missing after extraction`);
  }
}

async function main() {
  for (const spec of toFix) {
    const [name, version] = spec.includes('@') && !spec.startsWith('@') 
      ? spec.split('@')
      : [spec, undefined];
    // Handle scoped packages like @babel/core@7.x
    let pkgName = spec;
    let pkgVersion = undefined;
    if (spec.startsWith('@')) {
      const parts = spec.split('@');
      // @scope/name or @scope/name@version
      if (parts.length === 3) {
        pkgName = `@${parts[1]}`;
        pkgVersion = parts[2];
      } else {
        pkgName = `@${parts[1]}`;
      }
    } else {
      const atIdx = spec.indexOf('@');
      if (atIdx > 0) {
        pkgName = spec.substring(0, atIdx);
        pkgVersion = spec.substring(atIdx + 1);
      }
    }
    
    try {
      await installPackage(pkgName, pkgVersion);
    } catch (e) {
      console.error(`Failed ${pkgName}: ${e.message}`);
    }
  }
  console.log('Done');
}

main();
