// Interview questions about reconciliation. Answers describe React 19.3 behavior.
// `fns` are keys of fiber/reactSource.ts and render as links to React's source.
// `demo` replays clicks in a scenario and opens the explorer on a render and step.

export type Level = 'Fundamentals' | 'How it works' | 'Bailouts' | 'Tricky' | 'Senior';

export interface Demo {
  label: string;
  scenario: string;
  clicks?: string[]; // stage button labels, clicked in order
  step?: 'first' | 'commit' | string; // or a step title prefix, e.g. "beginWork ↓ div"
}

export interface Question {
  id: string;
  level: Level;
  question: string;
  answer: string;
  deeper?: string;
  fns?: string[];
  mistake?: string;
  demo?: Demo;
}

export const LEVELS: Level[] = ['Fundamentals', 'How it works', 'Bailouts', 'Tricky', 'Senior'];

export const questions: Question[] = [
  {
    id: 'what-is-reconciliation',
    level: 'Fundamentals',
    question: 'What is reconciliation in React, and when does it happen?',
    answer:
      'The render-phase process where React compares new elements with the current fibers to decide what changed. Its output is a work-in-progress tree with effect flags, which the commit phase applies to the DOM.',
    deeper:
      'It runs inside beginWork: each visited fiber reconciles its new child elements against its current child fibers. completeWork then marks DOM work, and commit applies it.',
    fns: ['beginWork', 'reconcileChildren', 'completeWork', 'commitRoot'],
    demo: { label: 'Step through a render', scenario: 'basic', clicks: ['+'], step: 'first' },
  },
  {
    id: 'element-vs-fiber',
    level: 'Fundamentals',
    question: 'What is the difference between a React element and a fiber? Which one does React keep?',
    answer:
      'An element is an immutable description returned by a component, created new every render and not kept. A fiber is a mutable, long-lived object per node holding state, hooks, the DOM node and effect flags. React keeps fibers, two per node, which swap roles.',
    deeper:
      'Elements are frozen in dev. After reconciliation an element survives only as a fiber’s pendingProps/memoizedProps. Fibers persist across renders as twins linked by `alternate`.',
    mistake: 'Saying fibers are the read-only objects. It is the other way round: elements are immutable, fibers are written every render.',
    demo: { label: 'Compare ② elements with ③ fibers', scenario: 'basic', clicks: ['+'], step: 'commit' },
  },
  {
    id: 'on-heuristic',
    level: 'Fundamentals',
    question: 'React diffs in O(n) instead of O(n³). Which two assumptions make that possible?',
    answer:
      'Elements of different types produce different trees, so React replaces the subtree instead of diffing it. And keys identify children within a list. React only compares children at the same position under the same parent.',
    deeper: 'React never searches for a subtree that moved to another parent. Keys only help match siblings inside one children list.',
    fns: ['reconcileSingleElement', 'reconcileChildrenArray'],
    demo: { label: 'Type change replaces the node', scenario: 'keyType', clicks: ['swap span↔p'], step: 'beginWork ↓ div' },
  },
  {
    id: 'keys',
    level: 'Fundamentals',
    question: 'Why does React need `key` on list items? What goes wrong with the array index as key?',
    answer:
      'Keys tell React which child is which across renders. With index keys, inserting or reordering items gives an item’s identity to a different item, so state, input values and focus end up on the wrong row, and every row gets updated. Stable keys let React reuse the right fibers and only insert what is new.',
    mistake: 'Saying the cost is visiting more children. React visits all of them either way; the real problem is mismatched identity.',
    fns: ['reconcileChildrenArray', 'placeChild', 'deleteChild'],
    demo: { label: 'New key → new fiber', scenario: 'keyType', clicks: ['+ & new key'], step: 'beginWork ↓ div' },
  },
  {
    id: 'setstate-to-dom',
    level: 'How it works',
    question: 'Walk through what happens between `setCount(c => c + 1)` and the DOM updating.',
    answer:
      'setCount queues an update on the hook, marks that fiber and its ancestors up to the root, and schedules a render. React walks down from the root skipping clean subtrees, re-runs the component and reconciles its children. Then commit applies the DOM changes, switches the current tree, and runs effects.',
    deeper:
      'The fiber gets `lanes`, ancestors get `childLanes`. updateState processes the queue during renderWithHooks. Updates from one event are batched into one render.',
    fns: ['renderWithHooks', 'updateState', 'reconcileChildFibers', 'commitRoot'],
    mistake: 'Saying React goes to "the lane where the update happened". It follows the marks down to the fiber that has lanes.',
    demo: { label: 'Step through the click', scenario: 'basic', clicks: ['+'], step: 'first' },
  },
  {
    id: 'current-vs-wip',
    level: 'How it works',
    question: 'What are the current tree and the work-in-progress tree, and why does React keep two?',
    answer:
      'Current is what is on screen. Work-in-progress is the next version React builds during render. Each fiber has a twin (`alternate`), and at commit they swap. This double buffering means an unfinished or discarded render never affects the screen.',
    deeper:
      'createWorkInProgress reuses current.alternate and overwrites it with data from current. From the second update on, React allocates no new fibers for unchanged nodes.',
    fns: ['createWorkInProgress'],
    demo: { label: 'Recycled A/B objects', scenario: 'basic', clicks: ['+', '+'], step: 'commit' },
  },
  {
    id: 'render-vs-commit',
    level: 'How it works',
    question: 'What is the render phase vs the commit phase? Which can be interrupted?',
    answer:
      'Render calls components and computes changes. It is pure, so React can pause, restart or discard it, for example when an urgent update interrupts a transition. Commit applies DOM mutations and runs effects, synchronously, and is never interrupted.',
    mistake: 'Calling all updates interruptible. Clicks and typing are urgent; only non-urgent work (startTransition, useDeferredValue) yields.',
    fns: ['workLoopSync', 'commitRoot', 'flushMutationEffects'],
    demo: { label: 'Open the commit step', scenario: 'basic', clicks: ['+'], step: 'commit' },
  },
  {
    id: 'reuse-or-create',
    level: 'How it works',
    question: 'What decides whether React reuses an existing fiber or creates a new one for a child?',
    answer:
      'For each child, React matches the new element with the current fiber at that position by key and type. If both match it reuses the fiber, keeping state and the DOM node, and passes the new props. Otherwise it deletes the old fiber and creates a new one.',
    deeper:
      'A match calls useFiber → createWorkInProgress (the twin gets the new pendingProps). A mismatch calls createFiberFromElement (Placement) and deleteChild (ChildDeletion on the parent). Props are not compared at this point.',
    fns: ['useFiber', 'createWorkInProgress', 'createFiberFromElement', 'deleteChild'],
    demo: { label: 'Reuse vs create in one list', scenario: 'keyType', clicks: ['+ & new key'], step: 'beginWork ↓ div' },
  },
  {
    id: 'child-rerender',
    level: 'Bailouts',
    question: 'A parent re-renders. Does its child component re-render? When does it not?',
    answer:
      'Yes by default, because the parent creates new elements, and a new props object means the child re-renders. It does not when the child is wrapped in React.memo with shallowly equal props, or when its element is the same object as last time (for example, passed in as children).',
    deeper: 'Without memo, React checks oldProps === newProps (the props object itself). memo compares each prop with Object.is (shallowEqual).',
    fns: ['attemptEarlyBailoutIfNoScheduledUpdate', 'updateSimpleMemoComponent', 'shallowEqual'],
    mistake: 'Saying React runs Object.is on each prop for every component. That is what memo adds; the default check is on the whole props object.',
    demo: { label: 'memo bailout vs plain child', scenario: 'memo', clicks: ['+'], step: 'beginWork ↓ memo' },
  },
  {
    id: 'children-pattern',
    level: 'Bailouts',
    question: 'Why does passing a component as `children` sometimes avoid a re-render without React.memo?',
    answer:
      'The children element was created by a component that did not re-render, so it is the same element with the same props object. React sees nothing changed and skips that subtree, without needing memo.',
    fns: ['bailoutOnAlreadyFinishedWork'],
    demo: { label: '<Expensive/> bails out', scenario: 'children', clicks: ['+'], step: 'beginWork ↓ Expensive' },
  },
  {
    id: 'memo-still-rerenders',
    level: 'Bailouts',
    question: 'A component is wrapped in React.memo but still re-renders every time its parent does. Why?',
    answer:
      'Usually a prop that is a new object every render: an inline object or function, JSX passed as a prop, or an inline style. Fix it with useMemo/useCallback or by moving the value out of render. Other causes: a context it reads changed, it has its own state update, or its key changes.',
    fns: ['updateSimpleMemoComponent', 'shallowEqual'],
    demo: { label: 'See memo compare props', scenario: 'memo', clicks: ['+'], step: 'beginWork ↓ memo' },
  },
  {
    id: 'same-state',
    level: 'Bailouts',
    question: 'You call setState with the value it already has. What does React do?',
    answer:
      'If nothing else is pending, React compares the new state with Object.is right away and does not render at all. Otherwise it may render that component once, then skip its children.',
    mistake: 'Saying React checks the component. It checks the state value, eagerly, at setState time.',
  },
  {
    id: 'change-key',
    level: 'Tricky',
    question: 'You change the `key` on a component. What happens, and when is that useful on purpose?',
    answer:
      'React treats it as a different component: it unmounts the old one (state lost, cleanups run, DOM removed) and mounts a fresh one. Useful for resetting state on purpose, e.g. <Form key={userId} />.',
    fns: ['deleteChild', 'createFiberFromElement', 'commitDeletionEffects', 'commitPlacement'],
    demo: { label: 'Delete + Placement at commit', scenario: 'keyType', clicks: ['+ & new key'], step: 'commit' },
  },
  {
    id: 'input-to-textarea',
    level: 'Tricky',
    question: 'A component switches between <input> and <textarea> at the same position. What happens to the typed text?',
    answer:
      'Different type, so React destroys the input and creates a new textarea. The typed text lived in the old DOM node, so it is lost.',
    demo: { label: 'Swap span↔p', scenario: 'keyType', clicks: ['swap span↔p'], step: 'beginWork ↓ div' },
  },
  {
    id: 'inline-onclick',
    level: 'Tricky',
    question: 'In React 19 a button’s inline onClick is a new function every render. Does React touch the DOM because of it?',
    answer:
      'Nothing is written to the DOM, because event handlers are not DOM attributes. React uses one event listener at the root and reads the current handler from the latest props stored on the DOM node, so the new function is used automatically.',
    deeper:
      'completeWork still sets Update (new props object). At commit, updateProperties skips handlers and commitUpdate refreshes __reactProps$ on the node.',
    fns: ['markUpdate', 'commitUpdate', 'updateProperties'],
    mistake: 'Answering only "no". The interviewer wants the why: delegated events + __reactProps$.',
    demo: { label: 'Commit writes nothing for the button', scenario: 'basic', clicks: ['+'], step: 'commit' },
  },
  {
    id: 'nested-component',
    level: 'Tricky',
    question: 'What is wrong with defining a component inside another component’s body?',
    answer:
      'Its function is recreated every render, so its type is new each time. React sees a type change and unmounts and remounts it on every render: state lost, DOM recreated, effects re-run. Define it outside and pass data as props.',
    mistake: 'Stopping at "it is recreated". Name the mechanism: new type identity → type mismatch → remount.',
  },
  {
    id: 'lanes',
    level: 'Senior',
    question: 'How does React know which part of the tree to work on after an update, without diffing everything?',
    answer:
      'Lanes. An update marks a priority lane on its fiber and a childLanes mark on every ancestor. During render, React skips any subtree without those marks, so it only walks the path to the update.',
    fns: ['attemptEarlyBailoutIfNoScheduledUpdate', 'bailoutOnAlreadyFinishedWork', 'cloneChildFibers'],
    demo: { label: 'HostRoot clones toward the update', scenario: 'memo', clicks: ['+'], step: 'beginWork ↓ HostRoot' },
  },
  {
    id: 'discard-render',
    level: 'Senior',
    question: 'How can React throw away an in-progress render without the screen showing a half-updated UI?',
    answer:
      'Render only writes to the work-in-progress tree, never the current tree or the DOM. To discard it, React starts over from the current tree. The screen only changes at commit, which happens all at once.',
    fns: ['createWorkInProgress', 'flushMutationEffects'],
    demo: { label: 'Watch ③ being written', scenario: 'basic', clicks: ['+'], step: 'first' },
  },
  {
    id: 'effect-flags',
    level: 'Senior',
    question: 'What do Placement, Update and ChildDeletion do, and when are they set vs applied?',
    answer:
      'They are effect flags set during render: Placement means insert, Update means update DOM properties, and ChildDeletion means remove children. Commit reads them and applies the matching DOM operations, so render decides what to change and commit performs it.',
    deeper:
      'Placement and ChildDeletion are set while reconciling children (beginWork); Update in completeWork. bubbleProperties collects them into subtreeFlags so commit can skip clean subtrees.',
    fns: ['placeChild', 'deleteChild', 'markUpdate', 'bubbleProperties', 'commitMutationEffectsOnFiber'],
    demo: { label: 'All three flags at once', scenario: 'keyType', clicks: ['+ & new key'], step: 'commit' },
  },
];
