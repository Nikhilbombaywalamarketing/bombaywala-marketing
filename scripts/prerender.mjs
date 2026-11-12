// Generates real, route-specific static HTML for every page after
// `vite build`, so Googlebot's very first fetch of any URL already
// contains the correct <title>, <meta description>, <link rel="canonical">
// and full body content — not the generic, content-free shell every route
// was serving before (see the removed comment in index.html: this is a
// pure client-rendered SPA with no SSR, so Google had to execute JS and
// wait for a second "render" pass to see anything page-specific, which is
// slow and not guaranteed to succeed — the direct cause of pages not
// getting indexed).
//
// No headless browser needed: react-dom/server + react-router-dom's
// StaticRouter render the exact same component tree Node-side, synchronously,
// since all content here is already bundled data (blog.ts/config.ts), not
// fetched at runtime.
//
// Head tags come from src/components/shared/SEO.tsx via SEOCollectorContext,
// not from scraping the rendered HTML string — see that file's comment for
// why: react-helmet-async rendered <title>/<meta>/<link> as real inline JSX
// on React 19, and stripping them back out of the body via regex produced a
// static file structurally different from what the client's first render
// produces at that same position, which is a hydration mismatch (React
// error #418, confirmed against a running preview server). <SEO> now always
// renders null, so there's nothing to strip and nothing to mismatch.
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import React from "react";
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom";
import { AppShell } from "../src/App.tsx";
import { blogPosts } from "../src/lib/blog.ts";

const SITE = "https://www.bombaywalamarketing.com";
const DEFAULT_IMAGE = `${SITE}/bombaywala-logo.png`;

function escapeAttr(s) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildHeadTags(seo) {
  const url = seo.canonical ? `${SITE}${seo.canonical}` : SITE;
  const image = seo.ogImage ?? DEFAULT_IMAGE;
  const title = escapeAttr(seo.title);
  const description = escapeAttr(seo.description);
  const robots = seo.noIndex ? "noindex, nofollow" : "index, follow";

  return [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}"/>`,
    `<meta name="robots" content="${robots}"/>`,
    seo.canonical ? `<link rel="canonical" href="${escapeAttr(url)}"/>` : "",
    `<meta property="og:title" content="${title}"/>`,
    `<meta property="og:description" content="${description}"/>`,
    `<meta property="og:url" content="${escapeAttr(url)}"/>`,
    `<meta property="og:image" content="${escapeAttr(image)}"/>`,
    `<meta property="og:type" content="website"/>`,
    `<meta property="og:site_name" content="Bombaywala Marketing"/>`,
    `<meta name="twitter:card" content="summary_large_image"/>`,
    `<meta name="twitter:title" content="${title}"/>`,
    `<meta name="twitter:description" content="${description}"/>`,
    `<meta name="twitter:image" content="${escapeAttr(image)}"/>`,
  ].filter(Boolean);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "../dist");
const templatePath = path.join(distDir, "index.html");
const template = readFileSync(templatePath, "utf-8");

// Same static route list as generate-sitemap.mjs, plus the noindex legal
// pages — those still deserve real prerendered content with a correct
// `noindex` meta tag baked in, they're just excluded from the sitemap.
const staticRoutes = [
  "/",
  "/about",
  "/case-studies",
  "/blog",
  "/contact",
  "/services/marketing",
  "/services/tech",
  "/services/seo",
  "/services/ppc",
  "/services/smm",
  "/services/smo",
  "/services/ecommerce-marketing",
  "/privacy",
  "/terms",
  "/cookies",
];
const blogRoutes = blogPosts.map((p) => `/blog/${p.slug}`);
const routes = [...staticRoutes, ...blogRoutes];

let okCount = 0;
const failed = [];

for (const route of routes) {
  try {
    const seoCollector = { current: null };
    const bodyHtml = renderToString(
      React.createElement(
        StaticRouter,
        { location: route },
        React.createElement(AppShell, { seoCollector })
      )
    );

    if (!seoCollector.current) {
      throw new Error("<SEO> never rendered for this route — no title/description collected");
    }

    const headTags = buildHeadTags(seoCollector.current);
    let html = template.replace("</head>", `    ${headTags.join("\n    ")}\n  </head>`);
    html = html.replace('<div id="root"></div>', `<div id="root">${bodyHtml}</div>`);

    // Flat `<route>.html` files, not `<route>/index.html` directories.
    // Vercel's docs confirm the former ("a static file named about.html
    // will be served when visiting the /about path") but never explicitly
    // confirm the latter for extensionless, no-trailing-slash requests —
    // and locally, `vite preview`'s own static server actually fell back
    // to serving the unrelated root index.html for a directory-style path
    // requested without a trailing slash (verified: curling the same URL
    // with vs. without a trailing slash returned two different <title>
    // tags). Every canonical/sitemap URL in this project is already the
    // no-trailing-slash form, so this is the only path shape worth risking
    // on an unconfirmed default. Requires "cleanUrls": true in vercel.json.
    if (route === "/") {
      writeFileSync(path.join(distDir, "index.html"), html);
    } else {
      const outDir = path.join(distDir, path.dirname(route));
      mkdirSync(outDir, { recursive: true });
      writeFileSync(path.join(distDir, `${route}.html`), html);
    }
    okCount++;
  } catch (err) {
    failed.push({ route, error: err instanceof Error ? err.message : String(err) });
  }
}

console.log(`✓ Prerendered ${okCount}/${routes.length} routes`);
if (failed.length) {
  console.error(`✗ ${failed.length} route(s) failed to prerender:`);
  for (const f of failed) console.error(`  ${f.route}: ${f.error}`);
  process.exit(1);
}
