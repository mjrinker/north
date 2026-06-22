# Decisions

## Theming
- Light/dark/system mode toggled via a 3-way slider in the nav header
- Uses CSS custom properties on `body` for theme-aware colors
- System theme follows `prefers-color-scheme` media query
- Theme state persisted in a writable Svelte store
- Theme slider uses SVG icons: gear (system), sun (light), moon (dark)

## Styling
- Global styles in `src/styles/global.css` define CSS variables per theme
- Component styles use `var(--variable)` to stay theme-aware
- Mobile-first approach with responsive breakpoints
