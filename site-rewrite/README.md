# ZIFF Site Rewrite

This directory is the home for the replacement website. The original Mobirise export remains in the repository root and is the frozen content baseline during the migration.

## Before Implementation

Read the repository-root [SITE_REWRITE_PLAN.md](../SITE_REWRITE_PLAN.md). It documents the current routes, content and integrations, preservation rules, recommended stack, interactive direction, and release acceptance checklist.

## Project Direction

- Astro + TypeScript for static-first pages and SEO.
- React islands only for interactive features that need client-side state.
- Reduced palette: oxblood navbar, coral pink, dusty rose, DCDEFF, and pale blue; Intro Rust for display and Oswald for body/supporting type.
- Preserve all existing routes, content, assets, language variants, anchors, metadata, and workflows unless an owner explicitly approves a change.
- Keep content readable and tasks usable with JavaScript disabled or reduced motion enabled.

`index.html` is the first standalone, interactive homepage prototype and can be opened directly in a browser. Its local media links point to the original `../assets/` and `../fonts/` directories, while links to the other pages continue to point to the existing Mobirise routes until those pages are migrated.

On a first visit in a browser tab, the homepage plays a roughly six-second graphic film-leader intro with no festival photos, three distinct jumping CSS-Peeps characters, a clapperboard, and a final ZIFF logo/February 2027 reveal. Visitors can skip it with the button or Escape; reduced-motion settings bypass it. CSS-Peeps (`propjockey/css-peeps`) is BSD-2-Clause; the original Open Peeps art is CC0.

This prototype is not yet the Astro application scaffold. Its contact form targets the existing PHP mailform endpoint and requires a hosted same-origin preview to submit successfully; a `file://` preview is for layout and interaction review only. Confirm the deployment host/runtime before completing form delivery and HTTP error handling, then port the accepted page into the Astro + TypeScript structure described in [SITE_REWRITE_PLAN.md](../SITE_REWRITE_PLAN.md).