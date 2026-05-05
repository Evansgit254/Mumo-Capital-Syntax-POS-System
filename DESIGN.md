# DESIGN.md — Multi-Tenant Hospitality POS Design System

> **Stitch Project:** `projects/14780943935040185205`
> **Last Synced:** 2026-05-04
> **Device Target:** Mobile (390px — 780px rendered)
> **Color Mode:** Dark
> **Font Family:** Inter (all roles)

---

## 1. Brand Philosophy

The design system evokes **quiet luxury, precision, and effortless service**. The aesthetic is **Minimalist + Corporate Modern** — high-contrast for legibility in varying lighting (dim lounges → bright poolsides). It avoids decorative clutter in favour of generous dark space, rigorous alignment, and intentional colour hits.

> "The emotional response should be one of calm control and technical reliability."

---

## 2. Color Palette

### 2.1 Brand Accent Colors

| Role | Token | Hex | Usage |
|---|---|---|---|
| Primary (Neutral) | `--primary` | `#c8c6c5` | Text, icon tints |
| Action Accent | `--secondary` | `#6fd7d6` | CTAs, active states, borders |
| Alert / Warning | `--tertiary` | `#fbbc00` | Pending, warnings, urgent |
| Error | `--error` | `#ffb4ab` | Destructive actions, errors |

> Override values used in generation:
> - Primary override: `#121212`
> - Secondary override: `#008B8B` (Vibrant Teal)
> - Tertiary override: `#FFBF00` (Soft Amber)
> - Neutral override: `#E0E0E0`

---

### 2.2 Surface Scale (Dark Mode)

| Token | Hex | Role |
|---|---|---|
| `--surface` | `#121414` | Base background |
| `--surface-dim` | `#121414` | Dimmed background |
| `--surface-bright` | `#38393a` | Elevated surface |
| `--surface-container-lowest` | `#0d0e0f` | Deepest recessed surface |
| `--surface-container-low` | `#1a1c1c` | Level 1 lift (sidebars) |
| `--surface-container` | `#1e2020` | Level 2 (cards, inputs) |
| `--surface-container-high` | `#282a2b` | Level 3 (modals, drawers) |
| `--surface-container-highest` | `#333535` | Level 4 (overlays) |
| `--surface-variant` | `#333535` | Chip/tag backgrounds |

**Elevation is communicated via tonal surface steps — not shadows.**

---

### 2.3 On-Surface (Text / Icon Colors)

| Token | Hex | Usage |
|---|---|---|
| `--on-surface` | `#e2e2e2` | Primary body text |
| `--on-surface-variant` | `#c4c7c7` | Secondary / supporting text |
| `--outline` | `#8e9192` | Dividers, inactive borders |
| `--outline-variant` | `#444748` | Subtle border, inactive state |
| `--inverse-surface` | `#e2e2e2` | Light surface for tooltips |
| `--inverse-on-surface` | `#2f3131` | Text on light surface |

---

### 2.4 Semantic / Contextual Colors

| Token | Hex | Usage |
|---|---|---|
| `--on-primary` | `#313030` | Text on primary surface |
| `--primary-container` | `#121212` | Primary chip/badge bg |
| `--on-secondary` | `#003737` | Text on teal buttons |
| `--secondary-container` | `#2fa09f` | Teal chip/badge bg |
| `--on-tertiary` | `#402d00` | Text on amber elements |
| `--tertiary-container` | `#1a1100` | Amber badge bg |
| `--error-container` | `#93000a` | Error alert background |
| `--on-error-container` | `#ffdad6` | Text on error bg |

---

## 3. Typography

**Font Family:** `Inter` (all — display, headline, body, label)

| Scale | Size | Weight | Line Height | Letter Spacing |
|---|---|---|---|---|
| `display-lg` | 48px | 700 (Bold) | 56px | -0.02em |
| `headline-md` | 24px | 600 (SemiBold) | 32px | -0.01em |
| `body-lg` | 18px | 400 | 28px | 0 |
| `body-md` | 16px | 400 | 24px | 0 |
| `label-sm` | 12px | 600 | 16px | +0.05em (uppercase) |

**Rules:**
- Headlines: tight (negative) letter-spacing for premium editorial look
- Body: 16–18px minimum for tablet/terminal legibility
- Labels: UPPERCASE + wide tracking to distinguish from interactive content
- Numbers & prices: same weight as labels — perceived as a single unit

---

## 4. Spacing Scale

Base unit: **8px**

| Token | Value | Usage |
|---|---|---|
| `spacing-xs` | 4px | Micro gaps |
| `spacing-sm` | 12px | Inline padding |
| `spacing-base` | 8px | Grid unit |
| `spacing-md` | 24px | Card padding, gutters |
| `spacing-lg` | 40px | Section separators |
| `spacing-touch-target` | 56px | Minimum interactive height |

**Layout:** 12-column grid (desktop) → 6-col / single-col (mobile). Gutters: 24px. Vertical rhythm strictly follows 8px scale.

---

## 5. Shape / Border Radius

| Scale | Value | Usage |
|---|---|---|
| `radius-sm` | 0.25rem (4px) | Small chips, tags |
| `radius-default` | 0.5rem (8px) | Buttons, inputs |
| `radius-md` | 0.75rem (12px) | — |
| `radius-lg` | 1rem (16px) | Cards, modals |
| `radius-xl` | 1.5rem (24px) | Large containers |
| `radius-full` | 9999px | Status pills, avatars |

---

## 6. Component Patterns

### 6.1 Buttons

| Variant | Background | Text | Height | Border |
|---|---|---|---|---|
| Primary | `#008B8B` (Teal) | `#ffffff` | 56px | None |
| Secondary | Transparent | `#e0e0e0` | 56px | 1px `#383838` |
| Alert / Warning | `#ffbf00` (Amber) | `#121212` | 56px | None |
| Destructive | `--error-container` | `--on-error-container` | 56px | None |

### 6.2 Cards

- Background: `--surface-container` (`#1e2020`) default → `#2c2c2c` for interactive cards
- Border: 1px `#383838` (inactive) → 2px inner teal (`#008B8B`) on selected
- Border radius: `radius-lg` (16px)
- Padding: `spacing-md` (24px)

### 6.3 Input Fields

- Background: `--surface-container-low` (`#1a1c1c`)
- Border: 1px `--outline-variant` (`#444748`)
- Focus border: `--secondary` (`#6fd7d6`)
- Label: Always above the field (persistent visibility)
- Border radius: `radius-default` (8px)
- Min height: 56px (touch-safe)

### 6.4 Status Indicators (Pills)

| Status | Color | Shape |
|---|---|---|
| Available / Success | `--secondary` (Teal) | `radius-full` + UPPERCASE label |
| Pending / Reserved | `--tertiary` (Amber) | `radius-full` + UPPERCASE label |
| Occupied / Active | `--on-surface` (White) | `radius-full` + UPPERCASE label |
| Error / Closed | `--error` | `radius-full` + UPPERCASE label |

### 6.5 Lists

- Row height: **72px** (large touch targets for menu items)
- Divider: 1px `#2c2c2c`
- Active row: teal left border (2px)

### 6.6 Navigation / App Bar

- Background: `--surface-container-low` (`#1a1c1c`)
- Height: 56px (touch target compliant)
- Icon + label: `label-sm` scale

### 6.7 Modals / Drawers

- Background: `--surface-container-high` (`#282a2b`)
- Border radius (top): `radius-xl` (24px)
- Overlay: `rgba(0,0,0,0.6)` scrim

---

## 7. Elevation Model

No heavy drop shadows. Depth via **tonal surface steps** only:

| Level | Token | Hex | Usage |
|---|---|---|---|
| 0 — Base | `--surface` | `#121414` | Page background |
| 1 — Sidebar | `--surface-container-low` | `#1a1c1c` | Nav, sidebars |
| 2 — Cards | `--surface-container` | `#1e2020` | Default cards |
| 3 — Modals | `--surface-container-high` | `#282a2b` | Dialogs, drawers |
| 4 — Overlays | `--surface-container-highest` | `#333535` | Floating overlays |

Boundary lines: 1px `#383838` (inactive) → teal `#008B8B` (active focus).

---

## 8. Accessibility

- Minimum touch target: **44×44px** (visual may be smaller — invisible hit area)
- Contrast target: **7:1** minimum for all functional text on dark surfaces
- All toggles, checkboxes, steppers must have 44×44px invisible tap area
- Status never conveyed by color alone — always paired with a label

---

## 9. Screen Inventory

All screens are **MOBILE** device type (780px rendered width).

| # | Screen ID | Title | Height |
|---|---|---|---|
| 1 | `3a2569bfb2424714985a86b04f865cc1` | Staff & Workforce Management | 1768px |
| 2 | `8ae3a59c54a44db883120ab9880f39c5` | Loyalty & Discounts | 3912px |
| 3 | `4e42d7ddaea74d38a0a334150cdf0ca4` | Staff Dashboard | 4430px |
| 4 | `66b8f6b9f0d248978ca3c29125b9e4f8` | Tenant Administration | 4580px |
| 5 | `4c273cf1427d4fd4a999ab8410f5c925` | Inventory Forecasting | 1768px |
| 6 | `7c2dfdcfba5f4482983dff23fe46eda4` | Reports & Analytics | 3152px |
| 7 | `0ed64813b0924c3ca6f77d7c66ae1dce` | Table Service Details | 4930px |
| 8 | `3986ee8f141b4417b3cbccf744a0d4cd` | Billing & Settlement | 5538px |
| 9 | `5259bede7fae4862b94e87ad3eb19c0e` | Guest Folio & Checkout | 2940px |
| 10 | `ad99f7a7c5a34e169ff44e1ec4199ef8` | Reservations & Waitlist | 4320px |
| 11 | `dec2b042d5ee4d50a3b920df5923480f` | Vendor & Supply Chain | 1768px |
| 12 | `57328cffa5584a919e1d9b16cff297f7` | Digital Room Service | 4742px |
| 13 | `4c4d4e2067ef42888af73626500e8ea2` | POS Interface | 1770px |
| 14 | `2474a8d37d374830a594806fbf8f003e` | Hardware & Peripherals | 3928px |
| 15 | `62e92a4da9e34d41a5aa2ae0dbe6ffce` | Activity Booking | 8750px |
| 16 | `fe505a450ff147b0b67deda3a3ec38ff` | Outlet Menu Manager | 1768px |
| 17 | `2495c56e71204415afe6f568cabe0f7e` | Guest Folio & Checkout (v2) | 2940px |
| 18 | `d1f11880c5b14f069a9b7d5b7b471ce9` | Guest & Room Directory | 2962px |
| 19 | `941c5ced38ba46b6b5d1e33332e1f20a` | Digital Concierge | 3178px |
| 20 | `c28f9249a5224f42a38b0b019ffa03d8` | The Grand Horizon Resort — Splash | 884px |
| 21 | `1da4a1ffc92b4c86b9794f6f55574391` | Table & Seat Management | 1768px |
| 22 | `4e7916fa6951475795a9a2c6f357af59` | Kitchen Display System (KDS) | 1768px |
| 23 | `7b27ec1486764dafb6973b2ae7c399dd` | Interactive Floor Plan | 2396px |
| 24 | `bf12896e24494a728181606dd7dbc704` | Staff Permissions Management | 4198px |
| 25 | `273b1837fb19440b83325793501695fb` | Inventory Audit & Adjustment | 1786px |
| 26 | `f736bf612c934514ba9ada7936f75b3a` | Mobile Check-In | 2210px |
| 27 | `ff72144b8e194c43a85e91ecb0679cdd` | Outlet Customization (Detailed) | 6730px |
| 28 | `68b38b7587514f23b72d713f8134abcb` | Inventory & Stock Control | 4448px |
| 29 | `58d9a27742d449dd9d0bc2c5d2823095` | Outlet Customization | 5162px |
| 30 | `e78c34d5c3594854b68226dc070a5e1b` | Resort Executive Analytics | 1768px |

---

## 10. CSS Variable Reference

Paste this block into your root stylesheet to bootstrap all design tokens:

```css
:root {
  /* Brand Accents */
  --color-primary: #c8c6c5;
  --color-secondary: #6fd7d6;       /* Action Teal */
  --color-tertiary: #fbbc00;        /* Alert Amber */
  --color-error: #ffb4ab;

  /* Surfaces */
  --surface: #121414;
  --surface-dim: #121414;
  --surface-bright: #38393a;
  --surface-container-lowest: #0d0e0f;
  --surface-container-low: #1a1c1c;
  --surface-container: #1e2020;
  --surface-container-high: #282a2b;
  --surface-container-highest: #333535;
  --surface-variant: #333535;

  /* On-Surface */
  --on-surface: #e2e2e2;
  --on-surface-variant: #c4c7c7;
  --outline: #8e9192;
  --outline-variant: #444748;
  --inverse-surface: #e2e2e2;
  --inverse-on-surface: #2f3131;

  /* On-Accent */
  --on-primary: #313030;
  --primary-container: #121212;
  --on-secondary: #003737;
  --secondary-container: #2fa09f;
  --on-tertiary: #402d00;
  --tertiary-container: #1a1100;
  --error-container: #93000a;
  --on-error-container: #ffdad6;

  /* Typography */
  --font-family: 'Inter', sans-serif;
  --font-display: 700 48px/56px var(--font-family);
  --font-headline: 600 24px/32px var(--font-family);
  --font-body-lg: 400 18px/28px var(--font-family);
  --font-body-md: 400 16px/24px var(--font-family);
  --font-label: 600 12px/16px var(--font-family);

  /* Spacing */
  --space-xs: 4px;
  --space-sm: 12px;
  --space-base: 8px;
  --space-md: 24px;
  --space-lg: 40px;
  --space-touch: 56px;

  /* Border Radius */
  --radius-sm: 0.25rem;
  --radius: 0.5rem;
  --radius-md: 0.75rem;
  --radius-lg: 1rem;
  --radius-xl: 1.5rem;
  --radius-full: 9999px;
}
```
