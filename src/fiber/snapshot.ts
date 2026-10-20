// Serializes the committed fiber tree right after each commit and tracks
// fiber *object identity* across commits, so A/B double buffering is shown
// from real objects instead of being assumed.

import { describeValue, elementIdByProps, type RenderCall } from '../trace';
import {
  decodeFlags,
  fiberName,
  Flags,
  isComponentTag,
  isHostTag,
  WorkTag,
  type FiberRoot,
  type Fiber,
  type FlagName,
  type Hook,
} from './types';

/**
 * new      – object never seen before (allocated in this render)
 * recycled – object seen in an older commit, reused by createWorkInProgress
 * kept     – same object as in the previous commit: React never cloned it (bailed-out subtree)
 */
export type FiberStatus = 'new' | 'recycled' | 'kept';

export interface PropChange {
  key: string;
  from: string;
  to: string;
}

export interface FiberSnap {
  objId: number;
  slot: number; // logical node: both twins share it
  letter: string; // A or B: which of the two objects for that slot
  name: string;
  tag: number;
  key: string | null;
  status: FiberStatus;
  mount: boolean; // created with no alternate → mount path
  alternateId: number | null;
  flags: FlagName[]; // only meaningful when status !== 'kept'
  props: Record<string, string>;
  textContent: string | null;
  propsSameObject: boolean | null; // vs alternate.memoizedProps
  changedProps: PropChange[];
  propsFromElement: number | null; // element id (trace) whose props object this fiber holds
  hooks: string[];
  deletions: { objId: number; name: string }[];
  functionCalled: boolean;
  children: FiberSnap[];
}

export interface CommitRecord {
  index: number;
  label: string;
  tree: FiberSnap;
  objIds: Set<number>;
  deletedIds: Set<number>;
  calls: RenderCall[];
  // Host fibers' DOM nodes (fiber.stateNode), kept out of FiberSnap so snapshots stay plain data.
  domByObjId: Map<number, Element>;
}

export class FiberTracker {
  private ids = new WeakMap<Fiber, number>();
  private slots = new WeakMap<Fiber, number>();
  private letters = new WeakMap<Fiber, string>();
  private lastSeen = new WeakMap<Fiber, number>();
  private nextId = 1;
  private nextSlot = 1;

  // Ids of fibers in the most recent snapshot (what is "current" right now).
  latestObjects = new WeakSet<Fiber>();

  idOf(fiber: Fiber): number | undefined {
    return this.ids.get(fiber);
  }

  letterOf(fiber: Fiber): string | undefined {
    return this.letters.get(fiber);
  }

  private register(fiber: Fiber): number {
    let id = this.ids.get(fiber);
    if (id !== undefined) return id;
    id = this.nextId++;
    this.ids.set(fiber, id);
    const twin = fiber.alternate;
    const twinSlot = twin ? this.slots.get(twin) : undefined;
    if (twinSlot !== undefined) {
      this.slots.set(fiber, twinSlot);
      this.letters.set(fiber, this.letters.get(twin!) === 'A' ? 'B' : 'A');
    } else {
      this.slots.set(fiber, this.nextSlot++);
      this.letters.set(fiber, 'A');
    }
    return id;
  }

  snapshot(root: FiberRoot, index: number, label: string, calls: RenderCall[]): CommitRecord {
    const objIds = new Set<number>();
    const deletedIds = new Set<number>();
    const domByObjId = new Map<number, Element>();
    const latest = new WeakSet<Fiber>();

    const visit = (fiber: Fiber): FiberSnap => {
      const seenAt = this.lastSeen.get(fiber);
      const status: FiberStatus = seenAt === undefined ? 'new' : seenAt === index - 1 ? 'kept' : 'recycled';
      const objId = this.register(fiber);
      // The alternate may be a fiber we never saw (e.g. the WIP root on first commit).
      const alternateId = fiber.alternate ? this.register(fiber.alternate) : null;
      this.lastSeen.set(fiber, index);
      objIds.add(objId);
      latest.add(fiber);
      if (isHostTag(fiber.tag) && fiber.stateNode instanceof Element) domByObjId.set(objId, fiber.stateNode);

      const props = fiber.memoizedProps;
      const prevProps = fiber.alternate?.memoizedProps ?? null;
      const mount = status === 'new' && fiber.alternate === null;
      const cloned = status !== 'kept';

      const deletions = cloned
        ? (fiber.deletions ?? []).map((d) => {
            const id = this.register(d);
            deletedIds.add(id);
            return { objId: id, name: fiberName(d) };
          })
        : [];

      const children: FiberSnap[] = [];
      for (let child = fiber.child; child; child = child.sibling) children.push(visit(child));

      return {
        objId,
        slot: this.slots.get(fiber)!,
        letter: this.letters.get(fiber)!,
        name: fiberName(fiber),
        tag: fiber.tag,
        key: fiber.key,
        status,
        mount,
        alternateId,
        flags: cloned ? decodeFlags(fiber.flags) : [],
        props: summarizeProps(fiber),
        textContent: hostText(fiber),
        propsSameObject: cloned && !mount && prevProps ? props === prevProps : null,
        changedProps: cloned && !mount && prevProps && props && props !== prevProps ? diffProps(prevProps, props) : [],
        propsFromElement: props ? (elementIdByProps.get(props) ?? null) : null,
        hooks: isComponentTag(fiber.tag) ? describeHooks(fiber) : [],
        deletions,
        functionCalled: cloned && isComponentTag(fiber.tag) && (fiber.flags & Flags.PerformedWork) !== 0,
        children,
      };
    };

    const tree = visit(root.current);
    this.latestObjects = latest;
    return { index, label, tree, objIds, deletedIds, calls, domByObjId };
  }
}

function hostText(fiber: Fiber): string | null {
  if (!isHostTag(fiber.tag)) return fiber.tag === WorkTag.HostText ? String(fiber.memoizedProps) : null;
  const children = fiber.memoizedProps?.children;
  return typeof children === 'string' || typeof children === 'number' ? String(children) : null;
}

function summarizeProps(fiber: Fiber): Record<string, string> {
  const props = fiber.memoizedProps;
  if (!props || typeof props !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(props)) {
    if (key === 'children' && isHostTag(fiber.tag)) continue; // shown as textContent / child fibers
    out[key] = describeValue(value);
  }
  return out;
}

function diffProps(prev: Record<string, unknown>, next: Record<string, unknown>): PropChange[] {
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  const changes: PropChange[] = [];
  for (const key of keys) {
    if (prev[key] !== next[key]) {
      const from = describeValue(prev[key]);
      const to = describeValue(next[key]);
      // Same printed value but a different object (e.g. a new function or element).
      changes.push({ key, from, to: from === to ? `${to} (new object)` : to });
    }
  }
  return changes;
}

function describeHooks(fiber: Fiber): string[] {
  const out: string[] = [];
  if (fiber.tag === WorkTag.ClassComponent) return out;
  let hook = fiber.memoizedState as Hook | null;
  while (hook && typeof hook === 'object' && 'next' in hook) {
    out.push(hook.queue ? `state: ${describeValue(hook.memoizedState)}` : 'hook');
    hook = hook.next;
  }
  return out;
}
