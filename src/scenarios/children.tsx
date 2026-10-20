import { useState, type ReactNode } from 'react';
import { rendered } from '../trace';

function Expensive() {
  return rendered('Expensive', {}, <i>expensive child</i>);
}

function Layout({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);
  return rendered(
    'Layout',
    { count },
    <div>
      <span>{count}</span>
      <button onClick={() => setCount(count + 1)}>+</button>
      {children}
    </div>,
  );
}

export function ChildrenDemo() {
  return rendered(
    'ChildrenDemo',
    {},
    <Layout>
      <Expensive />
    </Layout>,
  );
}
