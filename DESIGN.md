---
name: OAuth Ready, in Composio's visual language
description: >
  Design system for OAuth Ready, built on Composio's official Brand Hub (brand.composio.dev).
  Achromatic, infrastructure-grade developer UI: warm near-black / off-white surfaces,
  Geist Sans at 400/500 only, JetBrains Mono for chrome and code, one spot blue (#51a2ff)
  used only for interactive state. Format follows the DESIGN.md convention
  (YAML tokens up top, prose rules below).
version: 1.0
sources:
  official: [https://brand.composio.dev/guidelines.md, https://brand.composio.dev/colors/agent.json, https://brand.composio.dev/typography/agent.json, https://brand.composio.dev/platforms/agent.json, https://brand.composio.dev/codeblock/agent.json]
  measured: [https://composio.dev (production CSS), https://docs.composio.dev (production CSS)]
  retrieved: 2026-11-11

colors:
  # Brand: one spot blue, the same on both surfaces. A FILL, never body/heading/link text on light.
  brand: "#51a2ff"
  brand-hover: { light: "#3590f5", dark: "#51a2ff" }
  brand-active: { light: "#1f7ee8", dark: "#51a2ff" }
  brand-ink: { light: "#0b6fd6", dark: "#51a2ff" } # the READABLE blue: links, focus rings, selected rows
  brand-on-brand: "#0f0f0f" # the only legal text color on a brand fill
  # Surfaces (DEV = dark, FOR YOU = light)
  background: { light: "#f6f6f6", dark: "#0f0f0f" }
  card: { light: "#ffffff", dark: "#1e1e1e" }
  popover: { light: "#fafafa", dark: "#2a2a2a" }
  foreground: { light: "#0f0f0f", dark: "#ffffff" }
  border: { light: "#eaeaea", dark: "#2c2c2c" }
  accent-hover: { light: "#f5f5f5", dark: "#262626" } # neutral hover surface, NOT blue
  muted-foreground: { light: "rgb(15 15 15 / 0.60)", dark: "rgb(255 255 255 / 0.60)" } # hierarchy via alpha, not hue
  subtle-foreground: { light: "rgb(15 15 15 / 0.45)", dark: "rgb(255 255 255 / 0.45)" }
  # Semantic: literal meaning only
  destructive: { light: "oklch(0.577 0.215 27.3)", dark: "oklch(0.637 0.208 25.3)" }
  success: { light: "oklch(0.546 0.16 155.8)", dark: "oklch(0.648 0.17 155.8)" }
  warning: { light: "oklch(0.666 0.16 75)", dark: "oklch(0.758 0.163 75)" }
  # Code
  code-bg: { light: "#ffffff", dark: "#1e1e1e" }
  code-text: { light: "#0f0f0f", dark: "#e6e6e6" }
  code-border: { light: "#eaeaea", dark: "rgba(255,255,255,0.08)" }
  # Expressive gradients: hero art / OG images only, never UI chrome
  gradient-core: "linear-gradient(135deg, #FDFFC2, #00FFFF, #0089FF)"

typography:
  families:
    sans: "'Geist', sans-serif" # load via geist/font/sans
    mono: "'JetBrains Mono', monospace" # load via next/font/google
  display: { family: sans, size: 44px, weight: 400, lineHeight: 1.1, letterSpacing: "-0.025em" }
  h1: { family: sans, size: 32px, weight: 400, lineHeight: 1.15, letterSpacing: "-0.02em" }
  h2: { family: sans, size: 22px, weight: 500, lineHeight: 1.25, letterSpacing: "-0.01em" } # the ONLY 500 heading
  h3: { family: sans, size: 17px, weight: 400, lineHeight: 1.35 }
  body: { family: sans, size: 15px, weight: 400, lineHeight: 1.6 }
  body-sm: { family: sans, size: 13px, weight: 400, lineHeight: 1.5 }
  stat: { family: sans, size: 20px, weight: 400, lineHeight: 1.2, letterSpacing: "-0.01em", numeric: tabular-nums }
  label: { family: mono, size: 11px, weight: 500, lineHeight: 1.3, letterSpacing: "0.08em", transform: uppercase } # chrome, chips, table heads
  meta: { family: mono, size: 12px, weight: 400, lineHeight: 1.4 } # dates, counts, ids, versions
  code: { family: mono, size: 0.85rem, weight: 400, lineHeight: 1.6 }
  button: { family: sans, size: 14px, weight: 500, lineHeight: 1 }

rounded:
  none: 0px # DEFAULT: buttons, inputs, tabs, cards, code blocks, chips (docs.composio.dev ships --radius: 0)
  pill: 9999px # status dots and avatars only

spacing: # 4px base
  1: 4px
  2: 8px
  3: 12px
  4: 16px
  5: 20px
  6: 24px
  8: 32px
  10: 40px
  12: 48px
  16: 64px

layout:
  container-page: 1240px
  container-prose: 720px # guide body
  container-form: 520px # search / generate input
  container-cta: 380px
  gutter-mobile: 16px

elevation:
  shadow-elevated: "0 24px 60px -22px #0000001f, 0 6px 18px -10px #0000000f" # signature, measured from composio.dev
  usage: "Only on the one primary surface card per view (e.g. the verdict card). Everything else is flat and uses hairline borders."

components:
  button-primary: { bg: "{colors.foreground}", text: "{colors.background}", rounded: none, height: 40px, padding: "0 20px", typography: button }
  button-secondary: { bg: "{colors.card}", text: "{colors.foreground}", border: "1px solid rgb(from foreground / 0.15)", rounded: none, height: 40px }
  button-ghost: { bg: transparent, hover-bg: "{colors.accent-hover}", rounded: none }
  input: { bg: "{colors.card}", border: "{colors.border}", focus-ring: "2px {colors.brand-ink}", rounded: none, height: 44px }
  card: { bg: "{colors.card}", border: "1px solid {colors.border}", rounded: none, padding: 20px }
  chip: { bg: transparent, border: "1px solid {colors.border}", typography: label, rounded: none, height: 20px, padding: "0 6px" }
  tab: { typography: label, rounded: none, active: "border-bottom 2px {colors.foreground}" }
  code-block: { bg: "{colors.code-bg}", text: "{colors.code-text}", border: "{colors.code-border}", padding: "1rem 1.25rem", typography: code, rounded: none }
  link: { color: "{colors.brand-ink}", decoration: "underline on hover" }
  focus: { ring: "2px solid {colors.brand-ink}", offset: 2px }
---

# OAuth Ready: Design System

> **What this is.** OAuth Ready is a take-home project *for* Composio. It uses Composio's **visual language** (tokens, type, surfaces, tone) so it feels at home next to Composio's docs and dashboard.
> It is **not** an official Composio product. **Never use the Composio logo, wordmark or brand name as our identity.** Our wordmark is "OAuth Ready" set in Geist 500.

## 1. Where this comes from (evidence)

| Source | Grade | What we took |
|---|---|---|
| Composio Brand Hub `guidelines.md` and per-page `agent.json` (brand.composio.dev) | **Official** | Surfaces, colors, brand/ink/on-brand rules, typography rules, layout widths, voice |
| composio.dev production CSS (measured 2026-11-11) | **Measured** | `--shadow-elevated`, `--container-page: 1240px`, `--container-narrow: 520px`, mono labels with wide tracking (`tracking-wider`, `0.06–0.08em`) |
| docs.composio.dev production CSS (measured) | **Measured** | `--radius: 0`: the developer product is square-cornered |
| Community DESIGN.md files (VoltAgent `awesome-design-md` and copies, shadcn.io, etc.) | **Community** | Cross-check only |

**Correction we made:** most community Composio DESIGN.md files use **`#0007cd`** as the primary blue. The official Brand Hub says that value is **retired** ("1.75:1 and effectively invisible"). The current brand blue is **`#51a2ff`**, and **`#0b6fd6`** (brand-ink) is used when blue must be read on light. Community files also show the homepage's square, mono-uppercase buttons. The official rule says buttons are set in **Geist Sans**, so we follow the official rule. (That's the same evidence discipline the product applies to OAuth docs.)

## 2. Principles

1. **Plain is the house style.** The UI is achromatic: black, white and surface tokens. Hierarchy comes from **size, space and alpha**, never from hue or bold.
2. **Blue is a spot color (~7%).** It marks **interactive state only**: focus rings, the checked checkbox, the selected tab or row, the primary link color (as brand-ink). If a section feels plain, that is correct.
3. **Two surfaces, never mixed in one section.** DEV (dark) is our default, because this is a developer product like Composio's docs and dashboard. FOR YOU (light) is the alternate theme, used whole-page via the theme toggle and for print. Never put a dark card on a light section or the reverse.
4. **Infrastructure-grade.** Square corners, hairline borders, tight chrome, mono metadata. It should feel like docs.composio.dev, not a landing page.
5. **Clear over clever, technical not cold, confident not loud.** This applies to UI copy as much as to visuals.

## 3. Color rules

- **Surfaces:** page `background`, then `card` for content blocks, then `popover` for overlays. The surface step is the only "elevation" most things get.
- **Text:** `foreground` for primary text. Secondary text is `foreground` at 60% alpha (`muted-foreground`), tertiary at 45%. No grey hex values.
- **Brand `#51a2ff`** is a **fill** for: checked checkboxes, selected-state indicators, progress, the live-agent "running" pulse. The only text allowed on it is `brand-on-brand` (#0f0f0f). **Never put white text on brand.**
- **Brand-ink** is for **blue you read**: links, focus rings, selected-row text. On dark it's `#51a2ff`; on light it's `#0b6fd6`.
- **Never** fill anything larger than 24px with brand blue. That means no blue cards, banners or sections.
- **Semantic colors mean what they say:**
  - `success`: hands-on verified, a probe that passed, Tier 1 (no review)
  - `warning`: needs review or a wait (Tier 3), community-only evidence, conflicting sources
  - `destructive`: blockers, Tier 4 (gated), broken links, a quote not found in its source
  - Tier 2 and official-doc evidence stay **neutral**, because they don't need a color.
- Gradients (`gradient-core` etc.) are for OG images and hero art only. Never use them in UI chrome.

## 4. Typography rules (hard constraints)

- **Exactly two faces:** Geist Sans (load from the `geist` package, `geist/font/sans`) and JetBrains Mono (`next/font/google`). **Geist Mono, Inter, system-ui and serifs are banned.**
- **Sans is only 400 or 500.** `font-semibold`, `font-bold` and default `<b>`/`<strong>` are banned on sans. Style `strong`/`b` as 500.
  - display and h1 are 400
  - h2 is the **only** 500 heading
  - h3 and body are 400
- **Emphasis comes from size, not weight.**
- **Mono is for chrome and code:** chips, badges, table headers, dates, counts, ids, versions, step numbers, nav links, the URL in copy fields. It's the **only** face that may be uppercase with wide tracking (`label` token: 11px, 500, 0.08em, uppercase). Never set a heading or body paragraph in mono.
- **No eyebrow text.** Nothing goes above a heading: no kicker, overline, category label or "MOST COMMON" tag. Context goes **after** the heading or into the heading itself.
- Numbers in stats use `tabular-nums`.
- Before shipping, verify that computed `font-family` resolves to Geist / JetBrains Mono, and that no sans element is above 500.

## 5. Layout

- Page container 1240px. **Guide body uses the 720px prose column**, with metric grids allowed to span it. The search/generate form is 520px.
- 4px spacing base. Sections are separated by 48–64px. Cards have 20px padding (16px on mobile).
- Mobile: 16px gutters, single column, no horizontal scroll, and tabs wrap.
- Sticky top nav: 56px, `background` at 85% alpha with backdrop blur, hairline bottom border, mono-uppercase nav links.

## 6. Shape & elevation

- **Square everything** (`rounded-none`): buttons, inputs, cards, tabs, chips, code blocks, popovers. Only status dots and avatars are round.
- Borders: 1px `border` hairlines do the structural work.
- `shadow-elevated` appears **once per view**, on the primary surface card (the guide's verdict card, or the live-generation console). Everything else is flat.

## 7. Components

- **Buttons:**
  - Primary is a `foreground` fill with `background` text (white on dark, black on light), Geist 500 14px, 40px tall, square.
  - Secondary is a `card` fill with a `foreground/15` hairline.
  - Ghost is transparent with a `accent-hover` background on hover.
  - Never a blue button.
- **Inputs:** `card` fill, hairline border, 44px, square. Focus shows a 2px brand-ink ring.
- **Chips / badges:** mono `label` style, 1px border, square. Color only when semantic (see §3).
- **Tabs:** mono uppercase labels. The active tab has a 2px `foreground` underline; a brand dot is allowed as the selected-state marker.
- **Code / copy fields:** `code-bg` with a `code-border` hairline, JetBrains Mono 0.85rem/1.6, padding 1rem 1.25rem.
- **Popovers:** `popover` surface, hairline, square, and `shadow-elevated` allowed because popovers are overlays.
- **Icons:** Lucide only (Composio's official icon set), 16px, `currentColor`, stroke 1.5–2.
- **Links:** brand-ink, underline on hover.

## 8. Mapping to OAuth Ready UI

| Element | Treatment |
|---|---|
| Wordmark | "OAuth Ready" in Geist 500 16px, plus a 20px square `foreground` mark with "OR" in mono. **No Composio logo.** |
| Answer card | `card` + **shadow-elevated** (the one per view). Leads with the time-to-production range at `display` size, then the one-sentence verdict at 17px, three small stats, and the biggest risk as plain text with a `warning`-colored icon. Tier chip sits at the bottom, never above. |
| Tier badge | Mono label chip: `TIER 3 · FORMAL REVIEW`. Border and text are semantic: T1 success, T2 neutral, T3 warning, T4 destructive. |
| Owner chips | Mono label chips `AGENT`, `YOU`, `WAIT`, achromatic, with a Lucide icon (Bot / User / Hourglass). No emoji in product chrome. |
| Evidence chips | Mono superscript chips: `DOC`, `TESTED`, `PROBE`, `COMMUNITY`, `INFERRED`. `TESTED` is success. `COMMUNITY` and conflicts are warning. A quote not found in its source is destructive. All others are neutral. |
| Path picker | Selectable cards: path name, time until real users, tier chip. The default path is selected on load. |
| Steps | Collapsed rows: mono number, owner icon (User / Bot / Hourglass), title, time. Waiting steps use the `warning` color. Opening a row shows the detail, values to copy, gotchas and links. |
| Live agent console | A DEV code-surface panel (`code-bg`): mono log lines, a brand pulse dot for "running", success/destructive glyphs for probe results. |
| Requirements | Square checkboxes. Checked = brand fill with an `brand-on-brand` check. |
| Section headings | `h2` (500, 22px). No eyebrow. A one-line muted description may follow the heading. |

## 8a. Information hierarchy (progressive disclosure)

A guide holds a lot of facts. The page must not show them all at once.

1. **One answer first.** The top card leads with a single number (time until real users can connect) in the `display` size, then one sentence, three small supporting numbers and a row of chips (tier, biggest risk, cost, Composio status) whose detail is in tips. Nothing else.
2. **Titles by default, detail on demand.** Steps, nuances, blockers, handoff drafts, probes, the claim list and sources are rows that show only a title until opened. Steps have "Expand all".
3. **One evidence marker per sentence.** However many claims back a sentence, it gets one small chip (`DOC`, `DOC 3`, `MIXED 4`) in the tone of its weakest claim. The popover lists them all.
4. **Never repeat a block.** Numbers shown in the top card are not shown again in the same form below.
5. **Mono uppercase is rare.** Use it for chips and nav only. Stat labels and row metadata are small sans or lowercase mono, so they don't compete with headings.
6. **Paths are compared at a glance.** Each path is a selectable card showing its name, time and tier.
7. **Explanations live in tips, not on the page.** Use `Tip` (src/components/tip.tsx) for anything that explains rather than answers: how a number was estimated, what a tier means, a section's purpose, a requirement's detail, the biggest risk, cost, the Composio note. `Tip` opens on hover, tap and Enter, so it works on phones. Use `Hint` only for short icon labels. Section headings take a `tip`, not a visible intro paragraph. Things the reader must act on (step titles, checklist items, unverified items) stay visible.
8. **Orientation.** Wide screens get a sticky section list; sections are separated by a hairline and 48px.

## 9. Don'ts (quick reference)

- ❌ `font-semibold` / `font-bold` on any sans text
- ❌ Geist Mono, Inter, system fonts, serif fallbacks shipped
- ❌ Eyebrow labels above headings
- ❌ `#0007cd` (retired) or any second blue
- ❌ Blue text on light (use brand-ink), white text on blue fills, blue fills over 24px
- ❌ Rounded cards and buttons, decorative gradients in UI, colored tier and owner backgrounds used as decoration
- ❌ Mixing dark and light within one section
- ❌ The Composio logo or wordmark as our identity

## 10. Agent prompt guide

When generating UI for this repo: "Use the tokens in DESIGN.md. Use Composio DEV surface (#0f0f0f page, #1e1e1e cards, #2c2c2c hairlines), square corners, Geist Sans 400/500 only, JetBrains Mono uppercase 11px/0.08em for labels and chips, and #51a2ff only for interactive state (#0b6fd6 for readable blue on light). Put shadow-elevated on one primary card only. No eyebrows, no bold, Lucide icons."
