import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';
import styles from './HelpTip.module.css';

const closeListeners = new Set();

function canHoverFine() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches
  );
}

function placeBubble(trigger, bubble) {
  const rect = trigger.getBoundingClientRect();
  const size = bubble.getBoundingClientRect();
  const gap = 8;
  let top = rect.bottom + gap;
  let left = rect.left + rect.width / 2 - size.width / 2;

  if (top + size.height > window.innerHeight - 8) {
    top = rect.top - size.height - gap;
  }
  if (top < 8) top = 8;

  left = Math.max(8, Math.min(left, window.innerWidth - size.width - 8));
  return { top, left };
}

export default function HelpTip({ text, label = 'Ajuda' }) {
  const id = useId();
  const triggerRef = useRef(null);
  const bubbleRef = useRef(null);
  const closeTimer = useRef(null);
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  const close = useCallback(() => {
    setOpen(false);
    setPinned(false);
  }, []);

  useEffect(() => {
    const listener = (source) => {
      if (source !== close) close();
    };
    closeListeners.add(listener);
    return () => closeListeners.delete(listener);
  }, [close]);

  const announceOpen = useCallback(() => {
    closeListeners.forEach((fn) => fn(close));
    setOpen(true);
  }, [close]);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || !bubbleRef.current) return;
    setCoords(placeBubble(triggerRef.current, bubbleRef.current));
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, text, updatePosition]);

  useEffect(() => {
    if (!open) return undefined;
    const onScroll = () => updatePosition();
    window.addEventListener('resize', onScroll);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      const trigger = triggerRef.current;
      const bubble = bubbleRef.current;
      if (trigger && trigger.contains(event.target)) return;
      if (bubble && bubble.contains(event.target)) return;
      close();
    };
    const onKey = (event) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  useEffect(
    () => () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    },
    []
  );

  if (!text) return null;

  const clearCloseTimer = () => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const handleEnter = () => {
    if (!canHoverFine() || pinned) return;
    clearCloseTimer();
    announceOpen();
  };

  const handleLeave = () => {
    if (!canHoverFine() || pinned) return;
    clearCloseTimer();
    closeTimer.current = window.setTimeout(() => setOpen(false), 120);
  };

  const handleClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (pinned) {
      close();
      return;
    }
    announceOpen();
    setPinned(true);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ''}`}
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={handleClick}
        onPointerDown={(event) => event.stopPropagation()}
        onPointerEnter={handleEnter}
        onPointerLeave={handleLeave}
      >
        <Info size={13} strokeWidth={2.25} aria-hidden="true" />
      </button>
      {open
        ? createPortal(
            <div
              ref={bubbleRef}
              id={id}
              role="tooltip"
              className={styles.bubble}
              style={{ top: coords.top, left: coords.left }}
              onPointerEnter={handleEnter}
              onPointerLeave={handleLeave}
            >
              {text}
            </div>,
            document.body
          )
        : null}
    </>
  );
}

export function HelpLabel({ children, text, className = '' }) {
  if (!text) {
    return <span className={className}>{children}</span>;
  }
  return (
    <span className={`${styles.inline} ${className}`.trim()}>
      {children}
      <HelpTip text={text} />
    </span>
  );
}
