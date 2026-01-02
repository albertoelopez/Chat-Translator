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

// Create placeholder icons
const iconsDir = path.join(buildDir, 'assets', 'icons');
fs.mkdirSync(iconsDir, { recursive: true });

// Create simple SVG icons (for now)
const svgIcon = `<svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
  <rect width="128" height="128" fill="#667eea" rx="24"/>
  <text x="64" y="80" font-size="64" text-anchor="middle" fill="white">🌐</text>
</svg>`;

// For a real extension, you'd use proper PNG icons
// For now, create a note file
fs.writeFileSync(
  path.join(iconsDir, 'README.txt'),
  'Add icon16.png, icon32.png, icon48.png, and icon128.png here\n' +
  'You can create them at https://icon.kitchen or use any image editor'
);

console.log('✅ Build completed successfully!');
console.log('📁 Output directory:', buildDir);
console.log('\nNext steps:');
console.log('1. Add icon images to build/assets/icons/');
console.log('2. Load unpacked extension from build/ directory in Chrome');
console.log('3. Navigate to chrome://extensions/');
console.log('4. Enable "Developer mode"');
console.log('5. Click "Load unpacked" and select the build/ folder');
