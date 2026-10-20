import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { lookupTerm, type GlossaryEntry } from '../glossary';

const TOOLTIP_ID = 'xray-tooltip';
const GAP = 8;

interface Shown {
  entry: GlossaryEntry;
  anchor: Element;
}

// One fixed-position tooltip for every element with data-term="…" (event
// delegation). Being fixed, it is never clipped by scrolling panels.
export function TooltipLayer() {
  const [shown, setShown] = useState<Shown | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const termOf = (target: EventTarget | null) => (target instanceof Element ? target.closest('[data-term]') : null);
    const show = (e: Event) => {
      const anchor = termOf(e.target);
      if (!anchor) return;
      const entry = lookupTerm(anchor.getAttribute('data-term')!);
      if (!entry) return;
      anchor.setAttribute('aria-describedby', TOOLTIP_ID);
      setShown((cur) => (cur?.anchor === anchor ? cur : { entry, anchor }));
    };
    const hide = (e: Event) => {
      const anchor = termOf(e.target);
      const related = (e as PointerEvent | FocusEvent).relatedTarget;
      if (!anchor || (related instanceof Node && anchor.contains(related))) return;
      anchor.removeAttribute('aria-describedby');
      setShown((cur) => (cur?.anchor === anchor ? null : cur));
    };
    const close = () => setShown(null);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();

    document.addEventListener('pointerover', show);
    document.addEventListener('pointerout', hide);
    document.addEventListener('focusin', show);
    document.addEventListener('focusout', hide);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('pointerover', show);
      document.removeEventListener('pointerout', hide);
      document.removeEventListener('focusin', show);
      document.removeEventListener('focusout', hide);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
    };
  }, []);

  // Place below the anchor, or above when there is no room; clamp to the viewport.
  useLayoutEffect(() => {
    if (!shown || !boxRef.current) {
      setPos(null);
      return;
    }
    const a = shown.anchor.getBoundingClientRect();
    const box = boxRef.current.getBoundingClientRect();
    const below = a.bottom + GAP + box.height <= window.innerHeight;
    const top = below ? a.bottom + GAP : Math.max(GAP, a.top - GAP - box.height);
    const left = Math.min(Math.max(GAP, a.left + a.width / 2 - box.width / 2), window.innerWidth - box.width - GAP);
    setPos({ left, top });
  }, [shown]);

  if (!shown) return null;
  return (
    <div
      ref={boxRef}
      id={TOOLTIP_ID}
      role="tooltip"
      className="tooltip"
      style={pos ? { left: pos.left, top: pos.top } : { left: -9999, top: 0 }}
    >
      <div className="tooltip-title">{shown.entry.title}</div>
      <div>{shown.entry.body}</div>
      {shown.entry.footer && <div className="tooltip-footer">{shown.entry.footer}</div>}
    </div>
  );
}
