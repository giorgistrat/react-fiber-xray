import { useState } from 'react';
import { rendered } from '../trace';

export function KeyTypeCounter() {
  const [count, setCount] = useState(0);
  const [keyVersion, setKeyVersion] = useState(0);
  const [asParagraph, setAsParagraph] = useState(false);
  const Tag = asParagraph ? 'p' : 'span';
  return rendered(
    'KeyTypeCounter',
    { count, keyVersion, tag: Tag },
    <div>
      <Tag key={`v${keyVersion}`}>{count}</Tag>
      <button onClick={() => setCount(count + 1)}>+</button>
      <button onClick={() => { setCount(count + 1); setKeyVersion(keyVersion + 1); }}>+ &amp; new key</button>
      <button onClick={() => setAsParagraph(!asParagraph)}>swap span↔p</button>
    </div>,
  );
}
