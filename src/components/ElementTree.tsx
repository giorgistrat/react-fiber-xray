import type { ElementNode, RenderCall } from '../trace';

function ElementView({ node }: { node: ElementNode | string }) {
  if (typeof node === 'string') return <div className="el-text">"{node}"</div>;
  const attrs = Object.entries(node.props).map(([k, v]) => ` ${k}={${v}}`).join('');
  return (
    <div className={`el ${node.reused ? 'el-reused' : ''}`}>
      <div className="el-line">
        <code>
          &lt;{node.type}
          {node.key !== null && ` key="${node.key}"`}
          {attrs}
          {node.children.length === 0 ? ' />' : '>'}
        </code>
        <span className="eid">e{node.eid}{node.reused ? ' (same object as before)' : ''}</span>
      </div>
      {node.children.length > 0 && (
        <div className="el-children">
          {node.children.map((c, i) => <ElementView key={i} node={c} />)}
        </div>
      )}
    </div>
  );
}

export function ElementColumn({ calls, isInitial }: { calls: RenderCall[]; isInitial: boolean }) {
  if (isInitial) {
    return <p className="muted">No render yet. <code>createRoot</code> only created the HostRoot fiber.</p>;
  }
  return (
    <div className="elements">
      <p className="muted small">
        Plain objects returned by each component call, read one level at a time and then referenced as the WIP fibers' new props.
      </p>
      {calls.length === 0 && <p className="muted">No component function was called in this render.</p>}
      {calls.map((call, i) => (
        <div key={i} className="call">
          <div className="call-head">
            <b>{call.component}()</b> returned
            {Object.keys(call.state).length > 0 && <code className="muted"> {JSON.stringify(call.state)}</code>}
          </div>
          {call.returned !== null && <ElementView node={call.returned} />}
        </div>
      ))}
    </div>
  );
}
