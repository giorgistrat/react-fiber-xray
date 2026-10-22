// Owns the demo React root (separate from the visualizer's root) and the
// history of commit snapshots. The visualizer reads it with useSyncExternalStore.

import { createElement, type ComponentType } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { onCommit } from './devtoolsHook';
import { FiberTracker, type CommitRecord } from './fiber/snapshot';
import type { Fiber, FiberRoot } from './fiber/types';
import { drainTrace, resetTrace, traceRoot } from './trace';

export interface LogEntry {
  id: number;
  kind: 'call' | 'commit' | 'info';
  text: string;
  commit: number;
}

export interface DemoState {
  commits: CommitRecord[];
  log: LogEntry[];
  tracker: FiberTracker;
  run: number; // increments per startScenario, so callers can wait for a fresh mount
}

let state: DemoState = { commits: [], log: [], tracker: new FiberTracker(), run: 0 };
const subscribers = new Set<() => void>();
let logId = 1;

let root: Root | null = null;
let fiberRoot: FiberRoot | null = null;
let container: HTMLElement | null = null;

export function subscribe(callback: () => void) {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

export function getState() {
  return state;
}

// Notify after the current (demo) commit has finished; never render the
// visualizer synchronously from inside another root's commit.
let notifyQueued = false;
function notify() {
  if (notifyQueued) return;
  notifyQueued = true;
  queueMicrotask(() => {
    notifyQueued = false;
    subscribers.forEach((cb) => cb());
  });
}

function findKey(node: object, prefix: string): string | undefined {
  return Object.keys(node).find((k) => k.startsWith(prefix));
}

function record(label: string) {
  if (!fiberRoot) return;
  const calls = drainTrace();
  const index = state.commits.length;
  const commit = state.tracker.snapshot(fiberRoot, index, label, calls);
  const entries: LogEntry[] = [
    ...calls.filter((call) => call.kind === 'component').map((call): LogEntry => ({
      id: logId++,
      kind: 'call',
      text: `${call.component}() called${Object.keys(call.state).length ? ` ${JSON.stringify(call.state)}` : ''}`,
      commit: index,
    })),
    { id: logId++, kind: index === 0 ? 'info' : 'commit', text: `${label} → root.current = #${commit.tree.objId}${commit.tree.letter}`, commit: index },
  ];
  state = { ...state, commits: [...state.commits, commit], log: [...state.log, ...entries] };
  notify();
}

onCommit((committedRoot) => {
  if (committedRoot !== fiberRoot) return; // visualizer commits, or an unmounting demo root
  record(`Render ${state.commits.length}${state.commits.length === 1 ? ' (mount)' : ''}`);
});

export function startScenario(target: HTMLElement, Component: ComponentType) {
  stopScenario();
  container = target;
  resetTrace();
  state = { commits: [], log: [], tracker: new FiberTracker(), run: state.run + 1 };

  root = createRoot(target);
  const containerKey = findKey(target, '__reactContainer$');
  const hostRoot = containerKey ? ((target as unknown as Record<string, Fiber>)[containerKey]) : null;
  fiberRoot = (hostRoot?.stateNode as FiberRoot) ?? null;

  // Commit 0: before any render there is already a current tree – the bare HostRoot.
  record('createRoot (no render yet)');
  const element = createElement(Component);
  traceRoot(element); // drained into the mount commit, like a component's returned elements
  root.render(element);
}

export function stopScenario() {
  fiberRoot = null; // ignore the unmount commit
  root?.unmount();
  root = null;
  container = null;
}

export function getDemoContainer() {
  return container;
}

export function getFiberRoot() {
  return fiberRoot;
}

export { findKey };
