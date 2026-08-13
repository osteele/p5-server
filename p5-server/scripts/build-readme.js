import { readFile, writeFile } from 'node:fs/promises';

const source = await readFile('../README.md', 'utf8');
const readme = source
  .replace(
    /\]\(docs\/(explore\.gif)\)/g,
    '](https://images.osteele.com/p5-server/$1)'
  )
  .replace(/\]\((docs\/[^)]+)\)/g, '](https://osteele.github.io/p5-server/$1)')
  .replace(
    /\]\((https:\/\/osteele\.github\.io\/p5-server\/docs\/[^)]+)\.md\)/g,
    ']($1)'
  );

await writeFile('README.md', readme);
