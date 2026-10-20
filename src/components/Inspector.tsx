import type { FiberTracker } from '../fiber/snapshot';
import { decodeFlags, fiberName, tagLabel, type Fiber } from '../fiber/types';
import { describeValue } from '../trace';
import { findKey } from '../store';

function describeFiber(fiber: Fiber, tracker: FiberTracker) {
  const id = tracker.idOf(fiber);
  return id === undefined ? 'unseen' : `#${id}${tracker.letterOf(fiber) ?? ''}`;
}

function propsLine(props: Record<string, unknown> | null) {
  if (!props) return 'null';
  return `{ ${Object.entries(props).map(([k, v]) => `${k}: ${describeValue(v)}`).join(', ')} }`;
}

// `commitIndex` is only here so the panel re-evaluates "current or alternate" after each commit.
export function Inspector({ element, tracker }: { element: Element | null; tracker: FiberTracker; commitIndex: number }) {
  if (!element) {
    return (
      <p className="muted">
        Turn on <b>Inspect</b> and click any element in the demo stage. Its <code>__reactFiber$…</code> property is read directly.
      </p>
    );
  }
  const fiberKey = findKey(element, '__reactFiber$');
  const propsKey = findKey(element, '__reactProps$');
  if (!fiberKey) return <p className="muted">No fiber on this node.</p>;
  const raw = element as unknown as Record<string, unknown>;
  const fiber = raw[fiberKey] as Fiber;
  const domProps = propsKey ? (raw[propsKey] as Record<string, unknown>) : null;
  const isCurrent = tracker.latestObjects.has(fiber);

  const rows: [string, string][] = [
    ['element', `<${element.tagName.toLowerCase()}>`],
    ['fiber object', describeFiber(fiber, tracker)],
    ['is it on screen?', isCurrent ? 'yes: this object is in the current tree' : 'NO: this is the alternate (scratchpad) twin'],
    ['alternate', fiber.alternate ? describeFiber(fiber.alternate, tracker) : 'null'],
    ['tag', `${fiber.tag} (${tagLabel(fiber.tag)})`],
    ['type', fiberName(fiber)],
    ['key', String(fiber.key)],
    ['flags', `${fiber.flags} [${decodeFlags(fiber.flags).join(', ')}]`],
    ['lanes / childLanes', `${fiber.lanes} / ${fiber.childLanes}`],
    ['memoizedProps', propsLine(fiber.memoizedProps)],
    ['pendingProps === memoizedProps', String(fiber.pendingProps === fiber.memoizedProps)],
    ['__reactProps$ === memoizedProps', String(domProps === fiber.memoizedProps)],
    ['stateNode === this element', String(fiber.stateNode === element)],
    ['return', fiber.return ? `${fiberName(fiber.return)} ${describeFiber(fiber.return, tracker)}` : 'null'],
  ];

  return (
    <div>
      <table className="inspect">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <th>{k}</th>
              <td><code>{v}</code></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted small">
        A DOM node keeps pointing at the fiber it was created with (React does not move <code>__reactFiber$</code> on
        updates), so after a render it may point at the scratchpad twin. <code>__reactProps$</code> is refreshed on every
        committed Update, and that is where React's event system reads <code>onClick</code> from.
      </p>
    </div>
  );
}
