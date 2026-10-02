# ZIFF Website Rewrite Plan

## Purpose and Non-Negotiable

Rebuild the Mobirise-managed Zoom In Film Festival (ZIFF) website as a modern, interactive experience without losing any existing context or content. This document is the migration contract for the work.

**No source content is to be deleted, summarized, rewritten, replaced, or made inaccessible without an explicit, recorded owner approval.** This includes text, Romanian and English variants, images, videos, alt text, links, anchors, metadata, forms, policy tables, and behavior. When the source is unclear, preserve it and raise a question; do not guess.

The current root-level HTML and `project.mobirise` are the agreed baseline. The separate WordPress blog at `/blog` stays external. Legal copy remains verbatim unless an authorized reviewer approves changes.

## Recommended Technology

Use **Astro + TypeScript**, generating static HTML for the site's largely editorial 28 routes. Add **React islands** only for interactive controls that benefit from client-side state, such as gallery filtering/lightbox, an archive browser, and a timeline. This provides rich interaction without shipping a large client application to every content page.

Keep page and collection content structured, source-controlled, and reviewable. Use semantic HTML and progressive enhancement so core content and navigation remain available when JavaScript or animation is unavailable. A serverless/API endpoint may be needed for mail forms if the eventual host cannot run the current PHP mailform backend; confirm hosting before selecting that approach.

## Current Site at a Glance

- 28 root HTML routes, generated from Mobirise 6.1.12 with the StartM5 theme.
- Main project source: `project.mobirise`. It includes component/page data, theme tokens, font configuration, and global integration settings.
- Shared interface: fixed navigation with dropdowns, social and email links, repeated footer, cookie consent UI, scroll-responsive navigation, and Mobirise animation/parallax behavior. Verify shared components per route because the generated pages are not perfectly uniform.
- The original Mobirise theme uses primary `#dcdeff`, secondary `#ff8f7a`, success `#550000`, info `#ffd700`, warning `#241e4e`, and danger `#ff0000`. The current rewrite direction uses oxblood `#550000`, coral pink `#FF8F7A`, dusty rose `#C27A7A`, DCDEFF `#DCDEFF`, and pale blue `#F3F4FF`; the navbar uses oxblood instead of a bright/light surface. Use the local IntroRust-Base display face and Oswald Variable for body and supporting text.
- Content includes festival history and identity, people, partners, collaborations, press assets, donations/support, 43 gallery images, four past-film entries, participation instructions, FAQs, forms, and bilingual legal/policy content.
- Existing media, libraries, source fonts, generated derivatives, and project histories live under `assets/`, `fonts/`, and `history/`. Retain these originals during migration.

## Page Inventory

Every route below remains in scope, including routes that may not be linked from the primary navigation.

| Route | Current content and behavior to preserve |
| --- | --- |
| `index.html` | 2027 landing page, festival introduction and history, ticket widget, first-edition judges, newsletter, gallery preview, contact form. |
| `about.html` | About ZIFF, story/content sections, registration call to action, newsletter. |
| `team.html` | Team/leadership profiles and portraits, profile links to the blog, newsletter. |
| `partners.html` | Partner information, partner imagery/logos/links, newsletter. |
| `collabs.html` | 2027 collaboration content, partner imagery and logos. |
| `gallery.html` | 43 gallery images and existing lightbox behavior, newsletter. Preserve image order and asset mapping. |
| `past-movies.html` | Four prior film entries, posters and two YouTube embeds. One image is marked `PLACEHOLDER`; retain and flag it for review rather than substituting art. |
| `press.html` | Press room, festival mission, media assets/brand kit, press information. |
| `donate.html` | Support/donation-related content and festival legacy material. |
| `register.html` | Registration content and embedded Pretix ticket shop. |
| `submit.html` | Submission guidance, eligibility, checklist, key dates, questions, and Pretix content. |
| `join.html` | Team/volunteer information, external LarkSuite application, and contact form. Preserve the `join.html#article21-1x` deep link or an equivalent tested alias. |
| `contact.html` | Contact details, social links, and WitSec mail form. |
| `help.html` | FAQ/help content and WitSec mail form. |
| `report.html` | Ethics/reporting information, WitSec mail form, integrity contact. |
| `success.html` | Successful submission confirmation and recovery/navigation links. |
| `rules.html` | Ten rules sections in Romanian and English. Preserve both complete language versions and their structure. |
| `tos.html` | Terms of participation/purchase in Romanian and English. Preserve exact wording and hierarchy. |
| `privacy.html` | GDPR/privacy content in Romanian and English. Preserve exact wording, lists, and hierarchy. |
| `cookies.html` | Cookie policy, categories/providers, local storage keys, and related tables/text. |
| `legal.html` | Legal/operator information. Preserve all wording and links. |
| `400.html` | Bad request error and home recovery link. Configure the real HTTP status at the host. |
| `401.html` | Unauthorized error and recovery. Configure the real HTTP status at the host. |
| `403.html` | Forbidden error and recovery. Configure the real HTTP status at the host. |
| `404.html` | Not found error and recovery. Configure the real HTTP status at the host. |
| `500.html` | Internal server error and recovery. Configure the real HTTP status at the host. |
| `503.html` | Service unavailable error and recovery. Configure the real HTTP status at the host. |
| `maintenance.html` | Maintenance notice, gallery link, newsletter and contact form content. |

## Existing Integrations and Workflows

Treat these as production workflows. Do not remove or replace a provider without owner approval and end-to-end verification.

| Integration | Evidence in current source | Migration requirement |
| --- | --- | --- |
| Pretix | `tickets.zoomin-filmfest.com`; widgets on home, register, and submit routes | Preserve the widget, fallback/help text, and ticket purchase flow. Verify on production domain. |
| WordPress blog/newsletter | Blog at `zoomin-filmfest.com/blog`; newsletter POSTs to the WordPress Newsletter Plugin endpoint | Keep the blog external and preserve newsletter subscription behavior unless separately approved. |
| WitSec mail forms | PHP mailform assets and forms on home/contact/help/report/join/maintenance | Preserve fields, validation, recipient, autoresponder, redirects, and success/error feedback. Confirm PHP hosting or implement a secure endpoint. Never expose mail credentials. |
| LarkSuite | Volunteer application iframe on `join.html` | Preserve external application access and confirm the live form still works. |
| Google reCAPTCHA v3 | Contact/help/report/join/maintenance and home form references | Preserve protection while verifying privacy, consent, domain key, and server-side validation behavior. Keep secret material server-side. |
| Google Analytics | Measurement ID `G-6H26HJNXGW` | Respect user consent and avoid duplicate initialization. Verify network requests for accepted and declined states. |
| YouTube | Two film embeds on `past-movies.html` | Preserve videos and provide accessible playback and consent-aware loading where required. |
| Social/email destinations | Instagram, TikTok, email, team/blog links | Preserve destination and meaningful accessible names. |
| ANPC remote imagery | Consumer-protection images in page footers | Preserve image links/assets and verify the remote URLs or approved local copies. |

## Source and Asset Map

- `project.mobirise`: Mobirise page/component data, theme, typography, mailform configuration, analytics configuration, and custom global scripts.
- Root `*.html`: deployed page content, actual HTML semantics, per-page metadata, links, embeds, form markup, and generated interactions. Treat as authoritative for rendered page content.
- `assets/images/`: logos, portraits, gallery photography, film posters, partner marks, and duplicate/original/converted image versions. Do not deduplicate or rename until references and hashes are mapped.
- `assets/`: Mobirise/Bootstrap styles and scripts, gallery/lightbox code, parallax, video players, mail form, and related libraries. Replace dependencies selectively only after behavior parity is verified.
- `fonts/`: local font files. Preserve licenses and file identity; do not assume a web font is interchangeable with a local face.
- `history/`: dated Mobirise snapshots. Use only to resolve an ambiguity or recover context, not to override the current source baseline without approval.
- `publish-hashes.json` and `assets/images/hashes.json`: published asset/hash information. Retain as migration evidence.
- `sitemap.xml` and `robots.txt`: preserve URL discoverability and crawler policy; update only with a reviewed route mapping.

## Content-Preservation Method

### 1. Freeze the baseline

Before content migration, record a baseline revision/date and inventory all source paths. Keep the existing source site untouched in the repository. The new application belongs under `site-rewrite/`.

### 2. Build a content and behavior manifest

For all 28 routes, record:

- Page path, title, description, canonical/social metadata, language, and heading order.
- All visible text, including captions, form labels, validation/success messages, footer text, legal tables/lists, and bilingual variants.
- Internal/external links, query strings, fragments, target behavior, and meaningful element IDs.
- Images, video/audio, embeds, downloads, image order, alt text, dimensions, and original asset paths.
- Forms: action, method, field names/types/required state, hidden fields, validation, anti-spam, recipients/autoresponders, redirect, and success/error state.
- Interactive behavior, consent effects, analytics events, and page-specific navigation.

Capture hashes for source media. For text extraction that does not preserve reading order, compare visually and manually; do not use an automated diff as the sole legal-content review.

### 3. Migrate without destructive cleanup

Preserve source wording, images, links, IDs, and order by default. Keep duplicate files until the old-to-new asset map proves which files are equivalent and every reference is migrated. Record proposed corrections and missing/broken external destinations in a discrepancy log for owner decisions rather than silently changing them.

### 4. Verify route by route

Compare rendered pages against the manifest and source snapshots. Acceptance requires no unexplained missing content, media, language version, anchor, link, metadata, or interaction. Record any approved difference with the approver, date, reason, and affected route/content.

## Rebuild Plan

1. **Create the migration dossier and baseline manifest.** This file documents known context; the implementation should add a machine-readable per-route manifest before migrating page content.
2. **Set up `site-rewrite/`.** Initialize Astro and TypeScript there, keeping the existing Mobirise site at the repository root during development. Add formatting/type checks and build instructions when the application scaffold is approved.
3. **Build shared foundations.** Recreate semantic page shell, navigation/dropdowns, footer, SEO metadata, consent management, typography/color tokens, and accessible responsive layout. Preserve old public paths and fragment links or provide tested permanent redirects/aliases.
4. **Move structured content.** Create explicit content modules/collections for films, gallery items, people, partners, and page text. Keep policy text diffable and verbatim. Keep non-JavaScript HTML as the source of truth for reading.
5. **Migrate route groups.** Move editorial/festival pages, participation/support routes and integrations, bilingual legal pages, then error/maintenance pages. Verify each group against the manifest before continuing.
6. **Implement and verify workflows.** Confirm Pretix, forms, email delivery, LarkSuite, newsletter, consent/analytics, videos, and external links. Do not treat a visible form or iframe as proof that submission succeeds.
7. **Layer in interactions and motion.** Add only after base content is stable. Verify mobile, keyboard, reduced-motion, and performance behavior as each interactive feature is introduced.
8. **Preview and cut over only after sign-off.** Confirm current hosting/runtime, production error status handling, HTTPS, redirects, analytics consent, and third-party domains. Keep the old site available until owner acceptance.

## Interactive Experience Direction

Make browsing feel cinematic, playful, and participatory, while keeping the festival's actual information easy to find. Suggested interactions:

- **First-visit 2027 opening sequence:** a roughly six-second graphic film-leader/countdown with no festival photos, three animated CSS-Peeps characters, an animated clapperboard/stage marks, and the supplied ZIFF logo, resolving to February 2027. Play once per tab, provide a visible Skip control and Escape key, and bypass automatically for `prefers-reduced-motion`. CSS-Peeps code is BSD-2-Clause and its Open Peeps artwork is CC0; preserve those notices/attributions when vendoring or redistributing the dependency.
- **Explore the festival timeline:** an animated, navigable history of editions and milestones, with full text available without animation.
- **Browse the films:** filterable archive by edition/category where the source provides those values; film details can expand to show existing copy and media. Do not invent metadata to fill missing fields.
- **Explore the gallery:** responsive mosaic/grid, keyboard/touch-operable lightbox, next/previous navigation, captions/alt text, and direct image links where useful.
- **Choose a browsing path:** optional starting choices such as “watch,” “join,” or “learn,” which highlight relevant existing pages without hiding the full navigation.
- **Cinematic transitions and scroll reveals:** short, purposeful entrances, film-strip or editorial transitions, and subtle hover states. Content remains visible and usable if motion is disabled or scripts fail.

Motion/accessibility rules:

- Honor `prefers-reduced-motion`; offer pause/stop for any continuous movement.
- No scroll hijacking, unskippable wait, auto-playing sound, motion-only information, or animation blocking legal text, forms, ticket purchase, reporting, or navigation. The optional first-visit intro must remain skippable and respect reduced motion.
- Support keyboard focus and operation, screen-reader names/states, touch input, contrast, and stable layouts.
- Lazy-load offscreen media, avoid layout shifts, and keep small-screen/low-power performance in the acceptance criteria.

## Known Risks and Questions to Resolve

- **Analytics and consent mismatch:** source pages load GA in the page head before consent and also include a separate consent-time initializer. Rebuild the intended consent choice, not this duplicated/unconditional implementation. Confirm applicable consent/legal requirements with the site's owner.
- **Newsletter popup reference:** the custom script refers to `global-newsletter-popup` and localStorage subscription/cooldown keys. Confirm whether the element exists on any route before recreating or removing the behavior.
- **Mail form deployment:** current forms post through PHP. Hosting/runtime and secure delivery mechanism must be confirmed before replacing the backend.
- **Content accuracy:** one past-film image is explicitly marked placeholder; several image alts are generic or blank. Preserve those source states and get owner approval for any replacement copy/assets.
- **Live-site drift:** this plan uses the workspace snapshot as the baseline. Differences found on the deployed site should be logged and reviewed, not silently imported.
- **HTTP error pages:** static hosting may serve an error document with HTTP 200 unless host routing is configured. Verify actual HTTP status codes for 400/401/403/404/500/503 where supported.
- **External service consent and availability:** Pretix, reCAPTCHA, Google Analytics, WordPress, LarkSuite, YouTube, and remote ANPC images need production-domain verification.

## Acceptance Checklist

### Completeness
- [ ] All 28 original routes are represented and discoverable.
- [ ] Every text unit, heading, image, media embed, download, link, anchor, form, language variant, and metadata item is matched to the baseline manifest.
- [ ] Romanian and English policy/rules content is complete and unchanged unless a named reviewer approved a difference.
- [ ] Source assets and historical project files remain intact; all changed asset names have an old-to-new mapping.
- [ ] No page content is available only through a client-side interaction.

### Functionality
- [ ] Pretix ticket workflow and fallback are verified.
- [ ] All mail forms submit with correct validation, anti-spam, delivery, autoresponse, redirect, and success/error states.
- [ ] Newsletter registration and external blog links work.
- [ ] LarkSuite application works at the production origin.
- [ ] Consent accept/decline/manage works, and analytics is not initialized before permitted consent.
- [ ] Gallery/lightbox, archive, timeline, video playback, and every navigation/fragment link work with keyboard and touch.
- [ ] Error and maintenance pages offer useful recovery; host status behavior is verified.

### Quality
- [ ] Desktop and mobile layouts are checked.
- [ ] Keyboard access, focus visibility, screen-reader labels/landmarks, contrast, and reduced motion are checked.
- [ ] Animations do not hide, delay, or obstruct content and remain performant on mobile.
- [ ] Production build and preview pass; sitemap, robots, metadata, redirects, and links are reviewed.
- [ ] Owner signs off the discrepancy log and route-by-route content review before cutover.

## Confirmed Scope Decisions

- `/blog` remains a separate external WordPress site.
- The checked-in workspace source is authoritative; differences from the live site are flagged for review.
- Legal and policy wording stays verbatim until an authorized reviewer approves edits.
- All 28 Mobirise-managed routes are in the rewrite scope. The existing site stays intact during implementation.
- Deployment host/runtime has not yet been confirmed. Preserve the current domain and URLs; confirm host-specific implementation before configuring forms and HTTP error statuses.
