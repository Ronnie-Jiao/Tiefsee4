# Visual refresh — Tiefsee UI

This fork adds a cohesive visual skin to the existing main image viewer and
settings windows. It intentionally retains the original DOM structure, runtime
settings, keyboard shortcuts, layout preferences, image renderer, and file APIs.

## Design principles

- **The artwork remains the hero:** a quiet central canvas with low-contrast
  framing, matte surfaces and clear navigation.
- **Adaptive styling:** surfaces derive from runtime theme variables, including
  `--color-window-background`, `--color-white` and `--color-blue`. User
  themes and custom accent colors are not replaced.
- **Consistent affordances:** 6–22 px radius scale, semantic borders, soft
  elevation, distinct hover/active/focus-visible states.
- **Readable hierarchy:** small metadata labels, legible values, coherent
  settings headings, restrained use of accent color.
- **Safe to iterate:** design overrides are separate from functional source
  code and appended last by the SCSS build entrypoints.

## SCSS architecture

| File | Purpose |
| --- | --- |
| `Www/scss/_VisualFoundation.scss` | Shared tokens, typography, focus, dialogs, menus and toasts |
| `Www/scss/MainWindow/_VisualRefresh.scss` | Viewer chrome, toolbar, thumbnails, metadata, favorites, video and welcome state |
| `Www/scss/SettingWindow/_VisualRefresh.scss` | Navigation, settings cards, forms, switches, toolbar editor and plugins |
| `Www/scss/MainWindow/MainWindow.scss` | Includes foundation + main mixins at the end |
| `Www/scss/SettingWindow/SettingWindow.scss` | Includes foundation + settings mixins at the end |

Each override file exposes an `@mixin styles`, invoked *after* legacy rules.
Do not move the `@include` statements to the top of either entrypoint:
cascade order is intentional.

## Checks and visual QA

The `Validate UI styles` GitHub Actions workflow compiles both SCSS entrypoints
with the repository-locked Sass dependency. A successful compile does **not**
prove appearance or interaction correctness. Check the built Windows app:

1. Default dark theme and a light/user-custom theme (including color contrast).
2. Normal and maximized window, plus fullscreen toolbar auto-hide/reveal.
3. Different window sizes, particularly narrow settings navigation.
4. Thumbnail tray: hover, selected item, long filename, transparent file,
   portrait/landscape artwork, and an unsupported file.
5. Directory tray, metadata tabs, related files, favorite menu and dialogs.
6. Settings: navigation, all tabs, reset, input focus, switch state, hotkeys,
   toolbar customization and drag/drop targets.
7. Mouse/keyboard focus, high-DPI scaling, reduced motion and screen-reader labels.
8. Compare original and refreshed behavior for file open, image zoom, video,
   fullscreen, quick look, menus, and hotkeys.

## Notes for later iterations

- Runtime theme values live in `Www/ts/Config.ts`; do not override user saved
  color values with fixed colors in these styles.
- Keep the main image renderer free of nonessential effects; decorative surfaces
  belong to chrome, not the rendered artwork.
- Do not add new DOM wrappers around draggable title bars or panels without
  updating hit-testing and existing integration tests.
- Changes to frontend TypeScript require a separate `tsc --noEmit` check.
