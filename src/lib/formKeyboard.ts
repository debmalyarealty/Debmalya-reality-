import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

export interface KeyboardScrollInput {
  fieldTop: number;
  fieldBottom: number;
  submitBottom?: number | null;
  viewportTop: number;
  viewportBottom: number;
  headerOffset?: number;
  bottomPadding?: number;
}

/**
 * Computes the vertical scroll delta (positive = scroll down, negative = scroll up)
 * required so the active form field never hides behind the soft keyboard or top navbar,
 * and keeps the Submit button visible whenever both can fit above the keyboard.
 */
export function computeKeyboardSafeScrollDelta(
  input: KeyboardScrollInput
): number {
  const headerOffset = input.headerOffset ?? 88;
  const bottomPadding = input.bottomPadding ?? 16;
  const safeTop = input.viewportTop + headerOffset;
  const safeBottom = input.viewportBottom - bottomPadding;

  if (safeBottom <= safeTop) return 0;

  if (input.fieldTop < safeTop) {
    return input.fieldTop - safeTop;
  }

  let delta = 0;
  if (input.fieldBottom > safeBottom) {
    delta = input.fieldBottom - safeBottom;
  }

  const adjustedFieldTop = input.fieldTop - delta;
  if (typeof input.submitBottom === 'number' && Number.isFinite(input.submitBottom)) {
    const adjustedSubmitBottom = input.submitBottom - delta;
    if (adjustedSubmitBottom > safeBottom) {
      const extraNeeded = adjustedSubmitBottom - safeBottom;
      const roomAboveField = Math.max(0, adjustedFieldTop - safeTop);
      delta += Math.min(extraNeeded, roomAboveField);
    }
  }

  return Math.round(delta);
}

function isEditableFormControl(el: EventTarget | null): el is HTMLElement {
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement
  );
}

/**
 * Keeps the currently focused input and the form's Submit button visible above the
 * mobile software keyboard by combining dynamic bottom scroll room with visualViewport sync.
 */
export function useKeyboardSafeForm(
  formRef: RefObject<HTMLFormElement | null>
): { keyboardOpen: boolean } {
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const baselineHeightRef = useRef<number>(
    typeof window !== 'undefined' ? window.innerHeight : 0
  );

  const ensureVisible = useCallback(
    (targetEl: HTMLElement | null) => {
      const form = formRef.current;
      if (!form || !targetEl || !form.contains(targetEl)) return;

      const vv = window.visualViewport;
      const viewportTop = vv ? vv.offsetTop : 0;
      const visibleHeight = vv ? vv.height : window.innerHeight;
      const viewportBottom = viewportTop + visibleHeight;

      if (window.innerHeight > baselineHeightRef.current) {
        baselineHeightRef.current = window.innerHeight;
      }

      const visualInset = vv
        ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
        : 0;
      const layoutInset = Math.max(0, baselineHeightRef.current - visibleHeight);
      const keyboardHeight = Math.max(visualInset, layoutInset);

      setKeyboardOpen(keyboardHeight > 80);

      const submitBtn = form.querySelector<HTMLElement>('button[type="submit"]');
      const fieldRect = targetEl.getBoundingClientRect();
      const submitRect = submitBtn?.getBoundingClientRect() ?? null;

      const delta = computeKeyboardSafeScrollDelta({
        fieldTop: fieldRect.top,
        fieldBottom: fieldRect.bottom,
        submitBottom: submitRect ? submitRect.bottom : null,
        viewportTop,
        viewportBottom,
        headerOffset: 88,
        bottomPadding: 20,
      });

      if (Math.abs(delta) > 4) {
        const behavior: ScrollBehavior = window.matchMedia(
          '(prefers-reduced-motion: reduce)'
        ).matches
          ? 'auto'
          : 'smooth';
        window.scrollBy({ top: delta, behavior });
      }
    },
    [formRef]
  );

  useEffect(() => {
    if (!keyboardOpen) return;
    const raf = window.requestAnimationFrame(() => {
      const active = document.activeElement;
      if (isEditableFormControl(active)) {
        ensureVisible(active);
      }
    });
    return () => window.cancelAnimationFrame(raf);
  }, [keyboardOpen, ensureVisible]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    baselineHeightRef.current = Math.max(
      baselineHeightRef.current,
      window.innerHeight
    );
    let timerId = 0;

    const scheduleCheck = () => {
      window.clearTimeout(timerId);
      timerId = window.setTimeout(() => {
        const active = document.activeElement;
        if (isEditableFormControl(active)) {
          ensureVisible(active);
        }
      }, 120);
    };

    const onFocusIn = (e: FocusEvent) => {
      const form = formRef.current;
      if (!form || !isEditableFormControl(e.target) || !form.contains(e.target)) {
        return;
      }
      scheduleCheck();
    };

    const onFocusOut = () => {
      window.setTimeout(() => {
        const form = formRef.current;
        const active = document.activeElement;
        if (!form || !isEditableFormControl(active) || !form.contains(active)) {
          setKeyboardOpen(false);
        }
      }, 120);
    };

    const onViewportResize = () => {
      const form = formRef.current;
      const active = document.activeElement;
      if (!form || !isEditableFormControl(active) || !form.contains(active)) {
        baselineHeightRef.current = window.innerHeight;
        setKeyboardOpen(false);
        return;
      }
      scheduleCheck();
    };

    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    window.addEventListener('resize', onViewportResize);
    window.visualViewport?.addEventListener('resize', onViewportResize);
    window.visualViewport?.addEventListener('scroll', onViewportResize);

    return () => {
      window.clearTimeout(timerId);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      window.removeEventListener('resize', onViewportResize);
      window.visualViewport?.removeEventListener('resize', onViewportResize);
      window.visualViewport?.removeEventListener('scroll', onViewportResize);
    };
  }, [formRef, ensureVisible]);

  return { keyboardOpen };
}
