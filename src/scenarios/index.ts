import type { ComponentType } from 'react';
import { Counter } from './basic';
import { ChildrenDemo } from './children';
import { KeyTypeCounter } from './keyType';
import { MemoCounter } from './memo';

export interface Scenario {
  id: string;
  title: string;
  description: string;
  Component: ComponentType;
  lesson: string[];
  code: string;
}

export const scenarios: Scenario[] = [
  {
    id: 'basic',
    title: 'Basic Counter',
    description: 'The Counter from the doc. Watch A/B objects alternate and which fibers get flags.',
    Component: Counter,
    lesson: [
      'Render 1: everything below HostRoot is new (mount path); only Counter gets Placement – the div subtree is inserted in one step.',
      'Render 2: the previous tree is not null. New B objects are allocated and linked to A via alternate.',
      'Render 3+: no new objects. createWorkInProgress reuses the A objects and overwrites them.',
      'span: text child → no text fiber; commit writes the new text. button: onClick changes, nothing written to the DOM.',
      'React 19 detail: div, span and button all get the Update flag (new props object). The real diff runs at commit.',
    ],
    code: `function Counter() {
  const [count, setCount] = useState(0);
  return (
    <div>
      <span>{count}</span>
      <button onClick={() => setCount(count + 1)}>+</button>
    </div>
  );
}`,
  },
  {
    id: 'memo',
    title: 'React.memo bailout',
    description: 'StaticLabel is memoized, Plain is not. Both get no props.',
    Component: MemoCounter,
    lesson: [
      'Plain() is called on every click: a new element means a new (empty) props object.',
      'memo(StaticLabel) fiber is cloned, but shallowEqual passes → function NOT called.',
      'Its <em> child keeps the same object across commits: status "kept", never cloned.',
    ],
    code: `const StaticLabel = memo(function StaticLabel() {
  return <em>memoized label</em>;
});
function Plain() { return <small>plain child</small>; }

function MemoCounter() {
  const [count, setCount] = useState(0);
  return (
    <div>
      <span>{count}</span>
      <button onClick={() => setCount(count + 1)}>+</button>
      <StaticLabel />
      <Plain />
    </div>
  );
}`,
  },
  {
    id: 'children',
    title: 'children from parent',
    description: 'Layout holds the state. <Expensive/> was created by ChildrenDemo, which does not re-render.',
    Component: ChildrenDemo,
    lesson: [
      'Clicking re-renders Layout only; ChildrenDemo is not called.',
      'Layout returns the same <Expensive/> element object it received → same props object.',
      'Expensive fiber is cloned but bails out without memo; its <i> stays the same object.',
    ],
    code: `function Layout({ children }) {
  const [count, setCount] = useState(0);
  return (
    <div>
      <span>{count}</span>
      <button onClick={() => setCount(count + 1)}>+</button>
      {children}
    </div>
  );
}
function ChildrenDemo() {
  return <Layout><Expensive /></Layout>;
}`,
  },
  {
    id: 'keyType',
    title: 'key / type change',
    description: 'Change the key or the element type of the first child and React throws the old fiber away.',
    Component: KeyTypeCounter,
    lesson: [
      '"+" keeps type and key: the fiber is reused, Update flag only.',
      '"+ & new key": key differs → old fiber deleted (ChildDeletion on div), new fiber with Placement.',
      '"swap span↔p": type differs → same result: delete + create, new object ids, letter starts over at A.',
    ],
    code: `function KeyTypeCounter() {
  const [count, setCount] = useState(0);
  const [keyVersion, setKeyVersion] = useState(0);
  const [asParagraph, setAsParagraph] = useState(false);
  const Tag = asParagraph ? 'p' : 'span';
  return (
    <div>
      <Tag key={'v' + keyVersion}>{count}</Tag>
      <button onClick={...}>+</button>
      <button onClick={...}>+ & new key</button>
      <button onClick={...}>swap span↔p</button>
    </div>
  );
}`,
  },
];
