import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function layerRequire(layerDir, pkgName) {
  const anchor = path.join(
    ROOT,
    ".serverless",
    "layers",
    layerDir,
    "nodejs",
    "node_modules",
    ...pkgName.split("/"),
    "package.json",
  );
  return createRequire(anchor);
}

try {
  const gameslibReq = layerRequire("abstractplay-gameslib", "@abstractplay/gameslib");
  const gl = gameslibReq("@abstractplay/gameslib");
  if (!gl.gameinfo || typeof gl.GameFactory !== "function") {
    throw new Error("@abstractplay/gameslib missing expected exports");
  }

  const rendererReq = layerRequire("abstractplay-renderer", "@abstractplay/renderer");
  const pkg = rendererReq("@abstractplay/renderer");
  const renderer = pkg?.addPrefix
    ? pkg
    : pkg?.default?.addPrefix
      ? pkg.default
      : pkg?.default ?? pkg;
  if (typeof renderer.addPrefix !== "function") {
    throw new Error("@abstractplay/renderer addPrefix missing after layer require");
  }

  console.log("smoke-layer-modules: gameslib + renderer require OK");
} catch (error) {
  console.error(`smoke-layer-modules: ${error.message}`);
  process.exit(1);
}
