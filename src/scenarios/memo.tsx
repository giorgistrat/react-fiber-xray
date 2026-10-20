import { memo, useState } from 'react';
import { rendered } from '../trace';

const StaticLabel = memo(function StaticLabel() {
  return rendered('StaticLabel', {}, <em>memoized label</em>);
});

function Plain() {
  return rendered('Plain', {}, <small>plain child</small>);
}

export function MemoCounter() {
  const [count, setCount] = useState(0);
  return rendered(
    'MemoCounter',
    { count },
    <div>
      <span>{count}</span>
      <button onClick={() => setCount(count + 1)}>+</button>
      <StaticLabel />
      <Plain />
    </div>,
  );
}
