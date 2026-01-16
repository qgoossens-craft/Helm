# Clio Theme Documentation

<!-- Claude: This document serves as a comprehensive reference for implementing the Clio theme in other applications. The Clio theme is a light, modern design system featuring a distinctive multicolor gradient background with rose/pink accents. When adapting this theme, prioritize the gradient background and rose accent color as they are the most recognizable visual elements. -->

## Introduction

This document provides complete styling specifications for the **Clio** theme, originally developed for the Helm application. Use this reference to replicate the Clio aesthetic in other projects while maintaining visual consistency.

<!-- Claude: The theme is identified by `data-theme="clio-gradient"` on the HTML element. If you're implementing theme switching, use this attribute to scope all Clio-specific styles. -->

**Theme Identifier:** `clio-gradient`
**CSS Selector:** `html[data-theme="clio-gradient"]`

---

## Theme Overview

<!-- Claude: Clio's design philosophy balances visual interest with readability. The multicolor gradient provides personality while semi-transparent white surfaces ensure text remains legible. This is NOT a dark theme—it's explicitly light with pure black text. -->

The Clio theme is characterized by:

1. **Vibrant Gradient Background** — A diagonal gradient flowing from coral through pink, teal, cyan, to purple creates a distinctive, memorable appearance
2. **Semi-transparent Surfaces** — White surfaces with 92-98% opacity allow the gradient to subtly show through, creating depth
3. **Rose/Pink Primary Accent** — The `#e11d48` rose color ties into the gradient's warm tones
4. **High Contrast Text** — Pure black text on white surfaces ensures excellent readability
5. **Obsidian-inspired Minimalism** — Clean lines, subtle borders, and restrained use of shadows
6. **Native Feel** — System fonts and short animations create a responsive, platform-appropriate experience

---

## Color Palette

<!-- Claude: These CSS custom properties should be defined at the :root or html[data-theme="clio-gradient"] level. The transparency in background colors is intentional—it allows the gradient to show through. Don't replace rgba values with solid colors or you'll lose the layered effect. -->

### Background & Surface Colors

| Variable | Value | Purpose |
|----------|-------|---------|
| `--color-helm-bg` | `rgba(255, 255, 255, 0.95)` | Main background overlay |
| `--color-helm-surface` | `rgba(255, 255, 255, 0.92)` | Card and panel backgrounds |
| `--color-helm-surface-elevated` | `rgba(255, 255, 255, 0.98)` | Dropdowns, modals, popovers |
| `--color-helm-border` | `rgba(0, 0, 0, 0.4)` | Borders and dividers |

<!-- Claude: The surface hierarchy uses transparency levels: elevated (0.98) > bg (0.95) > surface (0.92). This creates visual depth without shadows. More transparent = more gradient visible = appears "lower" in the stack. -->

### Text Colors

| Variable | Value | Purpose |
|----------|-------|---------|
| `--color-helm-text` | `#000000` | Primary text |
| `--color-helm-text-muted` | `#000000` | Secondary text (same as primary in Clio) |

<!-- Claude: Both text colors are pure black. In other themes, text-muted might be gray, but Clio uses black for both to maintain high contrast against the colorful background. Consider using opacity for muted text instead: rgba(0,0,0,0.7). -->

### Accent Colors

| Variable | Value | Purpose |
|----------|-------|---------|
| `--color-helm-primary` | `#e11d48` | Primary accent (rose-600) |
| `--color-helm-primary-hover` | `#be123c` | Primary hover state (rose-700) |
| `--color-helm-success` | `#16a34a` | Success states (green-600) |
| `--color-helm-warning` | `#ca8a04` | Warning states (yellow-600) |
| `--color-helm-error` | `#dc2626` | Error states (red-600) |

<!-- Claude: The primary color (#e11d48) is Tailwind's rose-600. It was chosen because it harmonizes with the gradient's warm coral/pink starting colors. If adapting to a different gradient, choose a primary that appears in or complements your gradient. -->

### Complete CSS Custom Properties

```css
html[data-theme="clio-gradient"] {
  --color-helm-bg: rgba(255, 255, 255, 0.95);
  --color-helm-surface: rgba(255, 255, 255, 0.92);
  --color-helm-surface-elevated: rgba(255, 255, 255, 0.98);
  --color-helm-border: rgba(0, 0, 0, 0.4);
  --color-helm-text: #000000;
  --color-helm-text-muted: #000000;
  --color-helm-primary: #e11d48;
  --color-helm-primary-hover: #be123c;
  --color-helm-success: #16a34a;
  --color-helm-warning: #ca8a04;
  --color-helm-error: #dc2626;
}
```

---

## Background Gradient

<!-- Claude: This gradient is THE defining visual element of Clio. Apply it to the html or body element with background-attachment: fixed so it doesn't scroll. The 135deg angle creates a top-left to bottom-right flow. -->

```css
--helm-bg-gradient: linear-gradient(135deg,
  #ff8a80 0%,      /* Light coral/salmon - warm entry point */
  #fda4af 20%,     /* Pink - transition zone */
  #fecdd3 40%,     /* Light pink - subtle middle */
  #e0f2f1 55%,     /* Light cyan/teal - cool transition */
  #67e8f9 70%,     /* Cyan - bright cool zone */
  #a78bfa 90%,     /* Purple - approaching end */
  #c084fc 100%     /* Magenta/violet - strong finish */
);
```

### Gradient Color Breakdown

| Stop | Hex | Color Name | Notes |
|------|-----|------------|-------|
| 0% | `#ff8a80` | Light coral | Warm, inviting starting point |
| 20% | `#fda4af` | Pink | Rose-300, ties to primary accent |
| 40% | `#fecdd3` | Light pink | Rose-200, soft transition |
| 55% | `#e0f2f1` | Light teal | Cool transition begins |
| 70% | `#67e8f9` | Cyan | Cyan-300, bright and fresh |
| 90% | `#a78bfa` | Purple | Violet-400, rich end zone |
| 100% | `#c084fc` | Magenta | Purple-400, strong finish |

<!-- Claude: The gradient flows from warm (coral/pink) to cool (cyan/purple). This creates natural visual movement. The 55% teal acts as a "bridge" between the warm and cool sections. If modifying the gradient, maintain this warm→cool flow for visual harmony. -->

### Implementation

```css
html[data-theme="clio-gradient"] {
  background: var(--helm-bg-gradient);
  background-attachment: fixed;
  min-height: 100vh;
}
```

---

## Typography

<!-- Claude: System fonts are used intentionally for native platform feel and zero font-loading delay. The stack prioritizes Apple's system font, then falls back through Windows and Linux options. Don't add custom web fonts unless specifically requested—they would conflict with the "native feel" design goal. -->

### Font Stack

```css
font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

### Heading Sizes

| Element | Size | Weight | Notes |
|---------|------|--------|-------|
| H1 | `1.5em` | 600 | Main page titles |
| H2 | `1.25em` | 600 | Section headers |
| H3 | `1.1em` | 600 | Subsection headers |
| Body | `1em` (16px base) | 400 | Standard text |
| Code | `0.9em` | 400 | Monospace font |

<!-- Claude: All headings use weight 600 (semi-bold) rather than 700 (bold). This provides emphasis without appearing heavy against the colorful background. The relative em units allow the typography to scale with user font-size preferences. -->

### Code Typography

```css
code, pre {
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 0.9em;
}
```

---

## Spacing & Sizing Conventions

<!-- Claude: These values follow Tailwind CSS conventions (1 unit = 4px). If you're using Tailwind, these map directly to utility classes. If writing custom CSS, use these pixel values or create matching CSS custom properties. -->

### Spacing Scale

| Class | Value | Common Uses |
|-------|-------|-------------|
| `p-1` / `m-1` | `4px` | Tight spacing, icon padding |
| `p-2` / `m-2` | `8px` | Standard small spacing |
| `p-3` / `m-3` | `12px` | Medium spacing |
| `p-4` / `m-4` | `16px` | Standard component padding |
| `p-6` / `m-6` | `24px` | Large spacing, section gaps |

### Border Radius Scale

| Class | Value | Common Uses |
|-------|-------|-------------|
| `rounded` | `4px` | Subtle rounding, small elements |
| `rounded-lg` | `8px` | Buttons, inputs |
| `rounded-xl` | `12px` | Cards, panels |
| `rounded-2xl` | `16px` | Large cards, modal corners |

<!-- Claude: Clio uses generous border radius (8-16px for most elements). This contributes to the friendly, modern aesthetic. Avoid sharp corners (0px) or extreme rounding (full/pill) except for specific use cases like avatar circles. -->

### Standard Dimensions

| Element | Size | Tailwind Class |
|---------|------|----------------|
| Header height | `48px` | `h-12` |
| Sidebar width | `240px` | `w-60` |
| Detail panel width | `320px` | `w-80` |

---

## Component Patterns

<!-- Claude: These patterns establish consistent interaction design. The key principle is subtle feedback—small scale changes, color shifts, and short transitions rather than dramatic animations. -->

### Buttons

```css
.btn {
  padding: 8px 16px;           /* py-2 px-4 */
  border-radius: 8px;          /* rounded-lg */
  transition: background-color 0.15s, transform 0.1s;
  cursor: pointer;
}

.btn:active {
  transform: scale(0.98);      /* Subtle press feedback */
}

.btn-primary {
  background-color: var(--color-helm-primary);
  color: white;
}

.btn-primary:hover {
  background-color: var(--color-helm-primary-hover);
}
```

<!-- Claude: The scale(0.98) on :active provides tactile feedback without being distracting. This is more subtle than scale(0.95) which can feel "jumpy". -->

### Text Inputs

```css
.input {
  padding: 8px 16px;           /* py-2 px-4 */
  background-color: var(--color-helm-surface);
  border: 1px solid var(--color-helm-border);
  border-radius: 8px;          /* rounded-lg */
  transition: border-color 0.15s, box-shadow 0.15s;
}

.input:focus {
  outline: none;
  border-color: var(--color-helm-primary);
  box-shadow: 0 0 0 2px rgba(225, 29, 72, 0.2);  /* Primary with opacity */
}
```

### Cards

```css
.card {
  background-color: var(--color-helm-surface);
  border-radius: 16px;         /* rounded-2xl */
  border: 1px solid var(--color-helm-border);
  padding: 16px;               /* p-4 */
}
```

<!-- Claude: Cards use the most transparent surface (0.92 opacity) to let the gradient show through slightly. This creates visual interest while maintaining content readability. -->

### Navigation Items

```css
.nav-item {
  padding: 8px 12px;
  border-radius: 8px;
  transition: background-color 0.15s;
}

.nav-item:hover {
  background-color: var(--color-helm-surface);
}

.nav-item.active {
  background-color: var(--color-helm-primary);
  color: white;
}
```

---

## Animations

<!-- Claude: All animations are intentionally short (0.2-0.3s). This creates a snappy, responsive feel. Longer animations (>0.5s) would make the interface feel sluggish. The easing functions are standard ease-out for entrances and ease-in for exits. -->

### Keyframe Definitions

```css
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes slide-up {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slide-down {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes scale-in {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes slide-in-right {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes check-pop {
  0% { transform: scale(0); }
  70% { transform: scale(1.3); }
  100% { transform: scale(1); }
}

@keyframes slide-out-complete {
  from {
    opacity: 1;
    transform: translateX(0);
  }
  to {
    opacity: 0;
    transform: translateX(30px);
  }
}
```

### Animation Durations

| Animation | Duration | Easing | Use Case |
|-----------|----------|--------|----------|
| fade-in | 0.2s | ease-out | Appearing elements |
| fade-out | 0.2s | ease-in | Disappearing elements |
| slide-up | 0.3s | ease-out | Modals, toasts appearing |
| slide-down | 0.2s | ease-out | Dropdowns opening |
| scale-in | 0.2s | ease-out | Popovers, menus |
| spin | 1s | linear, infinite | Loading spinners |
| pulse | 2s | cubic-bezier | Loading states |
| slide-in-right | 0.2s | ease-out | Side panel appearing |
| check-pop | 0.3s | ease-out | Checkbox completion |
| slide-out-complete | 0.4s | ease-in | Task completion dismissal |

<!-- Claude: The check-pop animation (scale 0→1.3→1) provides satisfying feedback for completing tasks. The overshoot to 1.3 creates a "pop" effect. slide-out-complete is slightly longer (0.4s) to give users time to see the item leaving. -->

---

## Scrollbar Styling

<!-- Claude: Custom scrollbars maintain the theme aesthetic on Windows/Linux where default scrollbars can be visually jarring. WebKit browsers (Chrome, Safari, Edge) support these properties. Firefox requires different syntax (scrollbar-width, scrollbar-color). -->

```css
/* WebKit browsers (Chrome, Safari, Edge) */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background-color: var(--color-helm-border);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background-color: var(--color-helm-text-muted);
}

/* Firefox */
* {
  scrollbar-width: thin;
  scrollbar-color: var(--color-helm-border) transparent;
}
```

---

## Focus & Accessibility

<!-- Claude: Focus states are critical for keyboard navigation. The 2px ring with offset ensures focus is visible against any background. Always maintain these states—removing them breaks accessibility. The primary color ring ties focus states to the theme's accent. -->

```css
:focus-visible {
  outline: none;
  box-shadow:
    0 0 0 2px var(--color-helm-bg),           /* Offset ring */
    0 0 0 4px var(--color-helm-primary);      /* Primary color ring */
}

/* Alternative for elements where box-shadow conflicts */
.focus-ring:focus-visible {
  outline: 2px solid var(--color-helm-primary);
  outline-offset: 2px;
}
```

### Accessibility Considerations

1. **Color Contrast** — Pure black text (#000000) on white surfaces exceeds WCAG AAA requirements
2. **Focus Visibility** — 2px ring with contrasting offset ensures visibility on all backgrounds
3. **Motion** — All animations respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Prose / Markdown Styling

<!-- Claude: Prose styling is used for rendered markdown content (documentation, notes, etc.). These styles ensure readable long-form content with appropriate spacing between elements. -->

```css
.prose {
  color: var(--color-helm-text);
  line-height: 1.6;
  max-width: 65ch;  /* Optimal reading line length */
}

.prose h1 {
  font-size: 1.5em;
  font-weight: 600;
  margin-top: 1.5em;
  margin-bottom: 0.5em;
}

.prose h2 {
  font-size: 1.25em;
  font-weight: 600;
  margin-top: 1.25em;
  margin-bottom: 0.5em;
}

.prose h3 {
  font-size: 1.1em;
  font-weight: 600;
  margin-top: 1em;
  margin-bottom: 0.5em;
}

.prose p {
  margin-bottom: 1em;
}

.prose ul, .prose ol {
  margin-bottom: 1em;
  padding-left: 1.5em;
}

.prose li {
  margin-bottom: 0.25em;
}

.prose code {
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 0.9em;
  background-color: var(--color-helm-surface);
  padding: 0.125em 0.25em;
  border-radius: 4px;
}

.prose pre {
  background-color: var(--color-helm-surface);
  border-radius: 8px;
  padding: 1em;
  overflow-x: auto;
  margin-bottom: 1em;
}

.prose blockquote {
  border-left: 3px solid var(--color-helm-primary);
  padding-left: 1em;
  margin-left: 0;
  color: var(--color-helm-text-muted);
  font-style: italic;
}

.prose a {
  color: var(--color-helm-primary);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.prose a:hover {
  color: var(--color-helm-primary-hover);
}
```

---

## Implementation Checklist

<!-- Claude: Follow this checklist when implementing Clio in a new application. The order matters—establish the foundation (gradient, colors) before building components. -->

### Phase 1: Foundation

- [ ] Add `data-theme="clio-gradient"` attribute to `<html>` element
- [ ] Define all CSS custom properties (color palette)
- [ ] Apply gradient background to `html` or `body` with `background-attachment: fixed`
- [ ] Set up font stack on `body`
- [ ] Add base text color

### Phase 2: Core Styles

- [ ] Implement scrollbar styling (WebKit + Firefox)
- [ ] Add focus-visible styles for accessibility
- [ ] Add `prefers-reduced-motion` media query
- [ ] Define animation keyframes

### Phase 3: Components

- [ ] Style buttons (primary, secondary states)
- [ ] Style text inputs and form controls
- [ ] Style cards and surface containers
- [ ] Style navigation elements

### Phase 4: Content

- [ ] Add prose/markdown styling if needed
- [ ] Ensure all interactive elements have hover/active states
- [ ] Test keyboard navigation and focus visibility
- [ ] Verify color contrast meets WCAG AA (minimum)

### Phase 5: Polish

- [ ] Add entrance/exit animations where appropriate
- [ ] Fine-tune spacing for consistency
- [ ] Test on various screen sizes
- [ ] Verify gradient renders correctly on all target browsers

---

## Quick Reference

<!-- Claude: This summary provides at-a-glance values for the most commonly needed properties. -->

```css
/* Essential Clio values */
--primary: #e11d48;
--gradient: linear-gradient(135deg, #ff8a80 0%, #fda4af 20%, #fecdd3 40%, #e0f2f1 55%, #67e8f9 70%, #a78bfa 90%, #c084fc 100%);
--surface: rgba(255, 255, 255, 0.92);
--border: rgba(0, 0, 0, 0.4);
--text: #000000;
--radius: 8px;
--transition: 0.15s ease;
--font: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

---

*Last updated: January 2026*
