import { useState } from 'react';
import { rendered } from '../trace';

// Exactly the Counter from the doc.
export function Counter() {
  const [count, setCount] = useState(0);
  return rendered(
    'Counter',
    { count },
    <div>
      <span>{count}</span>
      <button onClick={() => setCount(count + 1)}>+</button>
    </div>,
  );
}
