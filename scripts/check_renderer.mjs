// Regression checks for JSON-driven rendering and progressive enhancement.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = await fs.readFile(path.join(root, "assets/js/render.js"), "utf8");
const content = JSON.parse(await fs.readFile(path.join(root, "content/site.json"), "utf8"));
async function render(page, input = content, failFetch = false, slug = content.projects[0].slug) {
  const nodes = Object.fromEntries(["main", "site-header", "draft-banner", "site-footer"].map(id => [id, {innerHTML:id === "main" ? "STATIC FALLBACK" : "", dataset:{prerendered:"true"}}]));
  const document = {body:{dataset:{page, root:page === "home" ? "." : page === "project" ? "../.." : "..", project:slug}}, getElementById:id => nodes[id]};
  const context = vm.createContext({document, location:{protocol:"https:", hash:""}, fetch:async () => {if (failFetch) throw Error("offline");return {ok:true,json:async () => input};}});
  vm.runInContext(source, context, {timeout:5000});
  await new Promise(resolve => setImmediate(resolve));
  return nodes;
}
const home = (await render("home")).main.innerHTML;
// Homepage order: hero, How I work, selected work, experience, about, contact.
const order = ['class="hero hero--story', 'id="how-i-work"', 'id="projects"', 'id="experience"', 'id="about"', 'id="contact"'].map(m => home.indexOf(m));
assert.ok(order.every((v, i) => v >= 0 && (i === 0 || v > order[i - 1])), `homepage sections out of order: ${order}`);
// Each tile links to its project page with real HTML; cards carry one outcome line and no legacy fields.
assert.equal((home.match(/class="how-tile"/g) || []).length, content.site.howIWork.tiles.length);
for (const t of content.site.howIWork.tiles) assert.ok(home.includes(`href="./projects/${t.project}/">${t.linkLabel}`));
assert.equal((home.match(/class="card__outcome"/g) || []).length, content.projects.length);
assert.ok(!/Recorded result|Related professional work|Real work\. Independent public models/.test(home));
assert.match((await render("project")).main.innerHTML, /id="academic-connections"/);
const thinkingHtml = (await render("applied-thinking")).main.innerHTML;
assert.match(thinkingHtml, /id="opacity-management"/);
assert.equal((thinkingHtml.match(/class="principle-card"/g) || []).length, 8, "eight principle tile cards");
assert.equal((thinkingHtml.match(/principle-card__visual/g) || []).length, 8, "every principle card has its tile");
assert.doesNotMatch(thinkingHtml, /thinking-capabilities|class="toc"/, "duplicate capabilities list and sidebar are gone");
const processHtml = (await render("process")).main.innerHTML;
for (const id of ["who", "workflow", "boundaries", "this-site", "reading"]) assert.match(processHtml, new RegExp(`id="${id}"`));
assert.match((await render("home"))["site-footer"].innerHTML, /href="\.\/how-these-were-built\/"/, "footer links to the process page");
assert.doesNotMatch((await render("process"))["site-footer"].innerHTML, /how-these-were-built/, "process page does not link to itself");
assert.match((await render("project")).main.innerHTML, /href="\.\.\/\.\.\/how-these-were-built\/"/, "case study role links to the process page");
// Figures: narrow and dark variants on project pages, card layout on the homepage.
const projectHtml = (await render("project")).main.innerHTML;
assert.match(projectHtml, /<source media="\(prefers-color-scheme: dark\) and \(max-width: 39\.99rem\)" srcset="[^"]+-narrow-dark\.svg"/);
assert.match(projectHtml, /<source media="\(max-width: 39\.99rem\)" srcset="[^"]+-narrow\.svg"/);
assert.match(projectHtml, /<p class="figure-title">/);
assert.match(home, /<div class="card__visual"><picture><source media="\(prefers-color-scheme: dark\)" srcset="[^"]+-card-dark\.svg"/);
// Phase 1 redesign: positioning hero and decision-led story template.
assert.match(home, /<section class="hero hero--story wrap"/);
assert.match(home, /<source media="\(prefers-color-scheme: dark\) and \(max-width: 49\.99rem\)" srcset="[^"]+ba-data-narrow-dark\.svg"/);
// Unset owner fields (null) are hidden exactly like omitted ones (false): no
// placeholders, disabled buttons or draft banner anywhere on any page.
// Tested on a copy with every field unset, independent of what the live content sets.
const unset = structuredClone(content);
Object.assign(unset.owner, {name: null, email: null, resume: null, otherLinks: null});
unset.projects[0].repoUrl = null;
delete unset.owner.projectStatements[unset.projects[0].slug].learned;
for (const [page, slug] of [["home"], ["project", unset.projects[0].slug], ["applied-thinking"], ["process"]]) {
  const nodes = await render(page, unset, false, slug);
  const all = nodes.main.innerHTML + nodes["site-header"].innerHTML + nodes["draft-banner"].innerHTML;
  assert.ok(!/class="ph|btn--off|Placeholder|Draft preview/.test(all), `${page}: unset fields must show no placeholder`);
}
const omitted = structuredClone(content);
Object.assign(omitted.owner, {name: false, email: false, resume: false, otherLinks: false});
const omittedHero = (await render("home", omitted)).main.innerHTML;
assert.ok(!/class="ph|btn--off/.test(omittedHero.slice(0, omittedHero.indexOf("</section>"))), "omitted fields must add nothing to the hero");
const filled = structuredClone(content);
Object.assign(filled.owner, {name: "A. Person", email: "a@example.com", resume: {label: "Résumé (PDF)", url: "https://example.com/r.pdf"}, otherLinks: [{label: "LinkedIn", url: "https://www.linkedin.com/in/example"}]});
const filledHero = (await render("home", filled)).main.innerHTML;
assert.ok(filledHero.includes('href="mailto:a@example.com"') && filledHero.includes('href="https://www.linkedin.com/in/example"') && filledHero.includes("A. Person"));
for (const id of ["situation", "decisions", "result", "next", "technical", "role", "academic-connections"]) {
  assert.match(projectHtml, new RegExp(`<section id="${id}"`));
}
assert.ok(!projectHtml.includes('class="toc"') && !projectHtml.includes("Independence statement"));
assert.match(projectHtml, /class="decision decision--visual"[\s\S]*tile-ambiguity/);
// Every project renders the story template, with its banner, decisions and owner statements.
for (const p of content.projects) {
  const html = (await render("project", content, false, p.slug)).main.innerHTML;
  assert.match(html, /<header class="story-head">/, p.slug);
  assert.match(html, /<figure class="showcase">/, p.slug);
  assert.equal((html.match(/<li class="decision/g) || []).length, p.story.decisions.length, p.slug);
  assert.ok(html.includes(content.owner.projectStatements[p.slug].contribution[0].slice(0, 60)), `${p.slug}: contribution must be verbatim`);
  assert.ok(!/Independence statement|class="toc"|Validation and results/.test(html), `${p.slug}: legacy sections`);
}
const hostile = structuredClone(content);
hostile.site.hero.visual.src = 'javascript:alert(1)';
hostile.site.hero.visual.link.href = 'javascript:alert(1)';
hostile.site.hero.primaryCta.href = 'javascript:alert(1)';
hostile.site.hero.visual.narrowMax = '1px), (min-width: 0';
hostile.projects[0].story.banner.src = 'javascript:alert(1)';
hostile.projects[0].story.headline = '<img src=x onerror="alert(1)">';
hostile.site.howIWork.tiles[0].src = 'javascript:alert(1)';
hostile.site.howIWork.moreLink.href = 'javascript:alert(1)';
hostile.projects[1].card.outcome = '<script>alert(1)</script>';
const hostileHome = (await render("home", hostile)).main.innerHTML;
const hostileStory = (await render("project", hostile)).main.innerHTML;
assert.ok(!hostileHome.includes("javascript:") && !hostileHome.includes("1px), (min-width: 0") && !hostileHome.includes("<script>"));
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
console.log("PASS: four routes, Applied Thinking tile cards, process page, homepage order, hero and story templates, escaped copy, rejected active URL schemes and offline fallback.");
