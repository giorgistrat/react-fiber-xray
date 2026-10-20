const items: { claim: string; truth: string; scenario: string }[] = [
  { claim: 'After the first commit the previous tree is null.', truth: 'It is the full tree you just committed. Look at "Current before render" on Render 2.', scenario: 'basic' },
  { claim: 'React builds the new tree from scratch.', truth: 'From Render 3 on, every fiber object is "recycled". New objects only for a new type, key or child.', scenario: 'keyType' },
  { claim: "The div is the same, so React doesn't touch it.", truth: 'The div gets a new props object each time, so it is visited. A real bailout needs the same props object.', scenario: 'children' },
  { claim: 'React keeps an element tree.', truth: 'Elements exist only as return values; the fibers hold them as props (see "props ← element eN").', scenario: 'basic' },
  { claim: 'The WIP tree is something React reads.', truth: 'It is output. React writes into it from current fiber + new element.', scenario: 'basic' },
];

export function Misconceptions({ onPick }: { onPick: (scenarioId: string) => void }) {
  return (
    <ol className="myths">
      {items.map((item) => (
        <li key={item.claim}>
          <s>{item.claim}</s>
          <div>{item.truth}</div>
          <button className="link" onClick={() => onPick(item.scenario)}>show me →</button>
        </li>
      ))}
    </ol>
  );
}
