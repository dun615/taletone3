// Production image slot. Upload/crop authoring lives in scripts/editor-image-slot.js.
(() => {
  if (customElements.get("image-slot")) return;
  class ImageSlot extends HTMLElement {
    static get observedAttributes() {
      return ["src", "fit", "position", "shape", "radius", "placeholder"];
    }
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
    }
    connectedCallback() {
      this.render();
    }
    attributeChangedCallback() {
      if (this.isConnected) this.render();
    }
    render() {
      const image = document.createElement("img");
      image.src = this.getAttribute("src") || "";
      image.alt = this.getAttribute("placeholder") || "";
      image.loading = this.closest("[data-chapter-preloaded]")
        ? "eager"
        : "lazy";
      image.decoding = "async";
      image.style.cssText =
        "width:100%;height:100%;display:block;object-fit:" +
        (this.getAttribute("fit") || "cover") +
        ";object-position:" +
        (this.getAttribute("position") || "50% 50%") +
        ";border-radius:" +
        (this.getAttribute("shape") === "circle"
          ? "50%"
          : (this.getAttribute("radius") || "0") + "px");
      this.shadowRoot.replaceChildren(image);
    }
  }
  customElements.define("image-slot", ImageSlot);
  window.addEventListener("TALETONE_CHAPTER_PRELOAD", (event) => {
    const section = document.getElementById("c-" + event.detail?.chapter);
    if (!section) return;
    section.setAttribute("data-chapter-preloaded", "");
    section.querySelectorAll("image-slot").forEach((slot) => slot.render());
    section.querySelectorAll("img").forEach((image) => {
      image.loading = "eager";
      const src = image.getAttribute("data-member-src");
      if (src) {
        image.src = src;
        image.removeAttribute("data-member-src");
      }
      if (image.src && image.decode) image.decode().catch(() => {});
    });
  });
})();
