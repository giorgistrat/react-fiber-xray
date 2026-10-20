// Must be imported before react-dom: React looks for this global when it loads
// and then calls onCommitFiberRoot(rendererId, fiberRoot) after every commit,
// right after `root.current` has switched to the new tree.
//
// In dev, Vite's React Refresh preamble (or the DevTools extension) has usually
// installed a hook already; in that case we wrap its onCommitFiberRoot.

import type { FiberRoot } from './fiber/types';

type CommitListener = (root: FiberRoot) => void;

interface DevtoolsHook {
  supportsFiber: boolean;
  renderers: Map<number, unknown>;
  inject(internals: unknown): number;
  onCommitFiberRoot(id: number, root: FiberRoot, ...rest: unknown[]): void;
  onCommitFiberUnmount(): void;
  onPostCommitFiberRoot(): void;
}

declare global {
  interface Window {
    __REACT_DEVTOOLS_GLOBAL_HOOK__?: DevtoolsHook;
  }
}

const listeners = new Set<CommitListener>();

export function onCommit(listener: CommitListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(root: FiberRoot) {
  for (const listener of listeners) {
    try {
      listener(root);
    } catch (err) {
      console.error('[reconciliation-demo] commit listener failed', err);
    }
  }
}

const existing = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
if (existing) {
  const original = existing.onCommitFiberRoot;
  existing.onCommitFiberRoot = function (id, root, ...rest) {
    try {
      original?.call(this, id, root, ...rest);
    } finally {
      emit(root);
    }
  };
} else {
  let nextId = 1;
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    renderers: new Map(),
    inject(internals) {
      const id = nextId++;
      this.renderers.set(id, internals);
      return id;
    },
    onCommitFiberRoot(_id, root) {
      emit(root);
    },
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
  };
}
