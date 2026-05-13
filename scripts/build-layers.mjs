import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import fsExtra from 'fs-extra';
const { copySync, ensureDirSync, removeSync } = fsExtra;

// Get __dirname equivalent in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..');
const serverlessDir = path.resolve(projectRoot, '.serverless');

// Define paths for the renderer layer
const rendererLayerPath = path.resolve(serverlessDir, 'layers', 'abstractplay-renderer');
const rendererNodejsPath = path.resolve(rendererLayerPath, 'nodejs');
const rendererNodeModulesPath = path.resolve(rendererNodejsPath, 'node_modules');

// Ensure the target directory exists and is clean
removeSync(rendererLayerPath); // Clean up any previous layer content
ensureDirSync(rendererNodejsPath);

// 1. Install public dependencies via npm to handle transitive dependencies correctly (like follow-redirects)
console.log('Installing puppeteer-core and @sparticuz/chromium in layer...');
execSync('npm install puppeteer-core@^24.33.0 @sparticuz/chromium@^143.0.0 --no-package-lock --omit=dev', {
    cwd: rendererNodejsPath,
    stdio: 'inherit'
});

// 2. Direct copy the private @development packages from the project root node_modules.
// These were installed by the CI workflow specifically.
const packagesToManualCopy = [
    { name: '@abstractplay/renderer', subPath: ['@abstractplay', 'renderer'] },
    { name: '@abstractplay/gameslib', subPath: ['@abstractplay', 'gameslib'] }
];

packagesToManualCopy.forEach(pkg => {
    console.log(`Manually copying ${pkg.name} (development version) to layer...`);
    const src = path.resolve(projectRoot, 'node_modules', ...pkg.subPath);
    const dest = path.resolve(rendererNodeModulesPath, ...pkg.subPath);
    ensureDirSync(path.dirname(dest));
    copySync(src, dest, { overwrite: true });
});

console.log(`Layer for renderer and browser dependencies built successfully at ${rendererLayerPath}`);