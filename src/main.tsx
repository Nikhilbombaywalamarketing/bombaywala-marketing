import { StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// hydrateRoot, not createRoot: every route now has a real server-rendered
// static HTML file (see scripts/prerender.mjs), not an empty shell.
// hydrateRoot attaches to that existing markup instead of discarding and
// repainting it, which is what createRoot would do.
hydrateRoot(
  document.getElementById('root')!,
  <StrictMode>
    <App />
  </StrictMode>,
)
