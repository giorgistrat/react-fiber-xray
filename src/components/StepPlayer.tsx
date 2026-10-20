import { useEffect, useState } from 'react';
import type { Call } from '../fiber/calls';
import { displayName, REACT_VERSION_TAG, sourceUrl } from '../fiber/reactSource';
import type { Step } from '../fiber/steps';

function CallTree({ calls }: { calls: Call[] }) {
  return (
    <div className="internals">
      <div className="internals-head">React internals</div>
      <ol className="call-tree">
        {calls.map((call, i) => {
          const url = call.kind ? null : sourceUrl(call.fn);
          return (
            <li key={i} style={{ paddingLeft: call.depth * 14 }} className={call.kind ? `call-${call.kind}` : ''}>
              {url ? (
                <a href={url} target="_blank" rel="noreferrer" data-term={`fn:${call.fn}`}>{displayName(call.fn)}</a>
              ) : (
                <span>{call.fn}</span>
              )}
              {call.note && <span className="call-note"> {call.note}</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// Controlled by App: the step index also drives the progressive WIP column
// and the DOM highlights on the stage.
export function StepPlayer({ steps, index, onIndex }: { steps: Step[]; index: number; onIndex: (index: number) => void }) {
  const [playing, setPlaying] = useState(false);
  const last = steps.length - 1;

  useEffect(() => {
    if (!playing) return;
    if (index >= last) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => onIndex(index + 1), 1300);
    return () => clearTimeout(timer);
  }, [playing, index, last, onIndex]);

  const play = () => {
    // Playing from the finished state restarts the walk from the first step.
    if (!playing && index >= last) onIndex(0);
    setPlaying((p) => !p);
  };

  return (
    <section className="panel steps">
      <div className="panel-head">
        <h2>Step through the render</h2>
        <div className="controls">
          <button onClick={() => onIndex(0)} disabled={index === 0} title="First step">⏮</button>
          <button onClick={() => onIndex(Math.max(0, index - 1))} disabled={index === 0} title="Previous step">◀</button>
          <button onClick={play}>{playing ? 'Pause' : 'Play'}</button>
          <button onClick={() => onIndex(Math.min(last, index + 1))} disabled={index >= last} title="Next step">▶</button>
          <button onClick={() => onIndex(last)} disabled={index >= last} title="Jump to commit">⏭</button>
          <span className="muted">{index + 1} / {steps.length}</span>
        </div>
      </div>
      <ol className="step-list">
        {steps.map((s, i) => (
          <li key={i} className={`step phase-${s.phase} ${i === index ? 'current' : ''} ${i > index ? 'future' : ''}`} onClick={() => onIndex(i)}>
            <div className="step-title">
              {s.title}
              {s.keyFn && <span className="step-fn"> · {displayName(s.keyFn)}</span>}
            </div>
            {i === index && (
              <>
                <ul>
                  {s.lines.map((line, j) => <li key={j}>{line}</li>)}
                </ul>
                <CallTree calls={s.calls} />
              </>
            )}
          </li>
        ))}
      </ol>
      <p className="muted small">
        Press ⏮ or Play to watch column ③ being written. Rebuilt from the committed snapshot: a fiber was visited exactly
        when it was cloned. This is not a live pause inside React's work loop. Function names are from React's source at{' '}
        {REACT_VERSION_TAG} and link to it; some of them are inlined in the shipped react-dom bundle.
      </p>
    </section>
  );
}
