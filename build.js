/**
 * Simple build script to copy extension files to build directory
 */

const fs = require('fs');
const path = require('path');

const buildDir = path.join(__dirname, 'build');
const srcDir = path.join(__dirname, 'src');

// Clean build directory
if (fs.existsSync(buildDir)) {
  fs.rmSync(buildDir, { recursive: true });
}

// Create build directory
fs.mkdirSync(buildDir, { recursive: true });

// Copy manifest.json
fs.copyFileSync(
  path.join(__dirname, 'manifest.json'),
  path.join(buildDir, 'manifest.json')
);

// Copy src directory
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyDir(srcDir, buildDir);

// Copy assets directory (icons)
const assetsDir = path.join(__dirname, 'assets');
if (fs.existsSync(assetsDir)) {
  const buildAssetsDir = path.join(buildDir, 'assets');
  copyDir(assetsDir, buildAssetsDir);
  console.log('✅ Assets copied');
}

console.log('✅ Build completed successfully!');
console.log('📁 Output directory:', buildDir);
console.log('\nNext steps:');
console.log('1. Add icon images to build/assets/icons/');
console.log('2. Load unpacked extension from build/ directory in Chrome');
console.log('3. Navigate to chrome://extensions/');
console.log('4. Enable "Developer mode"');
console.log('5. Click "Load unpacked" and select the build/ folder');
