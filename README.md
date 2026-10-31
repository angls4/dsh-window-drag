# dsh-window-drag

A DeepSeek Harness plugin that restores normal title-bar behavior in **DSH
Desktop on macOS**: press and drag an empty title-bar area to move the window,
and double-click it to zoom (fill the screen work area; double-click again to
restore the previous bounds).

## Why

Some DSH Desktop builds ignore `-webkit-app-region: drag`, so the shell's own
`[data-window-drag]` regions never make the window draggable — the window can
only be moved by the traffic lights or not at all. This plugin bypasses CSS
drag regions entirely and moves the native window with `window.moveBy()` /
`window.moveTo()` / `window.resizeTo()`, which Electron honors for the main
window.

## Behavior

- **Drag zones:** the top 48px title strip (the shell's
  `--dsh-frame-top-clearance`) across the full width, plus the sidebar header
  block (300×104px).
- **DoubleClick:** toggles macOS-style zoom using the screen work area.
- **While zoomed:** starting a drag shrinks the window to its previous
  size centered on the cursor (clamped to the screen boundaries) and continues
  the drag; double-click restores the previous bounds.
  (Renderer-driven window moves are clamped to the screen by Chromium, so a
  full-work-area window cannot slide as-is. The shell's native resize-border
  drag — grabbing the extreme window edge — is handled by the macOS window
  server instead and is *not* clamped: it can move the window off-screen or to
  another monitor while resizing. This plugin never intercepts those edge
  drags; its zones are the top strip and sidebar header only.)
- **Never captured:** buttons, links, tabs, inputs, `contenteditable`, menus,
  dialogs, and any element tagged `data-no-window-drag` — clicks keep working.
- **Disabled in fullscreen** and entirely inert on Windows/Linux or in an
  ordinary browser tab (gated on the `data-platform="darwin"` attribute that
  only the Electron preload writes).

## Install

From DSH Desktop, open **Settings → Plugins** (Plugin Manager) and install the
bundle from:

```
github:angls4/dsh-window-drag
```

or clone and install the local directory:

```
git clone https://github.com/angls4/dsh-window-drag
```

Then install the `dsh-window-drag/` directory through the Plugin Manager
("Install bundle…"). The plugin activates immediately; no restart is needed.

To uninstall, remove the bundle from the Plugin Manager.

## Requirements

- DeepSeek Harness Desktop (developed against 0.2.1-rc.5)
- macOS; other platforms are unaffected

## Development

This is a Cordis bundle: `cordis.patch.yml` inserts the `window-drag` row,
`index.js` is an empty Host half, and `client.js` registers the Client module
that attaches the pointer listeners. All listeners are removed when the plugin
is disabled or uninstalled.

## License

MIT — see [LICENSE](LICENSE).
