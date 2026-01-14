# Visual Redesign Plan: Figma to Production

## Overview

Apply the visual design language from the Figma design to the existing Greedy Dice Game application. This plan focuses **purely on look and feel** - all game mechanics and functionality remain unchanged.

---

## Design System Comparison

### Current App
- **Styling**: CSS custom properties + inline React styles
- **Colors**: `#1a1a2e` / `#16213e` background, `#22c55e` primary green
- **Surfaces**: `rgba(255, 255, 255, 0.05)` translucent overlays
- **Borders**: `rgba(255, 255, 255, 0.1)` subtle borders
- **Animations**: framer-motion
- **Icons**: Inline SVGs

### Figma Design
- **Styling**: Tailwind CSS utility classes
- **Colors**: Slate-900/Blue-900 gradient background, Emerald-500 primary
- **Surfaces**: `slate-800/50` semi-transparent cards with `border-slate-700`
- **Effects**: Animated blur blobs (`bg-emerald-500/10 blur-3xl animate-pulse`)
- **Borders**: More prominent `border-2` styling
- **Corners**: Larger radius (`rounded-xl`, `rounded-2xl`)
- **Animations**: Scale on hover (`hover:scale-105`), press feedback (`active:scale-95`)
- **Icons**: lucide-react

---

## Implementation Approach

**Decision: Hybrid approach** - Keep CSS custom properties infrastructure but update values to match Figma design. Add Tailwind-inspired visual effects.

This preserves:
- Existing responsive breakpoints
- Accessibility features (focus styles, reduced motion)
- CSS variable architecture for theming

While gaining:
- Figma's visual polish
- Animated background effects
- Enhanced button/card styling

---

## Phase 1: CSS Foundation Updates

### 1.1 Update Color Palette in `design-system.css`

```css
/* BEFORE */
--color-background: #1a1a2e;
--color-background-alt: #16213e;

/* AFTER - Match Figma slate/blue gradient */
--color-background: #0f172a;        /* slate-900 */
--color-background-alt: #1e3a5f;    /* blue-900 variant */
--color-surface: rgba(30, 41, 59, 0.5);  /* slate-800/50 */
--color-surface-elevated: rgba(30, 41, 59, 0.5);
--color-border: rgba(51, 65, 85, 1);     /* slate-700 */
```

### 1.2 Add Animated Background Blob Styles

Add to `design-system.css`:

```css
/* Animated background blobs */
.bg-blob {
  position: absolute;
  border-radius: 9999px;
  filter: blur(64px);
  animation: pulse 4s ease-in-out infinite;
  pointer-events: none;
}

.bg-blob-primary {
  background: rgba(16, 185, 129, 0.1); /* emerald-500/10 */
}

.bg-blob-secondary {
  background: rgba(59, 130, 246, 0.1); /* blue-500/10 */
  animation-delay: 1s;
}

@keyframes pulse {
  0%, 100% { opacity: 0.5; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.05); }
}
```

### 1.3 Update Body Background Gradient

```css
/* BEFORE */
background: linear-gradient(135deg, var(--color-background) 0%, var(--color-background-alt) 100%);

/* AFTER - Match Figma gradient */
background: linear-gradient(to bottom right, #0f172a, #1e3a5f, #0f172a);
```

### 1.4 Enhanced Button Styling

```css
.btn {
  /* Add Figma-style hover/active effects */
  transition: transform 150ms ease, box-shadow 150ms ease, background 150ms ease;
}

.btn:hover:not(:disabled) {
  transform: scale(1.02);  /* Reduced from current 1.05 for subtlety */
}

.btn:active:not(:disabled) {
  transform: scale(0.98);
}

/* Larger border radius for buttons */
.btn {
  border-radius: var(--radius-xl);  /* 16px, was radius-lg */
}

.btn-lg, .btn-xl {
  border-radius: var(--radius-2xl);  /* 24px */
}
```

### 1.5 Card/Surface Updates

```css
.card {
  border-radius: var(--radius-2xl);  /* Increase from xl */
  border-width: 1px;
  backdrop-filter: blur(8px);  /* Glassmorphism effect */
}

/* Active state cards (like selected options) */
.card-selected {
  border-width: 2px;
  box-shadow: 0 0 0 4px var(--color-primary-light);
}
```

---

## Phase 2: Component Visual Updates

### 2.1 App Root - Add Background Blobs

**File**: `client/src/App.tsx`

Add animated background blobs to the root container:

```tsx
<div style={{ minHeight: '100dvh', position: 'relative', overflow: 'hidden' }}>
  {/* Animated background blobs */}
  <div className="bg-blob bg-blob-primary"
       style={{ width: 384, height: 384, top: '25%', left: '25%' }} />
  <div className="bg-blob bg-blob-secondary"
       style={{ width: 384, height: 384, bottom: '25%', right: '25%' }} />

  {/* Existing content */}
  <header>...</header>
  <main>...</main>
</div>
```

### 2.2 Header Redesign

**File**: `client/src/App.tsx` (header section)

Updates:
- Use gradient text for "GREEDY" title: `background: linear-gradient(to right, #34d399, #10b981)`
- Add user pill with avatar: emerald border, slate background
- Icon buttons with consistent sizing

```tsx
<h1 style={{
  background: 'linear-gradient(to right, #34d399, #10b981)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  fontSize: 'var(--font-size-xl)',
  fontWeight: 'var(--font-weight-bold)',
}}>
  GREEDY
</h1>
```

### 2.3 AuthModal Visual Refresh

**File**: `client/src/components/auth/AuthModal.tsx`

Updates:
- Centered layout with max-width container
- Welcome text styling to match Figma
- Button redesign:
  - Google: White background, gray-900 text
  - Email: Blue gradient background
  - Guest: Slate background with border
- Add divider with "or" text
- Input field styling: `bg-slate-800/50 border-slate-700 focus:border-emerald-500`

### 2.4 Home Screen

**File**: `client/src/App.tsx` (home section)

Updates:
- Welcome message styling
- Create Game: Emerald gradient button with shadow
- Join Game: Blue gradient button
- Resume Game cards: Slate-800 background with emerald border for active games

### 2.5 Game Lobby

**File**: `client/src/components/lobby/GameLobby.tsx`

Updates:
- Game code display: Large emerald text, monospace
- Copy buttons: Emerald background, checkmark feedback
- Player cards: Slate-800/50 background, rounded-xl
  - Avatar circles: Colored backgrounds (blue for human, purple for AI)
  - HOST badge: Emerald with crown icon
  - AI badge: Purple background
- Add AI button: Dashed purple border, hover effect
- Collapsible sections: Chevron icons, smooth animations
- Start Game: Emerald gradient, prominent when ready

### 2.6 Create Game Screen

**File**: `client/src/components/lobby/CreateGame.tsx`

Updates:
- Option grids (target score, entry threshold, timer)
  - 2x2 grid layout
  - Selected state: Colored border + background glow
  - Emerald for target, Blue for entry, Purple for timer
- Category icons: Trophy, Shield, Clock from lucide-react
- Info boxes: Colored backgrounds with border

### 2.7 GameTheater (Gameplay)

**File**: `client/src/ui/GameTheater.tsx`

Updates:
- Section styling: `bg-slate-800/50 border-slate-700 rounded-2xl`
- Turn header: Larger text, color states (red for bust, green for success)
- Dice area: Maintain existing die styling
- Entry threshold progress: Orange gradient progress bar
- Action buttons:
  - Bank: Green gradient
  - Roll: Blue, or orange gradient for Hot Dice
  - Risk It: Orange/red gradient
  - Play Safe: Slate with border

### 2.8 MultiplayerGameBoard

**File**: `client/src/components/multiplayer/MultiplayerGameBoard.tsx`

Updates:
- Player bar styling: Slate background, emerald for current player
- Game code display in header: Smaller, rounded pill
- Menu dropdown: Solid slate-800 background (already fixed)

---

## Phase 3: Icon Migration (Optional)

Consider migrating from inline SVGs to lucide-react for consistency:

```tsx
import { Plus, Users, HelpCircle, LogOut, User, Trophy, Shield, Clock } from 'lucide-react';
```

Benefits:
- Consistent icon style
- Easier maintenance
- Tree-shaking for bundle size

---

## Phase 4: Animation Polish

### 4.1 Screen Transitions

Already using framer-motion. Ensure consistent:
- `initial={{ opacity: 0 }}`
- `animate={{ opacity: 1 }}`
- `exit={{ opacity: 0 }}`

### 4.2 Button Interactions

Add scale animations matching Figma:
```tsx
<motion.button
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.98 }}
>
```

### 4.3 Staggered List Animations

For player lists, game options:
```tsx
<motion.div
  initial={{ opacity: 0, y: 10 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: index * 0.05 }}
>
```

---

## Files to Modify

| Priority | File | Changes |
|----------|------|---------|
| 1 | `client/src/styles/design-system.css` | Color palette, backgrounds, blobs, button styles |
| 2 | `client/src/App.tsx` | Background blobs, header styling |
| 3 | `client/src/components/auth/AuthModal.tsx` | Full visual refresh |
| 4 | `client/src/components/lobby/GameLobby.tsx` | Full visual refresh |
| 5 | `client/src/components/lobby/CreateGame.tsx` | Option grid styling |
| 6 | `client/src/ui/GameTheater.tsx` | Section styling, buttons |
| 7 | `client/src/components/multiplayer/MultiplayerGameBoard.tsx` | Player bar, header tweaks |

---

## Implementation Order

### Step 1: Foundation (design-system.css)
- Update color variables
- Add blob animation styles
- Update button/card base styles

### Step 2: App Shell (App.tsx)
- Add background blobs
- Update header styling
- Test gradient backgrounds

### Step 3: Auth Flow
- AuthModal visual refresh
- Guest name screen styling

### Step 4: Game Setup
- CreateGame options styling
- GameLobby full refresh

### Step 5: Gameplay
- GameTheater visual updates
- MultiplayerGameBoard polish

### Step 6: Polish
- Icon consistency
- Animation timing
- Mobile responsiveness check

---

## Testing Checklist

After implementation:

- [ ] Dark background renders correctly
- [ ] Animated blobs are visible but subtle
- [ ] Buttons have proper hover/active states
- [ ] Cards have correct border radius and blur
- [ ] Colors match Figma palette
- [ ] Text is readable on all backgrounds
- [ ] Mobile layout works correctly
- [ ] Animations respect reduced-motion preference
- [ ] Focus states remain accessible

---

## Notes

- **Keep all game logic unchanged** - This is purely visual
- **Preserve accessibility** - Focus states, reduced motion support
- **Test on mobile first** - The app is mobile-focused
- **Maintain CSS variable architecture** - Enables future theming
