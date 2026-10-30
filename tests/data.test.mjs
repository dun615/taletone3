// Content rules for anyone adding works by hand: run `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const json = async (file) =>
  JSON.parse(await readFile(path.join(root, file), "utf8"));
const exists = async (file) => {
  try {
    await access(path.join(root, String(file).replace(/\\/g, "/")));
    return true;
  } catch {
    return false;
  }
};

for (const [label, dir] of [["live", "assets/data"]]) {
  test(`${label}: works have unique lowercase slugs, dates and their images`, async () => {
    const { works } = await json(`${dir}/works-data.json`);
    assert.ok(works.length > 0, "no works");
    const slugs = new Set();
    for (const work of works) {
      const name = work.slug || work.title;
      assert.match(
        work.slug || "",
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        `${name}: slug must be lowercase letters, digits and hyphens`,
      );
      assert.ok(!slugs.has(work.slug), `${name}: duplicate slug`);
      slugs.add(work.slug);
      assert.match(
        work.date || "",
        /^\d{4}\.\d{2}\.\d{2}$/,
        `${name}: date must be YYYY.MM.DD (the rack sorts by it)`,
      );
      for (const field of ["image", "thumb", "ogImage"]) {
        assert.ok(work[field], `${name}: ${field} is missing`);
        assert.ok(
          await exists(work[field]),
          `${name}: ${field} ${work[field]} does not exist`,
        );
      }
      if (work.category)
        assert.ok(
          ["ost", "artist", "original"].includes(work.category),
          `${name}: unknown category ${work.category}`,
        );
      for (const lang of Object.keys(work.translations || {}))
        assert.ok(
          ["en", "jp"].includes(lang),
          `${name}: translations.${lang} (Korean lives in the base fields)`,
        );
    }
  });
}
