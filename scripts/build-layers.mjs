import path from 'path';
import { fileURLToPath } from 'url';
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
ensureDirSync(rendererNodeModulesPath);

const packagesToCopy = [
    { name: '@abstractplay/renderer', subPath: ['@abstractplay', 'renderer'] },
    { name: 'puppeteer-core', subPath: ['puppeteer-core'] },
    { name: '@sparticuz/chromium', subPath: ['@sparticuz', 'chromium'] }
];

packagesToCopy.forEach(pkg => {
    console.log(`Copying ${pkg.name} to layer...`);
    const src = path.resolve(projectRoot, 'node_modules', ...pkg.subPath);
    const dest = path.resolve(rendererNodeModulesPath, ...pkg.subPath);
    copySync(src, dest, { overwrite: true });
});

console.log(`Layer for renderer and browser dependencies built successfully at ${rendererLayerPath}`);