import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function importLayerEntry(layerDir, pkgSegments) {
    const entry = path.join(
        ROOT,
        ".serverless",
        "layers",
        layerDir,
        "nodejs",
        "node_modules",
        ...pkgSegments,
        "build",
        "index.js",
    );
    return import(pathToFileURL(entry).href);
}

try {
    const gl = await importLayerEntry("abstractplay-gameslib", ["@abstractplay", "gameslib"]);
    if (!gl.gameinfo || typeof gl.GameFactory !== "function") {
        throw new Error("@abstractplay/gameslib missing expected exports");
    }

    const renderer = await importLayerEntry("abstractplay-renderer", ["@abstractplay", "renderer"]);
    if (typeof renderer.addPrefix !== "function") {
        throw new Error("@abstractplay/renderer addPrefix missing after layer import");
    }

    console.log("smoke-layer-modules: gameslib + renderer ESM import OK");
} catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`smoke-layer-modules: ${message}`);
    process.exit(1);
}
