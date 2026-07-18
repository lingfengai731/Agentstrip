# WanderMind Studio Design System

## 1. Visual Theme & Atmosphere

WanderMind Studio is a calm travel-planning studio with an editorial marketing shell and a practical AI workspace. It should feel trustworthy, warm and locally informed rather than like a generic booking marketplace or a futuristic AI demo. Photography carries the emotional weight; interface chrome remains quiet and precise. The established yellow brand mark is the signature, teal communicates functional actions, and ink-on-paper neutrals keep long travel content readable.

- Overall feeling: warm, capable, grounded and human.
- Visual density: spacious on marketing pages; compact but orderly inside the AI workspace.
- Brand posture: a thoughtful travel studio with useful AI and real local partners.
- Signature motif: the yellow WanderMind mark paired with real, clearly labelled travel photography.

### Key Characteristics

- Full-bleed destination imagery with restrained overlays.
- Amber for brand recognition and active navigation; teal for functional progress and confirmations.
- Thin warm-gray borders and shallow shadows instead of floating card stacks.
- Clear separation between inspiration, planning and local fulfilment.
- Five-language parity: changing language changes every user-facing label and state.

## 2. Color Palette & Roles

| Role | Semantic Name | Value | Usage |
| --- | --- | --- | --- |
| Brand | WanderMind Amber | `#FCBF1E` | Logo emphasis, active tabs, signature highlights |
| Brand hover | Amber Deep | `#F59E0B` | Hover/pressed amber states |
| Functional action | Island Teal | `#0E7C6B` | Forms, confirmations, route/contact actions |
| Functional hover | Teal Bright | `#14B8A6` | Focus and hover feedback |
| Primary text | Studio Ink | `#1A1A1A` | Headings and important content |
| Secondary text | Graphite | `#4A4A4A` | Body copy |
| Muted text | Stone | `#8A8A8A` | Metadata, hints and captions |
| Page background | Travel Paper | `#FAFAF7` | AI workspace background |
| Secondary surface | Warm Canvas | `#F3F1EA` | Grouped controls and quiet bands |
| Card surface | White Paper | `#FFFFFF` | Forms, modal panels and cards |
| Structural border | Warm Line | `#E5E2DA` | Inputs, panels and separators |
| Soft divider | Sand Line | `#F0EDE5` | Subtle list and section separation |

### Interactive

- Amber identifies the product and current location; do not use it for every primary form action.
- Teal identifies actions that advance a task: verify, save, generate, request and contact.
- Focus rings use `rgba(20, 184, 166, 0.18)` at 3px with a solid teal border.
- Destructive or blocking errors use a restrained red with explanatory text, never color alone.

### Theme Modes

#### Light Mode

- Background: `#FAFAF7` or white marketing sections.
- Surface: `#FFFFFF`.
- Text: `#1A1A1A` / `#4A4A4A`.
- Accent: amber brand, teal actions.
- Notes: borders do most of the separation work; shadows remain faint.

#### Dark Mode

- Background: `#15171A`.
- Secondary background: `#1C1F23`.
- Surface: `#1F2226`.
- Text: `#F3F1EA` / `#C9C6BD`.
- Border: `#2D3036`.
- Accent: amber and teal stay stable rather than inverting.

### Shadows & Depth

- Small: `0 2px 8px rgba(0,0,0,.04)`.
- Medium: `0 6px 24px rgba(0,0,0,.06)`.
- Modal: `0 14px 40px rgba(0,0,0,.10)`.
- Modal overlay: ink at roughly 60% opacity; keep the underlying journey visible as context.

## 3. Typography Rules

### Font Family

- Primary UI: `Roboto`, system UI, then complete CJK fallbacks.
- Chinese fallback: `PingFang SC`, `Microsoft YaHei`, `Source Han Sans SC`, `Noto Sans SC`.
- Japanese and Korean rely on matching system sans fallbacks; do not force a Latin-only face.
- Font Awesome is for icons only.

### Hierarchy

| Role | Size | Weight | Line Height | Letter Spacing | Notes |
| --- | --- | --- | --- | --- | --- |
| Marketing hero | `42-58px` desktop, `32-38px` mobile | 600-700 | 1.08-1.18 | 0 | Short, concrete promise |
| Section heading | `30-40px` | 600-700 | 1.2 | 0 | One idea per section |
| Product panel title | `18-22px` | 700 | 1.35 | 0 | Compact and scannable |
| Body | `15-17px` | 400 | 1.65-1.75 | 0 | Travel explanations and trust copy |
| Form label | `12-13px` | 600-700 | 1.4 | `.02em` | Sentence case, always visible |
| Eyebrow/meta | `10.5-12px` | 700 | 1.4 | `.08-.12em` | Use only for genuine taxonomy |

### Principles

- Do not use viewport-scaled type; use explicit responsive steps.
- Labels remain visible above fields. Placeholders show examples, not labels.
- Interface text uses plain verbs: “Send code”, “Verify email”, “Build my plan”.
- Errors state what failed and what the user should do next.

## 4. Component Stylings

### Buttons and Links

- Primary task CTA: teal fill, white text, 10-12px radius, 44-52px height.
- Brand CTA: amber fill with ink text, used sparingly for the first journey action.
- Secondary CTA: transparent surface, warm border, ink text.
- Text links: teal or ink; underline appears on hover/focus where context is not obvious.
- Hover: small color shift or 1px lift only. No springy or decorative motion.

### Cards and Containers

- Standard radius: 12px; prominent modal or image panel: 16px.
- Border: 1px solid warm line.
- Shadow: small or none. Avoid cards inside cards.
- Internal spacing: 20-28px desktop, 16-20px mobile.
- Editorial sections stay unframed; cards are reserved for repeated choices, forms and real service units.

### Inputs and Interactive Controls

- Height: at least 44px; mobile targets at least 48px where practical.
- Background: paper; border: warm line; radius: 10px.
- Focus: teal border and visible 3px focus ring.
- Required, invalid, sending, verified and disabled states must have text plus visual feedback.
- Date, budget and traveller controls use native/semantic inputs and concise helper copy.

### Navigation

- Preserve the existing fixed global header and yellow logo.
- On scroll, increase surface opacity and add a thin border/shallow shadow.
- Mobile navigation collapses; keyboard focus and close behaviour remain explicit.
- The selected page is signalled by both color and state, not color alone.

### Image Treatment

- Use real Bali photography as the first-viewport signal on Bali-facing pages.
- Every gallery image declares two dimensions: subject (`scenery` / `culture`) and source (`camera` / `traveller phone`).
- Preserve natural aspect ratio with stable dimensions to prevent layout shift.
- Do not apply filters that disguise the real appearance of a place.

### Distinctive Components

- Reality lens: paired “camera view” and “traveller view” labels on destination media.
- Constraint starter: date range, total budget, traveller profile and travel intent in one calm flow.
- Local fulfilment handoff: carry the selected route into the driver/contact request without retyping.
- Auth modal: compact in-page panel with yellow mark, email verification and Google sign-in.

## 5. Layout Principles

### Spacing System

- Base unit: 4px.
- Common gaps: 8, 12, 16, 20, 24, 32, 48, 64 and 96px.
- Marketing section padding: 72-104px desktop, 48-64px mobile.

### Grid & Container

- Marketing content max width: roughly 1140-1200px.
- AI workspace max width: 1600px with 280px / fluid / 360px columns.
- Driver forms use a two-column form/trust layout and collapse to one column below tablet.
- Gallery grids preserve image rhythm without masonry overlaps or ambiguous click targets.

### Whitespace Philosophy

- Give each section one job and enough space to read it.
- Do not convert every paragraph into a card.
- Align copy, filters and CTAs to the same container edges.

### Border Radius Scale

- Micro: 8px.
- Standard: 10-12px.
- Large: 16px.
- Pill: only for filters, tags and compact status controls.

## 6. Depth & Elevation

| Level | Treatment | Use |
| --- | --- | --- |
| Flat | No shadow, section background | Editorial content and timelines |
| Ring | 1px warm border | Inputs, filters and utility cards |
| Card | Small/medium shadow | Auth, route and service cards |
| Modal | Overlay plus large shadow | Focused tasks without leaving the page |
| Focus | Teal ring plus border | Keyboard and field focus |

### Depth Principles

- Depth communicates hierarchy, not decoration.
- The page background remains visible behind modals to preserve task context.
- Avoid glass effects beyond the established translucent fixed header.

## 7. Do's and Don'ts

### Do

- Preserve the yellow logo, teal task color and existing editorial photography.
- Make every language switch update the full visible interface and document language.
- Explain the difference between inspiration, planning and bookable/local services.
- Carry known dates, budget and route context forward between pages.
- Respect keyboard focus, reduced motion and mobile tap targets.

### Don't

- Do not copy another product’s logo, purple palette, wording or illustration.
- Do not invent a new visual identity for individual pages.
- Do not promise live inventory, bookings or discounts unless the integration is real.
- Do not expose a local partner’s private contact details outside the controlled request flow.
- Do not use “AI” as filler when the user-facing benefit is time, clarity or local execution.

## 8. Responsive Behavior

| Name | Width | Key Changes |
| --- | --- | --- |
| Mobile | `<= 575px` | Single column, 48px controls, compact copy, bottom-safe modals |
| Tablet | `576-991px` | Collapsed navigation, stacked forms, AI side panels become drawers |
| Desktop | `>= 992px` | Full nav, multi-column planning and paired content/media layouts |
| Wide | `>= 1200px` | Full 280/fluid/360 AI workspace and generous editorial spacing |

### Touch Targets

- Core actions are at least 44x44px; aim for 48px on mobile.
- Filters may scroll horizontally but must show that more choices exist.

### Collapsing Strategy

- Keep the decision order intact when stacking; never move the primary CTA above required context.
- Auth modal becomes a near-full-width bottom-safe panel on small screens.
- Driver trust content follows the form on mobile and stays beside it on desktop.

## 9. Agent Prompt Guide

### Quick Color Reference

- Brand: `#FCBF1E`.
- Primary task CTA: `#0E7C6B`.
- Background: `#FAFAF7`.
- Heading: `#1A1A1A`.
- Body: `#4A4A4A`.
- Border: `#E5E2DA`.

### Quick Summary

Build a calm, real-world travel studio interface that preserves WanderMind’s yellow mark, teal task actions and ink-on-paper neutrals. Photography provides emotion; structure provides trust. Marketing pages stay editorial and spacious, while the AI workspace is compact and functional. Use light borders, modest radii and very shallow shadows. Every action and state must work in English, Chinese, Japanese, Korean and Indonesian.

### Example Component Prompts

- Auth: “Build a compact in-page authentication modal using the yellow WanderMind mark, visible form labels, teal task buttons, an email-code flow and an official Google sign-in button. Preserve the underlying journey as dimmed context.”
- Journey starter: “Create a date, total-budget, traveller-profile and intent selector that feels like a travel studio consultation, not a flight-search clone.”
- Bali media: “Create an editorial photo grid whose filters distinguish scenery/culture and camera/traveller-phone images; clicking opens practical place details and a short route.”
- Local handoff: “Create a driver/service panel that summarizes selected dates, route and budget before a controlled contact request.”

### Ready-to-Use Prompt

Use `DESIGN.md` as a strict visual and interaction contract. Extend the existing WanderMind Studio implementation rather than replacing its identity. Keep amber for brand/current state, teal for task progress, real destination imagery, warm paper surfaces, visible labels, five-language parity, keyboard focus and restrained motion. Do not add unrelated features or generic AI styling.

### Iteration Guide

1. Confirm the page’s single user job and preserve existing navigation.
2. Build with real content, states and mobile behaviour before adding motion.
3. Audit all five languages, keyboard paths, console errors and visual consistency.

## Appendix: Interaction Patterns

- Scroll: fixed navigation gains opacity; content reveals should be subtle and reduced-motion safe.
- Hover: one small response per component, normally color, border or 1px elevation.
- Click: buttons enter an immediate pending state and preserve entered data on recoverable failure.
- Modal: focus moves inside, Escape closes when safe, focus returns to the trigger.

## Appendix: Content & Messaging Patterns

- Headline pattern: outcome first, destination/context second.
- CTA language: direct user action, such as “Choose dates and budget” or “Add this stop”.
- Trust signals: real image source, practical time/cost range, local partner role and privacy handling.
- Voice: calm, direct and specific. Avoid travel superlatives and vague apologies.

## Appendix: Observed Pages

- `https://wandermind.cc/`: global marketing shell, imagery, navigation and brand voice.
- `https://wandermind.cc/bali`: editorial destination page, gallery and itinerary rhythm.
- `https://wandermind.cc/find-driver`: form/trust layout and local handoff.
- `https://wandermind.cc/ai-tool`: product density, dual theme and planning interactions.
- CollectUI reference: auth composition only; its branding and visual identity are explicitly excluded.
