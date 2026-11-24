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
// Homepage order: hero, experience, case studies, How I think, about, contact.
const order = ['class="hero hero--story', 'id="experience"', 'id="projects"', 'id="how-i-work"', 'id="about"', 'id="contact"'].map(m => home.indexOf(m));
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
const projectHtml = (await render("project", content, false, "synthetic-data-quality-pipeline")).main.innerHTML;
assert.match(projectHtml, /<source media="\(prefers-color-scheme: dark\) and \(max-width: 39\.99rem\)" srcset="[^"]+-narrow-dark\.svg"/);
assert.match(projectHtml, /<source media="\(max-width: 39\.99rem\)" srcset="[^"]+-narrow\.svg"/);
assert.match(projectHtml, /<p class="figure-title">/);
assert.match(home, /<div class="card__visual"><picture><source media="\(prefers-color-scheme: dark\)" srcset="[^"]+-card-dark\.svg"/);
// Phase 1 redesign: positioning hero and decision-led story template.
assert.match(home, /<section class="hero hero--story wrap"/);
assert.match(home, /<source media="\(prefers-color-scheme: dark\) and \(max-width: 49\.99rem\)" srcset="[^"]+hero-decision-narrow-dark\.svg"/);
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
assert.ok(filledHero.includes('href="mailto:a@example.com"') && filledHero.includes('href="https://www.linkedin.com/in/example"'));
// The name appears once, in the header, not again in the hero eyebrow.
const filledNodes = await render("home", filled);
assert.match(filledNodes["site-header"].innerHTML, /class="brand"[^>]*>A\. Person</);
assert.ok(!filledNodes.main.innerHTML.includes("A. Person"), "name must not repeat in the hero");
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
// Case-study navigation: plain anchors in the static page, one per section that exists.
for (const p of content.projects) {
  const html = (await render("project", content, false, p.slug)).main.innerHTML;
  const nav = html.match(/<nav class="story-nav"[^>]*>[\s\S]*?<\/nav>/);
  assert.ok(nav, `${p.slug}: story navigation`);
  const targets = [...nav[0].matchAll(/href="#([^"]+)"/g)].map(m => m[1]);
  const expected = content.site.storyNav.items.filter(item => item.id !== "walkthrough" || p.story.walkthrough);
  assert.equal(targets.length, expected.length, `${p.slug}: one entry per section the page has`);
  for (const id of targets) assert.match(html, new RegExp(`<section id="${id}"`), `${p.slug}: #${id} exists`);
}
// Homepage decision sheet: the static page keeps the figure; the browser swaps in the interactive sheet.
assert.match(home, /<figure class="showcase" id="decision" data-decision-lab>/);
assert.match(home, /<figure class="showcase" id="decision" data-decision-lab>[\s\S]*?<picture>/, "static figure stays as the no-script fallback");
assert.ok(!home.includes('class="dlab"'), "the interactive sheet is not part of the static snapshot");
async function enhanceHome(input = content) {
  const handlers = {};
  const view = {innerHTML: ""}, out = {textContent: ""};
  const range = {value: "", attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, addEventListener(type, fn) { handlers[type] = fn; }};
  const presets = [0, 1, 2].map(() => ({dataset: {}, addEventListener(type, fn) { this.click = fn; }}));
  const holder = {className: "", html: "", set innerHTML(v) { this.html = v; presets.forEach((b, i) => { const m = v.match(new RegExp(`data-dlab-preset="${i}" data-value="([^"]*)"`)); b.dataset.value = m && m[1]; }); },
    querySelector: sel => ({"[data-dlab-range]": range, "[data-dlab-out]": out, "[data-dlab-view]": view})[sel], querySelectorAll: () => presets};
  const picture = {replaced: null, replaceWith(el) { this.replaced = el; }};
  const figure = {querySelector: sel => (sel === "picture" ? picture : null)};
  const nodes = Object.fromEntries(["main", "site-header", "draft-banner", "site-footer"].map(id => [id, {innerHTML: "", dataset: {prerendered: "true"}}]));
  const document = {body: {dataset: {page: "home", root: ".", project: ""}}, getElementById: id => nodes[id], createElement: () => holder,
    querySelector: sel => (sel === "[data-decision-lab]" ? figure : null)};
  const context = vm.createContext({document, location: {protocol: "https:", hash: ""}, fetch: async () => ({ok: true, json: async () => input})});
  vm.runInContext(source, context, {timeout: 5000});
  await new Promise(resolve => setImmediate(resolve));
  return {picture, holder, range, out, view, presets, handlers};
}
{
  const lab = await enhanceHome();
  assert.equal(lab.picture.replaced, lab.holder, "the interactive sheet replaces the static picture");
  assert.match(lab.holder.html, /min="1" max="4" step="0.05" value="1"/);
  // Start: the lab's original scenario. Plan A (2,976) beats Plan B (3,140) by 164.
  assert.match(lab.view.innerHTML, /<b>2,976<\/b>/); assert.match(lab.view.innerHTML, /<b>3,140<\/b>/);
  assert.match(lab.view.innerHTML, /dlab__plan is-best">\s*<p class="dlab__tag">Plan A/);
  assert.match(lab.view.innerHTML, /Plan A is cheaper by 164\. The better plan changes at about 1\.7×\./);
  assert.match(lab.view.innerHTML, /164 more than Plan A/);
  // 4×: the lab's high-shortage scenario. Plan B (8,660) beats Plan A (9,204) by 544.
  lab.range.value = "4"; lab.handlers.input();
  assert.match(lab.view.innerHTML, /<b>8,660<\/b>/); assert.match(lab.view.innerHTML, /<b>9,204<\/b>/);
  assert.match(lab.view.innerHTML, /dlab__plan is-best">\s*<p class="dlab__tag">Plan B/);
  assert.match(lab.view.innerHTML, /544 more than Plan B/);
  assert.equal(lab.out.textContent, "4× the original");
  assert.match(lab.range.attrs["aria-valuetext"], /^4× the original\. At 4× /);
  // Presets: the tipping point sits on the slider and flips the decision to Plan B.
  assert.deepEqual(lab.presets.map(b => b.dataset.value), ["1", "1.7", "4"]);
  lab.presets[1].dataset.value = "1.7"; lab.presets[1].click();
  assert.equal(lab.range.value, "1.7");
  assert.match(lab.view.innerHTML, /Plan B is cheaper by 1\./);
  lab.range.value = "1.65"; lab.handlers.input();
  assert.match(lab.view.innerHTML, /Plan A is cheaper by/);
  // Content is escaped, and a lab that is not two plans leaves the static figure alone.
  const bad = structuredClone(content);
  bad.site.hero.decisionLab.plans[0].name = '<img src=x onerror="alert(1)">';
  bad.site.hero.decisionLab.source = "<script>alert(1)</script>";
  const hostileLab = await enhanceHome(bad);
  assert.ok(!hostileLab.view.innerHTML.includes("<img") && !hostileLab.holder.html.includes("<script>"));
  const single = structuredClone(content);
  single.site.hero.decisionLab.plans.pop();
  assert.equal((await enhanceHome(single)).picture.replaced, null);
  const none = structuredClone(content);
  delete none.site.hero.decisionLab;
  assert.equal((await enhanceHome(none)).picture.replaced, null);
}
// Order walk-through (B2B case study): every step is in the static page with its full ledger.
{
  const b2b = content.projects.find(p => p.story.walkthrough);
  const w = b2b.story.walkthrough;
  const html = (await render("project", content, false, b2b.slug)).main.innerHTML;
  assert.match(html, /<section id="walkthrough" class="walk" data-walkthrough/);
  assert.equal((html.match(/<li class="walk__step"/g) || []).length, w.steps.length);
  assert.equal((html.match(/<div class="walk__row/g) || []).length, w.steps.length * w.rows.length, "every step carries the full ledger");
  assert.ok(html.indexOf('id="decisions"') < html.indexOf('id="walkthrough"') && html.indexOf('id="walkthrough"') < html.indexOf('id="result"'), "walk-through sits between decisions and result");
  // Committed demand never moves after the order is accepted; the added-up row is flagged as not a real quantity.
  assert.match(html, /walk__row--key[^>]*>\s*<dt>Committed demand/);
  assert.match(html, /walk__row--mistake/);
  // Changed rows show what they changed from: the first step moves quoted 0 -> 4.
  const first = html.match(/<li class="walk__step" id="walk-step-1">[\s\S]*?<\/li>/)[0];
  assert.match(first, /is-changed"><dt>Quoted[\s\S]*?<b>4<\/b><small>was 0<\/small>/);
  assert.match(html, /walk__badge walk__badge--hypothetical">Hypothetical/);
  for (const other of content.projects.filter(p => !p.story.walkthrough)) {
    assert.doesNotMatch((await render("project", content, false, other.slug)).main.innerHTML, /data-walkthrough/);
  }
  const hostileWalk = structuredClone(content);
  hostileWalk.projects.find(p => p.story.walkthrough).story.walkthrough.steps[0].title = '<img src=x onerror="alert(1)">';
  assert.ok(!(await render("project", hostileWalk, false, b2b.slug)).main.innerHTML.includes("<img src=x"));
  // The browser turns it into a stepper: one step visible, previous/next and numbered buttons.
  const handlers = [];
  const mk = (extra = {}) => ({classList: {toggled: {}, toggle(c, on) { this.toggled[c] = on; }, add() {}}, setAttribute() {}, removeAttribute() {}, addEventListener(t, f) { handlers.push(f); }, dataset: {}, ...extra});
  const stepEls = w.steps.map(() => mk());
  const prev = mk(), next = mk(), dots = w.steps.map((_, i) => mk({dataset: {walkTo: String(i)}}));
  const bar = {className: "", html: "", set innerHTML(v) { this.html = v; }, querySelectorAll: () => dots, querySelector: sel => (sel === '[data-walk="-1"]' ? prev : next)};
  const rootEl = {classList: {added: [], add(c) { this.added.push(c); }}, querySelectorAll: () => stepEls, querySelector: () => ({}), insertBefore() {}};
  const nodes = Object.fromEntries(["main", "site-header", "draft-banner", "site-footer"].map(id => [id, {innerHTML: "", dataset: {prerendered: "true"}}]));
  const document = {body: {dataset: {page: "project", root: "../..", project: b2b.slug}}, getElementById: id => nodes[id], createElement: () => bar,
    querySelector: sel => (sel === "[data-walkthrough]" ? rootEl : null)};
  const context = vm.createContext({document, location: {protocol: "https:", hash: ""}, fetch: async () => ({ok: true, json: async () => content})});
  vm.runInContext(source, context, {timeout: 5000});
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(rootEl.classList.added, ["is-stepper"]);
  assert.equal(stepEls[0].classList.toggled["is-current"], true);
  assert.equal(stepEls[1].classList.toggled["is-current"], false);
  assert.equal(prev.disabled, true); assert.equal(next.disabled, false);
  // handlers are registered in order: previous, next, then the numbered buttons
  const [onPrev, onNext] = handlers;
  onNext(); onNext();
  assert.equal(stepEls[2].classList.toggled["is-current"], true);
  assert.equal(stepEls[0].classList.toggled["is-current"], false);
  for (let i = 0; i < 10; i++) onNext();
  assert.equal(next.disabled, true, "stops at the last step");
  assert.equal(stepEls[w.steps.length - 1].classList.toggled["is-current"], true);
  onPrev();
  assert.equal(stepEls[w.steps.length - 2].classList.toggled["is-current"], true);
}
// Project x principle overview on the How I Think page, built from the approved mappings.
{
  const a = content.appliedThinking;
  const html = (await render("applied-thinking")).main.innerHTML;
  assert.match(html, /<table class="matrix">/);
  const rows = [...html.match(/<table class="matrix">[\s\S]*?<\/table>/)[0].matchAll(/<tr><th scope="row">[\s\S]*?<\/tr>/g)].map(m => m[0]);
  assert.equal(rows.length, a.principles.length, "one row per principle");
  let examples = 0, connects = 0;
  for (const pr of a.principles) {
    const row = rows.find(r => r.includes(`href="#${pr.id}"`));
    assert.ok(row, `${pr.id}: has a row`);
    const cells = [...row.matchAll(/matrix__cell--(example|connects|none)/g)].map(m => m[1]);
    assert.equal(cells.length, content.projects.length, `${pr.id}: one cell per project`);
    content.projects.forEach((p, i) => {
      const bridged = a.caseStudyBridges.find(b => b.slug === p.slug).principleIds.includes(pr.id);
      const want = pr.projectSlugs.includes(p.slug) ? "example" : bridged ? "connects" : "none";
      assert.equal(cells[i], want, `${pr.id} x ${p.slug}`);
    });
    examples += cells.filter(c => c === "example").length; connects += cells.filter(c => c === "connects").length;
  }
  assert.equal(examples, a.principles.reduce((n, pr) => n + pr.projectSlugs.length, 0));
  assert.ok(connects > 0);
  for (const p of content.projects) assert.ok(html.includes(`href="../projects/${p.slug}/">${p.card.kicker}</a></th>`), `${p.slug}: column links to its case study`);
  assert.ok(html.indexOf("thinking-boundary") < html.indexOf('class="matrix-block"') && html.indexOf('class="matrix-block"') < html.indexOf('class="thinking-cards"'));
  const noLabels = structuredClone(content);
  delete noLabels.appliedThinking.labels.matrixTitle;
  assert.doesNotMatch((await render("applied-thinking", noLabels)).main.innerHTML, /matrix/);
}
// Résumé reader's path: Start here strip, workstreams linked to case studies, pipeline cards.
{
  const h = content.site.hero, ex = content.owner.professionalExperience;
  const strip = home.match(/<nav class="start-here"[\s\S]*?<\/nav>/);
  assert.ok(strip && home.indexOf("start-here") < home.indexOf('id="decision"'), "Start here sits between the hero buttons and the figure");
  assert.equal((strip[0].match(/<li>/g) || []).length, h.startHere.steps.length);
  assert.match(strip[0], /href="#decision"/); assert.match(strip[0], /href="#experience"/); assert.match(strip[0], /href="\.\/how-these-were-built\/"/);
  const exp = home.slice(home.indexOf('id="experience"'), home.indexOf('id="projects"'));
  assert.equal((exp.match(/<li class="workstream">/g) || []).length, ex.workstreams.length);
  for (const ws of ex.workstreams) {
    assert.ok(exp.includes(ws.detail.slice(0, 60)), `${ws.title}: owner wording verbatim`);
    if (ws.project) assert.ok(exp.includes(`href="./projects/${ws.project}/">`), `${ws.title}: links to ${ws.project}`);
  }
  assert.ok(exp.indexOf("Supply planning") < exp.indexOf("Inventory decision support"), "supply planning leads");
  content.projects.forEach((p, i) => {
    const card = home.match(new RegExp(`<article class="card card--work" aria-labelledby="card-${p.slug}">[\\s\\S]*?</article>`))[0];
    assert.match(card, new RegExp(`<span class="card__stage">Stage ${i + 1}</span> ${p.card.kicker}`), `${p.slug}: stage ${i + 1}`);
    assert.match(card, /<dl class="card__split">[\s\S]*The system[\s\S]*A person/, `${p.slug}: says who does what`);
  });
  for (const p of content.projects) {
    const html = (await render("project", content, false, p.slug)).main.innerHTML;
    assert.match(html, new RegExp(`<div class="story-facts__decides"><dt>Who decides</dt><dd>${p.card.person.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</dd>`), `${p.slug}: who decides`);
  }
  const bare = structuredClone(content);
  delete bare.site.hero.startHere; delete bare.site.experience.workstreamsTitle; delete bare.site.work.stageLabel;
  const bareHome = (await render("home", bare)).main.innerHTML;
  assert.ok(!/start-here|class="workstream"|card__stage/.test(bareHome), "each addition can be switched off from the content file");
}
console.log("PASS: four routes, Applied Thinking tile cards, process page, homepage order, hero and story templates, résumé path (start here, linked workstreams, pipeline stages, who decides), case-study navigation, interactive decision sheet, order walk-through, principle matrix, escaped copy, rejected active URL schemes and offline fallback.");
