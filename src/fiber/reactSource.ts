// Source locations of the React internals named in the step player.
// Verified against facebook/react at tag v19.3.1 (the installed react-dom).
// Several of these are inlined in the compiled react-dom bundle, so these are
// the names you find in React's source, not necessarily in node_modules.

export const REACT_VERSION_TAG = 'v19.3.1';

interface SourceEntry {
  file: string; // relative to packages/
  line: number;
  summary: string;
}

const RECONCILER = 'react-reconciler/src';
const DOM = 'react-dom-bindings/src/client';

export const reactSource: Record<string, SourceEntry> = {
  // Work loop
  workLoopSync: { file: `${RECONCILER}/ReactFiberWorkLoop.js`, line: 2772, summary: 'Calls performUnitOfWork until there is no next fiber.' },
  performUnitOfWork: { file: `${RECONCILER}/ReactFiberWorkLoop.js`, line: 3081, summary: 'Runs beginWork on one fiber; if it returns no child, completes it.' },
  completeUnitOfWork: { file: `${RECONCILER}/ReactFiberWorkLoop.js`, line: 3368, summary: 'Walks back up: completeWork on this fiber, then its sibling or parent.' },
  commitRoot: { file: `${RECONCILER}/ReactFiberWorkLoop.js`, line: 3725, summary: 'Starts the commit phase for a finished WIP tree.' },
  flushMutationEffects: { file: `${RECONCILER}/ReactFiberWorkLoop.js`, line: 4009, summary: 'Applies DOM mutations, then switches root.current to the WIP tree.' },
  flushLayoutEffects: { file: `${RECONCILER}/ReactFiberWorkLoop.js`, line: 4055, summary: 'Runs layout effects and ref attachment after the DOM is updated.' },
  flushPassiveEffects: { file: `${RECONCILER}/ReactFiberWorkLoop.js`, line: 4691, summary: 'Runs useEffect callbacks, scheduled after paint.' },

  // Begin phase
  beginWork: { file: `${RECONCILER}/ReactFiberBeginWork.js`, line: 4226, summary: 'Entry point on the way down: dispatches on fiber.tag, or bails out early.' },
  updateHostRoot: { file: `${RECONCILER}/ReactFiberBeginWork.js`, line: 1831, summary: 'Processes root.render() updates and reconciles the root element.' },
  updateFunctionComponent: { file: `${RECONCILER}/ReactFiberBeginWork.js`, line: 1453, summary: 'Calls your function component (via renderWithHooks) and reconciles what it returns.' },
  updateSimpleMemoComponent: { file: `${RECONCILER}/ReactFiberBeginWork.js`, line: 547, summary: 'memo() fast path: shallow-compares props and bails out if equal.' },
  updateHostComponent: { file: `${RECONCILER}/ReactFiberBeginWork.js`, line: 1966, summary: 'Begin phase for a DOM element: works out its children and reconciles them.' },
  bailoutOnAlreadyFinishedWork: { file: `${RECONCILER}/ReactFiberBeginWork.js`, line: 3826, summary: 'Skips this fiber. Clones its children if work is pending below, otherwise returns null.' },
  attemptEarlyBailoutIfNoScheduledUpdate: { file: `${RECONCILER}/ReactFiberBeginWork.js`, line: 3958, summary: 'Same props object and no pending update on this fiber → bail out.' },
  reconcileChildren: { file: `${RECONCILER}/ReactFiberBeginWork.js`, line: 339, summary: 'Compares new child elements with current child fibers (mountChildFibers if there is no current).' },

  // Hooks
  renderWithHooks: { file: `${RECONCILER}/ReactFiberHooks.js`, line: 505, summary: 'Sets the hooks dispatcher (mount or update) and calls your component function.' },
  mountState: { file: `${RECONCILER}/ReactFiberHooks.js`, line: 1948, summary: 'First useState call: creates the hook and its update queue.' },
  updateState: { file: `${RECONCILER}/ReactFiberHooks.js`, line: 1962, summary: 'Later useState calls: reads the hook from current and applies queued updates.' },

  // Child reconciliation
  reconcileChildFibers: { file: `${RECONCILER}/ReactChildFiber.js`, line: 2034, summary: 'Child reconciler that tracks side effects (Placement, deletions).' },
  mountChildFibers: { file: `${RECONCILER}/ReactChildFiber.js`, line: 2112, summary: 'Child reconciler for a new parent: no side effects tracked, the parent is placed as a whole.' },
  reconcileSingleElement: { file: `${RECONCILER}/ReactChildFiber.js`, line: 1703, summary: 'One child element: reuse the current fiber if key and type match, else delete and create.' },
  reconcileChildrenArray: { file: `${RECONCILER}/ReactChildFiber.js`, line: 1177, summary: 'Several children: matches by index/key, reuses, creates, deletes and places them.' },
  useFiber: { file: `${RECONCILER}/ReactChildFiber.js`, line: 502, summary: 'Reuses a matching child via createWorkInProgress.' },
  deleteChild: { file: `${RECONCILER}/ReactChildFiber.js`, line: 434, summary: 'Adds an old child to parent.deletions and sets ChildDeletion.' },
  placeChild: { file: `${RECONCILER}/ReactChildFiber.js`, line: 511, summary: 'Sets the child index; flags Placement if it is new or moved.' },
  placeSingleChild: { file: `${RECONCILER}/ReactChildFiber.js`, line: 543, summary: 'Flags Placement on a single new child.' },
  cloneChildFibers: { file: `${RECONCILER}/ReactChildFiber.js`, line: 2120, summary: 'Clones the current children with createWorkInProgress, unchanged.' },
  createWorkInProgress: { file: `${RECONCILER}/ReactFiber.js`, line: 323, summary: 'Returns current.alternate overwritten with current’s data, or allocates it the first time.' },
  createFiberFromElement: { file: `${RECONCILER}/ReactFiber.js`, line: 739, summary: 'Allocates a brand-new fiber for an element.' },
  shallowEqual: { file: 'shared/shallowEqual.js', line: 18, summary: 'Compares two props objects key by key with Object.is.' },
  processUpdateQueue: { file: `${RECONCILER}/ReactFiberClassUpdateQueue.js`, line: 487, summary: 'Applies queued updates (here: the element from root.render()).' },

  // Complete phase
  completeWork: { file: `${RECONCILER}/ReactFiberCompleteWork.js`, line: 1082, summary: 'Entry point on the way up: creates DOM nodes (mount) or marks updates.' },
  updateHostComponentComplete: { file: `${RECONCILER}/ReactFiberCompleteWork.js`, line: 463, summary: 'Complete phase for an existing DOM element: marks Update if the props object changed.' },
  markUpdate: { file: `${RECONCILER}/ReactFiberCompleteWork.js`, line: 201, summary: 'Sets the Update flag; the real props diff happens at commit.' },
  appendAllChildren: { file: `${RECONCILER}/ReactFiberCompleteWork.js`, line: 245, summary: 'Appends child DOM nodes to the new element, still off-screen.' },
  bubbleProperties: { file: `${RECONCILER}/ReactFiberCompleteWork.js`, line: 793, summary: 'Merges children’s flags into subtreeFlags so commit can skip clean subtrees.' },
  createInstance: { file: `${DOM}/ReactFiberConfigDOM.js`, line: 534, summary: 'document.createElement for a host fiber.' },
  finalizeInitialChildren: { file: `${DOM}/ReactFiberConfigDOM.js`, line: 703, summary: 'Sets initial DOM properties on a new element.' },
  shouldSetTextContent: { file: `${DOM}/ReactFiberConfigDOM.js`, line: 744, summary: 'True for a single string/number child: set as textContent, no text fiber.' },
  setInitialProperties: { file: `${DOM}/ReactDOMComponent.js`, line: 1111, summary: 'Writes attributes, styles and text on a freshly created element.' },

  // Commit phase
  commitBeforeMutationEffects: { file: `${RECONCILER}/ReactFiberCommitWork.js`, line: 352, summary: 'Before DOM changes: Snapshot effects (e.g. clearing the root container on mount).' },
  clearContainer: { file: `${DOM}/ReactFiberConfigDOM.js`, line: 3972, summary: 'Empties the root container before the first insert.' },
  commitMutationEffectsOnFiber: { file: `${RECONCILER}/ReactFiberCommitWork.js`, line: 2072, summary: 'Walks fibers with mutation flags and applies them.' },
  commitDeletionEffects: { file: `${RECONCILER}/ReactFiberCommitWork.js`, line: 1386, summary: 'Removes a deleted fiber’s DOM node and runs its cleanups.' },
  commitReconciliationEffects: { file: `${RECONCILER}/ReactFiberCommitWork.js`, line: 2845, summary: 'Handles Placement, then clears the flag.' },
  commitPlacement: { file: `${RECONCILER}/ReactFiberCommitHostEffects.js`, line: 452, summary: 'Inserts the fiber’s DOM node (and its whole subtree) into its parent.' },
  commitHostUpdate: { file: `${RECONCILER}/ReactFiberCommitHostEffects.js`, line: 114, summary: 'Commits an Update on a host fiber.' },
  commitUpdate: { file: `${DOM}/ReactFiberConfigDOM.js`, line: 999, summary: 'Calls updateProperties and refreshes __reactProps$.' },
  updateProperties: { file: `${DOM}/ReactDOMComponent.js`, line: 1518, summary: 'The real props diff: writes only DOM properties that changed (not event handlers).' },
};

// updateHostComponent exists in both begin and complete files; the table keys
// the complete-phase one separately but displays the real name.
export function displayName(fn: string): string {
  return fn === 'updateHostComponentComplete' ? 'updateHostComponent' : fn;
}

export function sourceUrl(fn: string): string | null {
  const entry = reactSource[fn];
  return entry ? `https://github.com/facebook/react/blob/${REACT_VERSION_TAG}/packages/${entry.file}#L${entry.line}` : null;
}

export function sourceFile(fn: string): string | null {
  const entry = reactSource[fn];
  return entry ? `${entry.file.split('/').pop()}:${entry.line}` : null;
}
