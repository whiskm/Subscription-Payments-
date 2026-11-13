import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Icon } from './icons';

let openSheets = 0;

/** A panel that slides up from the bottom on phones and sits centred on wide screens. */
export function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
      }
    };
    document.addEventListener('keydown', onKey);
    const previous = document.activeElement as HTMLElement | null;
    if (++openSheets === 1) document.body.style.overflow = 'hidden';
    // Move focus inside, unless a field asked for it with autoFocus.
    requestAnimationFrame(() => {
      if (ref.current && !ref.current.contains(document.activeElement)) ref.current.focus();
    });
    return () => {
      document.removeEventListener('keydown', onKey);
      if (--openSheets === 0) document.body.style.overflow = '';
      previous?.focus?.();
    };
  }, [open]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="scrim"
            className="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <div className="sheet-wrap" key="wrap">
            <motion.div
              ref={ref}
              className="sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              tabIndex={-1}
              initial={{ y: '100%', opacity: 0.6 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0.6 }}
              transition={{ type: 'spring', stiffness: 380, damping: 36, mass: 0.9 }}
            >
              <div className="sheet__head">
                <h2 className="sheet__title" id={titleId}>
                  {title}
                </h2>
                <button className="icon-btn icon-btn--bare" onClick={onClose} aria-label="Close">
                  <Icon name="close" />
                </button>
              </div>
              <div className="sheet__body">{children}</div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
