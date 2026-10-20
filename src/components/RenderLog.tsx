import { useEffect, useRef } from 'react';
import type { LogEntry } from '../store';

export function RenderLog({ log, selected, onSelect }: { log: LogEntry[]; selected: number; onSelect: (commit: number) => void }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [log.length]);

  return (
    <section className="panel log">
      <div className="panel-head"><h2>Render log</h2></div>
      <div className="log-list">
        {log.map((entry) => (
          <div
            key={entry.id}
            className={`log-entry kind-${entry.kind} ${entry.commit === selected ? 'sel' : ''}`}
            onClick={() => onSelect(entry.commit)}
          >
            <span className="log-commit">R{entry.commit}</span> {entry.text}
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </section>
  );
}
