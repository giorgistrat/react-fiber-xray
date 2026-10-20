// Which React internal functions run for each reconstructed step, named as in
// React's source (see reactSource.ts). Like steps.ts this is derived from the
// committed snapshot, so it shows the path React must have taken, not a trace.

import type { CommitRecord, FiberSnap } from './snapshot';
import { isComponentTag, isHostTag, WorkTag } from './types';

export interface Call {
  fn: string; // key in reactSource, or a plain label such as "Counter()"
  depth: number;
  note?: string;
  kind?: 'user' | 'marker'; // your component function / a statement, not a React function
}

const label = (n: FiberSnap) => `${n.name} #${n.objId}${n.letter}`;
const isMemo = (n: FiberSnap) => n.tag === WorkTag.SimpleMemoComponent || n.tag === WorkTag.MemoComponent;

// Changed props that updateProperties actually writes to the DOM at commit:
// not event handlers, and `children` only when it is a text child.
export function domWrites(n: FiberSnap) {
  return n.changedProps.filter((c) => !c.key.startsWith('on') && (c.key !== 'children' || n.textContent !== null));
}

// reconcileChildren → mountChildFibers | reconcileChildFibers → per-child work.
function childCalls(n: FiberSnap, depth: number): Call[] {
  if (n.children.length === 0 && n.deletions.length === 0) return [];
  const calls: Call[] = [{ fn: 'reconcileChildren', depth }];
  // A parent with no current twin uses the reconciler that tracks no side effects.
  calls.push({ fn: n.mount ? 'mountChildFibers' : 'reconcileChildFibers', depth: depth + 1 });
  const several = n.children.length + n.deletions.length > 1;
  calls.push({ fn: several ? 'reconcileChildrenArray' : 'reconcileSingleElement', depth: depth + 2 });
  const d = depth + 3;
  const deletes = n.deletions.map((deleted): Call => ({ fn: 'deleteChild', depth: d, note: `${deleted.name} #${deleted.objId}: key or type changed` }));
  // A single element deletes non-matching children before creating; the array
  // pass deletes whatever old children are left over at the end.
  if (!several) calls.push(...deletes);
  for (const child of n.children) {
    if (child.status === 'new' && child.alternateId === null) {
      calls.push({ fn: 'createFiberFromElement', depth: d, note: `${label(child)} (new)` });
    } else {
      calls.push({ fn: 'useFiber', depth: d, note: `${label(child)}: same key and type` });
      calls.push({ fn: 'createWorkInProgress', depth: d + 1, note: child.status === 'new' ? `allocates #${child.objId}` : `reuses #${child.objId}` });
    }
    if (child.flags.includes('Placement')) calls.push({ fn: several ? 'placeChild' : 'placeSingleChild', depth: d, note: `Placement on ${label(child)}` });
  }
  if (several) calls.push(...deletes);
  return calls;
}

function bailoutCalls(n: FiberSnap, depth: number): Call[] {
  const childrenCloned = n.children.some((c) => c.status !== 'kept');
  return [
    { fn: 'bailoutOnAlreadyFinishedWork', depth, note: childrenCloned ? 'work pending below' : 'childLanes = 0 → returns null, subtree skipped' },
    ...(childrenCloned
      ? [
          { fn: 'cloneChildFibers', depth: depth + 1 },
          ...n.children.map((c): Call => ({ fn: 'createWorkInProgress', depth: depth + 2, note: `${label(c)} (${c.status === 'new' ? 'allocates' : 'reuses'} #${c.objId})` })),
        ]
      : []),
  ];
}

function componentCalls(n: FiberSnap, depth: number): Call[] {
  const stateHooks = n.hooks.filter((h) => h.startsWith('state:'));
  const run: Call[] = [
    { fn: 'updateFunctionComponent', depth },
    { fn: 'renderWithHooks', depth: depth + 1, note: n.mount ? 'mount dispatcher' : 'update dispatcher' },
    { fn: `${n.name.replace(/^memo\((.*)\)$/, '$1')}()`, depth: depth + 2, kind: 'user', note: 'your component' },
    ...stateHooks.map((h): Call => ({ fn: n.mount ? 'mountState' : 'updateState', depth: depth + 3, note: `useState → ${h.slice('state: '.length)}` })),
    ...childCalls(n, depth + 1),
  ];
  if (!isMemo(n)) return run;
  return [
    { fn: 'updateSimpleMemoComponent', depth },
    ...(n.mount ? [] : [{ fn: 'shallowEqual', depth: depth + 1, note: 'props not equal, or an update is pending' }]),
    ...run.map((c) => ({ ...c, depth: c.depth + 1 })),
  ];
}

export function beginCalls(n: FiberSnap, isMountRender: boolean): Call[] {
  const calls: Call[] = [{ fn: 'performUnitOfWork', depth: 0 }, { fn: 'beginWork', depth: 1 }];

  if (n.tag === WorkTag.HostRoot) {
    if (isMountRender) {
      calls.push({ fn: 'updateHostRoot', depth: 2 }, { fn: 'processUpdateQueue', depth: 3, note: 'element from root.render()' }, ...childCalls(n, 3));
    } else {
      calls.push({ fn: 'attemptEarlyBailoutIfNoScheduledUpdate', depth: 2 }, ...bailoutCalls(n, 3));
    }
    return calls;
  }

  if (isComponentTag(n.tag)) {
    if (n.functionCalled) calls.push(...componentCalls(n, 2));
    else if (isMemo(n)) {
      calls.push({ fn: 'updateSimpleMemoComponent', depth: 2 }, { fn: 'shallowEqual', depth: 3, note: 'equal → bail out' }, ...bailoutCalls(n, 3));
    } else calls.push({ fn: 'attemptEarlyBailoutIfNoScheduledUpdate', depth: 2, note: 'same props object, no update' }, ...bailoutCalls(n, 3));
    return calls;
  }

  if (isHostTag(n.tag)) {
    if (!n.mount && n.propsSameObject) {
      calls.push({ fn: 'attemptEarlyBailoutIfNoScheduledUpdate', depth: 2, note: 'same props object' }, ...bailoutCalls(n, 3));
      return calls;
    }
    calls.push({ fn: 'updateHostComponent', depth: 2 });
    if (n.textContent !== null) calls.push({ fn: 'shouldSetTextContent', depth: 3, note: `true for "${n.textContent}" → nextChildren = null, no text fiber` });
    calls.push(...childCalls(n, 3));
  }
  return calls;
}

export function completeCalls(n: FiberSnap): Call[] {
  const calls: Call[] = [{ fn: 'completeUnitOfWork', depth: 0 }, { fn: 'completeWork', depth: 1 }];
  if (isHostTag(n.tag)) {
    if (n.mount) {
      calls.push(
        { fn: 'createInstance', depth: 2, note: `document.createElement('${n.name}')` },
        { fn: 'appendAllChildren', depth: 2, note: 'off-screen' },
        { fn: 'finalizeInitialChildren', depth: 2 },
        { fn: 'setInitialProperties', depth: 3 },
      );
    } else {
      calls.push({ fn: 'updateHostComponentComplete', depth: 2 });
      if (n.flags.includes('Update')) calls.push({ fn: 'markUpdate', depth: 3, note: 'props object changed' });
    }
  } else if (n.tag === WorkTag.HostRoot && n.flags.includes('Snapshot')) {
    calls.push({ fn: 'flags |= Snapshot', depth: 2, kind: 'marker', note: 'clear the container at the start of commit' });
  }
  calls.push({ fn: 'bubbleProperties', depth: 2 });
  return calls;
}

export function commitCalls(commit: CommitRecord): Call[] {
  const deletions: FiberSnap[] = [];
  const placements: FiberSnap[] = [];
  const updates: FiberSnap[] = [];
  let passive = false;
  const walk = (n: FiberSnap) => {
    if (n.status === 'kept') return;
    if (n.deletions.length) deletions.push(n);
    if (n.flags.includes('Placement')) placements.push(n);
    if (n.flags.includes('Update') && isHostTag(n.tag)) updates.push(n);
    if (n.flags.includes('Passive')) passive = true;
    n.children.forEach(walk);
  };
  walk(commit.tree);

  const calls: Call[] = [{ fn: 'commitRoot', depth: 0 }, { fn: 'commitBeforeMutationEffects', depth: 1 }];
  if (commit.tree.flags.includes('Snapshot')) calls.push({ fn: 'clearContainer', depth: 2, note: 'HostRoot has Snapshot' });
  calls.push({ fn: 'flushMutationEffects', depth: 1 }, { fn: 'commitMutationEffectsOnFiber', depth: 2, note: 'walks only subtrees with flags' });
  for (const parent of deletions) {
    for (const d of parent.deletions) calls.push({ fn: 'commitDeletionEffects', depth: 3, note: `remove ${d.name} #${d.objId}` });
  }
  for (const n of placements) {
    calls.push({ fn: 'commitReconciliationEffects', depth: 3 }, { fn: 'commitPlacement', depth: 4, note: `insert ${label(n)} with its subtree` });
  }
  for (const n of updates) {
    const writes = domWrites(n);
    calls.push(
      { fn: 'commitHostUpdate', depth: 3, note: label(n) },
      { fn: 'commitUpdate', depth: 4 },
      {
        fn: 'updateProperties',
        depth: 5,
        note: writes.length
          ? `writes ${writes.map((c) => (c.key === 'children' ? `text ${c.from} → ${c.to}` : c.key)).join(', ')}`
          : 'diff finds nothing to write',
      },
    );
  }
  calls.push(
    { fn: 'root.current = finishedWork', depth: 2, kind: 'marker', note: 'the WIP tree is now the current tree' },
    { fn: 'flushLayoutEffects', depth: 1 },
  );
  if (passive) calls.push({ fn: 'flushPassiveEffects', depth: 1, note: 'scheduled, runs after paint' });
  return calls;
}
