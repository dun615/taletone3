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

test("only the current five chapters are indexed", async () => {
  const seo = JSON.parse(await read("assets/data/seo-content.json"));
  assert.deepEqual(
    seo.pages.map((p) => p.label),
    ["Home", "About", "Approach", "Discography", "Contact"],
  );
  const sitemap = await read("sitemap.xml");
  assert.ok(!sitemap.includes("/news/"));
  for (const prefix of ["", "en/", "ja/"])
    assert.ok(
      !(await read(prefix + "index.html")).includes("application/rss+xml"),
    );
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

test("all language metadata exposes exactly five navigation entries and 15 chapter-only sitemap URLs", async () => {
  const labels = ["Home", "About", "Approach", "Discography", "Contact"];
  for (const prefix of ["", "en/", "ja/"]) {
    const html = await read(prefix + "index.html");
    const data = JSON.parse(
      html.match(
        /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
      )[1],
    );
    const nav = data["@graph"].filter(
      (node) => node["@type"] === "SiteNavigationElement",
    );
    assert.deepEqual(
      nav.map((node) => node.name),
      labels,
    );
    assert.ok(
      nav.every((node) =>
        node.url.startsWith("https://taletone.net/" + prefix),
      ),
    );
    assert.ok(!html.includes("/news/"));
  }
  const sitemap=await read('sitemap.xml');
  const actual=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match=>match[1]);
  const seo=JSON.parse(await read('assets/data/seo-content.json'));
  const expected=seo.pages.flatMap(page=>['','/en','/ja'].map(prefix=>'https://taletone.net'+prefix+page.path));
  assert.deepEqual(actual,expected);
  assert.equal(actual.length,15);
  assert.ok(!actual.some(url=>/\/discography\/[^/]+\/$/.test(url)));
});

test("legacy URLs redirect directly and preserve queries and fragments", async () => {
  const data = JSON.parse(await read("assets/data/works-data.json"));
  const sitemap = await read("sitemap.xml");
  for (const prefix of [
    "",
    "en/",
    "ja/",
    "preview/",
    "preview/en/",
    "preview/ja/",
  ]) {
    const pairs = [
      ["members/", "about/"],
      ["story-types/", "approach/"],
      ["projects/", "approach/"],
      ["works/", "discography/"],
      ...data.works.map((w) => [
        "works/" + w.slug + "/",
        "discography/" + w.slug + "/",
      ]),
    ];
    for (const [oldPath, newPath] of pairs) {
      const html = await read(prefix + oldPath + "index.html");
      const target = "/" + prefix + newPath;
      assert.ok(html.includes('content="0; url=' + target + '"'));
      assert.ok(html.includes('href="https://taletone.net' + target + '"'));
      let destination = "";
      const context = vm.createContext({
        location: {
          search: "?work=heart-score",
          hash: "#c-works",
          replace: (url) => (destination = url),
        },
      });
      vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], context);
      assert.equal(destination, target + "?work=heart-score#c-works");
      assert.ok(
        !sitemap.includes(
          "<loc>https://taletone.net/" + prefix + oldPath + "</loc>",
        ),
      );
    }
  }
});
