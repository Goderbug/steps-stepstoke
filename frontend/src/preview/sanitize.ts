import DOMPurify from "dompurify";
import { marked } from "marked";
import { fromBase64, imageDimensions, MAX_PREVIEW_IMAGE_SIDE } from "../domain/files";

/** Markdown to sanitized HTML: no scripts, handlers, frames, forms, styles or remote images. */
export function renderMarkdown(src: string): string {
  const raw = marked.parse(src, { async: false, gfm: true }) as string;
  const purify = DOMPurify(window);
  purify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A") {
      const href = node.getAttribute("href") ?? "";
      if (!/^https:\/\//i.test(href)) node.removeAttribute("href");
      node.setAttribute("rel", "noopener noreferrer nofollow");
      node.setAttribute("target", "_blank");
    }
  });
  const clean = purify.sanitize(raw, {
    FORBID_TAGS: ["img", "iframe", "frame", "object", "embed", "form", "input", "button", "style", "svg", "math", "video", "audio", "source", "link", "meta", "base"],
    FORBID_ATTR: ["style", "srcset", "id", "name", "autofocus", "tabindex"],
    ALLOW_DATA_ATTR: false,
  });
  // Wide tables keep readable columns inside their own keyboard-scrollable region; the page never overflows.
  // The wrapper is added by W1 after sanitizing, inside an inert template, so file content cannot supply it.
  const t = document.createElement("template");
  t.innerHTML = clean;
  for (const table of Array.from(t.content.querySelectorAll("table"))) {
    const box = document.createElement("div");
    box.className = "table-scroll";
    box.setAttribute("role", "region");
    box.setAttribute("tabindex", "0");
    box.setAttribute("aria-label", "Document table (scroll horizontally)");
    table.replaceWith(box);
    box.append(table);
  }
  return t.innerHTML;
}

/**
 * Generated HTML is shown only inside an opaque-origin iframe (sandbox without allow-scripts or
 * allow-same-origin) and with a CSP that blocks network, scripts, forms and navigation. Inline
 * styles and data: images stay so self-contained pages render.
 */
export const PREVIEW_CSP =
  "default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:; form-action 'none'; base-uri 'none'; frame-src 'none'; connect-src 'none'; script-src 'none'";

export function isolatedSrcDoc(html: string): string {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${PREVIEW_CSP}">`;
  // CSP navigate-to is not implemented by all browsers. Strip navigable elements/attributes as
  // well as using the opaque sandbox: even a user click must not load an external page here.
  const purify = DOMPurify(window);
  let remainingPixels = MAX_PREVIEW_IMAGE_SIDE ** 2;
  purify.addHook("afterSanitizeAttributes", (node) => {
    const unsafeCss = (css: string) => /url|image-set|@|\\/i.test(css);
    if (node.hasAttribute("style") && unsafeCss(node.getAttribute("style") ?? "")) node.removeAttribute("style");
    if (node.tagName === "STYLE" && unsafeCss(node.textContent ?? "")) node.textContent = "";
    if (node.hasAttribute("src")) {
      const src = node.getAttribute("src") ?? "";
      const match = /^data:image\/(png|jpeg|webp);base64,([a-z0-9+/=\s]+)$/i.exec(src);
      let valid = false;
      if (match) {
        try {
          const size = imageDimensions(fromBase64(match[2]));
          valid = !!size && size.width > 0 && size.height > 0 && size.width <= MAX_PREVIEW_IMAGE_SIDE && size.height <= MAX_PREVIEW_IMAGE_SIDE && size.width * size.height <= remainingPixels;
          if (valid && size) remainingPixels -= size.width * size.height;
        } catch { /* invalid Base64 is untrusted content */ }
      }
      if (!valid) node.removeAttribute("src");
    }
  });
  const clean = purify.sanitize(html, {
    WHOLE_DOCUMENT: true,
    FORBID_TAGS: ["script", "noscript", "iframe", "frame", "object", "embed", "link", "meta", "base", "form", "input", "button", "textarea", "select", "option", "svg", "math", "audio", "video", "source", "track"],
    FORBID_ATTR: ["href", "xlink:href", "action", "formaction", "target", "ping", "download", "srcset", "nonce", "is"],
    ALLOW_DATA_ATTR: false,
  });
  return `<!doctype html><html><head>${meta}<meta name="referrer" content="no-referrer"></head><body>${clean}</body></html>`;
}
