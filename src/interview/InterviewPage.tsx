import { useState } from 'react';
import { displayName, REACT_VERSION_TAG, sourceUrl } from '../fiber/reactSource';
import { LEVELS, questions, type Demo, type Level, type Question } from './questions';

type Mark = 'got' | 'review';
const STORAGE_KEY = 'fiber-xray:interview';

// Progress is a per-viewer convenience; the page works without storage.
function loadMarks(): Record<string, Mark> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function saveMarks(marks: Record<string, Mark>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(marks));
  } catch {
    // private mode / blocked storage: keep progress for this session only
  }
}

type StatusFilter = 'all' | 'todo' | 'review' | 'got';

// `code` spans in the question data → <code>.
function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split('`').map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part))}
    </>
  );
}

function QuestionCard({
  q,
  number,
  revealed,
  onReveal,
  mark,
  onMark,
  onDemo,
}: {
  q: Question;
  number: number;
  revealed: boolean;
  onReveal: () => void;
  mark: Mark | undefined;
  onMark: (mark: Mark | undefined) => void;
  onDemo: (demo: Demo) => void;
}) {
  const [deeper, setDeeper] = useState(false);
  return (
    <article className={`qa ${mark ? `qa-${mark}` : ''}`}>
      <header className="qa-head">
        <span className="qa-num">{number}</span>
        <h3><Inline text={q.question} /></h3>
        <span className="chip qa-level">{q.level}</span>
      </header>

      {!revealed ? (
        <div className="qa-hidden">
          <p className="muted small">Answer out loud first, in 2–3 sentences. Then compare.</p>
          <button className="primary" onClick={onReveal}>Reveal answer</button>
        </div>
      ) : (
        <div className="qa-body">
          <p className="qa-answer"><Inline text={q.answer} /></p>
          {q.mistake && (
            <p className="qa-mistake">
              <b>Common mistake:</b> <Inline text={q.mistake} />
            </p>
          )}
          {(q.deeper || q.fns?.length) && (
            <div className="qa-deeper">
              <button className="link" onClick={() => setDeeper((d) => !d)} aria-expanded={deeper}>
                {deeper ? '▾' : '▸'} Go deeper (if they ask a follow-up)
              </button>
              {deeper && (
                <div className="qa-deeper-body">
                  {q.deeper && <p><Inline text={q.deeper} /></p>}
                  {q.fns && (
                    <p className="qa-fns">
                      Source ({REACT_VERSION_TAG}):{' '}
                      {q.fns.map((fn, i) => (
                        <span key={fn}>
                          {i > 0 && ', '}
                          <a href={sourceUrl(fn) ?? undefined} target="_blank" rel="noreferrer" data-term={`fn:${fn}`}>
                            {displayName(fn)}
                          </a>
                        </span>
                      ))}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
          <div className="qa-actions">
            {q.demo && (
              <button onClick={() => onDemo(q.demo!)}>▶ Show me: {q.demo.label}</button>
            )}
            <span className="qa-mark">
              <button className={mark === 'got' ? 'on-got' : ''} onClick={() => onMark(mark === 'got' ? undefined : 'got')}>
                ✓ Got it
              </button>
              <button className={mark === 'review' ? 'on-review' : ''} onClick={() => onMark(mark === 'review' ? undefined : 'review')}>
                ↻ Review again
              </button>
            </span>
          </div>
        </div>
      )}
    </article>
  );
}

export function InterviewPage({ onDemo }: { onDemo: (demo: Demo) => void }) {
  const [marks, setMarks] = useState<Record<string, Mark>>(loadMarks);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [level, setLevel] = useState<Level | 'all'>('all');
  const [status, setStatus] = useState<StatusFilter>('all');

  const setMark = (id: string, mark: Mark | undefined) => {
    setMarks((prev) => {
      const next = { ...prev };
      if (mark) next[id] = mark;
      else delete next[id];
      saveMarks(next);
      return next;
    });
  };

  const visible = questions.filter((q) => {
    if (level !== 'all' && q.level !== level) return false;
    if (status === 'todo') return !marks[q.id];
    if (status === 'review' || status === 'got') return marks[q.id] === status;
    return true;
  });
  const got = questions.filter((q) => marks[q.id] === 'got').length;
  const review = questions.filter((q) => marks[q.id] === 'review').length;
  const allRevealed = visible.every((q) => revealed.has(q.id));

  return (
    <div className="interview">
      <section className="panel interview-intro">
        <div className="panel-head">
          <h2>Interview practice: reconciliation</h2>
          <span className="muted small">
            {got} / {questions.length} got it · {review} to review
          </span>
        </div>
        <div className="progress-bar" aria-hidden="true">
          <span className="pb-got" style={{ width: `${(got / questions.length) * 100}%` }} />
          <span className="pb-review" style={{ width: `${(review / questions.length) * 100}%` }} />
        </div>
        <p className="small">
          Keep answers short: 2–3 sentences, the mechanism first. Use "go deeper" only for follow-ups. "Show me" opens the
          explorer on the exact render and step that demonstrates the answer. Answers describe React {REACT_VERSION_TAG.slice(1)}.
        </p>
        <div className="interview-filters">
          <div className="seg" role="group" aria-label="Level">
            {(['all', ...LEVELS] as const).map((l) => (
              <button key={l} className={level === l ? 'on' : ''} onClick={() => setLevel(l)}>
                {l === 'all' ? 'All levels' : l}
              </button>
            ))}
          </div>
          <div className="seg" role="group" aria-label="Status">
            {(
              [
                ['all', 'All'],
                ['todo', 'Not marked'],
                ['review', 'Review again'],
                ['got', 'Got it'],
              ] as const
            ).map(([value, label]) => (
              <button key={value} className={status === value ? 'on' : ''} onClick={() => setStatus(value)}>
                {label}
              </button>
            ))}
          </div>
          <button
            className="link"
            onClick={() => setRevealed(allRevealed ? new Set() : new Set(questions.map((q) => q.id)))}
          >
            {allRevealed ? 'Hide all answers' : 'Reveal all answers'}
          </button>
        </div>
      </section>

      {visible.length === 0 && <p className="muted">No questions match these filters.</p>}
      {visible.map((q) => (
        <QuestionCard
          key={q.id}
          q={q}
          number={questions.indexOf(q) + 1}
          revealed={revealed.has(q.id)}
          onReveal={() => setRevealed((prev) => new Set(prev).add(q.id))}
          mark={marks[q.id]}
          onMark={(m) => setMark(q.id, m)}
          onDemo={onDemo}
        />
      ))}
    </div>
  );
}
