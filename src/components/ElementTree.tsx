import { useState } from 'react';
import { deletionsByParent, elementFates, renderStats, type DeletedChild, type Fate } from '../fiber/elements';
import type { CommitRecord, FiberTracker } from '../fiber/snapshot';
import type { Progress } from '../fiber/steps';
import type { Fiber } from '../fiber/types';
import { ownerOf, type ElementNode, type RenderCall } from '../trace';

interface Ctx {
  fates: Map<number, Fate>;
  deletions: Map<number, DeletedChild[]>;
  stepping: boolean;
  begun: Set<number>;
  activeObjId: number | null;
  hoverSlot: number | null;
  onHover: (slot: number | null) => void;
  ownerLabel: (owner: object | null) => string | null;
  rootLetter: string;
}

function FateChip({ fate }: { fate: Fate }) {
  const wip = `#${fate.objId}${fate.letter}`;
  switch (fate.kind) {
    case 'mount':
      return <span className="chip fate fate-mount" data-term="el:mount" tabIndex={0}>mount → {wip}</span>;
    case 'create':
      return <span className="chip fate fate-create" data-term="el:create" tabIndex={0}>new → {wip}{fate.placement ? ' + Placement' : ''}</span>;
    case 'bailout':
      return <span className="chip fate fate-bailout" data-term="el:bailout" tabIndex={0}>same object → bailout {wip}</span>;
    default:
      return <span className="chip fate fate-reuse" data-term="el:reuse" tabIndex={0}>reuse #{fate.alternateId} → {wip}</span>;
  }
}

function Deleted({ items }: { items: DeletedChild[] }) {
  return (
    <>
      {items.map((d) => (
        <div key={d.objId} className="el-deleted" data-term="el:deleted">
          ✗ <s>{d.name}{d.key !== null && ` key="${d.key}"`} #{d.objId}</s> no matching element → deleteChild
        </div>
      ))}
    </>
  );
}

function RawTable({ node, ctx }: { node: ElementNode; ctx: Ctx }) {
  return (
    <table className="raw">
      <tbody>
        {node.raw.map((f) => (
          <tr key={f.key} className={f.hidden ? 'raw-hidden' : ''}>
            <th>{f.key}</th>
            <td>
              <code>{f.key === '_owner' ? (ctx.ownerLabel(ownerOf(node.eid)) ?? 'null (created outside any component)') : f.value}</code>
              {f.hidden && <span className="muted"> non-enumerable</span>}
            </td>
          </tr>
        ))}
        <tr>
          <th>Object.isFrozen</th>
          <td><code>{String(node.frozen)}</code></td>
        </tr>
      </tbody>
    </table>
  );
}

function isHostType(type: string) {
  return /^[a-z]/.test(type);
}

function ElementView({ node, ctx }: { node: ElementNode | string; ctx: Ctx }) {
  const [showRaw, setShowRaw] = useState(false);
  if (typeof node === 'string') return <div className="el-text">"{node}"</div>;

  const fate = ctx.fates.get(node.eid);
  const readBy = fate?.parentObjId ?? null;
  const classes = ['el'];
  if (node.reused) classes.push('el-reused');
  if (ctx.stepping && readBy !== null && !ctx.begun.has(readBy)) classes.push('el-unread');
  if (readBy !== null && readBy === ctx.activeObjId) classes.push('el-reading');
  if (fate && ctx.hoverSlot === fate.slot) classes.push('el-hover');

  const attrs = Object.entries(node.props).map(([k, v]) => ` ${k}={${v}}`).join('');
  const textOnly = isHostType(node.type) && node.children.length === 1 && typeof node.children[0] === 'string';
  const deleted = fate ? ctx.deletions.get(fate.objId) : undefined;

  return (
    <div className={classes.join(' ')}>
      <div className="el-line" onMouseEnter={() => fate && ctx.onHover(fate.slot)} onMouseLeave={() => ctx.onHover(null)}>
        <code>
          &lt;{node.type}
          {node.key !== null && ` key="${node.key}"`}
          {attrs}
          {node.children.length === 0 ? ' />' : '>'}
        </code>
        <span className="eid">e{node.eid}</span>
        {fate && <FateChip fate={fate} />}
        {node.reused && !fate && <span className="chip st-kept" data-term="el:bailout">same object as before</span>}
        {node.repeat && <span className="muted small">(same object as above)</span>}
        {node.raw.length > 0 && (
          <button className="raw-toggle" data-term="el:raw" onClick={() => setShowRaw((v) => !v)} aria-expanded={showRaw}>
            {'{ }'}
          </button>
        )}
      </div>
      {showRaw && <RawTable node={node} ctx={ctx} />}
      {textOnly ? (
        <div className="el-text">
          "{node.children[0] as string}" <span className="chip fate fate-text" data-term="el:text" tabIndex={0}>→ textContent, no fiber</span>
        </div>
      ) : (
        node.children.length > 0 && (
          <div className="el-children">
            {node.children.map((c, i) => <ElementView key={i} node={c} ctx={ctx} />)}
          </div>
        )
      )}
      {deleted && <Deleted items={deleted} />}
    </div>
  );
}

function CallBlock({ call, readerId, ctx }: { call: RenderCall; readerId: number | null; ctx: Ctx }) {
  const classes = ['call'];
  if (ctx.stepping && readerId !== null && !ctx.begun.has(readerId)) classes.push('el-unread');
  if (readerId !== null && readerId === ctx.activeObjId) classes.push('call-reading');
  const owner = ctx.ownerLabel(call.owner);
  const deleted = readerId !== null && call.kind === 'component' ? ctx.deletions.get(readerId) : undefined;

  return (
    <div className={classes.join(' ')}>
      <div className="call-head">
        {call.kind === 'root' ? (
          <>
            <b>root.render(…)</b> · read by <span data-term="tag:HostRoot">HostRoot #{readerId}{ctx.rootLetter}</span>
          </>
        ) : (
          <>
            <b>{call.component}()</b> returned
            {Object.keys(call.state).length > 0 && <code className="muted"> {JSON.stringify(call.state)}</code>}
            {owner && <span className="owner" data-term="el:owner"> · owner {owner}</span>}
          </>
        )}
      </div>
      {call.returned !== null && <ElementView node={call.returned} ctx={ctx} />}
      {deleted && <Deleted items={deleted} />}
    </div>
  );
}

interface Props {
  commit: CommitRecord;
  isInitial: boolean;
  progress?: Progress;
  activeObjId: number | null;
  hoverSlot: number | null;
  onHover: (slot: number | null) => void;
  tracker: FiberTracker;
}

export function ElementColumn({ commit, isInitial, progress, activeObjId, hoverSlot, onHover, tracker }: Props) {
  if (isInitial) {
    return <p className="muted">No render yet. <code>createRoot</code> only created the HostRoot fiber.</p>;
  }
  const stats = renderStats(commit.calls);
  const ownerLabel = (owner: object | null) => {
    if (!owner) return null;
    const id = tracker.idOf(owner as Fiber);
    return id === undefined ? 'a fiber' : `#${id}${tracker.letterOf(owner as Fiber) ?? ''}`;
  };
  const ctx: Ctx = {
    fates: elementFates(commit, stats.reusedEids),
    deletions: deletionsByParent(commit),
    stepping: progress !== undefined && !progress.committed,
    begun: progress?.begun ?? new Set(),
    activeObjId,
    hoverSlot,
    onHover,
    ownerLabel,
    rootLetter: commit.tree.letter,
  };
  const readerOf = (call: RenderCall) => {
    if (call.kind === 'root') return commit.tree.objId;
    return call.owner ? (tracker.idOf(call.owner as Fiber) ?? null) : null;
  };

  return (
    <div className="elements">
      <p className="el-stats" data-term="el:stats">
        This render created <b>{stats.created}</b> element object{stats.created === 1 ? '' : 's'}
        {stats.reused > 0 && <> (<b>{stats.reused}</b> reused from an earlier render)</>}. React keeps none of them: after
        commit they survive only as the WIP fibers' <code>memoizedProps</code>.
      </p>
      {commit.calls.length === 0 && <p className="muted">No component function was called in this render.</p>}
      {commit.calls.map((call, i) => (
        <CallBlock key={i} call={call} readerId={readerOf(call)} ctx={ctx} />
      ))}
    </div>
  );
}
