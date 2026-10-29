// Regression checks for JSON-driven rendering and progressive enhancement.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = await fs.readFile(path.join(root, "assets/js/render.js"), "utf8");
const content = JSON.parse(await fs.readFile(path.join(root, "content/site.json"), "utf8"));
async function render(page, input = content, failFetch = false) {
  const nodes = Object.fromEntries(["main", "site-header", "draft-banner", "site-footer"].map(id => [id, {innerHTML:id === "main" ? "STATIC FALLBACK" : "", dataset:{prerendered:"true"}}]));
  const document = {body:{dataset:{page, root:page === "home" ? "." : page === "project" ? "../.." : "..", project:content.projects[0].slug}}, getElementById:id => nodes[id]};
  const context = vm.createContext({document, location:{protocol:"https:", hash:""}, fetch:async () => {if (failFetch) throw Error("offline");return {ok:true,json:async () => input};}});
  vm.runInContext(source, context, {timeout:5000});
  await new Promise(resolve => setImmediate(resolve));
  return nodes;
}
const home = (await render("home")).main.innerHTML;
assert.ok(home.indexOf('id="experience"') < home.indexOf('id="applied-thinking"'));
assert.ok(home.indexOf('id="applied-thinking"') < home.indexOf('id="projects"'));
assert.match((await render("project")).main.innerHTML, /id="academic-connections"/);
assert.match((await render("applied-thinking")).main.innerHTML, /id="opacity-management"/);
// Figures: narrow and dark variants on project pages, card layout on the homepage.
const projectHtml = (await render("project")).main.innerHTML;
assert.match(projectHtml, /<source media="\(prefers-color-scheme: dark\) and \(max-width: 39\.99rem\)" srcset="[^"]+-narrow-dark\.svg"/);
assert.match(projectHtml, /<source media="\(max-width: 39\.99rem\)" srcset="[^"]+-narrow\.svg"/);
assert.match(projectHtml, /<p class="figure-title">/);
assert.match(home, /<div class="card__visual"><picture><source media="\(prefers-color-scheme: dark\)" srcset="[^"]+-card-dark\.svg"/);
// Phase 1 redesign: positioning hero and decision-led story template.
assert.match(home, /<section class="hero hero--story wrap"/);
assert.match(home, /<source media="\(prefers-color-scheme: dark\) and \(max-width: 49\.99rem\)" srcset="[^"]+ba-data-narrow-dark\.svg"/);
assert.ok(!/class="ph/.test(home.slice(0, home.indexOf("</section>"))), "hero must not show placeholders");
for (const id of ["situation", "decisions", "result", "next", "technical", "role", "academic-connections"]) {
  assert.match(projectHtml, new RegExp(`<section id="${id}"`));
}
assert.ok(!projectHtml.includes('class="toc"') && !projectHtml.includes("Independence statement"));
assert.match(projectHtml, /class="decision decision--visual"[\s\S]*tile-ambiguity/);
const hostile = structuredClone(content);
hostile.site.hero.visual.src = 'javascript:alert(1)';
hostile.site.hero.visual.link.href = 'javascript:alert(1)';
hostile.site.hero.primaryCta.href = 'javascript:alert(1)';
hostile.site.hero.visual.narrowMax = '1px), (min-width: 0';
hostile.projects[0].story.banner.src = 'javascript:alert(1)';
hostile.projects[0].story.headline = '<img src=x onerror="alert(1)">';
const hostileHome = (await render("home", hostile)).main.innerHTML;
const hostileStory = (await render("project", hostile)).main.innerHTML;
assert.ok(!hostileHome.includes("javascript:") && !hostileHome.includes("1px), (min-width: 0"));
assert.ok(!hostileStory.includes("javascript:") && hostileStory.includes("&lt;img src=x"));
hostile.projects[0].visuals[0].src = 'javascript:alert(1)';
hostile.appliedThinking.hero.title = '<img src=x onerror="alert(1)">';
hostile.appliedThinking.diagrams[0].src = 'javascript:alert(1)';
hostile.appliedThinking.homePreview.ctaPath = 'javascript:alert(1)';
hostile.appliedThinking.principles[0].method = '<script>alert(1)</script>';
const result = (await render("applied-thinking", hostile)).main.innerHTML;
assert.ok(result.includes('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'));
assert.ok(!result.includes('<script>') && !result.includes('src="javascript:') && !result.includes('srcset="javascript:'));
assert.ok(!(await render("project", hostile)).main.innerHTML.includes('javascript:'));
assert.ok(!(await render("home", hostile)).main.innerHTML.includes('href="javascript:'));
assert.equal((await render("applied-thinking", content, true)).main.innerHTML, "STATIC FALLBACK");
console.log("PASS: three routes, homepage order, hero and story templates, escaped copy, rejected active URL schemes and offline fallback.");
