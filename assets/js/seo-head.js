(function () {
  function pageKeyFromPath(pathname) {
    var clean = (pathname || "/").replace(/\/+$/, "/");
    if (clean === "/") return "home";
    var key = clean.split("/").filter(Boolean)[0];
    return key || "home";
  }

  function findSeoPage() {
    var seo = window.TALETONE_SEO_CONTENT;
    if (!seo || !Array.isArray(seo.pages)) return null;
    var key = pageKeyFromPath(window.location.pathname);
    return seo.pages.find(function (page) { return page.key === key; }) || seo.pages[0] || null;
  }

  function upsertMeta(selector, attrs) {
    var nodes = Array.prototype.slice.call(document.head.querySelectorAll(selector));
    var node = nodes.shift() || document.createElement("meta");
    nodes.forEach(function (extra) { extra.remove(); });
    Object.keys(attrs).forEach(function (name) { node.setAttribute(name, attrs[name]); });
    if (!node.parentNode) document.head.appendChild(node);
    return node;
  }

  var normalizing = false;

  function normalizeSeoHead() {
    if (normalizing) return;
    normalizing = true;
    var seoPage = findSeoPage();
    var titles = Array.prototype.slice.call(document.head.querySelectorAll("title"));
    var fallbackTitle = titles.length ? titles[titles.length - 1].textContent : document.title;
    var title = seoPage && seoPage.title ? seoPage.title : fallbackTitle || "TALETONE MUSIC";
    titles.forEach(function (node) { node.remove(); });
    var titleNode = document.createElement("title");
    titleNode.textContent = title;
    document.head.appendChild(titleNode);
    document.title = title;

    var descNodes = Array.prototype.slice.call(document.head.querySelectorAll('meta[name="description"]'));
    var fallbackDesc = descNodes.length ? descNodes[descNodes.length - 1].getAttribute("content") : "";
    var description = seoPage && seoPage.description ? seoPage.description : fallbackDesc;
    descNodes.forEach(function (node) { node.remove(); });
    if (description) upsertMeta('meta[name="description"]', { name: "description", content: description });

    var baseUrl = (window.TALETONE_SEO_CONTENT && window.TALETONE_SEO_CONTENT.baseUrl) || "https://taletone.net";
    var pagePath = seoPage && seoPage.path ? seoPage.path : "/";
    var canonicalUrl = baseUrl.replace(/\/$/, "") + pagePath;
    var canonical = document.head.querySelector('link[rel="canonical"]') || document.createElement("link");
    canonical.setAttribute("rel", "canonical");
    canonical.setAttribute("href", canonicalUrl);
    if (!canonical.parentNode) document.head.appendChild(canonical);

    upsertMeta('meta[property="og:title"]', { property: "og:title", content: title });
    if (description) upsertMeta('meta[property="og:description"]', { property: "og:description", content: description });
    upsertMeta('meta[property="og:url"]', { property: "og:url", content: canonicalUrl });
    upsertMeta('meta[name="twitter:title"]', { name: "twitter:title", content: title });
    if (description) upsertMeta('meta[name="twitter:description"]', { name: "twitter:description", content: description });
    normalizing = false;
  }

  function run() {
    normalizeSeoHead();
    window.setTimeout(normalizeSeoHead, 50);
    window.setTimeout(normalizeSeoHead, 300);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    run();
  }

  if ("MutationObserver" in window) {
    var observer = new MutationObserver(function () { window.setTimeout(normalizeSeoHead, 0); });
    observer.observe(document.head, { childList: true, subtree: true, attributes: true, attributeFilter: ["content", "href"] });
    window.setTimeout(function () { observer.disconnect(); normalizeSeoHead(); }, 10000);
  }
})();
