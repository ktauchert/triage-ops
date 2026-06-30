# Agent prompt — Build Gridnull marketing site (Phase A)

Copy everything inside the **prompt block** below into a new agent session. Attach or reference these files in the same workspace:

1. **[landing-page-plan.md](./landing-page-plan.md)** — technical blueprint (stack, design, folder structure, phases)
2. **[landing-page-content.md](./landing-page-content.md)** — all marketing copy, SEO, legal footer text
3. **[legal.md](./legal.md)** — EULA/privacy guidance
4. Source files to sync later (Phase B): `install/EULA.md`, `install/PRIVACY.md`, `install/install.md`, `docs/security.md`

---

## Prompt (copy from here)

```
You are implementing the Gridnull public marketing site in the gridnull monorepo.

## Goal

Build **Phase A only** from docs/landing-page-plan.md: a credible marketing SPA at `apps/site` with routes Home, Features, Security, Editions, Contact, plus static legal pages EULA and Privacy.

Do NOT implement Phase B (full docs sync), Phase C (changelog/search), or Phase D (Stripe billing) unless explicitly asked.

Do NOT modify apps/web (product dashboard) except if required for shared assets — prefer keeping marketing separate.

## Required reading (read before coding)

1. docs/landing-page-plan.md — design system, tech stack, folder structure, acceptance criteria
2. docs/landing-page-content.md — USE THIS for all user-facing copy (headlines, features, FAQ, SEO titles, footer). Replace {{PLACEHOLDERS}} with sensible defaults and list what the owner must fill in.
3. docs/legal.md — footer links, legal page sources
4. install/EULA.md and install/PRIVACY.md — render on /legal/eula and /legal/privacy (copy into apps/site/src/content/legal/ or load at build time)

## Tech stack (non-negotiable unless owner overrides)

- apps/site — new npm workspace `@gridnull/site`
- React 19 + Vite 6 + TypeScript
- React Router 7
- Tailwind CSS 4
- Framer Motion 11 (respect prefers-reduced-motion)
- lucide-react icons
- Add root scripts: dev:site, build:site

## Design

Follow landing-page-plan.md §2:

- Dark neo-noir ops aesthetic: backgrounds #070b10 / #141c26, cyan accent #2ee6d6, amber sparingly for Pro badges
- Frosted glass cards, thin grid lines at low opacity
- Display font for headlines only (Rajdhani, Exo 2, or Orbitron); body Inter or Geist Sans
- Professional first — subtle neon, NO glitch effects, NO illegible neon-on-neon
- Mobile-responsive header with hamburger nav

## Routes (Phase A)

| Path | Content source |
|------|----------------|
| / | landing-page-content.md § Home |
| /features | landing-page-content.md § Features |
| /security | landing-page-content.md § Security |
| /editions | landing-page-content.md § Editions (include honesty banner about CE/Pro not enforced yet) |
| /contact | landing-page-content.md § Contact — default to mailto:{{CONTACT_EMAIL}} if no form backend |
| /legal/eula | install/EULA.md |
| /legal/privacy | install/PRIVACY.md |
| * | 404 with links to / and /docs |

## Components to build

Per landing-page-plan.md §5, minimum:

- MarketingLayout (SiteHeader, SiteFooter)
- Hero, FeatureGrid, TrustStrip, ScreenshotFrame (placeholder), EditionComparisonTable or PricingCards, ContactSection
- motion: FadeIn, StaggerChildren, optional ParallaxGrid on hero only
- ui: Button, Card, Badge, Container, Section
- MarkdownRenderer for legal pages (headings, lists, tables, links, blockquotes)

## Content rules

- Marketing claims MUST match shipped product — see landing-page-content.md § "What NOT to claim"
- Emphasize: on-prem, local Ollama, human-approved write-back, closed registration
- Editions page: clearly label CE/Pro as **planned packaging**
- Show write-back disclaimer on Features page (from landing-page-content.md)
- Footer: EULA, Privacy, copyright line from landing-page-content.md

## SEO

Implement per-route title + meta description from landing-page-content.md § SEO metadata. Use react-helmet-async or equivalent.

## Owner placeholders

If owner did not provide values, use these defaults and document in a short BUILD-NOTES.md in apps/site:

- CONTACT_EMAIL: hello@triageops.dev
- SITE_URL: https://triageops.dev
- COMPANY_NAME: Gridnull
- GITHUB_ORG: ktauchert

List placeholders the owner must replace before production launch.

## Questionnaire (§9 of landing-page-plan)

If critical decisions are missing, use §10 defaults from landing-page-plan.md:

- Primary CTA: Request pilot → /contact
- Contact: mailto or simple form without backend
- Docs: link to /docs with "coming soon" or stub DocsHomePage pointing to install guide only if Phase B not in scope — for Phase A, footer can link "Documentation" to a simple /docs page that says "Full docs in Phase B" OR render a single Install card linking to GitHub install.md — prefer minimal /docs stub with link to GitHub docs until Phase B
- Analytics: none
- Billing: none
- Language: English

## Acceptance criteria

- [ ] npm run build -w @gridnull/site passes
- [ ] npm run dev:site works
- [ ] All Phase A routes render on mobile and desktop
- [ ] prefers-reduced-motion disables parallax and CTA pulse
- [ ] No secrets in client bundle
- [ ] Legal pages render EULA and Privacy from repo markdown
- [ ] No broken internal links
- [ ] Lighthouse performance ≥ 85 on production build (best effort)
- [ ] Copy comes from landing-page-content.md, not invented features

## Implementation style

- Match monorepo conventions (see AGENTS.md): smallest correct diff, no drive-by refactors
- Do not commit unless owner asks
- After scaffold, update root package.json workspaces if needed
- Optional: add apps/site/BUILD-NOTES.md with deploy instructions (Cloudflare Pages / Netlify / Vercel static)

## Out of scope

- apps/web dashboard changes
- Stripe / license keys
- Full docs sync script (Phase B)
- GitHub Releases API changelog
- i18n / German pages (English only for Phase A)

Start by reading the three doc files, then scaffold apps/site per landing-page-plan.md §5 and §14, then implement pages using landing-page-content.md copy.
```

---

## How to use this

1. Open a new Cursor agent (or Composer) in the `gridnull` repo.
2. Paste the prompt block above.
3. Ensure the agent can read `docs/landing-page-plan.md`, `docs/landing-page-content.md`, and `install/EULA.md`.
4. Optionally answer §9 questionnaire in your first message (domain, contact email, logo).
5. Review staging build; replace `{{PLACEHOLDERS}}` in content before public launch.

## Owner quick answers (fill in before sending)

Copy this block into your message if you want to skip the agent questionnaire:

```
Domain: [your domain]
Contact email: [your email]
Primary CTA: Request pilot
Contact method: mailto / Formspree URL
CE download: GitHub Releases install ZIP (private pilot until public)
Screenshots: use placeholders
Cyberpunk intensity: 70% sober / 30% neon (default)
Analytics: none
Phase: A only
Language: English
```
