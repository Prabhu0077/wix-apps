// Storefront custom elements for the Wix editor (site plugins and widgets).
// Built to public/elements/reviews.js by scripts/build-elements.mjs.
//
// New Wix apps can only add storefront UI as custom elements. Each element
// here finds out which store it is on (Wix access token -> our
// /api/widget/instance), then shows our server-rendered page in an iframe
// that resizes to fit. The pages themselves are plain HTML (~12 KB).
//
//   <bodham-product-reviews product-id="...">  product page plugin
//   <bodham-rating-badge product-id="...">     product page plugin (near title)
//   <bodham-reviews-carousel>                  site widget (home page)
//   <bodham-all-reviews>                       site widget (reviews page)
//
// Wix passes plugin API values as kebab-case attributes (productId -> product-id).

import { createClient } from "@wix/sdk";
import { site } from "@wix/site";

import { frameSrc, heightFrom, type Kind } from "./frame";

declare const __APP_ID__: string;
declare const __APP_ORIGIN__: string;

// Where our pages live: the origin this script was loaded from, so preview
// deployments work too; the build-time value is the fallback.
const SCRIPT_SRC = (document.currentScript as HTMLScriptElement | null)?.src ?? "";
const ORIGIN = (() => {
  try {
    return SCRIPT_SRC ? new URL(SCRIPT_SRC).origin : __APP_ORIGIN__;
  } catch {
    return __APP_ORIGIN__;
  }
})();

type Wix = ReturnType<typeof makeClient>;
function makeClient() {
  return createClient({ auth: site.auth(), host: site.host({ applicationId: __APP_ID__ }) });
}
// Created lazily and guarded: outside a Wix site (or with a bad build) the
// elements must still register and simply show nothing.
let wixClient: Wix | null | undefined;
function wix(): Wix | null {
  if (wixClient === undefined) {
    try {
      wixClient = makeClient();
    } catch (err) {
      console.warn("[product-reviews] Wix client unavailable:", err);
      wixClient = null;
    }
  }
  return wixClient;
}

let instancePromise: Promise<string | null> | null = null;

/** The store's instanceId, asked once per page. */
function instanceId(): Promise<string | null> {
  const client = wix();
  if (!client) return Promise.resolve(null);
  instancePromise ??= client
    .fetchWithAuth(`${ORIGIN}/api/widget/instance`)
    .then((r) => (r.ok ? r.json() : null))
    .then((d: { instanceId?: string } | null) => d?.instanceId ?? null)
    .catch(() => null)
    .then((id) => {
      if (!id) instancePromise = null; // try again on the next element
      return id;
    });
  return instancePromise;
}

function define(tag: string, kind: Kind) {
  if (customElements.get(tag)) return;

  class ReviewsElement extends HTMLElement {
    static get observedAttributes() {
      return ["product-id"];
    }

    private frame: HTMLIFrameElement | null = null;
    private onMessage = (e: MessageEvent) => {
      if (!this.frame || e.source !== this.frame.contentWindow) return;
      const h = heightFrom(e.data);
      if (h !== null) this.frame.style.height = `${h}px`;
    };
    // Wix injects a fresh access token into elements that have this property.
    accessTokenListener = (() => {
      try {
        return wix()?.auth.getAccessTokenInjector();
      } catch {
        return undefined;
      }
    })();

    connectedCallback() {
      this.style.display = "block";
      window.addEventListener("message", this.onMessage);
      void this.render();
    }

    disconnectedCallback() {
      window.removeEventListener("message", this.onMessage);
    }

    attributeChangedCallback(_name: string, oldValue: string | null, newValue: string | null) {
      if (oldValue !== newValue && this.isConnected) void this.render();
    }

    private async render() {
      const src = frameSrc(kind, ORIGIN, await instanceId(), this.getAttribute("product-id"));
      if (!src) {
        this.frame?.remove();
        this.frame = null;
        return;
      }
      if (this.frame?.src === src) return;
      if (!this.frame) {
        const f = document.createElement("iframe");
        f.title = kind === "badge" ? "Product rating" : "Customer reviews";
        f.loading = kind === "badge" ? "eager" : "lazy";
        f.setAttribute("scrolling", "no");
        f.style.cssText = "display:block;width:100%;border:0;height:0;overflow:hidden;background:transparent";
        this.frame = f;
        this.replaceChildren(f);
      }
      this.frame.src = src;
    }
  }

  customElements.define(tag, ReviewsElement);
}

define("bodham-product-reviews", "reviews");
define("bodham-rating-badge", "badge");
define("bodham-reviews-carousel", "carousel");
define("bodham-all-reviews", "all");
