// Minimal typing for the parts of React's internal Fiber object we read.
// These are undocumented internals; values verified against react-dom 19.3.

export interface Hook {
  memoizedState: unknown;
  queue: unknown;
  next: Hook | null;
}

export interface Fiber {
  tag: number;
  key: string | null;
  elementType: unknown;
  type: unknown;
  stateNode: unknown;
  return: Fiber | null;
  child: Fiber | null;
  sibling: Fiber | null;
  index: number;
  pendingProps: Record<string, unknown> | null;
  memoizedProps: Record<string, unknown> | null;
  memoizedState: unknown;
  flags: number;
  subtreeFlags: number;
  deletions: Fiber[] | null;
  lanes: number;
  childLanes: number;
  alternate: Fiber | null;
}

export interface FiberRoot {
  current: Fiber;
  containerInfo: Element;
}

export const WorkTag = {
  FunctionComponent: 0,
  ClassComponent: 1,
  HostRoot: 3,
  HostPortal: 4,
  HostComponent: 5,
  HostText: 6,
  Fragment: 7,
  ForwardRef: 11,
  MemoComponent: 14,
  SimpleMemoComponent: 15,
  HostHoistable: 26,
  HostSingleton: 27,
} as const;

// Effect flags (ReactFiberFlags). Only the ones worth showing.
export const Flags = {
  PerformedWork: 1,
  Placement: 2,
  Update: 4,
  ChildDeletion: 16,
  ContentReset: 32,
  Callback: 64,
  Ref: 512,
  Snapshot: 1024,
  Passive: 2048,
} as const;

export type FlagName = keyof typeof Flags;

// Commit clears Placement (2) once the node is inserted, so by the time we
// snapshot it is gone. The dev-only PlacementDEV bit is set together with it
// for new insertions and survives until the fiber is recycled.
const PlacementDEV = 1 << 27;

export function decodeFlags(flags: number): FlagName[] {
  const effective = flags & PlacementDEV ? flags | Flags.Placement : flags;
  return (Object.keys(Flags) as FlagName[]).filter((name) => (effective & Flags[name]) !== 0);
}

export function isHostTag(tag: number): boolean {
  return tag === WorkTag.HostComponent || tag === WorkTag.HostHoistable || tag === WorkTag.HostSingleton;
}

export function isComponentTag(tag: number): boolean {
  return (
    tag === WorkTag.FunctionComponent ||
    tag === WorkTag.ForwardRef ||
    tag === WorkTag.MemoComponent ||
    tag === WorkTag.SimpleMemoComponent ||
    tag === WorkTag.ClassComponent
  );
}

function typeName(type: unknown): string | null {
  if (typeof type === 'string') return type;
  if (typeof type === 'function') {
    const fn = type as { displayName?: string; name?: string };
    return fn.displayName || fn.name || 'Anonymous';
  }
  if (type && typeof type === 'object') {
    const obj = type as { displayName?: string; type?: unknown; render?: unknown };
    if (obj.displayName) return obj.displayName;
    if (obj.type) return typeName(obj.type); // memo(...)
    if (obj.render) return typeName(obj.render); // forwardRef(...)
  }
  return null;
}

export function fiberName(fiber: Fiber): string {
  switch (fiber.tag) {
    case WorkTag.HostRoot:
      return 'HostRoot';
    case WorkTag.HostText:
      return '#text';
    case WorkTag.Fragment:
      return 'Fragment';
    case WorkTag.MemoComponent:
    case WorkTag.SimpleMemoComponent:
      return `memo(${typeName(fiber.elementType) ?? typeName(fiber.type) ?? '?'})`;
    default:
      return typeName(fiber.type) ?? `tag ${fiber.tag}`;
  }
}

export function tagLabel(tag: number): string {
  const entry = Object.entries(WorkTag).find(([, value]) => value === tag);
  return entry ? entry[0] : `tag ${tag}`;
}
