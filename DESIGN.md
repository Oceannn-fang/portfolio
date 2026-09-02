# DESIGN.md: gk3.website Reference

## Source
- URL: https://gk3.website/
- Capture date: 2026-08-05
- Evidence: Playwright screenshot, rendered DOM, `css/color.css`, `css/main.css`, `js/main.js`

## Reference Screenshot

![Full-page screenshot of gk3.website](./.firecrawl/gk3-website-desktop-full.png)

Use this screenshot as the visual source of truth for layout, hierarchy, density, and feel. Tokens below describe the same page in machine-readable form.

## Design Summary

The site is a one-page product-design portfolio with a hard left/right split. The left side is a fixed “device/viewer” panel showing the currently hovered work inside a phone or media frame. The right side is a long editorial list of roles, projects, and speaking appearances. The overall tone is playful, confident, and typographic: huge display type, lowercase captions, visible list borders, and a slowly rotating color pair driven by CSS variables.

## Design Tokens

### Colors

Observed base tokens from `css/color.css`:

- `--base-saturated`: `rgb(19, 69, 250)` (strong blue)
- `--base-pastel`: `#D3FED7` (minty pale green)
- Light mode foreground: `--base-saturated`
- Light mode background: `--base-pastel`
- Dark mode foreground: `#D3FED7`
- Dark mode background: `rgb(5, 18, 66)`
- Selection: foreground color as background, background color as text
- Accent shifts over time: `main.js` increments hue by `0.5` degrees at 15fps and writes new `--fg-color`, `--bg-color`, and `--scrim` values

The site does not rely on one fixed palette. The signature is a continuously rotating but still readable high-contrast pair.

### Typography

Observed loaded font families:

- Quincy Light: hero name, large display
- Quincy Text Italic: section/row titles
- Quincy Medium Italic: italic sublabels inside titles
- Ellograph Light: placeholder text and small captions
- Ellograph Demi: list items and footer labels
- Fallback body: `Times New Roman`

Key type scale:

- Hero `h1`: `70px`, line-height `80%`, letter-spacing `-2px`, weight normal
- Row `h2`: `56px`, line-height `100%`, letter-spacing `-1px`, weight normal
- List `ul`: `29px`, line-height `32px`, letter-spacing `-1px`, lowercase
- Row `h3`: `21px`, letter-spacing `-1px`, weight normal
- Footer/legal: about `14.75px`

### Spacing And Layout

- Desktop split: left viewer is `34%` width, right main content is `66%` width
- Right content is a flex column aligned to the start
- Hero height: `calc(100vh - 224px)`, with mobile fallback `calc(100vh - 278px)`
- Rows separated by `100px` bottom margin
- List items have `20px 24px 26px` padding with top and bottom hairline borders
- Row titles live at `24px` side margin
- Huge negative letter spacing and tight line heights make the type feel editorial

## Components

### Fixed Viewer

- Left side, full viewport height, `pointer-events: none`
- Contains `#videoFrame`, `#videoWrapper`, a video element, an `h4` placeholder, and a WebGL canvas
- Modes observed in HTML/CSS: `phone`, `video`, `social`, `pin`
- Phone mode shows a rounded black phone frame with media inside
- Social mode shows a circular `146px` icon track with vertical transforms
- On hover of a list item, the viewer switches to that item’s dataset mode

### Hero

- Right column hero contains the person’s name only, large display type
- No nav bar, no eyebrow, no marketing copy
- The name is the entire first screen statement

### Work/Role Rows

- Each row uses `h2` for the role/company/project name
- `h3` for the date range or subtitle
- A border-topped `ul` lists sub-items such as project names, products, and links
- Hovering a list item activates the viewer and adds `.active`
- Non-link items open viewer previews; link items show an arrow cursor

### Footer / Legal

- Small “find me elsewhere” row for social links
- A thin copyright bar
- A two-column justified “fine print” letter, used as personal voice rather than legal boilerplate

## Page Patterns

1. Name hero
2. Career chronology: role title, date range, sub-items
3. Occasional speaking section
4. Find me elsewhere
5. Copyright bar
6. Personal fine-print note

## Content Style

- Lowercase and short
- Uses arrows (`→`) and small caps/parenthetical labels
- Personal, playful, anti-corporate
- Example patterns: `director of ai software design at hp iq`, `2025 → 2026`, `occasional speaking`, `find me elsewhere`

## Agent Build Instructions

To rebuild a personal portfolio in this style for the existing Next.js project:

1. Use a fixed left preview rail (`~34vw` on desktop) and a right content rail (`~66vw`).
2. Make the hero just the person’s name and a compact current role line, with no nav bar or stacked marketing copy.
3. Build the main page as one chronological list of work/role rows. Each row has a large italic title, a small date range, and a hairline-divided list of sub-items.
4. Add a hover interaction: hovering a list item changes the left rail content. Use the existing portfolio images/albums as preview media.
5. Use the existing `ogl` dependency for a full-bleed grain/canvas shader in the left rail, or a lightweight CSS animated canvas fallback.
6. Let colors rotate through a base blue/pastel pair using CSS variables updated by JavaScript, while keeping text contrast readable.
7. Replace the default cursor with a small eye/arrow style cursor on desktop if the interaction needs it, but keep touch behavior accessible.
8. Keep mobile behavior simple: the left preview becomes an expandable overlay; the right content stays as the main scroll surface.
9. Do not copy GK3’s name, role history, images, or copy. Adapt the layout and interaction language to the personal portfolio data already in this repo.

## Rerun Inputs

workflow: firecrawl-website-design-clone
source_url: https://gk3.website/
target_stack: Next.js + Tailwind + motion + GSAP + ogl
output: DESIGN.md
