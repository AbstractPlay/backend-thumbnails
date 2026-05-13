import { copySync, ensureDirSync, removeSync } from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..');
const serverlessDir = path.resolve(projectRoot, '.serverless');

// Define paths for the renderer layer
const rendererLayerPath = path.resolve(serverlessDir, 'layers', 'abstractplay-renderer');
const rendererNodejsPath = path.resolve(rendererLayerPath, 'nodejs');
const rendererNodeModulesPath = path.resolve(rendererNodejsPath, 'node_modules');
const rendererSourcePath = path.resolve(projectRoot, 'node_modules', '@abstractplay', 'renderer');

// Ensure the target directory exists and is clean
removeSync(rendererLayerPath); // Clean up any previous layer content
ensureDirSync(rendererNodeModulesPath);

console.log(`Building layer for @abstractplay/renderer...`);

// Copy the installed @abstractplay/renderer package directly
copySync(rendererSourcePath, path.resolve(rendererNodeModulesPath, '@abstractplay', 'renderer'), { overwrite: true });

console.log(`Layer for @abstractplay/renderer built successfully at ${rendererLayerPath}`);