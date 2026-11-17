// Every subpath in package.json's `exports` must load in plain Node, not only
// through a bundler: the extension's e2e runner and any script consumer import
// them directly. Run after `pnpm build`.
import { readFile } from 'node:fs/promises';

const { name, exports } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
let failed = 0;
for (const [subpath, target] of Object.entries(exports)) {
  try {
    await import(new URL(`../${target.default}`, import.meta.url).href);
    console.log(`ok   ${name}${subpath.slice(1)}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL ${name}${subpath.slice(1)}: ${err instanceof Error ? err.message : err}`);
  }
}
process.exit(failed ? 1 : 0);
