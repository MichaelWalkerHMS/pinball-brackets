# IFPA Bracket Predictor - Mobile Responsive Fixes

## Summary of Issues & Solutions

### Issue 1: Header Navigation Collision
**Problem:** Nav items (About, FAQ, Settings, Admin, username) collide with page title on mobile.

**Solution:** Collapse nav into hamburger menu on mobile.

```jsx
{/* Desktop nav - hide on mobile */}
<nav className="hidden md:flex items-center gap-4">
  {/* nav items */}
</nav>

{/* Mobile hamburger - show only on mobile */}
<button className="md:hidden text-white p-2">
  <HamburgerIcon />
</button>

{/* Mobile dropdown menu - conditionally rendered */}
{menuOpen && (
  <nav className="md:hidden bg-slate-800 ...">
    {/* stacked nav items */}
  </nav>
)}
```

---

### Issue 2: Title Awkward Word Breaks
**Problem:** "2026 Michigan State Championship" breaks word-by-word.

**Solution:** Use responsive font sizing and proper leading.

```jsx
<h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
  {tournament.name}
</h1>
```

Key patterns:
- `text-2xl sm:text-3xl` - Smaller on mobile, larger on tablet+
- `leading-tight` - Tighter line height for multi-line titles
- Let natural word-wrap happen rather than forcing breaks

---

### Issue 3: Badge/Rank Text Collision ("Incompletenk")
**Problem:** "Incomplete" badge crashes into "Rank" text.

**Solution:** Restructure row to stack on mobile, use flex-shrink-0 on badges.

```jsx
<div className="flex flex-col sm:flex-row sm:items-center gap-3">
  {/* Left: Badge + Name */}
  <div className="flex items-center gap-2 flex-1 min-w-0">
    <span className="... flex-shrink-0">Incomplete</span>
    {bracket.name && <span className="truncate">{bracket.name}</span>}
  </div>
  
  {/* Right: Rank + Actions - wraps below on mobile */}
  <div className="flex items-center justify-between sm:justify-end gap-3">
    <div className="flex items-center gap-1.5">
      <span>Rank</span>
      <span className="font-medium">#{bracket.rank}</span>
    </div>
    <div className="flex gap-2">
      <button>Edit</button>
      <button>View</button>
    </div>
  </div>
</div>
```

Key patterns:
- `flex-col sm:flex-row` - Stack vertically on mobile, horizontal on tablet+
- `flex-shrink-0` on badges - Prevent badge from compressing
- `gap-1.5` or `gap-2` - Explicit spacing between elements
- `min-w-0` on flex children - Allow truncation to work

---

### Issue 4: Bracket Visualization Clipped
**Problem:** Bracket diagram gets cut off, connector lines disappear.

**Solution:** Horizontal scroll container with minimum width.

```jsx
{/* Scrollable bracket container */}
<div className="overflow-x-auto overflow-y-auto">
  {/* Min-width prevents collapse */}
  <div className="min-w-[600px] p-4">
    <div className="flex gap-6">
      {/* Round columns with fixed widths */}
      <div className="w-[180px] flex-shrink-0">
        {/* matches */}
      </div>
      {/* connector */}
      <div className="w-[180px] flex-shrink-0">
        {/* matches */}
      </div>
    </div>
  </div>
</div>

{/* Optional: Scroll hint for mobile */}
<div className="sm:hidden text-center py-1 text-gray-500 text-xs">
  ← Swipe to see all rounds →
</div>
```

Key patterns:
- `overflow-x-auto` - Enable horizontal scroll
- `min-w-[600px]` - Prevent bracket from collapsing too small
- `flex-shrink-0` on columns - Keep column widths fixed
- `w-[180px]` - Fixed width per round column

---

### Issue 5: "Back to Dashboard" Link Too Long
**Problem:** Full text takes too much space on mobile.

**Solution:** Shorten text on mobile.

```jsx
<a href="#" className="flex items-center gap-1 text-blue-400 text-sm">
  <ArrowLeftIcon />
  <span className="hidden sm:inline">Back to Dashboard</span>
  <span className="sm:hidden">Back</span>
</a>
```

---

## Dark/Light Mode Considerations

All the mockups use dark mode colors. For light mode support, swap:

| Dark Mode | Light Mode |
|-----------|------------|
| `bg-slate-900` | `bg-white` or `bg-gray-50` |
| `bg-slate-800` | `bg-gray-100` or `bg-white` |
| `text-white` | `text-gray-900` |
| `text-gray-400` | `text-gray-600` |
| `border-slate-700` | `border-gray-200` |

Use Tailwind's `dark:` prefix:
```jsx
<div className="bg-white dark:bg-slate-800 text-gray-900 dark:text-white">
```

---

## Key Tailwind Breakpoints

| Prefix | Min Width | Use Case |
|--------|-----------|----------|
| (none) | 0px | Mobile-first default |
| `sm:` | 640px | Large phones / small tablets |
| `md:` | 768px | Tablets |
| `lg:` | 1024px | Laptops |

The mockups primarily use `sm:` and `md:` breakpoints since most issues are mobile vs tablet/desktop.

---

## Files Included

1. **MobileDashboardMockup.jsx** - Improved header + bracket list rows
2. **MobileBracketEditorMockup.jsx** - Improved bracket editor with scroll

These are reference implementations. Copy the relevant patterns into your actual components.
