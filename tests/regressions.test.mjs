import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
const read = (p) => readFile(new URL("../" + p, import.meta.url), "utf8");

test("Works geometry caches absent decks and invalidates a detached deck", async () => {
  let now = 0,
    reads = 0,
    deck = null;
  const section = {
    isConnected: true,
    querySelector: () => deck,
    getBoundingClientRect: () => {
      reads++;
      return { top: 2000, bottom: 4000 };
    },
  };
  const sandbox = vm.createContext({
    performance: { now: () => now },
    document: { getElementById: () => section },
  });
  vm.runInContext(await read("src/app/parts/scene.js"), sandbox);
  const state = { scroller: { scrollTop: 0 } };
  for (let i = 0; i < 60; i++) {
    now = i * 16.67;
    sandbox.ComponentScene.worksBox.call(state, 900);
  }
  assert.ok(
    reads <= 3,
    `expected cached missing deck, got ${reads} layout reads`,
  );
  deck = {
    isConnected: true,
    getBoundingClientRect: () => ({ top: 2100, width: 50, height: 50 }),
  };
  state._layoutGeometryDirty = true;
  sandbox.ComponentScene.worksBox.call(state, 900);
  state._layoutGeometryDirty = false;
  const previous = reads;
  deck.isConnected = false;
  sandbox.ComponentScene.worksBox.call(state, 900);
  assert.equal(reads, previous + 1);
});

test("audio cache releases earlier records while retaining current language buffers", async () => {
  const source = await read("assets/js/works.js");
  const helper = source.match(
    /  function retainLayerBuffers\(entries\)\{[\s\S]*?\n  }/,
  )[0];
  const current = Promise.resolve({ length: 100 }),
    previous = Promise.resolve({ length: 200 });
  const ctx = vm.createContext({
    layerBuffers: { kr: current, jp: current, old: previous },
  });
  vm.runInContext(helper, ctx);
  ctx.retainLayerBuffers([{ url: "kr" }, { url: "jp" }]);
  assert.deepEqual(Object.keys(ctx.layerBuffers).sort(), ["jp", "kr"]);
  assert.equal(ctx.layerBuffers.kr, current);
  ctx.retainLayerBuffers([{ url: "next" }]);
  assert.equal(Object.keys(ctx.layerBuffers).length, 0);
});

test("all news languages serve real static collections and correct canonical URLs", async () => {
  const site = JSON.parse(await read("assets/data/site-content.json"));
  for (const prefix of ["", "en/", "ja/"]) {
    const html = await read(prefix + "news/index.html");
    assert.ok(html.includes(`https://taletone.net/${prefix}news/`));
    assert.ok(!html.includes("<x-dc>"));
    for (const news of site.news)
      assert.ok(html.includes(`/${prefix}news/${news.slug}/`));
  }
});

test("runtime route normalization keeps every configured route", async () => {
  const context = vm.createContext({});
  vm.runInContext(await read("src/app/parts/routing.js"), context);
  const config = JSON.parse(await read("assets/data/seo-content.json"));
  const normalized = context.ComponentRouting._normalizeSeoConfig(config);
  assert.equal(normalized.pages.length, config.pages.length);
  for (const page of config.pages)
    assert.ok(
      normalized.pages.some((p) => p.key === page.key && p.path === page.path),
    );
});

test("preview uses canonical sources and keeps news navigation isolated", async () => {
  for (const prefix of ["", "en/", "ja/"]) {
    const html = await read("preview/" + prefix + "news/index.html");
    assert.ok(html.includes("noindex, nofollow"));
    assert.ok(html.includes("/preview/" + prefix + "news/"));
  }
});
