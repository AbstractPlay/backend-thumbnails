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

// Ensure the target directory exists and is clean
removeSync(rendererLayerPath); // Clean up any previous layer content
ensureDirSync(rendererNodejsPath);

// 1. Read root package.json to get the versions determined by the workflow
const pkg = fsExtra.readJsonSync(path.join(projectRoot, 'package.json'));

// 2. Create a subset package.json for the layer.
// This ensures we install the packages AND all their transitive dependencies correctly.
const layerPackages = ['@abstractplay/renderer', '@abstractplay/gameslib', 'puppeteer-core', '@sparticuz/chromium'];
const layerPkg = {
    name: 'abstractplay-renderer-layer',
    version: '1.0.0',
    dependencies: {}
};

layerPackages.forEach(name => {
    if (pkg.dependencies && pkg.dependencies[name]) {
        layerPkg.dependencies[name] = pkg.dependencies[name];
    }
});

fsExtra.writeJsonSync(path.join(rendererNodejsPath, 'package.json'), layerPkg);

// 3. Copy .npmrc so npm can authenticate for your private GitHub packages
if (fsExtra.existsSync(path.join(projectRoot, '.npmrc'))) {
    copySync(path.join(projectRoot, '.npmrc'), path.join(rendererNodejsPath, '.npmrc'));
}

// 4. Run a clean install inside the layer directory.
// This respects the versions in your root package.json while ensuring isolation.
console.log('Building layer dependencies from root version specifications...');
execSync('npm install --omit=dev --no-package-lock', {
    cwd: rendererNodejsPath,
    stdio: 'inherit'
});

// 5. Direct copy the local versions of our libraries from root node_modules.
// This ensures that the @development (or @latest) code that the workflow just
// installed in the root is exactly what ends up in the layer, bypassing any
// version resolution issues during the sub-folder npm install.
const packagesToOverride = ['@abstractplay/renderer', '@abstractplay/gameslib'];
for (const name of packagesToOverride) {
    const src = path.resolve(projectRoot, 'node_modules', name);
    const dest = path.resolve(rendererNodejsPath, 'node_modules', name);

    if (!fsExtra.existsSync(src)) {
        console.warn(`Warning: Local source for ${name} not found at ${src}. Skipping override.`);
        continue;
    }

    console.log(`Syncing local code for ${name} into layer...`);
    copySync(src, dest, { overwrite: true });

    // Also sync the dependencies of this package from root node_modules to ensure hoisted deps are present
    const internalPkg = fsExtra.readJsonSync(path.join(src, 'package.json'));
    if (internalPkg.dependencies) {
        for (const dep of Object.keys(internalPkg.dependencies)) {
            const depSrc = path.resolve(projectRoot, 'node_modules', dep);
            const depDest = path.resolve(rendererNodejsPath, 'node_modules', dep);
            if (fsExtra.existsSync(depSrc)) {
                copySync(depSrc, depDest, { overwrite: true });
            }
        }
    }
}

console.log(`Layer built successfully at ${rendererLayerPath}`);