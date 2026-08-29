import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

test("renderer addPrefix is available via createRequire (Lambda path)", () => {
  const require = createRequire(import.meta.url);
  const pkg = require("@abstractplay/renderer");
  const renderer = pkg?.addPrefix
    ? pkg
    : pkg?.default?.addPrefix
      ? pkg.default
      : pkg?.default ?? pkg;
  assert.equal(typeof renderer.addPrefix, "function");
  assert.equal(typeof renderer.render, "function");
});

test("gameslib loads via createRequire", () => {
  const require = createRequire(import.meta.url);
  const gl = require("@abstractplay/gameslib");
  assert.ok(gl.gameinfo);
  assert.equal(typeof gl.GameFactory, "function");
});
