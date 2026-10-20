import { useLayoutEffect, useState, type RefObject } from 'react';
import type { CommitRecord, FiberSnap } from '../fiber/snapshot';

export interface Link {
  from: number; // objId in column ① (current before render)
  to: number; // objId in column ③ (WIP → committed)
  kind: 'twin' | 'same';
  letter: string;
  slot: number;
}

// twin: the WIP fiber's `alternate` is that fiber in ①.
// same: React never cloned it, so it is literally the same object in both trees.
export function buildLinks(prev: CommitRecord, next: CommitRecord): Link[] {
  const links: Link[] = [];
  const walk = (n: FiberSnap) => {
    if (n.status === 'kept' && prev.objIds.has(n.objId)) {
      links.push({ from: n.objId, to: n.objId, kind: 'same', letter: n.letter, slot: n.slot });
    } else if (n.alternateId !== null && prev.objIds.has(n.alternateId)) {
      links.push({ from: n.alternateId, to: n.objId, kind: 'twin', letter: n.letter, slot: n.slot });
    }
    n.children.forEach(walk);
  };
  walk(next.tree);
  return links;
}

interface Path {
  d: string;
  link: Link;
  start: [number, number];
  end: [number, number];
}

function anchor(container: Element, col: 'prev' | 'next', objId: number): DOMRect | null {
  const card = container.querySelector(`[data-col="${col}"][data-obj="${objId}"]`);
  return (card?.querySelector(':scope > .fiber-head') ?? card)?.getBoundingClientRect() ?? null;
}

export function AlternateLinks({
  containerRef,
  links,
  hoverSlot,
  layoutKey,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  links: Link[];
  hoverSlot: number | null;
  // Changes whenever card sizes may have changed (commit, step, toggles).
  layoutKey: string;
}) {
  const [paths, setPaths] = useState<Path[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => {
      // Only meaningful when the three columns sit side by side.
      const sideBySide = getComputedStyle(container).gridTemplateColumns.split(' ').length === 3;
      if (!sideBySide) {
        setPaths([]);
        return;
      }
      const box = container.getBoundingClientRect();
      const next: Path[] = [];
      for (const link of links) {
        const a = anchor(container, 'prev', link.from);
        const b = anchor(container, 'next', link.to);
        if (!a || !b) continue;
        const x1 = a.right - box.left;
        const y1 = a.top + a.height / 2 - box.top;
        const x2 = b.left - box.left;
        const y2 = b.top + b.height / 2 - box.top;
        const bend = (x2 - x1) * 0.4;
        next.push({ d: `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`, link, start: [x1, y1], end: [x2, y2] });
      }
      setPaths(next);
      setSize({ w: box.width, h: box.height });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef, links, layoutKey]);

  if (paths.length === 0) return null;
  return (
    <svg className="alt-links" width={size.w} height={size.h} aria-hidden="true">
      {paths.map(({ d, link, start, end }) => {
        const hot = hoverSlot === link.slot;
        const cls = `alt-link kind-${link.kind} letter-${link.letter} ${hot ? 'hot' : ''} ${hoverSlot !== null && !hot ? 'dim' : ''}`;
        return (
          <g key={`${link.from}-${link.to}`} className={cls}>
            <path d={d} />
            <circle cx={start[0]} cy={start[1]} r={3} />
            <circle cx={end[0]} cy={end[1]} r={3} />
            {hot && (
              <text x={(start[0] + end[0]) / 2} y={(start[1] + end[1]) / 2 - 6} textAnchor="middle">
                {link.kind === 'same' ? `same object #${link.to}` : `#${link.to}.alternate = #${link.from}`}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
