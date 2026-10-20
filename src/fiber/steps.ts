// Rebuilds the beginWork / completeWork walk of one render from the committed
// snapshot. React does not expose its work loop, so this is a reconstruction:
// a fiber was visited exactly when it was cloned (status !== 'kept').

import type { CommitRecord, FiberSnap } from './snapshot';
import { isComponentTag, isHostTag, WorkTag } from './types';

export type StepPhase = 'begin' | 'complete' | 'commit';

export interface Step {
  phase: StepPhase;
  objId: number | null;
  title: string;
  lines: string[];
}

const label = (n: FiberSnap) => `${n.name} #${n.objId}${n.letter}`;

export function buildSteps(commit: CommitRecord): Step[] {
  const steps: Step[] = [];
  const isMountRender = commit.index === 1;

  const walk = (n: FiberSnap) => {
    if (n.status === 'kept') return;
    steps.push({ phase: 'begin', objId: n.objId, title: `beginWork ↓ ${label(n)}`, lines: beginLines(n, isMountRender) });
    for (const child of n.children) walk(child);
    steps.push({ phase: 'complete', objId: n.objId, title: `completeWork ↑ ${label(n)}`, lines: completeLines(n) });
  };
  walk(commit.tree);

  steps.push({ phase: 'commit', objId: null, title: 'commit', lines: commitLines(commit) });
  return steps;
}

function originLine(n: FiberSnap): string {
  if (n.status === 'new' && n.alternateId === null) return `New fiber object #${n.objId} (no current twin → mount path).`;
  if (n.status === 'new') return `createWorkInProgress: current #${n.alternateId} has no alternate yet → allocate new object #${n.objId} and link them.`;
  return `createWorkInProgress: reuse alternate object #${n.objId} (from two renders ago), overwrite it with data from current #${n.alternateId}.`;
}

function beginLines(n: FiberSnap, isMountRender: boolean): string[] {
  const lines = [originLine(n)];
  const childrenCloned = n.children.some((c) => c.status !== 'kept');

  if (n.tag === WorkTag.HostRoot) {
    lines.push(
      isMountRender
        ? 'Process the update from root.render(): its element is reconciled against the current child (none) → create the child fiber.'
        : 'The root has no update itself, but work is pending below (childLanes) → clone its child.',
    );
    return lines;
  }

  if (isComponentTag(n.tag)) {
    if (n.functionCalled) {
      lines.push(n.mount ? `Call ${n.name}() for the first time; hooks are created.` : `Call ${n.name}(); hooks read state from current fiber (${n.hooks.join(', ') || 'none'}).`);
      lines.push('Reconcile the returned elements against the current child fibers.');
    } else {
      lines.push(
        n.tag === WorkTag.SimpleMemoComponent || n.tag === WorkTag.MemoComponent
          ? 'memo: shallow-compare old vs new props → equal, no pending update → BAILOUT, function not called.'
          : 'Props are the SAME object as last time and no pending update → BAILOUT, function not called.',
      );
      lines.push(childrenCloned ? 'Work is pending deeper, so children are cloned.' : 'childLanes = 0 → return null: the whole subtree is skipped (children stay the same objects).');
    }
    return lines;
  }

  if (isHostTag(n.tag)) {
    if (!n.mount) {
      lines.push(
        n.propsSameObject
          ? `Same props object → bailout${childrenCloned ? ' (children cloned: work pending below)' : '; subtree skipped'}.`
          : 'New props object (from the parent’s new element) → visited, children reconciled.',
      );
    } else {
      lines.push('Reconcile child elements → create child fibers.');
    }
    if (n.textContent !== null) lines.push(`Single text child "${n.textContent}" → set as text content, no text fiber is created.`);
    if (n.flags.includes('Placement')) lines.push('Flag Placement: commit will insert this node (with its whole subtree).');
    return lines;
  }

  return lines;
}

function completeLines(n: FiberSnap): string[] {
  const lines: string[] = [];
  if (isHostTag(n.tag)) {
    if (n.mount) {
      lines.push(`document.createElement('${n.name}'), set initial props, append child DOM nodes. Still off-screen.`);
    } else if (n.flags.includes('Update')) {
      lines.push('Props object changed → flag Update. (React 19 marks it here and does the real diff at commit, in updateProperties.)');
      lines.push(`At commit: ${commitPrediction(n)}`);
    } else {
      lines.push('Same props object → no Update flag, nothing to do at commit.');
    }
  } else if (n.tag === WorkTag.HostText) {
    lines.push(n.mount ? 'Create a text node.' : 'Compare text.');
  } else {
    lines.push('No DOM node of its own; bubble child flags up (subtreeFlags).');
  }
  if (n.deletions.length > 0) {
    lines.push(`ChildDeletion: ${n.deletions.map((d) => `${d.name} #${d.objId}`).join(', ')} will be removed (with its DOM node) at commit.`);
  }
  return lines;
}

function commitPrediction(n: FiberSnap): string {
  const handlers = n.changedProps.filter((c) => c.key.startsWith('on')).map((c) => c.key);
  const domChanges = n.changedProps.filter((c) => !c.key.startsWith('on') && (c.key !== 'children' || n.textContent !== null));
  const parts: string[] = [];
  if (domChanges.length) {
    parts.push(`write ${domChanges.map((c) => (c.key === 'children' ? `textContent ${c.from} → ${c.to}` : `${c.key} ${c.from} → ${c.to}`)).join(', ')}`);
  }
  if (handlers.length) {
    parts.push(`${handlers.join(', ')} changed but handlers are not DOM attributes → nothing written; __reactProps$ is refreshed so the event system calls the new function`);
  }
  return parts.length ? parts.join('; ') + '.' : 'diff finds no DOM property change → nothing written.';
}

function commitLines(commit: CommitRecord): string[] {
  const effects: string[] = [];
  const collect = (n: FiberSnap) => {
    if (n.status === 'kept') return;
    for (const flag of n.flags) {
      if (flag === 'Placement' || flag === 'ChildDeletion') effects.push(`${flag} on ${label(n)}`);
      if (flag === 'Update' && isHostTag(n.tag)) effects.push(`Update on ${label(n)} → ${commitPrediction(n)}`);
    }
    n.children.forEach(collect);
  };
  collect(commit.tree);
  return [
    effects.length ? `Apply DOM effects: ${effects.join('; ')}.` : 'No DOM effects to apply.',
    `root.current = WIP tree (root #${commit.tree.objId}${commit.tree.letter}). The previous tree becomes the scratchpad for the next render.`,
  ];
}
