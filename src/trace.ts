// Records which demo component functions React calls during a render, and the
// elements they return. Demo components end with `return rendered(name, state, <jsx/>)`.
// The buffer is drained into the next commit record (see store.ts).

import type { ReactNode } from 'react';

export interface ElementNode {
  eid: number;
  // true when this exact element object was already seen in an earlier render
  // (e.g. `children` passed down from a parent that did not re-render).
  reused: boolean;
  type: string;
  key: string | null;
  props: Record<string, string>;
  children: (ElementNode | string)[];
}

export interface RenderCall {
  component: string;
  state: Record<string, unknown>;
  returned: ElementNode | string | null;
  time: number;
}

let buffer: RenderCall[] = [];
let nextEid = 1;

// props object → element id, so a fiber can say "my props came from element e5".
export let elementIdByProps = new WeakMap<object, number>();

export function resetTrace() {
  buffer = [];
  nextEid = 1;
  elementIdByProps = new WeakMap();
}

export function drainTrace(): RenderCall[] {
  const calls = buffer;
  buffer = [];
  return calls;
}

export function rendered<T extends ReactNode>(component: string, state: Record<string, unknown>, element: T): T {
  buffer.push({ component, state, returned: serializeNode(element), time: performance.now() });
  return element;
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
  if (isElement(value)) return `<${describeType(value.type)}/>`;
  if (typeof value === 'string') return JSON.stringify(value);
  return String(value);
}

function serializeNode(node: unknown): ElementNode | string | null {
  if (node === null || node === undefined || typeof node === 'boolean') return null;
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) {
    // Fragments of arrays are rare in the demos; show them as an anonymous group.
    return {
      eid: nextEid++,
      reused: false,
      type: '[array]',
      key: null,
      props: {},
      children: node.map(serializeNode).filter((c): c is ElementNode | string => c !== null),
    };
  }
  if (!isElement(node)) return String(node);

  const existing = elementIdByProps.get(node.props);
  const eid = existing ?? nextEid++;
  if (existing === undefined) elementIdByProps.set(node.props, eid);
  const props: Record<string, string> = {};
  for (const [key, value] of Object.entries(node.props)) {
    if (key !== 'children') props[key] = describeValue(value);
  }
  const rawChildren = node.props.children;
  const list = Array.isArray(rawChildren) ? rawChildren : rawChildren === undefined ? [] : [rawChildren];
  return {
    eid,
    reused: existing !== undefined,
    type: describeType(node.type),
    key: node.key,
    props,
    children: list.map(serializeNode).filter((c): c is ElementNode | string => c !== null),
  };
}
