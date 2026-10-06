# ZIFF Site Rewrite

This directory is the home for the replacement website. The original Mobirise export remains in the repository root and is the frozen content baseline during the migration.

## Status

Read the repository-root [SITE_REWRITE_PLAN.md](../SITE_REWRITE_PLAN.md) before migrating content. It documents the route inventory, integrations, preservation rules, interaction direction, and acceptance criteria.

## Project Direction

- Astro + TypeScript for static-first pages and SEO.
- Node.js 22.19+ for the current Astro dependency tree.
- React islands only for interactive features that need client-side state.
- Reduced palette: oxblood navbar, coral pink, dusty rose, DCDEFF, and pale blue; Intro Rust for display and Oswald for body/supporting type.
- Preserve all existing routes, content, assets, language variants, anchors, metadata, and workflows unless an owner explicitly approves a change.
- Keep content readable and tasks usable with JavaScript disabled or reduced motion enabled.

Astro is scaffolded in this directory. The standalone `index.html` remains the editable homepage prototype and content reference. `src/pages/index.astro` temporarily reads that file's head and body and renders them at `/`, preserving the current page while we migrate sections into Astro components. The predev/prebuild script stages original media/fonts and all other legacy routes into `public/`; source copies remain in the repository root.

Run `npm install`, then `npm run dev` from this directory, or from the repository root run `npm --prefix site-rewrite run dev`. Use `npm run build` to produce the static site in `dist/`. Run `npm run manifest` to refresh the 28-route preservation manifest at `src/data/source-manifest.json`.

The intro (Draft3, about 10s) is a beat-driven WebGL title sequence. A start screen offers "Enter with sound" or "Enter muted" (browsers block autoplay audio); the choice is remembered for the session and the footer "Replay intro" button reuses it. The camera flies smoothly over the extruded brand lettering with hard cuts only at the clapperboard and the clap. A low-poly clapperboard prop claps on beat and spins away while the original clapper artwork fades in, the camera zooms out, the background fades from black to oxblood `#550000`, and the final logo waits for Enter. Code is in `src/intro/`: `main.ts` lifecycle and start screen, `scene.ts` three.js scene, `timeline.ts` camera path/palettes (pure maths), `audio.ts` synthesized score rendered offline into a buffer. It is lazy-loaded only when the intro plays. Generated inputs: `src/intro/logo-data.ts` from `Logo Transparent.svg` (`npm run logo`) and `src/intro/clapper-icon.png` + `icon-data.ts` from the print-resolution `Logo Zoom In2.ai` (`npm run icon`, CMYK decoded and colour-fitted to the SVG's embedded reference). Skip/Escape dismiss it; reduced-motion, Save-Data, weak devices and missing WebGL bypass it. In dev, `window.ziffIntro.seek(seconds)` freezes the intro at a time for screenshots (`seek(null)` resumes). CSS-Peeps (BSD-2-Clause, license included; Open Peeps artwork is CC0) is vendored in `vendor/css-peeps/` and copied to `public/vendor` by `scripts/prepare-public.mjs`. Draft1, the earlier 2D intro, is kept in `drafts/intro-draft1.html` and served at `/drafts/intro-draft1.html`. Node 22.19+ is recommended.

The contact form targets the existing PHP mailform endpoint and requires a hosted same-origin preview to submit successfully; opening the prototype as `file://` is for visual/interaction review only. Confirm the deployment host/runtime before completing form delivery and HTTP error handling.

## Docker Deployment (VPS)

The root [Dockerfile](../Dockerfile) builds the site and serves the static output with nginx. Build from the repository root, since the build needs the root `assets/`, `fonts/`, `*.html`, `robots.txt` and `sitemap.xml`.

Create `docker-compose.yml` in the repository root:

```yaml
services:
  ziff:
    build: .
    container_name: ziff
    restart: unless-stopped
    ports:
      - "80:80"
```

Then on the VPS:

```sh
git clone https://github.com/Seaside-Branding/ziffwebsite.git
cd ziffwebsite
docker compose up -d --build
```

To update: `git pull && docker compose up -d --build`. For HTTPS, put a reverse proxy (Caddy, Traefik, or nginx) in front and change `ports` to e.g. `"127.0.0.1:8080:80"`. Note the contact form's PHP mailform endpoint is not available on this static nginx container.
