"use client";

import { useEffect } from "react";

// Site-wide: focusing a text/number field selects its whole contents, so a
// single click lets you type a replacement value. We also swallow the mouseup
// that *caused* the focus — otherwise the browser would drop the selection and
// place a caret, which is the flaky "needs a triple-click" behaviour. Clicking
// again once already focused still positions the caret normally.
const SELECTABLE = new Set(["text", "number", "search", "tel", "url", "email", ""]);

export function SelectOnFocus() {
  useEffect(() => {
    let pending: HTMLInputElement | null = null;

    const onFocusIn = (e: FocusEvent) => {
      const el = e.target;
      if (el instanceof HTMLInputElement && SELECTABLE.has(el.type) && !el.readOnly && !el.disabled) {
        el.select();
        pending = el;
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (pending && e.target === pending) e.preventDefault();
      pending = null;
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("mouseup", onMouseUp, true);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("mouseup", onMouseUp, true);
    };
  }, []);

  return null;
}
