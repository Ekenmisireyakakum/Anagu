/**
 * Extract typescript lib files from npm cache into node_modules/typescript
 * without running npm install.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const cacheDir = path.join(process.env.USERPROFILE || 'C:/Users/StarLab', 'AppData/Local/npm-cache/_cacache/content-v2/sha512');
const targetDir = 'C:/Users/StarLab/Desktop/Library/Anagu/node_modules/typescript';

// Walk cache and find gzip files > 5MB (typescript 5.5.4 tgz is ~6.5MB)
function walkSync(dir, results = []) {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fp = path.join(dir, item.name);
    if (item.isDirectory()) {
      walkSync(fp, results);
    } else {
      const size = fs.statSync(fp).size;
      if (size > 5000000 && size < 8000000) {
        results.push({ path: fp, size });
      }
    }
  }
  return results;
}

console.log('Scanning npm cache for large gzip files...');
const candidates = walkSync(cacheDir);
console.log(`Found ${candidates.length} candidate files`);

// For each candidate, peek at the tar to see if it's the typescript package
// A tar entry header starts at byte 0, the filename is the first 100 bytes
function peekTarName(gzipPath) {
  try {
    const compressed = fs.readFileSync(gzipPath);
    const decompressed = zlib.gunzipSync(compressed);
    // First tar header: filename is bytes 0-99
    const name = decompressed.slice(0, 100).toString('ascii').replace(/\0/g, '');
    return name;
  } catch (e) {
    return null;
  }
}

let typescriptTarball = null;
for (const c of candidates) {
  const name = peekTarName(c.path);
  if (name && name.startsWith('package/')) {
    console.log(`  Candidate: ${c.path.slice(-40)} size=${Math.round(c.size/1024)}KB firstEntry=${name}`);
    // Check if it has typescript-specific files
    try {
      const compressed = fs.readFileSync(c.path);
      const content = zlib.gunzipSync(compressed).toString('utf8', 0, 2000);
      if (content.includes('typescript') && content.includes('tsc')) {
        typescriptTarball = c.path;
        console.log(`  >>> Selected as typescript tarball: ${c.path.slice(-40)}`);
        break;
      }
    } catch (e) {}
  }
}

if (!typescriptTarball) {
  console.error('Could not find typescript tarball in npm cache');
  process.exit(1);
}

// Now extract all files from the tarball into targetDir
console.log(`\nExtracting typescript from ${typescriptTarball}...`);

function extractTar(tarBuffer, destDir) {
  let offset = 0;
  let fileCount = 0;
  
  while (offset < tarBuffer.length - 512) {
    const header = tarBuffer.slice(offset, offset + 512);
    
    // Check for end-of-archive (two 512-byte zero blocks)
    if (header.every(b => b === 0)) break;
    
    // Parse filename (first 100 bytes, null-terminated)
    let filename = header.slice(0, 100).toString('ascii').replace(/\0/g, '');
    
    // Parse long name from GNU tar (type 'L')
    const typeflag = String.fromCharCode(header[156]);
    
    // Parse size (octal string in bytes 124-135)
    const sizeOctal = header.slice(124, 136).toString('ascii').replace(/\0/g, '').trim();
    const size = parseInt(sizeOctal, 8) || 0;
    
    offset += 512; // move past header
    
    if (typeflag === 'L') {
      // GNU long name: next block(s) contain the real filename
      const longNameBuf = tarBuffer.slice(offset, offset + size);
      filename = longNameBuf.toString('ascii').replace(/\0/g, '');
      offset += Math.ceil(size / 512) * 512;
      // Now read the actual header for this file
      const realHeader = tarBuffer.slice(offset, offset + 512);
      const realSizeOctal = realHeader.slice(124, 136).toString('ascii').replace(/\0/g, '').trim();
      const realSize = parseInt(realSizeOctal, 8) || 0;
      const realTypeflag = String.fromCharCode(realHeader[156]);
      offset += 512;
      
      if (realTypeflag === '0' || realTypeflag === '' || realTypeflag === '\0') {
        const content = tarBuffer.slice(offset, offset + realSize);
        const relPath = filename.replace(/^package\//, '');
        const destPath = path.join(destDir, relPath);
        const destDirPath = path.dirname(destPath);
        if (!fs.existsSync(destDirPath)) fs.mkdirSync(destDirPath, { recursive: true });
        fs.writeFileSync(destPath, content);
        fileCount++;
      }
      offset += Math.ceil(realSize / 512) * 512;
      continue;
    }
    
    if (typeflag === '0' || typeflag === '' || typeflag === '\0') {
      // Regular file
      const content = tarBuffer.slice(offset, offset + size);
      const relPath = filename.replace(/^package\//, '');
      if (relPath) {
        const destPath = path.join(destDir, relPath);
        const destDirPath = path.dirname(destPath);
        if (!fs.existsSync(destDirPath)) fs.mkdirSync(destDirPath, { recursive: true });
        fs.writeFileSync(destPath, content);
        fileCount++;
        if (fileCount % 50 === 0) process.stdout.write('.');
      }
    } else if (typeflag === '5') {
      // Directory
      const relPath = filename.replace(/^package\//, '');
      if (relPath) {
        const destPath = path.join(destDir, relPath);
        if (!fs.existsSync(destPath)) fs.mkdirSync(destPath, { recursive: true });
      }
    }
    
    offset += Math.ceil(size / 512) * 512;
  }
  
  return fileCount;
}

try {
  const compressed = fs.readFileSync(typescriptTarball);
  console.log(`Read ${Math.round(compressed.length/1024)}KB compressed file`);
  const tarBuffer = zlib.gunzipSync(compressed);
  console.log(`Decompressed to ${Math.round(tarBuffer.length/1024)}KB`);
  
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
  
  const count = extractTar(tarBuffer, targetDir);
  console.log(`\nExtracted ${count} files to ${targetDir}`);
  
  // Verify package.json exists and contains typescript
  const pkgPath = path.join(targetDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    console.log(`Verified: typescript version ${pkg.version}`);
  }
  
  // Verify lib/lib.es2021.full.d.ts exists
  const libPath = path.join(targetDir, 'lib/lib.es2021.full.d.ts');
  if (fs.existsSync(libPath)) {
    console.log('SUCCESS: lib/lib.es2021.full.d.ts found');
  } else {
    console.error('ERROR: lib/lib.es2021.full.d.ts not found after extraction');
    // List what we got in lib/
    const libDir = path.join(targetDir, 'lib');
    if (fs.existsSync(libDir)) {
      const libFiles = fs.readdirSync(libDir).filter(f => f.endsWith('.d.ts')).slice(0, 10);
      console.log('lib/ .d.ts files:', libFiles);
    }
  }
} catch (e) {
  console.error('Extraction failed:', e.message);
  process.exit(1);
}
