import { test } from "node:test";
import assert from "node:assert/strict";
import { gameinfo, GameFactory } from "@abstractplay/gameslib";
import { addPrefix, render } from "@abstractplay/renderer";

test("renderer addPrefix and render are available via ESM import", () => {
    assert.equal(typeof addPrefix, "function");
    assert.equal(typeof render, "function");
});

test("gameslib loads via ESM import", () => {
    assert.ok(gameinfo);
    assert.equal(typeof GameFactory, "function");
});
