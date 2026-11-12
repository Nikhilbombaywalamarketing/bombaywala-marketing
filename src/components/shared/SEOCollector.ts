import { createContext } from "react";

export interface SEOState {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  noIndex?: boolean;
}

// Only ever provided by scripts/prerender.mjs (one ref per route, read back
// after renderToString) — never in the real browser. <SEO> writes into it
// synchronously during render, which is normally a React anti-pattern, but
// this is a single-pass, non-concurrent Node build script, not a running
// app, so there's no scheduler to fight with.
export const SEOCollectorContext = createContext<{ current: SEOState | null } | null>(null);
