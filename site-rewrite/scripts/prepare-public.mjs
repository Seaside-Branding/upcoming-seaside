import { cp, copyFile, mkdir, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const publicRoot = fileURLToPath(new URL('../public/', import.meta.url));

await mkdir(publicRoot, { recursive: true });

for (const [source, target] of [
  [resolve(repoRoot, 'assets'), resolve(publicRoot, 'assets')],
  [resolve(repoRoot, 'fonts'), resolve(publicRoot, 'fonts')],
  [fileURLToPath(new URL('../vendor/', import.meta.url)), resolve(publicRoot, 'vendor')],
  [fileURLToPath(new URL('../drafts/', import.meta.url)), resolve(publicRoot, 'drafts')]
]) {
  await cp(source, target, {
    recursive: true,
    force: true
  });
}

for (const entry of await readdir(repoRoot, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith('.html') && entry.name !== 'index.html') {
    await copyFile(resolve(repoRoot, entry.name), resolve(publicRoot, entry.name));
  }
}

for (const file of ['robots.txt', 'sitemap.xml']) {
  await copyFile(resolve(repoRoot, file), resolve(publicRoot, file));
}
