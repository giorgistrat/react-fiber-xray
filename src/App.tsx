import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AlternateLinks, buildLinks } from './components/AlternateLinks';
import { TooltipLayer } from './components/TooltipLayer';
import { ElementColumn } from './components/ElementTree';
import { FiberCard, type Highlight } from './components/FiberCard';
import { Inspector } from './components/Inspector';
import { Misconceptions } from './components/Misconceptions';
import { RenderLog } from './components/RenderLog';
import { StepPlayer } from './components/StepPlayer';
import { buildSteps, commitEffects, progressAt } from './fiber/steps';
import { InterviewPage } from './interview/InterviewPage';
import type { Demo } from './interview/questions';
import { scenarios } from './scenarios';
import { getState, startScenario, stopScenario, subscribe } from './store';

const EMPTY = new Set<number>();

type View = 'explorer' | 'interview';
const viewFromHash = (): View => (window.location.hash === '#interview' ? 'interview' : 'explorer');

function waitUntil(check: () => boolean, timeout = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    const start = performance.now();
    const tick = () => {
      if (check()) resolve(true);
      else if (performance.now() - start > timeout) resolve(false);
      else setTimeout(tick, 16);
    };
    tick();
  });
}

export default function App() {
  const [scenarioId, setScenarioId] = useState('basic');
  const [resetCount, setResetCount] = useState(0);
  const [selected, setSelected] = useState<number | null>(null); // null = follow latest
  const [hoverSlot, setHoverSlot] = useState<number | null>(null);
  const [stepState, setStepState] = useState<{ key: string; index: number } | null>(null);
  const [showLinks, setShowLinks] = useState(true);
  const [showPointers, setShowPointers] = useState(false);
  const [inspectMode, setInspectMode] = useState(false);
  const [inspected, setInspected] = useState<Element | null>(null);
  const [view, setView] = useState<View>(viewFromHash);
  // A step to open once a demo's target commit is on screen (see playDemo).
  const [pendingStep, setPendingStep] = useState<{ commit: number; match: string } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const columnsRef = useRef<HTMLDivElement>(null);

  const scenario = scenarios.find((s) => s.id === scenarioId)!;
  const { commits, log, tracker } = useSyncExternalStore(subscribe, getState);

  useEffect(() => {
    // Swap demo roots in a microtask: unmounting a root synchronously while
    // React is still rendering (this effect runs inside a click's sync render) warns.
    const stage = stageRef.current!;
    queueMicrotask(() => startScenario(stage, scenario.Component));
    setSelected(null);
    setInspected(null);
    return () => queueMicrotask(stopScenario);
  }, [scenario, resetCount]);

  const latest = commits.length - 1;
  const index = selected === null ? latest : Math.min(selected, latest);
  const commit = commits[index];
  const prev = index > 0 ? commits[index - 1] : undefined;
  const steps = useMemo(() => (commit && index > 0 ? buildSteps(commit) : []), [commit, index]);
  const links = useMemo(() => (prev && commit ? buildLinks(prev, commit) : []), [prev, commit]);

  // The step player starts on the last step (commit), i.e. the finished tree.
  const stepKey = `${scenarioId}-${resetCount}-${index}`;
  const stepIndex = stepState?.key === stepKey ? stepState.index : steps.length - 1;
  const step = steps[stepIndex];
  const onStepIndex = useCallback((i: number) => setStepState({ key: stepKey, index: i }), [stepKey]);
  const progress = useMemo(() => (steps.length ? progressAt(steps, stepIndex) : undefined), [steps, stepIndex]);
  const activeObjId = step?.objId ?? null;

  // Mark the DOM nodes on the stage that the current step is about.
  useEffect(() => {
    if (!commit || !step) return;
    const marks: [Element, string][] = [];
    if (step.phase === 'commit') {
      for (const effect of commitEffects(commit.tree)) {
        const el = commit.domByObjId.get(effect.objId);
        if (el) marks.push([el, effect.kind]);
      }
    } else if (step.objId !== null) {
      const el = commit.domByObjId.get(step.objId);
      if (el) marks.push([el, 'active']);
    }
    const live = marks.filter(([el]) => el.isConnected);
    live.forEach(([el, kind]) => el.setAttribute('data-xray', kind));
    return () => live.forEach(([el]) => el.removeAttribute('data-xray'));
  }, [commit, step]);

  useEffect(() => {
    const onHash = () => setView(viewFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (!pendingStep || index !== pendingStep.commit || steps.length === 0) return;
    const { match } = pendingStep;
    const found = match === 'first' ? 0 : match === 'commit' ? steps.length - 1 : steps.findIndex((s) => s.title.startsWith(match));
    setStepState({ key: stepKey, index: found >= 0 ? found : steps.length - 1 });
    setPendingStep(null);
  }, [pendingStep, index, steps, stepKey]);

  // Interview "Show me": restart the scenario, replay the clicks on the real
  // demo buttons, then open the resulting render at the requested step.
  const playDemo = useCallback(async (demo: Demo) => {
    window.history.pushState(null, '', window.location.pathname + window.location.search);
    setView('explorer');
    setInspectMode(false);
    setPendingStep(null);
    const run = getState().run;
    setScenarioId(demo.scenario);
    setResetCount((n) => n + 1);
    window.scrollTo({ top: 0 });
    if (!(await waitUntil(() => getState().run > run && getState().commits.length >= 2))) return;
    for (const label of demo.clicks ?? []) {
      const before = getState().commits.length;
      const button = [...(stageRef.current?.querySelectorAll('button') ?? [])].find((b) => b.textContent === label);
      if (!button) break;
      button.click();
      await waitUntil(() => getState().commits.length > before);
    }
    setSelected(null);
    setPendingStep({ commit: getState().commits.length - 1, match: demo.step ?? 'commit' });
  }, []);

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

  const hlPrev: Highlight = { hoverSlot, activeObjId: null, deletedIds: commit?.deletedIds ?? EMPTY, onHover: setHoverSlot, showPointers };
  const hlNext: Highlight = { hoverSlot, activeObjId, deletedIds: EMPTY, onHover: setHoverSlot, showPointers };

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>React reconciliation, live</h1>
          <p className="muted">
            current fiber (old data) + new element (new props) → work-in-progress fiber (new data). Every number below is read from React's real fiber objects.
          </p>
        </div>
        <nav className="views" aria-label="Pages">
          <a href="#" className={view === 'explorer' ? 'on' : ''} aria-current={view === 'explorer' ? 'page' : undefined}>Explorer</a>
          <a href="#interview" className={view === 'interview' ? 'on' : ''} aria-current={view === 'interview' ? 'page' : undefined}>Interview questions</a>
        </nav>
      </header>

      {view === 'interview' && <InterviewPage onDemo={playDemo} />}

      {/* Kept mounted while hidden so the demo root and its history survive tab switches. */}
      <div hidden={view !== 'explorer'}>
        <nav className="tabs scenario-tabs">
          {scenarios.map((s) => (
            <button key={s.id} className={s.id === scenarioId ? 'on' : ''} onClick={() => setScenarioId(s.id)}>
              {s.title}
            </button>
          ))}
        </nav>

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
              <label className="toggle small">
                <input type="checkbox" checked={showLinks} onChange={(e) => setShowLinks(e.target.checked)} /> Alternate links
              </label>
              <label className="toggle small">
                <input type="checkbox" checked={showPointers} onChange={(e) => setShowPointers(e.target.checked)} /> Pointers
              </label>
              <span className="legend">
                <span className="chip letter-chip A" data-term="label:letter">A</span>/<span className="chip letter-chip B" data-term="label:letter">B</span> twin objects ·
                <span className="chip st-new" data-term="status:new" tabIndex={0}>new object</span>
                <span className="chip st-recycled" data-term="status:recycled" tabIndex={0}>recycled</span>
                <span className="chip st-kept" data-term="status:kept" tabIndex={0}>not cloned</span> · hover a fiber to find its twin
              </span>
            </div>

            {commit && (
              <div className="columns" ref={columnsRef}>
                {showLinks && (
                  <AlternateLinks
                    containerRef={columnsRef}
                    links={links}
                    hoverSlot={hoverSlot}
                    layoutKey={`${stepKey}-${stepIndex}-${showPointers}`}
                  />
                )}
                <section className="panel col">
                  <div className="panel-head">
                    <h2 data-term="col:prev">① Current tree before render</h2>
                    <span className="muted small">read, never modified</span>
                  </div>
                  {prev ? <FiberCard node={prev.tree} hl={hlPrev} showWork={false} col="prev" /> : <p className="muted">Nothing before createRoot.</p>}
                </section>
                <section className="panel col">
                  <div className="panel-head">
                    <h2 data-term="col:elements">② New elements</h2>
                    <span className="muted small">read one level at a time</span>
                  </div>
                  <ElementColumn
                    commit={commit}
                    isInitial={index === 0}
                    progress={progress}
                    activeObjId={activeObjId}
                    hoverSlot={hoverSlot}
                    onHover={setHoverSlot}
                    tracker={tracker}
                  />
                </section>
                <section className="panel col">
                  <div className="panel-head">
                    <h2 data-term="col:next">③ Work-in-progress → committed</h2>
                    <span className="muted small">written by the render</span>
                  </div>
                  {progress && (
                    <div className={`wip-banner ${progress.committed ? 'committed' : ''}`}>
                      {progress.committed
                        ? 'Committed: root.current → this tree. It is what is on screen now.'
                        : `Rendering (step ${stepIndex + 1}/${steps.length}): this tree is a work in progress. In React, the screen would still show ①.`}
                    </div>
                  )}
                  <FiberCard node={commit.tree} hl={hlNext} showWork={index > 0} col="next" progress={progress} />
                </section>
              </div>
            )}

            {steps.length > 0 && <StepPlayer key={stepKey} steps={steps} index={stepIndex} onIndex={onStepIndex} />}

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
      <TooltipLayer />
    </div>
  );
}
