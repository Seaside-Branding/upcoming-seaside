import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const outputPath = fileURLToPath(new URL('../src/data/source-manifest.json', import.meta.url));
const htmlFiles = (await readdir(repositoryRoot, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
  .map((entry) => entry.name)
  .sort();

function attribute(node, name) {
  return node.attrs?.find((item) => item.name === name)?.value ?? null;
}

function collectText(node) {
  const parts = [];
  function visit(current) {
    if (current.nodeName === '#text') {
      const value = current.value.replace(/\s+/g, ' ').trim();
      if (value) parts.push(value);
      return;
    }
    if (current.tagName === 'script' || current.tagName === 'style') return;
    for (const child of current.childNodes ?? []) visit(child);
  }
  visit(node);
  return parts.join(' ');
}

function walk(node, visit) {
  visit(node);
  for (const child of node.childNodes ?? []) walk(child, visit);
}

function attributes(node, names) {
  return Object.fromEntries(names
    .map((name) => [name, attribute(node, name)])
    .filter(([, value]) => value !== null));
}

function describeForm(form) {
  const fields = [];
  walk(form, (node) => {
    if (!['input', 'textarea', 'select', 'button'].includes(node.tagName)) return;
    fields.push({
      tag: node.tagName,
      name: attribute(node, 'name'),
      type: attribute(node, 'type'),
      id: attribute(node, 'id'),
      required: node.attrs?.some((item) => item.name === 'required') ?? false,
      placeholder: attribute(node, 'placeholder'),
      value: attribute(node, 'value')
    });
  });
  return {
    action: attribute(form, 'action'),
    method: attribute(form, 'method') ?? 'get',
    fields
  };
}

const routes = {};
for (const file of htmlFiles) {
  const source = await readFile(resolve(repositoryRoot, file), 'utf8');
  const document = parse(source);
  const html = document.childNodes.find((node) => node.tagName === 'html');
  const head = html?.childNodes.find((node) => node.tagName === 'head');
  const body = html?.childNodes.find((node) => node.tagName === 'body');
  const nodes = [];
  walk(document, (node) => nodes.push(node));

  const titleNode = nodes.find((node) => node.tagName === 'title');
  const sections = [];
  const anchors = [];
  const headings = [];
  const links = [];
  const forms = [];
  const resources = [];

  for (const node of nodes) {
    if (node.tagName === 'section') {
      const heading = [];
      walk(node, (child) => {
        if (!heading.length && /^h[1-6]$/.test(child.tagName ?? '')) heading.push(child);
      });
      sections.push({
        id: attribute(node, 'id'),
        className: attribute(node, 'class'),
        heading: heading[0] ? collectText(heading[0]) : null
      });
    }
    if (/^h[1-6]$/.test(node.tagName ?? '')) {
      headings.push({ level: Number(node.tagName.slice(1)), id: attribute(node, 'id'), text: collectText(node) });
    }
    const id = attribute(node, 'id');
    const name = attribute(node, 'name');
    if (id || (node.tagName === 'a' && name)) anchors.push({ tag: node.tagName, id, name });
    if (node.tagName === 'a' && attribute(node, 'href')) {
      links.push({ href: attribute(node, 'href'), text: collectText(node), target: attribute(node, 'target'), rel: attribute(node, 'rel') });
    }
    if (node.tagName === 'form') forms.push(describeForm(node));
    if (['img', 'iframe', 'script', 'link', 'video', 'audio', 'source', 'track', 'object', 'embed'].includes(node.tagName)) {
      resources.push({ tag: node.tagName, ...attributes(node, ['src', 'href', 'poster', 'rel', 'type', 'alt', 'loading', 'media', 'integrity', 'crossorigin']) });
    }
  }

  const metadata = [];
  walk(head ?? document, (node) => {
    if (node.tagName === 'meta') metadata.push(attributes(node, ['name', 'property', 'http-equiv', 'content', 'charset']));
    if (node.tagName === 'link' && ['canonical', 'alternate', 'icon', 'shortcut icon'].includes(attribute(node, 'rel'))) {
      metadata.push({ tag: 'link', ...attributes(node, ['rel', 'href', 'hreflang', 'type']) });
    }
  });

  routes[file] = {
    sha256: createHash('sha256').update(source).digest('hex'),
    language: attribute(html, 'lang'),
    title: titleNode ? collectText(titleNode) : null,
    metadata,
    headings,
    sections,
    anchors,
    links,
    forms,
    resources,
    bodyText: body ? collectText(body) : ''
  };
}

await mkdir(resolve(outputPath, '..'), { recursive: true });
await writeFile(outputPath, `${JSON.stringify({ routeCount: htmlFiles.length, routes }, null, 2)}\n`, 'utf8');
console.log(`Wrote source manifest for ${htmlFiles.length} routes to ${outputPath}`);
