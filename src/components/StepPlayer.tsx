import { useEffect, useState } from 'react';
import type { Step } from '../fiber/steps';

export function StepPlayer({ steps, onActive }: { steps: Step[]; onActive: (objId: number | null) => void }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const step = steps[Math.min(index, steps.length - 1)];

  useEffect(() => {
    onActive(step?.objId ?? null);
  }, [step, onActive]);

  useEffect(() => {
    if (!playing) return;
    if (index >= steps.length - 1) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => setIndex((i) => i + 1), 1300);
    return () => clearTimeout(timer);
  }, [playing, index, steps.length]);

  if (!step) return null;
  return (
    <section className="panel steps">
      <div className="panel-head">
        <h2>Step through the render</h2>
        <div className="controls">
          <button onClick={() => setIndex(0)} disabled={index === 0}>⏮</button>
          <button onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}>◀</button>
          <button onClick={() => setPlaying((p) => !p)}>{playing ? 'Pause' : 'Play'}</button>
          <button onClick={() => setIndex((i) => Math.min(steps.length - 1, i + 1))} disabled={index >= steps.length - 1}>▶</button>
          <span className="muted">{index + 1} / {steps.length}</span>
        </div>
      </div>
      <ol className="step-list">
        {steps.map((s, i) => (
          <li key={i} className={`step phase-${s.phase} ${i === index ? 'current' : ''}`} onClick={() => setIndex(i)}>
            <div className="step-title">{s.title}</div>
            {i === index && (
              <ul>
                {s.lines.map((line, j) => <li key={j}>{line}</li>)}
              </ul>
            )}
          </li>
        ))}
      </ol>
      <p className="muted small">Rebuilt from the committed snapshot: a fiber was visited exactly when it was cloned. This is not a live pause inside React's work loop.</p>
    </section>
  );
}
