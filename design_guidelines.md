# Design Guidelines: Logistics Automation Dashboard

## Design Approach

**Selected Approach:** Design System-Based (Carbon Design System principles for data-heavy enterprise applications)

**Justification:** This is a complex, data-intensive business management platform requiring:
- High information density across multiple interconnected modules
- Consistent component patterns for CRUD operations
- Professional enterprise aesthetics
- Efficient task completion over visual novelty

**Primary References:** Monday.com and Airtable's modular design patterns, with Carbon Design System's enterprise data visualization principles

---

## Core Design Elements

### Typography System
**Font Family:** Poppins (Google Fonts)
- **Headings:** Poppins SemiBold (600)
  - Page Titles: 2rem (32px)
  - Module Headers: 1.5rem (24px)
  - Card Titles: 1.125rem (18px)
- **Body Text:** Poppins Regular (400)
  - Primary: 0.875rem (14px)
  - Secondary/Labels: 0.75rem (12px)
- **Data Display:** Poppins Medium (500)
  - Metrics/Numbers: 1.25rem (20px)
  - Table Headers: 0.813rem (13px)

### Color Palette
- **Primary:** hsl(342 85.11% 52.55%) - Vibrant pink for CTAs, active states, key actions
- **Secondary:** hsl(0 0% 76.86%) - Neutral grey for borders, dividers, secondary elements
- **Background:** hsl(0 0% 94.12%) - Light grey for main workspace
- **Text:** hsl(0 0% 10.2%) - Dark for primary content
- **Cards:** hsl(0 0% 98.82%) - White for module cards and panels
- **Dark Mode Background:** hsl(20, 14%, 4%) with adjusted contrast for all elements

### Spacing System
**Tailwind Units:** Consistent use of 2, 4, 6, 8, 12, 16 units
- **Component Padding:** p-4 (cards), p-6 (modals), p-8 (main sections)
- **Margins:** mb-4 (element spacing), mb-8 (section spacing), mb-12 (major sections)
- **Gaps:** gap-4 (grid items), gap-6 (module cards), gap-8 (major layouts)

### Layout Architecture

**Dashboard Structure:**
- **Sidebar Navigation:** Fixed left sidebar (280px) with collapsible toggle, module icons with labels, role-based visibility
- **Top Bar:** Fixed header (64px height) with breadcrumb navigation, global search, user profile dropdown, dark mode toggle
- **Content Area:** Fluid width with max-w-7xl container, responsive grid system
- **Module Grid:** Grid-cols-1 (mobile), grid-cols-2 (tablet), grid-cols-3 (desktop) for dashboard cards

**Data Tables:**
- Sticky headers with sort indicators
- Row hover states with subtle background change
- Action buttons right-aligned
- Expandable rows for linked data relationships
- Pagination at bottom-right

---

## Component Library

### Navigation Components
**Sidebar Module Menu:**
- Icon + Label layout (leading icon, trailing count badge)
- Active state with primary color left border (4px) and background tint
- Collapsible sub-menus for nested relationships
- Module quick-action buttons on hover

**Breadcrumb Navigation:**
- Slash separators with hover underline
- Current page in medium weight, previous pages in regular
- Clickable path for rapid navigation

### Data Display Components

**Module Cards (Dashboard):**
- Border radius: 0.8rem
- Shadow: subtle elevation (shadow-sm)
- Header with module icon, name, and quick add button
- Metric display: Large number with label below
- Recent activity list (3-5 items)
- "View All" link at bottom

**Data Tables:**
- Alternating row backgrounds for readability
- Cell padding: px-4 py-3
- Checkbox column (40px) for bulk actions
- Action column (120px) with icon buttons
- Responsive: Stack to cards on mobile

**Relationship Indicators:**
- Inline badges showing linked records (e.g., "3 Invoices, 2 Expenses")
- Clickable with dropdown preview of linked items
- Visual connectors using subtle lines or icons

### Form Components

**Input Fields:**
- Height: h-10 (40px)
- Border: 1px secondary color, focus ring in primary
- Label above input (text-sm, mb-2)
- Helper text below (text-xs, secondary color)
- Error states with red border and message

**Custom Fields Creator:**
- Drag-and-drop field type selector
- Live preview panel showing field as it will appear
- Field configuration panel (label, type, required, default value)
- Save/Cancel actions with confirmation

**Dropdown Selects:**
- Chevron indicator on right
- Search functionality within dropdown for long lists
- Multi-select with tag pills showing selected items
- "Select all" option for bulk selection

### Action Components

**Primary Buttons:**
- Height: h-10, padding: px-6
- Background: Primary color with white text
- Hover: Slightly darker shade
- Active: Even darker with subtle scale

**Icon Buttons:**
- Size: w-8 h-8
- Circular or rounded-md
- Hover: Background color change
- Tooltip on hover for clarity

**Bulk Action Bar:**
- Appears at top when items selected
- Sticky positioning
- Shows count of selected items
- Quick actions (delete, export, assign, etc.)

### Modal & Overlay Components

**Modals:**
- Max width: max-w-2xl for forms, max-w-4xl for data views
- Backdrop: Semi-transparent dark overlay
- Border radius: 0.8rem matching cards
- Header with title and close button
- Footer with action buttons (Cancel left, Primary right)

**Side Panels (Detail Views):**
- Slide in from right (400px width)
- Full height with scroll
- Header with entity name and quick actions
- Tabbed content sections
- Related records displayed at bottom

### Status & Feedback Components

**Status Badges:**
- Pill shape with rounded-full
- Size variations: px-2 py-1 (small), px-3 py-1.5 (medium)
- Semantic colors: Success (green), Warning (yellow), Error (red), Info (blue)

**Progress Indicators:**
- Linear progress bars for operations pipeline
- Circular loaders for data fetching
- Skeleton screens for initial page load
- Toast notifications: Top-right corner, auto-dismiss (4s), stack vertically

---

## Interaction Patterns

**Search & Filter:**
- Global search in top bar with keyboard shortcut (Ctrl+K)
- Module-level filters in collapsible panel above table
- Real-time filtering as user types
- Filter tags showing active filters with clear button

**Interconnected Data:**
- Click any linked entity to open side panel detail view
- Hover tooltips showing quick summary
- Visual breadcrumb trail when navigating relationships
- Back button to return to previous context

**Role-Based UI:**
- Hide/disable actions based on user permissions
- Visual indicator (lock icon) on restricted features
- Different dashboard layouts per role (Admin sees all modules, Employee sees limited)

**Dark Mode:**
- Toggle in user profile dropdown
- Smooth transition (0.3s ease)
- Persist preference in localStorage
- Adjusted contrast ratios for accessibility

---

## Responsive Behavior

**Breakpoints:**
- Mobile: < 768px (single column, hamburger menu)
- Tablet: 768px - 1024px (2 columns, collapsed sidebar)
- Desktop: > 1024px (3 columns, full sidebar)

**Mobile Adaptations:**
- Sidebar converts to bottom navigation bar
- Tables convert to stacked cards
- Forms maintain full width inputs
- Reduced padding/margins (halve spacing units)

---

## Images

**No Hero Images Required**
This is a dashboard application focused on data and functionality. No hero or marketing images are needed. The interface relies on iconography, data visualization, and modular card layouts.

**Icons:** Use Heroicons (outline style for secondary actions, solid for primary/active states) via CDN

**Data Visualization:** Use Chart.js or similar for metrics displays in dashboard cards (simple bar/line charts for trends)