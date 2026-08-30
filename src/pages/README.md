# AdminDashboard overflow menu fix

Fixes the three-dot overflow menu being clipped by the student table/card overflow.

The menu is rendered as a fixed-position overlay and its coordinates are calculated from the clicked three-dot button. It opens downward when there is room and upward when near the bottom of the viewport. It closes on outside click or scroll.

Replace:
- src/pages/AdminDashboard.jsx
- src/pages/AdminDashboard.redesign.css

Keep AdminDashboard.css unchanged.
