window.__ModuleLoader__.load({
  id: '@local/dsh-window-drag',
  factory() {
    /*
     * Some DSH Desktop builds ignore `-webkit-app-region: drag` in the main
     * renderer, leaving the window impossible to move. This module restores
     * normal title-bar behaviour with plain DOM events:
     *
     *  - press + move on an empty title-bar area moves the native window
     *    through window.moveBy();
     *  - double-click on the same area toggles the macOS-style zoom
     *    (fill the screen work area, then restore the previous bounds);
     *  - interactive controls (buttons, tabs, inputs, dialogs) are never
     *    captured, so clicks keep working.
     *
     * macOS only: Windows/Linux keep their native title bar handling.
     */

    const INTERACTIVE = [
      'button', 'a', 'input', 'select', 'textarea', 'summary', 'label',
      '[contenteditable="true"]', '[data-no-window-drag]',
      '[role="button"]', '[role="link"]', '[role="tab"]', '[role="menuitem"]',
      '[role="menu"]', '[role="listbox"]', '[role="dialog"]',
      '[role="alertdialog"]', '[role="checkbox"]', '[role="radio"]',
      '[role="switch"]', '[role="slider"]', '[role="combobox"]',
      '[role="textbox"]',
    ].join(',');

    const SIDEBAR_HEAD_WIDTH = 300;
    const SIDEBAR_HEAD_HEIGHT = 104;
    const ZOOM_TOLERANCE = 2;
    const DRAG_THRESHOLD = 3;
    const DOUBLE_CLICK_MS = 400;
    const DOUBLE_CLICK_SLOP = 6;
    const ZOOM_GUARD_MS = 700;

    function titlebarHeight() {
      const value = Number.parseFloat(
        getComputedStyle(document.documentElement)
          .getPropertyValue('--dsh-frame-top-clearance'),
      );
      return Number.isFinite(value) && value > 0 ? value : 48;
    }

    function isDarwin() {
      // `data-platform` is written by the Desktop shell's preload only, so this
      // keeps the plugin inert in an ordinary browser session on a Mac.
      return document.documentElement.dataset.platform === 'darwin';
    }

    function isInteractive(target) {
      return target instanceof Element && target.closest(INTERACTIVE) !== null;
    }

    function inDragZone(event, clearance) {
      if (event.clientY < 0 || event.clientX < 0) return false;
      if (event.clientY <= clearance) return true;
      return event.clientX <= SIDEBAR_HEAD_WIDTH &&
        event.clientY <= SIDEBAR_HEAD_HEIGHT;
    }

    function workArea() {
      const screen = window.screen;
      return {
        x: screen.availLeft,
        y: screen.availTop,
        w: screen.availWidth,
        h: screen.availHeight,
      };
    }

    function currentBounds() {
      return {
        x: window.screenX,
        y: window.screenY,
        w: window.outerWidth,
        h: window.outerHeight,
      };
    }

    function isZoomed(bounds, area) {
      return Math.abs(bounds.x - area.x) <= ZOOM_TOLERANCE &&
        Math.abs(bounds.y - area.y) <= ZOOM_TOLERANCE &&
        Math.abs(bounds.w - area.w) <= ZOOM_TOLERANCE &&
        Math.abs(bounds.h - area.h) <= ZOOM_TOLERANCE;
    }

    return {
      apply(ctx) {
        if (!isDarwin()) return;

        const clearance = titlebarHeight();
        let drag = null;
        let lastPress = null;
        let preZoom = null;
        let lastZoomAt = 0;

        const toggleZoom = () => {
          const area = workArea();
          const bounds = currentBounds();
          if (isZoomed(bounds, area) && preZoom !== null) {
            window.moveTo(preZoom.x, preZoom.y);
            window.resizeTo(preZoom.w, preZoom.h);
            preZoom = null;
          } else {
            preZoom = bounds;
            window.moveTo(area.x, area.y);
            window.resizeTo(area.w, area.h);
          }
          lastZoomAt = performance.now();
        };

        const onPointerDown = (event) => {
          if (event.button !== 0 || !event.isPrimary) return;
          if (document.documentElement.hasAttribute('data-fullscreen')) return;
          if (!inDragZone(event, clearance) || isInteractive(event.target)) return;

          const now = performance.now();
          if (lastPress !== null &&
            now - lastPress.at <= DOUBLE_CLICK_MS &&
            Math.abs(event.clientX - lastPress.x) <= DOUBLE_CLICK_SLOP &&
            Math.abs(event.clientY - lastPress.y) <= DOUBLE_CLICK_SLOP) {
            lastPress = null;
            drag = null;
            toggleZoom();
            event.preventDefault();
            return;
          }

          lastPress = { at: now, x: event.clientX, y: event.clientY };
          drag = {
            id: event.pointerId,
            startX: event.screenX,
            startY: event.screenY,
            x: event.screenX,
            y: event.screenY,
            moved: false,
          };
          try {
            document.documentElement.setPointerCapture(event.pointerId);
          } catch (_error) {
            /* pointer capture is best-effort */
          }
          event.preventDefault();
        };

        const onPointerMove = (event) => {
          if (drag === null || event.pointerId !== drag.id) return;

          if (!drag.moved) {
            const dx = event.screenX - drag.startX;
            const dy = event.screenY - drag.startY;
            if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
            drag.moved = true;
            window.moveBy(dx, dy);
          } else {
            const dx = event.screenX - drag.x;
            const dy = event.screenY - drag.y;
            if (dx === 0 && dy === 0) return;
            window.moveBy(dx, dy);
          }
          drag.x = event.screenX;
          drag.y = event.screenY;
          event.preventDefault();
        };

        const onPointerEnd = (event) => {
          if (drag === null || event.pointerId !== drag.id) return;
          drag = null;
        };

        const onDoubleClick = (event) => {
          if (performance.now() - lastZoomAt < ZOOM_GUARD_MS) return;
          if (document.documentElement.hasAttribute('data-fullscreen')) return;
          if (!inDragZone(event, clearance) || isInteractive(event.target)) return;
          toggleZoom();
          event.preventDefault();
        };

        window.addEventListener('pointerdown', onPointerDown, true);
        window.addEventListener('pointermove', onPointerMove, true);
        window.addEventListener('pointerup', onPointerEnd, true);
        window.addEventListener('pointercancel', onPointerEnd, true);
        window.addEventListener('dblclick', onDoubleClick, true);

        return () => {
          window.removeEventListener('pointerdown', onPointerDown, true);
          window.removeEventListener('pointermove', onPointerMove, true);
          window.removeEventListener('pointerup', onPointerEnd, true);
          window.removeEventListener('pointercancel', onPointerEnd, true);
          window.removeEventListener('dblclick', onDoubleClick, true);
          drag = null;
          lastPress = null;
          preZoom = null;
        };
      },
    };
  },
});