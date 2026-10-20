import type { FiberSnap } from '../fiber/snapshot';
import { isComponentTag, tagLabel, WorkTag } from '../fiber/types';

export interface Highlight {
  hoverSlot: number | null;
  activeObjId: number | null;
  deletedIds: Set<number>;
  onHover: (slot: number | null) => void;
}

const statusText = {
  new: 'new object',
  recycled: 'recycled',
  kept: 'not cloned',
} as const;

export function FiberCard({ node, hl, showWork }: { node: FiberSnap; hl: Highlight; showWork: boolean }) {
  const classes = ['fiber', `letter-${node.letter}`];
  if (showWork) classes.push(`status-${node.status}`);
  if (hl.hoverSlot === node.slot) classes.push('twin-hover');
  if (hl.activeObjId === node.objId) classes.push('active');
  if (hl.deletedIds.has(node.objId)) classes.push('deleted');

  const bailedOut = showWork && node.status !== 'kept' && isComponentTag(node.tag) && !node.functionCalled;
  const propEntries = Object.entries(node.props).filter(([k]) => k !== 'children' || node.tag !== WorkTag.HostRoot);

  return (
    <div
      className={classes.join(' ')}
      onMouseEnter={(e) => {
        e.stopPropagation();
        hl.onHover(node.slot);
      }}
      onMouseLeave={(e) => {
        e.stopPropagation();
        hl.onHover(null);
      }}
    >
      <div className="fiber-head">
        <span className="fiber-name">{node.name}</span>
        {node.key !== null && <span className="chip key">key="{node.key}"</span>}
        <span className="obj" title="object identity (A/B = which of the two twins)">
          #{node.objId}
          <b className="letter">{node.letter}</b>
        </span>
        <span className="alt" title="alternate pointer">alt {node.alternateId === null ? 'null' : `#${node.alternateId}`}</span>
      </div>
      <div className="fiber-meta">
        <span className="tag">{tagLabel(node.tag)}</span>
        {showWork && <span className={`chip st-${node.status}`}>{statusText[node.status]}</span>}
        {showWork && node.functionCalled && <span className="chip called">ƒ called</span>}
        {bailedOut && <span className="chip bailout">bailout</span>}
        {showWork && node.flags.filter((f) => f !== 'PerformedWork').map((f) => (
          <span key={f} className={`chip flag flag-${f}`}>{f}</span>
        ))}
        {hl.deletedIds.has(node.objId) && <span className="chip flag flag-ChildDeletion">deleted next</span>}
      </div>
      {(propEntries.length > 0 || node.textContent !== null || node.hooks.length > 0) && (
        <div className="fiber-body">
          {node.textContent !== null && <div>text: <code>{node.textContent}</code></div>}
          {propEntries.length > 0 && (
            <div>props: <code>{propEntries.map(([k, v]) => `${k}=${v}`).join(' ')}</code></div>
          )}
          {node.hooks.length > 0 && <div>hooks: <code>{node.hooks.join(', ')}</code></div>}
          {showWork && node.propsFromElement !== null && node.status !== 'kept' && (
            <div className="muted">props ← element e{node.propsFromElement}</div>
          )}
          {showWork && node.propsSameObject && <div className="muted">same props object as current</div>}
          {showWork && node.changedProps.map((c) => (
            <div key={c.key} className="diff">Δ {c.key}: {c.from} → {c.to}</div>
          ))}
        </div>
      )}
      {node.children.length > 0 && (
        <div className="fiber-children">
          {node.children.map((c) => (
            <FiberCard key={c.objId} node={c} hl={hl} showWork={showWork} />
          ))}
        </div>
      )}
    </div>
  );
}
