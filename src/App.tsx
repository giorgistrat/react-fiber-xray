import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ElementColumn } from './components/ElementTree';
import { FiberCard, type Highlight } from './components/FiberCard';
import { Inspector } from './components/Inspector';
import { Misconceptions } from './components/Misconceptions';
import { RenderLog } from './components/RenderLog';
import { StepPlayer } from './components/StepPlayer';
import { buildSteps } from './fiber/steps';
import { scenarios } from './scenarios';
import { getState, startScenario, stopScenario, subscribe } from './store';

const EMPTY = new Set<number>();

export default function App() {
  const [scenarioId, setScenarioId] = useState('basic');
  const [resetCount, setResetCount] = useState(0);
  const [selected, setSelected] = useState<number | null>(null); // null = follow latest
  const [hoverSlot, setHoverSlot] = useState<number | null>(null);
  const [activeObjId, setActiveObjId] = useState<number | null>(null);
  const [inspectMode, setInspectMode] = useState(false);
  const [inspected, setInspected] = useState<Element | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const scenario = scenarios.find((s) => s.id === scenarioId)!;
  const { commits, log, tracker } = useSyncExternalStore(subscribe, getState);

  useEffect(() => {
    startScenario(stageRef.current!, scenario.Component);
    setSelected(null);
    setInspected(null);
    return () => stopScenario();
  }, [scenario, resetCount]);

  const latest = commits.length - 1;
  const index = selected === null ? latest : Math.min(selected, latest);
  const commit = commits[index];
  const prev = index > 0 ? commits[index - 1] : undefined;
  const steps = useMemo(() => (commit && index > 0 ? buildSteps(commit) : []), [commit, index]);
  const onActive = useCallback((id: number | null) => setActiveObjId(id), []);

  const select = (i: number) => setSelected(i >= latest ? null : Math.max(0, i));

  const clickPlus = () => {
    stageRef.current?.querySelector('button')?.click();
  };

  const onStageClickCapture = (e: React.MouseEvent) => {
    if (!inspectMode) return;
    e.preventDefault();
    e.stopPropagation(); // keep the click away from the demo root
    setInspected(e.target as Element);
  };

  const hlPrev: Highlight = { hoverSlot, activeObjId: null, deletedIds: commit?.deletedIds ?? EMPTY, onHover: setHoverSlot };
  const hlNext: Highlight = { hoverSlot, activeObjId, deletedIds: EMPTY, onHover: setHoverSlot };

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>React reconciliation, live</h1>
          <p className="muted">
            current fiber (old data) + new element (new props) → work-in-progress fiber (new data). Every number below is read from React's real fiber objects.
          </p>
        </div>
        <nav className="tabs">
          {scenarios.map((s) => (
            <button key={s.id} className={s.id === scenarioId ? 'on' : ''} onClick={() => setScenarioId(s.id)}>
              {s.title}
            </button>
          ))}
        </nav>
      </header>

      <div className="layout">
        <aside className="side">
          <section className="panel">
            <div className="panel-head">
              <h2>Demo stage</h2>
              <span className="muted small">its own createRoot</span>
            </div>
            <div
              ref={stageRef}
              className={`stage ${inspectMode ? 'inspecting' : ''}`}
              onClickCapture={onStageClickCapture}
            />
            <div className="controls">
              <button className="primary" onClick={clickPlus} disabled={inspectMode}>Click +</button>
              <button onClick={() => setResetCount((n) => n + 1)}>Reset</button>
              <label className="toggle">
                <input type="checkbox" checked={inspectMode} onChange={(e) => setInspectMode(e.target.checked)} /> Inspect
              </label>
            </div>
            <p className="small">{scenario.description}</p>
            <pre className="code">{scenario.code}</pre>
            <ul className="lesson">
              {scenario.lesson.map((l) => <li key={l}>{l}</li>)}
            </ul>
          </section>

          <section className="panel">
            <div className="panel-head"><h2>Fiber inspector</h2></div>
            <Inspector element={inspected} tracker={tracker} commitIndex={latest} />
          </section>

          <RenderLog log={log} selected={index} onSelect={select} />
        </aside>

        <main className="main">
          <div className="history">
            <button onClick={() => select(index - 1)} disabled={index <= 0}>◀</button>
            <strong>{commit?.label ?? '…'}</strong>
            <button onClick={() => select(index + 1)} disabled={index >= latest}>▶</button>
            {selected !== null && <button className="link" onClick={() => setSelected(null)}>jump to latest</button>}
            <span className="legend">
              <span className="chip letter-chip A">A</span>/<span className="chip letter-chip B">B</span> twin objects ·
              <span className="chip st-new">new object</span>
              <span className="chip st-recycled">recycled</span>
              <span className="chip st-kept">not cloned</span> · hover a fiber to find its twin
            </span>
          </div>

          {commit && (
            <div className="columns">
              <section className="panel col">
                <div className="panel-head">
                  <h2>① Current tree before render</h2>
                  <span className="muted small">read, never modified</span>
                </div>
                {prev ? <FiberCard node={prev.tree} hl={hlPrev} showWork={false} /> : <p className="muted">Nothing before createRoot.</p>}
              </section>
              <section className="panel col">
                <div className="panel-head">
                  <h2>② New elements</h2>
                  <span className="muted small">read one level at a time</span>
                </div>
                <ElementColumn calls={commit.calls} isInitial={index === 0} />
              </section>
              <section className="panel col">
                <div className="panel-head">
                  <h2>③ Work-in-progress → committed</h2>
                  <span className="muted small">written, now root.current</span>
                </div>
                <FiberCard node={commit.tree} hl={hlNext} showWork={index > 0} />
              </section>
            </div>
          )}

          {steps.length > 0 && <StepPlayer key={`${scenarioId}-${resetCount}-${index}`} steps={steps} onActive={onActive} />}

          <section className="panel">
            <div className="panel-head"><h2>Common misconceptions</h2></div>
            <Misconceptions onPick={setScenarioId} />
          </section>

          <footer className="muted small">
            Reads undocumented React internals (react-dom 19.3, dev build) through <code>__REACT_DEVTOOLS_GLOBAL_HOOK__</code>. Snapshots are taken right after each commit.
          </footer>
        </main>
      </div>
    </div>
  );
}
