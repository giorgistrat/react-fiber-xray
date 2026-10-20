// Tooltip texts. Elements opt in with data-term="<key>"; TooltipLayer looks the key up here.

import { displayName, reactSource, sourceFile } from './fiber/reactSource';

export interface GlossaryEntry {
  title: string;
  body: string;
  footer?: string;
}

const entries: Record<string, GlossaryEntry> = {
  // Object status (computed by fiber-xray from object identity)
  'status:new': {
    title: 'new object',
    body: 'This fiber object did not exist before this render. React allocated it: on mount, on the first update (the twin of the current fiber), or for a new type or key.',
  },
  'status:recycled': {
    title: 'recycled',
    body: 'Same JS object as two renders ago. createWorkInProgress reused current.alternate and overwrote it with data from the current fiber. From Render 3 on, almost every fiber is recycled.',
  },
  'status:kept': {
    title: 'not cloned',
    body: 'Exactly the same object as in the previous tree. Its parent bailed out with no work below, so React never visited or copied it. Both trees share it.',
  },

  // Chips
  'chip:called': {
    title: 'ƒ called',
    body: 'React called your component function during this render (it has the PerformedWork flag).',
  },
  'chip:bailout': {
    title: 'bailout',
    body: 'The fiber was cloned but its function was not called: same props object (or memo found equal props) and no pending update.',
  },
  'chip:working': {
    title: 'in progress',
    body: 'beginWork has run on this fiber, but completeWork has not yet. It sits on the path React is walking down.',
  },
  'chip:deleted': {
    title: 'deleted next',
    body: 'In the next render this fiber is put in its parent’s deletions list (key or type changed). Its DOM node is removed at commit.',
  },

  // Flags
  'flag:Placement': {
    title: 'Placement flag',
    body: 'Commit must insert this fiber’s DOM node into its parent, with its whole subtree. Set while the parent reconciles its children (beginWork).',
  },
  'flag:Update': {
    title: 'Update flag',
    body: 'In React 19, set in completeWork whenever a host fiber gets a new props object. The real diff runs at commit in updateProperties, which may write nothing.',
  },
  'flag:ChildDeletion': {
    title: 'ChildDeletion flag',
    body: 'This fiber has old children to remove (listed in fiber.deletions). Set while reconciling children, when a key or type no longer matches.',
  },
  'flag:Snapshot': {
    title: 'Snapshot flag',
    body: 'Work for the before-mutation phase. On HostRoot at mount it means: clear the root container before inserting the new tree.',
  },
  'flag:Passive': { title: 'Passive flag', body: 'The fiber has useEffect callbacks to run after paint (flushPassiveEffects).' },
  'flag:Ref': { title: 'Ref flag', body: 'A ref must be attached or detached during commit.' },
  'flag:Callback': { title: 'Callback flag', body: 'Callbacks queued with an update run during the layout phase of commit.' },
  'flag:ContentReset': { title: 'ContentReset flag', body: 'The element’s text content must be reset before its new children are inserted.' },

  // Work tags
  'tag:HostRoot': { title: 'HostRoot', body: 'The root fiber created by createRoot. Its stateNode is the FiberRoot, whose .current points to the tree on screen.' },
  'tag:FunctionComponent': { title: 'FunctionComponent', body: 'A fiber for a function component. Its hook list lives in memoizedState.' },
  'tag:HostComponent': { title: 'HostComponent', body: 'A fiber for a DOM element such as <div>. Its stateNode is the real DOM node.' },
  'tag:HostText': { title: 'HostText', body: 'A fiber for a text node. Not created when an element has a single text child.' },
  'tag:SimpleMemoComponent': { title: 'SimpleMemoComponent', body: 'memo() of a plain function with no custom compare. Props are shallow-compared to decide on a bailout.' },
  'tag:MemoComponent': { title: 'MemoComponent', body: 'memo() wrapper fiber in the general case (e.g. with a custom compare function).' },

  // Labels
  'label:objId': { title: 'object id', body: 'A number fiber-xray gives each fiber object (via a WeakMap), so you can see when React reuses the same JS object.' },
  'label:letter': { title: 'A / B twin', body: 'Each node has at most two fiber objects that swap roles every commit (double buffering). The letter tells you which of the two this is.' },
  'label:alt': { title: 'alternate', body: 'fiber.alternate points at this fiber’s twin in the other tree. null means no twin exists yet.' },
  'label:propsFrom': { title: 'props ← element', body: 'This fiber’s memoizedProps is the very props object of that element in column ②. Elements are not stored as a tree; fibers hold their props.' },
  'label:sameProps': { title: 'same props object', body: 'memoizedProps is the identical object the current fiber had. Without a pending update, that allows a bailout.' },
  'label:key': { title: 'key', body: 'Matched together with the type when reconciling children. A different key means a new fiber, even for the same type.' },
  'label:pointers': { title: 'tree pointers', body: 'Fibers form a tree through child (first child), sibling (next sibling) and return (parent) pointers.' },

  // Columns
  'col:prev': { title: '① Current tree', body: 'The fibers on screen before this render (the last commit). React reads old props, state and children from it and never modifies it during render.' },
  'col:elements': { title: '② New elements', body: 'Plain objects returned by the components called in this render. React reads them one level at a time.' },
  'col:next': { title: '③ Work-in-progress', body: 'The fibers React writes during this render: current fiber + new element → WIP fiber. At commit it becomes root.current.' },
};

export function lookupTerm(term: string): GlossaryEntry | null {
  if (term.startsWith('fn:')) {
    const fn = term.slice(3);
    const entry = reactSource[fn];
    if (!entry) return null;
    return { title: `${displayName(fn)}()`, body: entry.summary, footer: `${sourceFile(fn)} · React v19.3.1 · click to open` };
  }
  return entries[term] ?? null;
}
