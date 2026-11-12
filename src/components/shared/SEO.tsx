import { useContext, useEffect } from "react";
import { SEOCollectorContext } from "./SEOCollector";

interface SEOProps {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  noIndex?: boolean;
}

const SITE = "https://www.bombaywalamarketing.com";
const DEFAULT_IMAGE = `${SITE}/bombaywala-logo.png`;

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

// Deliberately NOT react-helmet-async. That library rendered <title>/<meta>/
// <link> as real inline JSX wherever <Helmet> sat in the tree (its React 19
// behavior — the old server-collection API never fires, since it depends on
// componentDidMount/componentDidUpdate, which don't run during
// renderToString). scripts/prerender.mjs needs those tags lifted into a
// real <head> for correct, crawlable HTML, but doing that via string
// surgery on the server output left the static file structurally different
// from what the client's first render produces at that same tree position —
// a hydration mismatch (React error #418), confirmed in dist/ output
// against a running preview server.
//
// This component sidesteps the whole problem: it always renders null, so
// server and client trees are identical at this position and there's
// nothing to mismatch. Server-side, scripts/prerender.mjs supplies a
// collector via SEOCollectorContext and reads it back after renderToString
// to build the real <head> tags itself. Client-side, an effect updates
// document.head imperatively — needed for in-app route changes, since the
// static HTML only reflects the page you first landed on.
export default function SEO({ title, description, canonical, ogImage, noIndex }: SEOProps) {
  const collector = useContext(SEOCollectorContext);
  if (collector) {
    collector.current = { title, description, canonical, ogImage, noIndex };
  }

  useEffect(() => {
    const url = canonical ? `${SITE}${canonical}` : SITE;
    const image = ogImage ?? DEFAULT_IMAGE;

    document.title = title;
    upsertMeta("name", "description", description);
    upsertMeta("name", "robots", noIndex ? "noindex, nofollow" : "index, follow");

    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:url", url);
    upsertMeta("property", "og:image", image);
    upsertMeta("property", "og:type", "website");
    upsertMeta("property", "og:site_name", "Bombaywala Marketing");

    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", title);
    upsertMeta("name", "twitter:description", description);
    upsertMeta("name", "twitter:image", image);

    let linkEl = document.querySelector('link[rel="canonical"]');
    if (canonical) {
      if (!linkEl) {
        linkEl = document.createElement("link");
        linkEl.setAttribute("rel", "canonical");
        document.head.appendChild(linkEl);
      }
      linkEl.setAttribute("href", url);
    } else if (linkEl) {
      linkEl.remove();
    }
  }, [title, description, canonical, ogImage, noIndex]);

  return null;
}
