// Records which demo component functions React calls during a render, and the
// elements they return. Demo components end with `return rendered(name, state, <jsx/>)`.
// The buffer is drained into the next commit record (see store.ts).

import type { ReactNode } from 'react';

export interface ElementNode {
  eid: number;
  // true when this exact element object was already seen in an earlier render
  // (e.g. `children` passed down from a parent that did not re-render).
  reused: boolean;
  // true when the same object already appeared earlier in this render
  // (e.g. as a parent's props.children, then again in the child's output).
  repeat: boolean;
  type: string;
  key: string | null;
  props: Record<string, string>;
  children: (ElementNode | string)[];
  // Every own property of the real element object, as captured at render time.
  raw: RawField[];
  frozen: boolean;
}

export interface RawField {
  key: string;
  value: string;
  hidden: boolean; // non-enumerable (dev-only bookkeeping)
}

export interface RenderCall {
  kind: 'component' | 'root';
  component: string;
  state: Record<string, unknown>;
  returned: ElementNode | string | null;
  // The fiber that was rendering when the elements were created (element._owner).
  owner: object | null;
  time: number;
}

let buffer: RenderCall[] = [];
let nextEid = 1;

// props object → element id, so a fiber can say "my props came from element e5".
export let elementIdByProps = new WeakMap<object, number>();
// element id → element._owner fiber; resolved to "#7B" at display time.
let ownerByEid = new Map<number, object | null>();
// element ids seen since the last commit
let seenThisRender = new Set<number>();

export function resetTrace() {
  buffer = [];
  nextEid = 1;
  elementIdByProps = new WeakMap();
  ownerByEid = new Map();
  seenThisRender = new Set();
}

export function ownerOf(eid: number): object | null {
  return ownerByEid.get(eid) ?? null;
}

export function drainTrace(): RenderCall[] {
  const calls = buffer;
  buffer = [];
  seenThisRender = new Set();
  return calls;
}

export function rendered<T extends ReactNode>(component: string, state: Record<string, unknown>, element: T): T {
  const owner = isElement(element) ? ((element as { _owner?: object | null })._owner ?? null) : null;
  buffer.push({ kind: 'component', component, state, returned: serializeNode(element), owner, time: performance.now() });
  return element;
}

// The element passed to root.render(): created outside any component, read by HostRoot.
export function traceRoot(element: ReactNode) {
  buffer.push({ kind: 'root', component: 'root.render', state: {}, returned: serializeNode(element), owner: null, time: performance.now() });
}

function isElement(node: unknown): node is { type: unknown; key: string | null; props: Record<string, unknown> } {
  return typeof node === 'object' && node !== null && '$$typeof' in node && 'props' in node;
}

export function describeType(type: unknown): string {
  if (typeof type === 'string') return type;
  if (typeof type === 'function') return (type as { name?: string }).name || 'Anonymous';
  if (type && typeof type === 'object') {
    const inner = (type as { type?: unknown }).type;
    if (inner) return `memo(${describeType(inner)})`;
  }
  return String(type);
}

export function describeValue(value: unknown): string {
  if (typeof value === 'function') return 'ƒ';
  if (Array.isArray(value)) return `[${value.map(describeValue).join(', ')}]`;
  if (isElement(value)) return `<${describeType(value.type)}/>`;
  if (typeof value === 'string') return JSON.stringify(value);
  return String(value);
}

function describeRaw(key: string, value: unknown): string {
  if (typeof value === 'symbol') return String(value);
  if (key === 'type') return typeof value === 'string' ? JSON.stringify(value) : `ƒ ${describeType(value)}`;
  if (key === 'key') return value === null ? 'null' : JSON.stringify(value);
  if (key === 'props' && value && typeof value === 'object') {
    return `{ ${Object.entries(value).map(([k, v]) => `${k}: ${describeValue(v)}`).join(', ')} }`;
  }
  if (key === '_store' && value && typeof value === 'object') {
    return `{ validated: ${String((value as { validated?: unknown }).validated)} }`;
  }
  if (value instanceof Error) return 'Error (stack where the element was created)';
  if (key === '_debugTask' && value) return 'console.createTask(…) handle (async stack in DevTools)';
  if (value && typeof value === 'object') return value.constructor?.name || 'object';
  return describeValue(value);
}

function rawFields(element: object): RawField[] {
  return Object.getOwnPropertyNames(element).map((key) => ({
    key,
    value: describeRaw(key, (element as Record<string, unknown>)[key]),
    hidden: !Object.prototype.propertyIsEnumerable.call(element, key),
  }));
}

function serializeNode(node: unknown): ElementNode | string | null {
  if (node === null || node === undefined || typeof node === 'boolean') return null;
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) {
    // Fragments of arrays are rare in the demos; show them as an anonymous group.
    return {
      eid: nextEid++,
      reused: false,
      repeat: false,
      type: '[array]',
      key: null,
      props: {},
      children: node.map(serializeNode).filter((c): c is ElementNode | string => c !== null),
      raw: [],
      frozen: Object.isFrozen(node),
    };
  }
  if (!isElement(node)) return String(node);

  const existing = elementIdByProps.get(node.props);
  const eid = existing ?? nextEid++;
  if (existing === undefined) {
    elementIdByProps.set(node.props, eid);
    ownerByEid.set(eid, (node as { _owner?: object | null })._owner ?? null);
  }
  const repeat = seenThisRender.has(eid);
  seenThisRender.add(eid);
  const props: Record<string, string> = {};
  for (const [key, value] of Object.entries(node.props)) {
    if (key !== 'children') props[key] = describeValue(value);
  }
  const rawChildren = node.props.children;
  const list = Array.isArray(rawChildren) ? rawChildren : rawChildren === undefined ? [] : [rawChildren];
  return {
    eid,
    reused: existing !== undefined && !repeat,
    repeat,
    type: describeType(node.type),
    key: node.key,
    props,
    children: list.map(serializeNode).filter((c): c is ElementNode | string => c !== null),
    raw: rawFields(node),
    frozen: Object.isFrozen(node),
  };
}
