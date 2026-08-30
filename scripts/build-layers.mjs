import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import fsExtra from 'fs-extra';
const { copySync, ensureDirSync, removeSync, readJsonSync, writeJsonSync, existsSync, readdirSync, statSync, unlinkSync } = fsExtra;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..');
const serverlessDir = path.resolve(projectRoot, '.serverless');
const LAYER_UNZIPPED_LIMIT = 262_144_000; // 250 MiB — AWS Lambda layer limit

/** @type {import('fs').Stats} */
function dirSize(dirPath) {
    let total = 0;
    for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
        const full = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            total += dirSize(full);
        } else if (entry.isFile()) {
            total += statSync(full).size;
        }
    }
    return total;
}

function formatBytes(bytes) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

const AP_PACKAGE_CRUFT_DIRS = new Set([
    'src',
    'test',
    'tests',
    'docs',
    'playground',
    'scripts',
    'bin',
    '.github',
    '.cursor',
    'node_modules',
]);

const AP_PACKAGE_CRUFT_FILE = [
    /^README/i,
    /^CHANGELOG/i,
    /^TODO$/i,
    /\.md$/i,
    /^eslint\.config\./,
    /^webpack\.config\./,
    /^tsconfig/,
    /^serverless\.yml$/,
    /^i18next-parser\.config\./,
    /^\.aiexclude$/,
];

const NODE_MODULES_CRUFT_DIRS = new Set([
    'test',
    'tests',
    '__tests__',
    'docs',
    'doc',
    'example',
    'examples',
    'coverage',
    '.github',
    'benchmark',
    'bench',
]);

function shouldRemoveApPackageFile(name) {
    if (name.endsWith('.map')) {
        return true;
    }
    return AP_PACKAGE_CRUFT_FILE.some((pattern) => pattern.test(name));
}

function shouldRemoveNodeModulesFile(name) {
    if (name.endsWith('.map')) {
        return true;
    }
    if (/^(README|CHANGELOG|LICENSE|LICENCE|HISTORY|AUTHORS)/i.test(name)) {
        return true;
    }
    if (name.endsWith('.md')) {
        return true;
    }
    return false;
}

function trimTree(dirPath, { apPackageRoot = false } = {}) {
    if (!existsSync(dirPath)) {
        return;
    }

    for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
        const full = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
            if (apPackageRoot && AP_PACKAGE_CRUFT_DIRS.has(entry.name)) {
                removeSync(full);
                continue;
            }
            if (!apPackageRoot && NODE_MODULES_CRUFT_DIRS.has(entry.name)) {
                removeSync(full);
                continue;
            }
            if (!apPackageRoot && entry.name === '@types') {
                removeSync(full);
                continue;
            }
            trimTree(full, { apPackageRoot: false });
            continue;
        }

        if (apPackageRoot ? shouldRemoveApPackageFile(entry.name) : shouldRemoveNodeModulesFile(entry.name)) {
            unlinkSync(full);
        }
    }
}

function trimLayer(layerPath, overridePackages) {
    const nodeModulesPath = path.join(layerPath, 'nodejs', 'node_modules');

    for (const name of overridePackages) {
        const pkgPath = path.join(nodeModulesPath, ...name.split('/'));
        if (existsSync(pkgPath)) {
            trimTree(pkgPath, { apPackageRoot: true });
        }
    }

    if (existsSync(nodeModulesPath)) {
        trimTree(nodeModulesPath);
    }
}

function syncPackageDeps(fromRoot, layerNodeModulesPath, packageName, excludeDeps = []) {
    const src = path.resolve(fromRoot, 'node_modules', ...packageName.split('/'));
    const dest = path.resolve(layerNodeModulesPath, ...packageName.split('/'));

    if (!existsSync(src)) {
        console.warn(`Warning: Local source for ${packageName} not found at ${src}. Skipping override.`);
        return;
    }

    console.log(`Syncing local code for ${packageName} into layer...`);
    ensureDirSync(path.dirname(dest));
    removeSync(dest);
    copySync(src, dest, { overwrite: true });

    const internalPkg = readJsonSync(path.join(src, 'package.json'));
    if (!internalPkg.dependencies) {
        return;
    }

    const excluded = new Set(excludeDeps);
    for (const dep of Object.keys(internalPkg.dependencies)) {
        if (excluded.has(dep)) {
            continue;
        }
        const depSrc = path.resolve(fromRoot, 'node_modules', dep);
        const depDest = path.resolve(layerNodeModulesPath, dep);
        if (existsSync(depSrc)) {
            removeSync(depDest);
            copySync(depSrc, depDest, { overwrite: true });
        }
    }
}

/**
 * @param {{
 *   name: string;
 *   dir: string;
 *   packages: string[];
 *   overridePackages?: string[];
 *   excludeDeps?: string[];
 * }} config
 */
function buildLayer(config) {
    const layerPath = path.resolve(serverlessDir, 'layers', config.dir);
    const nodejsPath = path.resolve(layerPath, 'nodejs');
    const nodeModulesPath = path.resolve(nodejsPath, 'node_modules');

    removeSync(layerPath);
    ensureDirSync(nodejsPath);

    const pkg = readJsonSync(path.join(projectRoot, 'package.json'));
    const layerPkg = {
        name: `${config.name}-layer`,
        version: "1.0.0",
        type: "module",
        dependencies: {},
    };

    for (const name of config.packages) {
        if (pkg.dependencies?.[name]) {
            layerPkg.dependencies[name] = pkg.dependencies[name];
        }
    }

    writeJsonSync(path.join(nodejsPath, 'package.json'), layerPkg);

    const npmrc = path.join(projectRoot, '.npmrc');
    if (existsSync(npmrc)) {
        copySync(npmrc, path.join(nodejsPath, '.npmrc'));
    }

    console.log(`Building ${config.name} layer dependencies...`);
    execSync('npm install --omit=dev --no-package-lock', {
        cwd: nodejsPath,
        stdio: 'inherit',
    });

    for (const name of config.overridePackages ?? []) {
        syncPackageDeps(projectRoot, nodeModulesPath, name, config.excludeDeps ?? []);
    }

    trimLayer(layerPath, config.overridePackages ?? []);

    const size = dirSize(layerPath);
    console.log(`${config.name} layer size: ${formatBytes(size)} (${size} bytes)`);
    if (size >= LAYER_UNZIPPED_LIMIT) {
        throw new Error(
            `${config.name} layer exceeds the ${formatBytes(LAYER_UNZIPPED_LIMIT)} Lambda unzipped limit`,
        );
    }

    console.log(`Layer built successfully at ${layerPath}`);
    return size;
}

const LAYERS = [
    {
        name: 'abstractplay-chromium',
        dir: 'abstractplay-chromium',
        packages: ['puppeteer-core', '@sparticuz/chromium'],
    },
    {
        name: 'abstractplay-gameslib',
        dir: 'abstractplay-gameslib',
        packages: ['@abstractplay/gameslib'],
        overridePackages: ['@abstractplay/gameslib'],
        excludeDeps: ['@abstractplay/renderer', 'puppeteer-core', '@sparticuz/chromium'],
    },
    {
        name: 'abstractplay-renderer',
        dir: 'abstractplay-renderer',
        packages: ['@abstractplay/renderer'],
        overridePackages: ['@abstractplay/renderer'],
        excludeDeps: ['@abstractplay/gameslib', 'puppeteer-core', '@sparticuz/chromium'],
    },
];

for (const layer of LAYERS) {
    buildLayer(layer);
}
