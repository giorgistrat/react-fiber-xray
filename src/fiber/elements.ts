// What happened to each element of a render: which fiber reads it (its parent's
// beginWork), and what reconciliation did with it. Derived from the committed
// snapshot via fiber.memoizedProps === element.props (FiberSnap.propsFromElement).

import type { ElementNode, RenderCall } from '../trace';
import type { CommitRecord, FiberSnap } from './snapshot';

export type FateKind = 'mount' | 'create' | 'reuse' | 'bailout';

export interface Fate {
  kind: FateKind;
  objId: number;
  letter: string;
  slot: number;
  alternateId: number | null;
  recycled: boolean; // WIP object reused from two renders ago (vs. newly allocated)
  placement: boolean;
  parentObjId: number | null; // the fiber whose beginWork reads this element
}

export interface DeletedChild {
  objId: number;
  name: string;
  key: string | null;
}

export function elementFates(commit: CommitRecord, reusedEids: Set<number>): Map<number, Fate> {
  const fates = new Map<number, Fate>();
  const walk = (n: FiberSnap, parent: FiberSnap | null) => {
    if (n.status !== 'kept' && n.propsFromElement !== null) {
      let kind: FateKind;
      if (parent?.mount) kind = 'mount';
      else if (n.status === 'new' && n.alternateId === null) kind = 'create';
      else if (reusedEids.has(n.propsFromElement) && n.propsSameObject) kind = 'bailout';
      else kind = 'reuse';
      fates.set(n.propsFromElement, {
        kind,
        objId: n.objId,
        letter: n.letter,
        slot: n.slot,
        alternateId: n.alternateId,
        recycled: n.status === 'recycled',
        placement: n.flags.includes('Placement'),
        parentObjId: parent?.objId ?? null,
      });
    }
    n.children.forEach((c) => walk(c, n));
  };
  walk(commit.tree, null);
  return fates;
}

export function deletionsByParent(commit: CommitRecord): Map<number, DeletedChild[]> {
  const out = new Map<number, DeletedChild[]>();
  const walk = (n: FiberSnap) => {
    if (n.status === 'kept') return;
    if (n.deletions.length) out.set(n.objId, n.deletions);
    n.children.forEach(walk);
  };
  walk(commit.tree);
  return out;
}

function forEachElement(node: ElementNode | string | null, fn: (el: ElementNode) => void) {
  if (node === null || typeof node === 'string') return;
  if (node.type !== '[array]') fn(node);
  node.children.forEach((c) => forEachElement(c, fn));
}

// Elements created in this render vs. element objects carried over from an earlier one.
export function renderStats(calls: RenderCall[]): { created: number; reused: number; reusedEids: Set<number> } {
  const seen = new Set<number>();
  const reusedEids = new Set<number>();
  for (const call of calls) {
    forEachElement(call.returned, (el) => {
      seen.add(el.eid);
      if (el.reused) reusedEids.add(el.eid);
    });
  }
  return { created: seen.size - reusedEids.size, reused: reusedEids.size, reusedEids };
}
