import type { FiberSnap } from '../fiber/snapshot';
import type { Progress } from '../fiber/steps';
import { isComponentTag, tagLabel, WorkTag } from '../fiber/types';

export interface Highlight {
  hoverSlot: number | null;
  activeObjId: number | null;
  deletedIds: Set<number>;
  onHover: (slot: number | null) => void;
  showPointers: boolean;
}

const statusText = {
  new: 'new object',
  recycled: 'recycled',
  kept: 'not cloned',
} as const;

interface Props {
  node: FiberSnap;
  hl: Highlight;
  showWork: boolean;
  col: 'prev' | 'next';
  // Only for the WIP column while stepping: how far the render has got.
  progress?: Progress;
  parentReached?: boolean;
  parentId?: number | null;
  siblingId?: number | null;
}

export function FiberCard({ node, hl, showWork, col, progress, parentReached = true, parentId = null, siblingId = null }: Props) {
  const stepping = progress !== undefined && !progress.committed;
  // A not-cloned fiber is never visited; it is shared with current as soon as its parent is.
  const reached = !stepping || (node.status === 'kept' ? parentReached : progress.begun.has(node.objId));
  const completed = !stepping || node.status === 'kept' || progress.completed.has(node.objId);

  const classes = ['fiber', `letter-${node.letter}`];
  if (showWork) classes.push(`status-${node.status}`);
  if (!reached) classes.push('ghost');
  else if (!completed) classes.push('working');
  if (hl.hoverSlot === node.slot) classes.push('twin-hover');
  if (hl.activeObjId === node.objId) classes.push('active');
  if (hl.deletedIds.has(node.objId)) classes.push('deleted');

  const bailedOut = showWork && node.status !== 'kept' && isComponentTag(node.tag) && !node.functionCalled;
  const propEntries = Object.entries(node.props).filter(([k]) => k !== 'children' || node.tag !== WorkTag.HostRoot);
  // Placement / ChildDeletion are set while reconciling (begin); Update is set in completeWork.
  const flags = node.flags.filter((f) => f !== 'PerformedWork' && (f !== 'Update' || completed));

  const children = node.children.length > 0 && (
    <div className="fiber-children">
      {node.children.map((c, i) => (
        <FiberCard
          key={c.objId}
          node={c}
          hl={hl}
          showWork={showWork}
          col={col}
          progress={progress}
          parentReached={reached}
          parentId={node.objId}
          siblingId={node.children[i + 1]?.objId ?? null}
        />
      ))}
    </div>
  );

  const hover = {
    onMouseEnter: (e: React.MouseEvent) => {
      e.stopPropagation();
      hl.onHover(node.slot);
    },
    onMouseLeave: (e: React.MouseEvent) => {
      e.stopPropagation();
      hl.onHover(null);
    },
  };

  if (!reached) {
    return (
      <div className={classes.join(' ')} data-col={col} data-obj={node.objId} {...hover}>
        <div className="fiber-head">
          <span className="fiber-name">{node.name}</span>
          <span className="obj">#{node.objId}<b className="letter">{node.letter}</b></span>
          <span className="alt">not reached yet</span>
        </div>
        {children}
      </div>
    );
  }

  const ptr = (id: number | null) => (id === null ? 'null' : `#${id}`);

  return (
    <div className={classes.join(' ')} data-col={col} data-obj={node.objId} {...hover}>
      <div className="fiber-head">
        <span className="fiber-name">{node.name}</span>
        {node.key !== null && <span className="chip key">key="{node.key}"</span>}
        <span className="obj" title="object identity (A/B = which of the two twins)">
          #{node.objId}
          <b className="letter">{node.letter}</b>
        </span>
        <span className="alt" title="alternate pointer">alt {ptr(node.alternateId)}</span>
      </div>
      <div className="fiber-meta">
        <span className="tag">{tagLabel(node.tag)}</span>
        {!completed && <span className="chip working-chip">beginWork done, waiting for completeWork</span>}
        {showWork && <span className={`chip st-${node.status}`}>{statusText[node.status]}</span>}
        {showWork && node.functionCalled && <span className="chip called">ƒ called</span>}
        {bailedOut && <span className="chip bailout">bailout</span>}
        {showWork && flags.map((f) => (
          <span key={f} className={`chip flag flag-${f}`}>{f}</span>
        ))}
        {hl.deletedIds.has(node.objId) && <span className="chip flag flag-ChildDeletion">deleted next</span>}
      </div>
      {hl.showPointers && (
        <div className="pointers">
          child → {ptr(node.children[0]?.objId ?? null)} · sibling → {ptr(siblingId)} · return → {ptr(parentId)}
        </div>
      )}
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
      {children}
    </div>
  );
}
