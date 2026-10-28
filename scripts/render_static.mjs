// Generate no-script HTML using the same renderer and content as the browser.
// No dependencies; run with Node 18+ from any directory.
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const content = JSON.parse(await fs.readFile(path.join(root, "content/site.json"), "utf8"));
const renderer = await fs.readFile(path.join(root, "assets/js/render.js"), "utf8");
const pages = ["index.html", "applied-thinking/index.html", ...content.projects.map(p => `projects/${p.slug}/index.html`)];
const escape = value => String(value).replace(/[&<>"']/g, ch => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"})[ch]);
let stale = false;
for (const filename of pages) {
  const file = path.join(root, filename);
  const source = await fs.readFile(file, "utf8");
  const dataset = Object.fromEntries([...source.matchAll(/data-(page|root|project)="([^"]*)"/g)].map(m => [m[1], m[2]]));
  const nodes = Object.fromEntries(["site-header", "draft-banner", "main", "site-footer"].map(id => [id, {innerHTML:"", hidden:false, dataset:{}}]));
  const document = {body:{dataset}, title:"", getElementById:id => nodes[id]};
  const context = vm.createContext({document, location:{protocol:"https:", hash:""}, fetch:async () => ({ok:true, json:async () => content})});
  vm.runInContext(renderer, context, {timeout:5000});
  await new Promise(resolve => setImmediate(resolve));
  if (!nodes.main.innerHTML || nodes.main.innerHTML.includes('notice--error')) throw new Error(`${filename}: rendering failed`);
  let next = source;
  for (const [id, node] of Object.entries(nodes)) {
    const tag = id === "site-header" ? "header" : id === "site-footer" ? "footer" : id === "main" ? "main" : "div";
    // Each region ends at a generated marker, so nested sections remain intact.
    const pattern = new RegExp(`<${tag}([^>]*\\bid="${id}"[^>]*)>[\\s\\S]*?<!-- /${id} -->\\s*</${tag}>`);
    const initial = new RegExp(`<${tag}([^>]*\\bid="${id}"[^>]*)>[\\s\\S]*?</${tag}>`);
    next = next.replace(pattern.test(next) ? pattern : initial, (_, attrs) => {
      attrs = attrs.replace(/\s+hidden\b/g, "").replace(/\s+data-prerendered="true"/g, "");
      if (id === "main") attrs += ' data-prerendered="true"';
      if (id === "draft-banner" && !node.innerHTML) attrs += " hidden";
      return `<${tag}${attrs}>${node.innerHTML}\n<!-- /${id} --></${tag}>`;
    });
  }
  next = next.replace(/<title>[\s\S]*?<\/title>/, `<title>${escape(document.title)}</title>`);
  next = next.replace(/\s*<meta name="robots" content="noindex, nofollow">/g, "");
  if (content.appliedThinking.draftStatus !== "approved" || Object.values(content.appliedThinking.review).some(v => v !== "approved")) {
    next = next.replace('<meta name="viewport"', '<meta name="robots" content="noindex, nofollow">\n  <meta name="viewport"');
  }
  next = next.replace(/[\t ]+\n/g, "\n");
  if (next !== source) {
    if (process.argv.includes("--check")) { console.error(`STALE ${filename}: run node scripts/render_static.mjs`); stale = true; }
    else await fs.writeFile(file, next);
  }
}
if (stale) process.exitCode = 1;
else console.log(`${pages.length} static pages ${process.argv.includes("--check") ? "current" : "generated"}.`);
