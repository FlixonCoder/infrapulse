import { useEffect } from 'react';
/** Keep keyboard focus inside the active modal and return it to its opener. */
export function useDialog(active: boolean, selector: string) {
  useEffect(() => {
    if (!active) return;
    const dialog = document.querySelector<HTMLElement>(selector),
      previous = document.activeElement;
    const elements = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input,select,[tabindex="0"]',
        ) ?? [],
      );
    elements()[0]?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const targets = elements(),
        first = targets[0],
        last = targets[targets.length - 1];
      if (!first) return;
      if (
        e.shiftKey &&
        (document.activeElement === first || !dialog?.contains(document.activeElement))
      ) {
        e.preventDefault();
        last.focus();
      } else if (
        !e.shiftKey &&
        (document.activeElement === last || !dialog?.contains(document.activeElement))
      ) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', trap);
    return () => {
      document.removeEventListener('keydown', trap);
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [active, selector]);
}
