/*
 * Renders every page from content/site.json. This file holds layout and
 * behavior only; site text and personal details live in the content file.
 *
 * Content convention: null = pending owner input (rendered as a visible
 * placeholder and listed in the draft banner); false = intentionally omitted.
 */
(function () {
  "use strict";

  const body = document.body;
  const root = body.dataset.root || ".";
  const home = root === "." ? "./" : root + "/";

  // Labels for pending items. Keys are full paths or the final path segment.
  const LABELS = {
    "owner.name": "Name",
    "owner.githubUsername": "GitHub username",
    "owner.intro": "Intro: technical interests",
    "owner.bio": "Background",
    "owner.skills": "Skills",
    "owner.email": "Public contact email",
    "owner.resume": "Resume file or link",
    "owner.otherLinks": "Other links (LinkedIn, etc.)",
    ownerVerification: "Owner verification statement",
    contribution: "My contribution",
    learned: "What I learned",
    professionalContext: "Related professional experience",
    repoUrl: "Source repository link"
  };

  // Guidance shown inside block placeholders (draft tooling, not site copy).
  const HINTS = {
    "owner.intro": "One or two sentences on your technical interests. Do not claim a title or qualification you have not approved.",
    "owner.bio": "Concise, factual background that you explicitly approve.",
    "owner.skills": "A short list of skills you approve listing.",
    ownerVerification: "State whether you personally reproduced these checks.",
    contribution: "Your own role in this public demo, including AI assistance.",
    learned: "What you learned, in your own words.",
    professionalContext: "Exact owner-approved wording only. Set this field to false to omit the section."
  };

  const STATEMENT_KEYS = ["ownerVerification", "contribution", "learned", "professionalContext"];

  /* ---------- text helpers ---------- */

  function esc(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[ch]);
  }

  // Escape first, then allow `code` and **bold** only.
  function inline(value) {
    return esc(value)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  }

  function paras(value) {
    const list = Array.isArray(value) ? value : [value];
    return list.map((p) => `<p>${inline(p)}</p>`).join("");
  }

  // Allows http(s), mailto and relative URLs; relative ones resolve from the site root.
  function url(value) {
    const s = String(value).trim();
    if (/^(https?:|mailto:)/i.test(s)) return esc(s);
    if (/^[a-z][a-z0-9+.-]*:/i.test(s) || s.startsWith("//")) return null;
    return esc(s.startsWith("/") || s.startsWith("#") ? s : home + s);
  }

  /* ---------- responsive figures ---------- */

  // scripts/build_visuals.py writes each figure in layouts (wide, narrow, card)
  // and colour schemes; `sizes` in site.json lists the layouts that exist.
  const NARROW = "(max-width: 39.99rem)";
  const DARK = "(prefers-color-scheme: dark)";

  function variant(src, layout, dark) {
    const suffix = (layout === "wide" ? "" : "-" + layout) + (dark ? "-dark" : "");
    return url(String(src).replace(/\.svg$/, suffix + ".svg"));
  }

  // <picture> that swaps in the dark scheme and, for figures, the narrow layout
  // on phones. Homepage cards use the compact card layout at every width.
  function picture(entry, alt, mode) {
    const sizes = entry.sizes || {};
    const layout = mode === "card" && sizes.card ? "card" : "wide";
    const main = sizes[layout];
    const base = variant(entry.src, layout, false);
    if (!base || !main) return "";
    // media: comma-separated viewport queries, or "" for any viewport.
    const source = (layout, dark, media) => {
      const [w, h] = sizes[layout];
      const queries = media ? media.split(",").map(q => q.trim()) : [];
      const m = dark ? (queries.length ? queries.map(q => `${DARK} and ${q}`).join(", ") : DARK) : queries.join(", ");
      return `<source media="${m}" srcset="${variant(entry.src, layout, dark)}" width="${w}" height="${h}">`;
    };
    // An entry may switch to its narrow layout at a wider breakpoint (e.g. banners).
    const narrow = /^\d+(\.\d+)?rem$/.test(entry.narrowMax || "") ? `(max-width: ${entry.narrowMax})` : NARROW;
    const sources = layout === "wide" && sizes.narrow ? [source("narrow", true, narrow), source("narrow", false, narrow)] : [];
    sources.push(source(layout, true, ""));
    const loading = entry.eager ? "" : ' loading="lazy"';
    return `<picture>${sources.join("")}<img src="${base}" alt="${esc(alt)}" width="${main[0]}" height="${main[1]}"${loading} decoding="async"></picture>`;
  }

  // A headline figure: optional HTML title, the picture, a caption and an optional link.
  function showcase(entry) {
    if (!entry) return "";
    const image = picture(entry, entry.alt, "figure");
    if (!image) return "";
    const href = entry.link ? url(entry.link.href) : null;
    const link = href ? ` <a href="${href}">${esc(entry.link.label)}</a>` : "";
    return `<figure class="showcase">
      ${entry.title ? `<p class="showcase__title">${inline(entry.title)}</p>` : ""}
      ${image}
      ${entry.caption || link ? `<figcaption>${inline(entry.caption || "")}${link}</figcaption>` : ""}
    </figure>`;
  }

  /* ---------- pending items ---------- */

  function walkPending(node, path, out) {
    if (node === null) {
      out.push(path);
    } else if (Array.isArray(node)) {
      node.forEach((item, i) => walkPending(item, `${path}[${item && item.slug ? item.slug : i}]`, out));
    } else if (typeof node === "object") {
      Object.keys(node).forEach((key) => {
        if (!key.startsWith("_")) walkPending(node[key], path ? `${path}.${key}` : key, out);
      });
    }
  }

  function statementsFor(content, slug) {
    return (content.owner.projectStatements || {})[slug] || {};
  }

  function pendingItems(content) {
    const paths = [];
    walkPending(content, "", paths);
    // A project without a statements entry is pending too, not silently empty.
    content.projects.forEach((p) => {
      const s = statementsFor(content, p.slug);
      STATEMENT_KEYS.forEach((key) => {
        if (s[key] === undefined) paths.push(`owner.projectStatements.${p.slug}.${key}`);
      });
    });
    return paths.map((path) => ({
      path,
      label: describe(content, path),
      kind: path.endsWith(".repoUrl") ? "link" : "placeholder"
    }));
  }

  function describe(content, path) {
    if (LABELS[path]) return LABELS[path];
    const last = path.split(".").pop();
    const label = LABELS[last] || last;
    const m = path.match(/^owner\.projectStatements\.([^.]+)\./) || path.match(/^projects\[([^\]]+)\]/);
    if (!m) return label;
    const project = content.projects.find((p) => p.slug === m[1]);
    return `${project ? project.title : m[1]}: ${label}`;
  }

  /* ---------- placeholders and disabled links ---------- */

  function ph(content, path) {
    return `<span class="ph"><span class="ph__tag">Placeholder</span> ${esc(describe(content, path))}</span>`;
  }

  function phBlock(content, path) {
    const hint = HINTS[path] || HINTS[path.split(".").pop()];
    return `<div class="ph ph--block">
      <p class="ph__title"><span class="ph__tag">Placeholder</span> ${esc(describe(content, path))}</p>
      ${hint ? `<p>${esc(hint)}</p>` : ""}
      <p class="ph__path">Edit <code>${esc(path)}</code> in <code>content/site.json</code>.</p>
    </div>`;
  }

  // null -> block placeholder, false -> omitted (returns null), otherwise paragraphs.
  function ownerText(content, value, path) {
    if (value === false) return null;
    if (value === null || value === undefined) return phBlock(content, path);
    return paras(value);
  }

  const LOCK = '<svg class="icon" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><path fill="currentColor" d="M5 7V5a3 3 0 1 1 6 0v2h.5A1.5 1.5 0 0 1 13 8.5v5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 13.5v-5A1.5 1.5 0 0 1 4.5 7H5Zm1.5 0h3V5a1.5 1.5 0 1 0-3 0v2Z"/></svg>';

  function disabledLink(label, note) {
    return `<a class="btn btn--off" role="link" aria-disabled="true">${LOCK}<span>${esc(label)}</span><span class="btn__note">${esc(note)}</span></a>`;
  }

  function repoLinks(project, withReadme) {
    const href = project.repoUrl ? url(project.repoUrl) : null;
    if (!href) return disabledLink("Source repository", "Not yet published");
    let html = `<a class="btn" href="${href}">Source on GitHub<span class="visually-hidden">: ${esc(project.title)}</span></a>`;
    if (withReadme) html += `<a class="btn" href="${href}#readme">README and run instructions</a>`;
    return html;
  }

  /* ---------- shared chrome ---------- */

  function renderHeader(content) {
    const name = content.owner.name;
    const brand = name === null ? ph(content, "owner.name") : esc(name || "Portfolio");
    return `<div class="wrap header__inner">
      <a class="brand" href="${home}">${brand}</a>
      <nav aria-label="Primary">
        <ul class="nav">
          <li><a href="${home}#projects">Projects</a></li>
          <li><a href="${home}#experience">Experience</a></li>
          ${content.appliedThinking ? `<li><a href="${url(content.appliedThinking.route)}"${body.dataset.page === "applied-thinking" ? ' aria-current="page"' : ""}>${esc(content.appliedThinking.navLabel)}</a></li>` : ""}
          <li><a href="${home}#about">About</a></li>
          <li><a href="${home}#contact">Contact</a></li>
        </ul>
      </nav>
    </div>`;
  }

  function renderBanner(content) {
    const items = pendingItems(content);
    const a = content.appliedThinking;
    const review = a && (a.draftStatus !== "approved" || Object.values(a.review || {}).some(value => value !== "approved"));
    const reviewHtml = review ? `<div class="wrap"><p><strong>${esc(a.labels.draftTitle)}.</strong> ${esc(a.labels.draftBody)}</p></div>` : "";
    if (!items.length) return reviewHtml;
    const links = items.filter((i) => i.kind === "link").length;
    const fields = items.length - links;
    const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
    return `${reviewHtml}<div class="wrap">
      <p><strong>Draft preview.</strong> ${plural(fields, "placeholder")} and ${plural(links, "unpublished link")} still need owner input. Resolve or omit them before publishing.</p>
      <details>
        <summary>Show open items</summary>
        <ul class="pending-list">
          ${items.map((i) => `<li>${esc(i.label)} <code>${esc(i.path)}</code></li>`).join("")}
        </ul>
      </details>
    </div>`;
  }

  function renderFooter(content) {
    return `<div class="wrap footer__inner">
      <p>${inline(content.site.disclosure || content.site.footer)}</p>
      <p>${inline(content.site.privacy)}</p>
    </div>`;
  }

  function tags(list) {
    return `<ul class="tags">${list.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`;
  }

  function pageTitle(content, prefix) {
    const name = content.owner.name;
    const suffix = name ? `${name} · Portfolio` : "Independent Technical Portfolio";
    return prefix ? `${prefix} · ${suffix}` : suffix;
  }

  /* ---------- home page ---------- */


  function technicalFigure(visual) {
    const image = visual && picture(visual, visual.alt, "figure");
    if (!image) return "";
    return `<figure class="technical-figure">
        ${visual.title ? `<p class="figure-title">${inline(visual.title)}</p>` : ""}
        ${image}
        <figcaption><span class="figure-label">${esc(visual.label || (visual.kind === "diagram" ? "SYSTEM / MODEL" : "SYNTHETIC RESULT"))}</span> ${inline(visual.caption)}</figcaption>
      </figure>`;
  }

  function renderVisuals(project, only) {
    if (!Array.isArray(project.visuals) || !project.visuals.length) return "";
    const list = only ? only.map(src => project.visuals.find(v => v.src === src)) : project.visuals;
    if (!list.some(Boolean)) return "";
    return `<div class="visual-gallery">${list.map(technicalFigure).join("")}</div>`;
  }

  function renderCard(project) {
    const c = project.card;
    return `<li>
      <article class="card card--work" aria-labelledby="card-${esc(project.slug)}">
        <div class="card__visual">${picture((project.visuals || []).find(v => v.src === project.thumbnail) || {src: project.thumbnail}, "", "card")}</div>
        <p class="card__kicker">${esc(c.kicker)}</p>
        <h3 id="card-${esc(project.slug)}">${esc(project.title)}</h3>
        <p class="card__outcome">${inline(c.outcome)}</p>
        <div class="actions">
          <a class="btn btn--primary" href="${home}projects/${esc(project.slug)}/">Read the case study<span class="visually-hidden">: ${esc(project.title)}</span></a>
          ${repoLinks(project, false)}
        </div>
      </article>
    </li>`;
  }

  // "How I work": one tile per project, each with a real link to that project.
  function renderHowIWork(content) {
    const s = content.site.howIWork;
    if (!s) return "";
    const tiles = s.tiles.map((t) => {
      const project = content.projects.find(p => p.slug === t.project);
      const image = project && picture(t, t.alt, "figure");
      if (!image) return "";
      return `<li class="how-tile"><figure>
          ${image}
          <figcaption><a href="${home}projects/${esc(project.slug)}/">${esc(t.linkLabel)}<span aria-hidden="true">&nbsp;→</span></a></figcaption>
        </figure></li>`;
    }).join("");
    const more = s.moreLink && url(s.moreLink.href);
    return `<section class="section how-i-work" id="how-i-work" aria-labelledby="how-title">
      <div class="wrap">
        <p class="eyebrow">${esc(s.eyebrow)}</p>
        <h2 id="how-title">${esc(s.title)}</h2>
        <p class="section__lede">${inline(s.lede)}</p>
        <ul class="how-tiles">${tiles}</ul>
        ${more ? `<p class="how-more"><a class="btn" href="${more}">${esc(s.moreLink.label)}</a></p>` : ""}
      </div>
    </section>`;
  }

  // Résumé button shared by the hero and the experience section.
  function resumeButton(content, label) {
    const r = content.owner.resume;
    if (r === null) return disabledLink(label, "Placeholder");
    const href = r && r.url ? url(r.url) : null;
    return href ? `<a class="btn" href="${href}">${esc(label)}</a>` : "";
  }

  function renderContact(content) {
    const o = content.owner;
    const rows = [];

    if (o.email !== false) {
      rows.push(["Email", o.email === null ? ph(content, "owner.email")
        : `<a href="mailto:${esc(o.email)}">${esc(o.email)}</a>`]);
    }
    if (o.resume !== false) {
      const href = o.resume && o.resume.url ? url(o.resume.url) : null;
      rows.push(["Résumé", href ? `<a href="${href}">${esc(o.resume.label || "Résumé")}</a>`
        : ph(content, "owner.resume")]);
    }
    if (o.githubUsername !== false) {
      rows.push(["GitHub", o.githubUsername === null ? ph(content, "owner.githubUsername")
        : `<a href="https://github.com/${encodeURIComponent(o.githubUsername)}">github.com/${esc(o.githubUsername)}</a>`]);
    }
    if (o.otherLinks !== false) {
      const links = (o.otherLinks || [])
        .map((l) => ({ label: l.label, href: url(l.url) }))
        .filter((l) => l.href)
        .map((l) => `<a href="${l.href}">${esc(l.label)}</a>`);
      rows.push(["Other links", o.otherLinks === null ? ph(content, "owner.otherLinks") : links.join(" · ")]);
    }

    return `<dl class="contact">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>`;
  }

  function renderExperience(content) {
    const ex = content.owner.professionalExperience;
    if (!ex || ex === false) return "";
    const e = content.site.experience || {};
    return `<section class="section section--experience" id="experience" aria-labelledby="experience-title">
      <div class="wrap experience-compact">
        <p class="eyebrow">${esc(e.eyebrow || "Experience")}</p>
        <h2 id="experience-title">${esc(e.title || "Experience")}</h2>
        <p class="experience-role"><strong>${esc(ex.role)}</strong> · ${esc(ex.organization)} · ${esc(ex.period)}</p>
        <p class="section__lede">${inline(ex.summary)}</p>
        <div class="actions">${resumeButton(content, e.resumeLabel || "Full résumé")}</div>
      </div>
    </section>`;
  }
  // Positioning hero. Contact buttons come from the owner fields: a set field
  // links, a pending (null) field shows a marked placeholder in its final
  // position, and an omitted (false) field adds nothing.
  function renderHero(content) {
    const o = content.owner;
    const h = content.site.hero;
    const kicker = typeof o.name === "string" && o.name ? esc(o.name)
      : o.name === null ? `${ph(content, "owner.name")} · ${inline(h.eyebrow)}` : inline(h.eyebrow);
    const buttons = [];
    const pending = (label) => disabledLink(label, "Placeholder");
    const cta = h.primaryCta && url(h.primaryCta.href);
    if (cta) buttons.push(`<a class="btn btn--primary" href="${cta}">${esc(h.primaryCta.label)}</a>`);
    const resume = resumeButton(content, (o.resume && o.resume.label) || "Résumé");
    if (resume) buttons.push(resume);
    if (o.email === null) buttons.push(pending("Email"));
    else if (typeof o.email === "string" && o.email) buttons.push(`<a class="btn" href="mailto:${esc(o.email)}">Email</a>`);
    if (o.otherLinks === null) buttons.push(pending("LinkedIn"));
    for (const link of Array.isArray(o.otherLinks) ? o.otherLinks : []) {
      const href = url(link.url);
      if (href) buttons.push(`<a class="btn" href="${href}">${esc(link.label)}</a>`);
    }
    if (typeof o.githubUsername === "string" && o.githubUsername) {
      buttons.push(`<a class="btn" href="https://github.com/${encodeURIComponent(o.githubUsername)}">GitHub</a>`);
    }
    return `<section class="hero hero--story wrap" aria-labelledby="intro-title">
      <p class="eyebrow">${kicker}</p>
      <h1 id="intro-title">${inline(h.title)}</h1>
      <p class="hero__lede">${inline(h.lede)}</p>
      <div class="actions hero__actions">${buttons.join("")}</div>
      ${showcase(h.visual)}
    </section>`;
  }

  function renderHome(content) {
    const o = content.owner;
    const name = o.name === null ? ph(content, "owner.name") : esc(o.name || content.site.headline || "Portfolio");
    const intro = ownerText(content, o.intro, "owner.intro");
    const bio = ownerText(content, o.bio, "owner.bio");
    const skills = o.skills === false ? null
      : o.skills === null || o.skills === undefined ? phBlock(content, "owner.skills") : tags(o.skills);
    const tools = [...new Set(content.projects.flatMap((p) => p.focus))];

    document.title = pageTitle(content, "");

    const hero = content.site.hero ? renderHero(content) : `
    <section class="hero wrap" aria-labelledby="intro-title">
      <p class="eyebrow">Independent portfolio · Enterprise-informed public examples</p>
      <h1 id="intro-title">${name}</h1>
      ${intro ? `<div class="hero__intro">${intro}</div>` : ""}
      <p class="hero__summary">${inline(content.site.summary)}</p>
    </section>`;

    const w = content.site.work;
    const about = content.site.about;
    // An owner-written bio, once set, replaces the site's About paragraphs.
    const aboutText = bio || (about ? paras(about.paragraphs) : "");
    return `
    ${hero}

    ${renderHowIWork(content)}

    <section class="section" id="projects" aria-labelledby="projects-title">
      <div class="wrap">
        <p class="eyebrow">${esc(w.eyebrow)}</p>
        <h2 id="projects-title">${esc(w.title)}</h2>
        <p class="section__lede">${inline(w.lede)}</p>
        <ul class="cards">${content.projects.map(renderCard).join("")}</ul>
      </div>
    </section>

    ${renderExperience(content)}

    <section class="section" id="about" aria-labelledby="about-title">
      <div class="wrap about-compact">
        <h2 id="about-title">${esc(about ? about.title : "About")}</h2>
        ${aboutText}
        ${skills ? `<h3>Skills</h3>${skills}` : ""}
        <h3>${esc(about ? about.toolsLabel : "Methods and tools in these projects")}</h3>
        ${tags(tools)}
      </div>
    </section>

    <section class="section" id="contact" aria-labelledby="contact-title">
      <div class="wrap">
        <h2 id="contact-title">Contact</h2>
        ${renderContact(content)}
      </div>
    </section>`;
  }

  /* ---------- case study page ---------- */

  function principleLinks(a, ids, fromPage) {
    return `<ul class="thinking-links">${ids.map(id => {
      const p = a.principles.find(item => item.id === id);
      return p ? `<li><a href="${fromPage ? url(a.route) : ""}#${esc(id)}">${esc(p.code)} · ${esc(p.title)}</a></li>` : "";
    }).join("")}</ul>`;
  }

  function renderAcademicBacklinks(content, slug) {
    const a = content.appliedThinking;
    const bridge = a && a.caseStudyBridges.find(item => item.slug === slug);
    if (!bridge) return "";
    return `<p>${inline(a.labels.backlinksIntro)}</p>${principleLinks(a, bridge.principleIds, true)}`;
  }

  function renderThinkingFigure(a, index) {
    const d = a.diagrams[index];
    const image = picture(d, d.alt, "figure");
    return image ? `<figure class="technical-figure thinking-figure">${image}<figcaption>${inline(d.caption)}</figcaption></figure>` : "";
  }

  function renderAppliedThinking(content) {
    const a = content.appliedThinking;
    if (!a) throw new Error("Applied Thinking content is missing");
    const l = a.labels;
    const section = (id, html) => `<section id="${id}" aria-labelledby="${id}-title"><h2 id="${id}-title">${esc(l[id])}</h2>${html}</section>`;
    const principle = p => `<article class="thinking-principle" id="${esc(p.id)}" aria-labelledby="${esc(p.id)}-title">
      <span class="thinking-number">${esc(p.code)}</span><h4 id="${esc(p.id)}-title">${esc(p.title)}</h4>
      <p class="thinking-question">${inline(p.question)}</p><p>${inline(p.explanation)}</p>
      <p class="thinking-caveat"><strong>${esc(l.caveat)}:</strong> ${inline(p.limitation)}</p>
      <details><summary>${esc(l.approach)}</summary><div class="thinking-detail"><p><strong>${esc(l.method)}:</strong> ${inline(p.method)}</p><p><strong>${esc(l.concepts)}:</strong> ${inline(p.academicConnections)}</p>${p.technicalNote ? paras(p.technicalNote) : ""}</div></details>
      ${p.projectSlugs.length ? `<ul class="thinking-links">${p.projectSlugs.map(slug => { const project = content.projects.find(item => item.slug === slug); return project ? `<li><a href="${home}projects/${esc(slug)}/">${esc(l.relatedProject)}: ${esc(project.title)}</a></li>` : ""; }).join("")}</ul>` : `<p class="note">${esc(l.conceptual)}</p>`}
    </article>`;
    document.title = pageTitle(content, a.navLabel);
    const sections = [
      section("capabilities", `<ul class="thinking-capabilities">${a.capabilities.map(c => `<li><h3>${esc(c.title)}</h3><p>${inline(c.description)}</p></li>`).join("")}</ul>`),
      section("foundations", `<div class="thinking-foundations">${a.foundations.map(f => `<div><p class="eyebrow">${esc(f.discipline)}</p><h3>${esc(f.title)}</h3>${paras(f.body)}</div>`).join("")}</div>${renderThinkingFigure(a, 0)}<p>${inline(a.sharedConcern)}</p>`),
      section("principles", a.foundations.map(f => `<div class="thinking-group"><h3>${esc(f.discipline)} · ${esc(f.title)}</h3><div class="thinking-principles">${a.principles.filter(p => p.discipline === f.id).map(principle).join("")}</div></div>`).join("")),
      section("connections", `<p>${inline(l.connectionsIntro)}</p><div class="thinking-connections">${a.connections.map(c => `<article id="${esc(c.id)}"><h3>${esc(c.title)}</h3><p>${inline(c.body)}</p>${principleLinks(a, c.principleIds, false)}</article>`).join("")}</div>`),
      section("workflow", `<p>${inline(a.workflow.intro)}</p>${renderThinkingFigure(a, 1)}<ol class="thinking-workflow">${a.workflow.steps.map(s => `<li id="step-${esc(s.id)}"><h3>${esc(s.title)}</h3><p>${inline(s.body)}</p></li>`).join("")}</ol><p>${inline(a.workflow.closing)}</p>`),
      section("in-practice", `<p class="thinking-boundary">${inline(a.disclosure)}</p><div class="thinking-bridges">${a.caseStudyBridges.map(b => `<article><p class="eyebrow">${esc(l.relatedProject)}</p><h3><a href="${home}projects/${esc(b.slug)}/">${esc(b.label)}</a></h3><p>${inline(b.body)}</p>${principleLinks(a, b.principleIds, false)}</article>`).join("")}</div>`),
      section("academic", `<p>${inline(l.academicIntro)}</p><table class="thinking-table"><thead><tr><th scope="col">${esc(l.academicArea)}</th><th scope="col">${esc(l.academicUse)}</th></tr></thead><tbody>${a.academicFoundations.rows.map(r => `<tr><th scope="row">${esc(r.title)}</th><td>${inline(r.translation)}</td></tr>`).join("")}</tbody></table><p class="note">${inline(l.academicDeferred)}</p>`),
      section("limitations", `${paras(a.closing)}<p class="thinking-boundary"><strong>${esc(l.evidenceBoundary)}:</strong> ${inline(a.disclosure)}</p><div class="actions"><a class="btn btn--primary" href="${home}#projects">${esc(a.projectsCtaLabel)}</a></div>`)
    ];
    return `<div class="wrap thinking-page"><nav class="crumbs" aria-label="Breadcrumb"><ol><li><a href="${home}">${esc(l.home)}</a></li><li><span aria-current="page">${esc(a.navLabel)}</span></li></ol></nav>
      <header class="cs-head thinking-hero" id="intro"><p class="eyebrow">${esc(a.hero.eyebrow)}</p><h1>${esc(a.hero.title)}</h1><p class="thinking-tagline">${inline(a.hero.tagline)}</p>${paras(a.hero.paragraphs)}</header>
      <div class="cs-layout"><nav class="toc" aria-label="${esc(l.onThisPage)}"><p class="toc__title">${esc(l.onThisPage)}</p><ol>${a.proposedPageSections.map(id => `<li><a href="#${esc(id)}">${esc(l[id])}</a></li>`).join("")}</ol></nav><div class="prose thinking-content">${sections.join("")}</div></div></div>`;
  }

  function renderPager(content, index) {
    const list = content.projects;
    const prev = list[(index - 1 + list.length) % list.length];
    const next = list[(index + 1) % list.length];
    const link = (p, dir, rel) => `<a class="${rel}" rel="${rel}" href="${home}projects/${esc(p.slug)}/">
        <span class="pager__dir">${dir}</span><span class="pager__title">${esc(p.title)}</span></a>`;
    return `<nav class="pager wrap" aria-label="Other projects">
      ${link(prev, "Previous project", "prev")}${link(next, "Next project", "next")}
    </nav>`;
  }

  // Decision-led case study: situation, a few decisions with their trade-offs,
  // the result, what comes next, then technical notes and the owner's own words.
  function renderStory(content, index) {
    const p = content.projects[index];
    const st = p.story;
    const s = statementsFor(content, p.slug);
    const base = `owner.projectStatements.${p.slug}`;
    document.title = pageTitle(content, p.title);

    const professional = ownerText(content, s.professionalContext, `${base}.professionalContext`);
    const contribution = ownerText(content, s.contribution, `${base}.contribution`);
    const learned = ownerText(content, s.learned, `${base}.learned`);
    const repo = p.repoUrl ? url(p.repoUrl) : null;
    const decisions = st.decisions.map((d, i) => {
      const visual = d.visual ? picture(d.visual, d.visual.alt, "figure") : "";
      return `<li class="decision${visual ? " decision--visual" : ""}">
          <div class="decision__text">
            <p class="decision__num" aria-hidden="true">${String(i + 1).padStart(2, "0")}</p>
            <h3>${inline(d.title)}</h3>
            ${paras(d.body)}
            ${d.term ? `<p class="decision__term">${inline(d.term)}</p>` : ""}
          </div>
          ${visual ? `<div class="decision__visual">${visual}</div>` : ""}
        </li>`;
    }).join("");
    const backlinks = renderAcademicBacklinks(content, p.slug);

    return `
    <div class="wrap story">
      <nav class="crumbs" aria-label="Breadcrumb">
        <ol>
          <li><a href="${home}">Home</a></li>
          <li><a href="${home}#projects">Projects</a></li>
          <li><span aria-current="page">${esc(p.title)}</span></li>
        </ol>
      </nav>
      <header class="story-head">
        <p class="eyebrow">${esc(p.title)}</p>
        <h1>${inline(st.headline)}</h1>
        <p class="story-head__lede">${inline(st.lede)}</p>
        <dl class="story-facts">${st.facts.map(f => `<div><dt>${esc(f.label)}</dt><dd>${inline(f.value)}</dd></div>`).join("")}</dl>
        <div class="actions">${repoLinks(p, false)}</div>
      </header>
      ${showcase(st.banner)}
      <article class="story-body">
        <section id="situation" aria-labelledby="situation-title">
          <h2 id="situation-title">The situation</h2>
          ${paras(st.situation)}
          ${professional ? `<div class="story-origin"><p class="story-origin__label">Where this comes from</p>${professional}</div>` : ""}
        </section>
        <section id="decisions" aria-labelledby="decisions-title">
          <h2 id="decisions-title">${esc(st.decisionsTitle)}</h2>
          <ol class="decisions">${decisions}</ol>
        </section>
        <section id="result" aria-labelledby="result-title">
          <h2 id="result-title">The result</h2>
          ${paras(st.result.text)}
          ${renderVisuals(p, st.result.visuals)}
        </section>
        <section id="next" aria-labelledby="next-title">
          <h2 id="next-title">What I’d do next</h2>
          ${paras(st.next)}
        </section>
        <section id="technical" aria-labelledby="technical-title">
          <h2 id="technical-title">Technical notes</h2>
          <ul class="tech-notes">${st.technical.notes.map(n => `<li>${inline(n)}</li>`).join("")}</ul>
          ${st.technical.visuals ? renderVisuals(p, st.technical.visuals) : ""}
          ${repo ? `<p><a class="btn" href="${repo}#readme">${esc(st.technical.linkLabel)}</a></p>` : ""}
        </section>
        <section id="role" aria-labelledby="role-title">
          <h2 id="role-title">My role</h2>
          ${contribution || ""}
          ${learned ? `<h3>What I learned</h3>${learned}` : ""}
        </section>
        ${backlinks ? `<section id="academic-connections" aria-labelledby="academic-connections-title">
          <h2 id="academic-connections-title">${esc(content.appliedThinking.labels.backlinks)}</h2>${backlinks}</section>` : ""}
      </article>
    </div>
    ${renderPager(content, index)}`;
  }

  function renderProject(content, slug) {
    const index = content.projects.findIndex((p) => p.slug === slug);
    if (index < 0) {
      document.title = pageTitle(content, "Project not found");
      return `<div class="wrap notice"><h1>Project not found</h1>
        <p>No project with the id <code>${esc(slug)}</code> is listed in <code>content/site.json</code>.</p>
        <p><a href="${home}#projects">Back to all projects</a></p></div>`;
    }

    return renderStory(content, index);
  }

  /* ---------- boot ---------- */

  function renderError(error) {
    // A generated snapshot remains readable offline or when enhancement fails.
    if (document.getElementById("main").dataset.prerendered === "true") return;
    const fromDisk = location.protocol === "file:";
    document.getElementById("main").innerHTML = `<div class="wrap"><div class="notice notice--error" role="alert">
      <h1>Content could not be loaded</h1>
      <p>This page reads <code>content/site.json</code>. ${fromDisk
        ? "Browsers block that when a page is opened directly from disk. From the repository root, run <code>python -m http.server 8000</code> and open <code>http://localhost:8000/</code>."
        : "Check that the file exists and is valid JSON."}</p>
      <p class="note">${esc(error.message)}</p>
    </div></div>`;
  }

  async function boot() {
    let content;
    try {
      const response = await fetch(`${home}content/site.json`, { cache: "no-cache" });
      if (!response.ok) throw new Error(`HTTP ${response.status} for content/site.json`);
      content = await response.json();
    } catch (error) {
      renderError(error);
      return;
    }

    document.getElementById("site-header").innerHTML = renderHeader(content);
    const banner = document.getElementById("draft-banner");
    banner.innerHTML = renderBanner(content);
    banner.hidden = !banner.innerHTML;
    const page = body.dataset.page;
    document.getElementById("main").innerHTML = page === "project"
      ? renderProject(content, body.dataset.project)
      : page === "applied-thinking" ? renderAppliedThinking(content) : renderHome(content);
    document.getElementById("site-footer").innerHTML = renderFooter(content);

    // Content arrives after load, so jump to a #fragment once it exists.
    if (location.hash) {
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target) target.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }

  boot();
})();

