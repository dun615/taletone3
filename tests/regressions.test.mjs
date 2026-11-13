import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
const read = (p) => readFile(new URL("../" + p, import.meta.url), "utf8");

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
    ];
    for (const [oldPath, newPath] of pairs) {
      const html = await read(prefix + oldPath + "index.html");
      // (the preview became the site: its old aliases lead to the live chapter)
      const target = "/" + prefix.replace(/^preview\/?/, "") + newPath;
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
