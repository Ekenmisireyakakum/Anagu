/**
 * Download and extract specific npm packages that are broken (missing package.json).
 * Uses direct HTTPS + tar extraction without npm.
 */
const https = require('https');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const nodeModulesDir = 'C:/Users/StarLab/Desktop/Library/Anagu/node_modules';

// Packages that need to be fixed (missing package.json)
const toFix = [
  '@babel/core',
];

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

async function getPackageVersion(pkgName) {
  // Check the installed package directory for any clue about the version
  const pkgDir = path.join(nodeModulesDir, pkgName);
  // Try to find version from any existing file
  const indexDts = path.join(pkgDir, 'index.d.ts');
  if (fs.existsSync(indexDts)) {
    const content = fs.readFileSync(indexDts, 'utf8').substring(0, 500);
    const m = content.match(/@(\d+\.\d+\.\d+)/);
    if (m) return m[1];
  }
  
  // For known packages, use specific versions matching the package.json
  const versions = {
    '@babel/types': '7.29.14',
    '@babel/core': '7.29.13',
    '@babel/traverse': '7.29.14',
  };
  return versions[pkgName];
}

async function installPackage(pkgName) {
  const version = await getPackageVersion(pkgName);
  const encodedName = pkgName.replace('/', '%2F');
  const registryUrl = `https://registry.npmjs.org/${pkgName}/${version}`;
  
  console.log(`\n[${pkgName}@${version}] Fetching metadata...`);
  const metaRaw = await httpsGet(registryUrl);
  const meta = JSON.parse(metaRaw.toString());
  const tarball = meta.dist.tarball;
  
  console.log(`[${pkgName}] Downloading ${tarball}...`);
  const compressed = await httpsGet(tarball);
  console.log(`[${pkgName}] Downloaded ${Math.round(compressed.length/1024)}KB, decompressing...`);
  
  const tarData = zlib.gunzipSync(compressed);
  const destDir = path.join(nodeModulesDir, pkgName);
  
  // Don't delete existing files — just overlay (preserves partial install)
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  
  const count = extractTar(tarData, destDir);
  console.log(`[${pkgName}] Extracted ${count} files`);
  
  // Verify package.json
  const pkgJsonPath = path.join(destDir, 'package.json');
  if (fs.existsSync(pkgJsonPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    console.log(`[${pkgName}] OK - version ${pkg.version}`);
  } else {
    console.error(`[${pkgName}] ERROR - package.json still missing`);
  }
}

async function main() {
  for (const pkg of toFix) {
    try {
      await installPackage(pkg);
    } catch (e) {
      console.error(`Failed to install ${pkg}: ${e.message}`);
    }
  }
  console.log('\nAll done!');
}

main();
