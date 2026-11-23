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

  // Content numbers are used as numbers only when they are finite.
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  // Replaces {name} placeholders in content strings.
  const fill = (text, vars) => String(text).replace(/\{(\w+)\}/g, (all, key) => (key in vars ? vars[key] : all));

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
  function showcase(entry, attrs) {
    if (!entry) return "";
    const image = picture(entry, entry.alt, "figure");
    if (!image) return "";
    const href = entry.link ? url(entry.link.href) : null;
    const link = href ? ` <a href="${href}">${esc(entry.link.label)}</a>` : "";
    return `<figure class="showcase"${attrs || ""}>
      ${entry.title ? `<p class="showcase__title">${inline(entry.title)}</p>` : ""}
      ${image}
      ${entry.caption || link ? `<figcaption>${inline(entry.caption || "")}${link}</figcaption>` : ""}
    </figure>`;
  }

  /* ---------- unset fields ---------- */

  // The public site never shows placeholders: a field that is null (not set
  // yet) is hidden exactly like false. Any other value is shown.
  function hideUnset(node) {
    if (node === null) return false;
    if (Array.isArray(node)) return node.map(hideUnset);
    if (node && typeof node === "object") {
      return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, hideUnset(value)]));
    }
    return node;
  }

  function statementsFor(content, slug) {
    return (content.owner.projectStatements || {})[slug] || {};
  }

  /* ---------- placeholder labels (unreachable once unset fields are hidden) ---------- */

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

  // Not set (null, false or missing) -> omitted (returns null), otherwise paragraphs.
  function ownerText(content, value, path) {
    if (value === false || value === null || value === undefined) return null;
    return paras(value);
  }

  const LOCK = '<svg class="icon" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><path fill="currentColor" d="M5 7V5a3 3 0 1 1 6 0v2h.5A1.5 1.5 0 0 1 13 8.5v5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 13.5v-5A1.5 1.5 0 0 1 4.5 7H5Zm1.5 0h3V5a1.5 1.5 0 1 0-3 0v2Z"/></svg>';

  function disabledLink(label, note) {
    return `<a class="btn btn--off" role="link" aria-disabled="true">${LOCK}<span>${esc(label)}</span><span class="btn__note">${esc(note)}</span></a>`;
  }

  function repoLinks(project, withReadme) {
    const href = project.repoUrl ? url(project.repoUrl) : null;
    if (!href) return "";
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
          <li><a href="${home}#experience">Experience</a></li>
          <li><a href="${home}#projects">Case Studies</a></li>
          ${content.appliedThinking ? `<li><a href="${url(content.appliedThinking.route)}"${body.dataset.page === "applied-thinking" ? ' aria-current="page"' : ""}>${esc(content.appliedThinking.navLabel)}</a></li>` : ""}
          <li><a href="${home}#about">About</a></li>
          <li><a href="${home}#contact">Contact</a></li>
        </ul>
      </nav>
    </div>`;
  }

  // The only banner left is for Applied Thinking copy that still awaits approval;
  // unset owner fields are simply hidden, so they no longer raise a banner.
  function renderBanner(content) {
    const a = content.appliedThinking;
    const review = a && (a.draftStatus !== "approved" || Object.values(a.review || {}).some(value => value !== "approved"));
    return review ? `<div class="wrap"><p><strong>${esc(a.labels.draftTitle)}.</strong> ${esc(a.labels.draftBody)}</p></div>` : "";
  }


  function renderFooter(content) {
    const pr = content.site.process;
    const processLink = pr && body.dataset.page !== "process" ? ` <a href="${url(pr.route)}">${esc(pr.linkLabel)}</a>` : "";
    return `<div class="wrap footer__inner">
      <p>${inline(content.site.disclosure || content.site.footer)}${processLink}</p>
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
        <h3 id="card-${esc(project.slug)}">${esc(c.title || project.title)}</h3>
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
    // The name appears once, in the header; the hero keeps its own eyebrow line.
    const kicker = inline(h.eyebrow);
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
      ${showcase(h.visual, h.decisionLab ? " data-decision-lab" : "")}
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

    ${renderExperience(content)}

    <section class="section" id="projects" aria-labelledby="projects-title">
      <div class="wrap">
        <p class="eyebrow">${esc(w.eyebrow)}</p>
        <h2 id="projects-title">${esc(w.title)}</h2>
        <p class="section__lede">${inline(w.lede)}</p>
        <ul class="cards">${content.projects.map(renderCard).join("")}</ul>
      </div>
    </section>

    ${renderHowIWork(content)}

    <section class="section" id="about" aria-labelledby="about-title">
      <div class="wrap about-compact">
        <h2 id="about-title">${esc(about ? about.title : "About")}</h2>
        ${aboutText}
        ${skills ? `<h3>Skills</h3>${skills}` : ""}
        <h3>${esc(about ? about.toolsLabel : "Methods and tools in these projects")}</h3>
        ${tags(tools)}
        ${about && Array.isArray(about.aiTools) && about.aiTools.length ? `<h3>${esc(about.aiToolsLabel || "AI tools")}</h3>${tags(about.aiTools)}` : ""}
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

  function renderThinkingFigure(a, name) {
    const d = (a.diagrams || []).find(item => String(item.src).includes(name));
    const image = d && picture(d, d.alt, "figure");
    return image ? `<figure class="technical-figure thinking-figure">${image}<figcaption>${inline(d.caption)}</figcaption></figure>` : "";
  }

  // A course row may name a principle; "{principle}" in its text becomes a link to that card.
  function courseText(a, row) {
    const p = row.principle && a.principles.find(item => item.id === row.principle);
    const link = p ? `<a href="#${esc(p.id)}">${esc(p.title)}</a>` : "";
    return inline(row.translation).replace("{principle}", link);
  }

  // Project x principle overview, built only from mappings the page already states:
  // a principle's projectSlugs (its example comes from that project) and each
  // case study's bridge (a conceptual connection).
  function renderPrincipleMatrix(content) {
    const a = content.appliedThinking, l = a.labels;
    if (!l.matrixTitle) return "";
    const projects = content.projects;
    const bridged = (slug, id) => (a.caseStudyBridges.find((b) => b.slug === slug) || { principleIds: [] }).principleIds.includes(id);
    const head = projects.map((p) => `<th scope="col"><a href="${home}projects/${esc(p.slug)}/">${esc((p.card && p.card.kicker) || p.title)}</a></th>`).join("");
    const rows = a.principles.map((pr) => {
      const cells = projects.map((p) => {
        const kind = pr.projectSlugs.includes(p.slug) ? "example" : bridged(p.slug, pr.id) ? "connects" : "none";
        const text = kind === "example" ? l.matrixExample : kind === "connects" ? l.matrixConnects : l.matrixNone;
        const mark = kind === "example" ? "●" : kind === "connects" ? "○" : "";
        return `<td class="matrix__cell matrix__cell--${kind}" data-project="${esc((p.card && p.card.kicker) || p.title)}"><span class="matrix__mark" aria-hidden="true">${mark}</span><span class="matrix__text">${esc(text)}</span></td>`;
      }).join("");
      return `<tr><th scope="row"><a href="#${esc(pr.id)}"><span class="matrix__code">${esc(pr.code)}</span> ${esc(pr.title)}</a>${pr.projectSlugs.length ? "" : `<small>${esc(l.conceptual)}</small>`}</th>${cells}</tr>`;
    }).join("");
    return `<div class="matrix-block"><h3>${esc(l.matrixTitle)}</h3><p>${inline(l.matrixIntro)}</p>
      <div class="matrix-wrap"><table class="matrix"><thead><tr><th scope="col">${esc(l.matrixPrinciple)}</th>${head}</tr></thead><tbody>${rows}</tbody></table></div>
      <ul class="matrix-key"><li><span aria-hidden="true">●</span> ${esc(l.matrixExample)}</li><li><span aria-hidden="true">○</span> ${esc(l.matrixConnects)}</li></ul></div>`;
  }

  // Applied Thinking: the eight principles lead as tile cards, grouped by
  // discipline; the longer explanation, method and coursework sit in <details>.
  function renderAppliedThinking(content) {
    const a = content.appliedThinking;
    if (!a) throw new Error("Applied Thinking content is missing");
    const l = a.labels;
    const section = (id, html) => `<section id="${id}" class="thinking-section" aria-labelledby="${id}-title"><h2 id="${id}-title">${esc(l[id])}</h2>${html}</section>`;
    const projectLinks = p => p.projectSlugs.length
      ? `<ul class="thinking-links">${p.projectSlugs.map(slug => { const project = content.projects.find(item => item.slug === slug); return project ? `<li><a href="${home}projects/${esc(slug)}/">${esc(l.relatedProject)}: ${esc(project.title)}<span aria-hidden="true">&nbsp;→</span></a></li>` : ""; }).join("")}</ul>`
      : `<p class="note">${esc(l.conceptual)}</p>`;
    const principle = p => `<li class="principle-card" id="${esc(p.id)}">
      <article aria-labelledby="${esc(p.id)}-title">
        ${p.visual ? `<div class="principle-card__visual">${picture(p.visual, p.visual.alt, "figure")}</div>` : ""}
        <div class="principle-card__body">
          <p class="thinking-number">${esc(p.code)}</p>
          <h4 id="${esc(p.id)}-title">${esc(p.title)}</h4>
          <p class="thinking-question">${inline(p.question)}</p>
          <p class="thinking-caveat"><strong>${esc(l.caveat)}:</strong> ${inline(p.limitation)}</p>
          <details><summary>${esc(l.approach)}</summary><div class="thinking-detail">${paras(p.explanation)}<p><strong>${esc(l.method)}:</strong> ${inline(p.method)}</p><p><strong>${esc(l.concepts)}:</strong> ${inline(p.academicConnections)}</p>${p.technicalNote ? paras(p.technicalNote) : ""}</div></details>
          ${projectLinks(p)}
        </div>
      </article>
    </li>`;
    document.title = pageTitle(content, a.navLabel);
    const groups = a.foundations.map(f => `<div class="thinking-group" id="group-${esc(f.id)}">
        <div class="thinking-group__intro"><p class="eyebrow">${esc(f.discipline)}</p><h3>${esc(f.title)}</h3>${paras(f.body)}</div>
        <ul class="principle-cards">${a.principles.filter(p => p.discipline === f.id).map(principle).join("")}</ul>
      </div>`).join("");
    const sections = {
      principles: `${l.principlesIntro ? `<p class="section__lede">${inline(l.principlesIntro)}</p>` : ""}${groups}<p class="thinking-shared">${inline(a.sharedConcern)}</p>`,
      "in-practice": `<p class="thinking-boundary">${inline(a.disclosure)}</p>${renderPrincipleMatrix(content)}<ul class="thinking-cards">${a.caseStudyBridges.map(b => `<li><article><p class="eyebrow">${esc(l.relatedProject)}</p><h3><a href="${home}projects/${esc(b.slug)}/">${esc(b.label)}</a></h3><p>${inline(b.body)}</p>${principleLinks(a, b.principleIds, false)}</article></li>`).join("")}</ul>`,
      workflow: `<p>${inline(a.workflow.intro)}</p>${renderThinkingFigure(a, "thinking-cycle")}<ol class="thinking-workflow">${a.workflow.steps.map(s => `<li id="step-${esc(s.id)}"><h3>${esc(s.title)}</h3><p>${inline(s.body)}</p></li>`).join("")}</ol><p>${inline(a.workflow.closing)}</p>`,
      connections: `<p>${inline(l.connectionsIntro)}</p><ul class="thinking-cards">${a.connections.map(c => `<li><article id="${esc(c.id)}"><h3>${esc(c.title)}</h3><p>${inline(c.body)}</p>${principleLinks(a, c.principleIds, false)}</article></li>`).join("")}</ul>`,
      academic: `<p>${inline(l.academicIntro)}</p><table class="thinking-table"><thead><tr><th scope="col">${esc(l.academicArea)}</th><th scope="col">${esc(l.academicUse)}</th></tr></thead><tbody>${a.academicFoundations.rows.map(r => `<tr><th scope="row">${esc(r.title)}</th><td>${courseText(a, r)}</td></tr>`).join("")}</tbody></table><p class="note">${inline(l.academicDeferred)}</p>`,
      limitations: `${paras(a.closing)}<p class="thinking-boundary"><strong>${esc(l.evidenceBoundary)}:</strong> ${inline(a.disclosure)}</p><div class="actions"><a class="btn btn--primary" href="${home}#projects">${esc(a.projectsCtaLabel)}</a></div>`
    };
    const order = a.proposedPageSections.filter(id => sections[id]);
    return `<div class="wrap thinking-page"><nav class="crumbs" aria-label="Breadcrumb"><ol><li><a href="${home}">${esc(l.home)}</a></li><li><span aria-current="page">${esc(a.navLabel)}</span></li></ol></nav>
      <header class="thinking-hero" id="intro"><p class="eyebrow">${esc(a.hero.eyebrow)}</p><h1>${esc(a.hero.title)}</h1><p class="thinking-tagline">${inline(a.hero.tagline)}</p>${paras(a.hero.paragraphs)}${showcase(a.hero.visual)}
        <nav class="jump-links" aria-label="${esc(l.onThisPage)}"><ul>${order.map(id => `<li><a href="#${esc(id)}">${esc(l[id])}</a></li>`).join("")}</ul></nav>
      </header>
      <div class="thinking-content">${order.map(id => section(id, sections[id])).join("")}</div></div>`;
  }

  // "How these were built": who decided what, the workflow, checks and boundaries.
  function renderProcess(content) {
    const pr = content.site.process;
    if (!pr) throw new Error("Process content is missing");
    document.title = pageTitle(content, pr.navLabel);
    const list = items => `<ul>${items.map(i => `<li>${inline(i)}</li>`).join("")}</ul>`;
    const cta = pr.cta.href.startsWith("#") ? esc(home + pr.cta.href) : url(pr.cta.href);
    return `<div class="wrap process">
      <nav class="crumbs" aria-label="Breadcrumb"><ol><li><a href="${home}">Home</a></li><li><span aria-current="page">${esc(pr.navLabel)}</span></li></ol></nav>
      <header class="story-head"><p class="eyebrow">${esc(pr.eyebrow)}</p><h1>${esc(pr.title)}</h1><p class="story-head__lede">${inline(pr.lede)}</p></header>
      <section id="who" aria-labelledby="who-title"><h2 id="who-title">${esc(pr.split.title)}</h2>
        <div class="process-split">
          <div class="process-split__col process-split__col--owner"><h3>${esc(pr.split.owner.label)}</h3>${list(pr.split.owner.items)}</div>
          <div class="process-split__col process-split__col--ai"><h3>${esc(pr.split.ai.label)}</h3>${list(pr.split.ai.items)}</div>
        </div>
      </section>
      <section id="workflow" aria-labelledby="workflow-title"><h2 id="workflow-title">${esc(pr.steps.title)}</h2>
        <ol class="process-steps">${pr.steps.items.map(s => `<li><h3>${esc(s.title)}</h3><p>${inline(s.body)}</p></li>`).join("")}</ol>
      </section>
      <section id="boundaries" aria-labelledby="boundaries-title"><h2 id="boundaries-title">${esc(pr.boundaries.title)}</h2>${list(pr.boundaries.items)}</section>
      <section id="this-site" aria-labelledby="this-site-title"><h2 id="this-site-title">${esc(pr.site.title)}</h2>${paras(pr.site.paragraphs)}</section>
      <section id="reading" aria-labelledby="reading-title"><h2 id="reading-title">${esc(pr.reading.title)}</h2>${list(pr.reading.items)}
        ${cta ? `<div class="actions"><a class="btn btn--primary" href="${cta}">${esc(pr.cta.label)}</a></div>` : ""}
      </section>
    </div>`;
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

  // "Follow one order": every step is a card with the full ledger, so the page reads
  // without JavaScript; enhanceWalkthrough() turns it into a one-step-at-a-time stepper.
  const count = (v) => String(num(v));
  function renderWalkthrough(w) {
    const L = w.labels, total = w.steps.length;
    const steps = w.steps.map((step, i) => {
      const rows = w.rows.map((r) => {
        const now = num(step.values[r.id]);
        const was = i === 0 ? num(w.start[r.id]) : num(w.steps[i - 1].values[r.id]);
        const kind = r.kind === "key" || r.kind === "mistake" ? ` walk__row--${r.kind}` : "";
        return `<div class="walk__row${kind}${now !== was ? " is-changed" : ""}"><dt>${esc(r.label)}<small>${esc(r.owner)}</small></dt><dd><b>${count(now)}</b>${now !== was ? `<small>${esc(fill(L.was, { n: count(was) }))}</small>` : ""}</dd></div>`;
      }).join("");
      const records = (step.records || []).map((id) => `<code>${esc(id)}</code>`).join(" ");
      return `<li class="walk__step" id="walk-step-${i + 1}">
        <p class="walk__meta"><span class="walk__num">${esc(fill(L.step, { n: i + 1, total }))}</span><time datetime="${esc(step.date)}">${esc(step.dateLabel)}</time><span class="walk__owner">${esc(step.owner)}</span>${step.hypothetical ? `<span class="walk__badge walk__badge--hypothetical">${esc(L.hypothetical)}</span>` : ""}${step.badge ? `<span class="walk__badge">${esc(step.badge)}</span>` : ""}</p>
        <h3>${esc(step.title)}</h3>
        <p>${inline(step.body)}</p>
        ${records ? `<p class="walk__records">${records}</p>` : ""}
        <dl class="walk__ledger">${rows}</dl>
      </li>`;
    }).join("");
    return `<section id="walkthrough" class="walk" data-walkthrough aria-labelledby="walkthrough-title">
          <h2 id="walkthrough-title">${esc(w.title)}</h2>
          <p>${inline(w.lede)}</p>
          <ol class="walk__steps">${steps}</ol>
          <p class="walk__takeaway">${inline(w.takeaway)}</p>
          <p class="note">${inline(w.source)}</p>
        </section>`;
  }

  // "On this page" row for the long case-study pages: plain anchors, so it works
  // without JavaScript; enhanceStoryNav() adds the current-section marker.
  function renderStoryNav(content, present) {
    const n = content.site.storyNav;
    if (!n || !Array.isArray(n.items)) return "";
    const items = n.items.filter((item) => present.has(item.id));
    return `<nav class="story-nav" aria-label="${esc(n.label)}"><ul>${items.map((item) => `<li><a href="#${esc(item.id)}">${esc(item.label)}</a></li>`).join("")}</ul></nav>`;
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
          <li><a href="${home}#projects">Case Studies</a></li>
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
      ${renderStoryNav(content, new Set(["situation", "decisions", "result", "next", "technical", "role", ...(st.walkthrough ? ["walkthrough"] : []), ...(backlinks ? ["academic-connections"] : [])]))}
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
        ${st.walkthrough ? renderWalkthrough(st.walkthrough) : ""}
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
          ${content.site.process ? `<p><a href="${url(content.site.process.route)}">${esc(content.site.process.linkLabel)}<span aria-hidden="true">&nbsp;→</span></a></p>` : ""}
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

  /* ---------- enhancements (browser only; the static pages read fine without them) ---------- */

  // Decision sheet: the visitor moves the shortage cost and sees which plan is
  // cheaper. Each plan's cost is a straight line, container charge + shortage
  // cost x multiplier, so four numbers per plan in content/site.json are
  // enough; scripts/verify_decision_lab.py re-solves the model to confirm them.
  const fmt = (n) => Math.round(n).toLocaleString("en-US");
  const times = (x) => String(Number(x.toFixed(2)));
  const oneDecimal = (x) => String(Number(x.toFixed(1)));

  function tippingPoint(lab) {
    const [a, b] = lab.plans;
    return (num(b.fixed) - num(a.fixed)) / (num(a.shortage) - num(b.shortage));
  }

  // Usable only with two plans where the second costs more to set up and saves on shortages.
  function decisionLabValid(lab) {
    if (!lab || !Array.isArray(lab.plans) || lab.plans.length !== 2 || !lab.labels) return false;
    const [a, b] = lab.plans;
    return num(b.fixed) > num(a.fixed) && num(a.shortage) > num(b.shortage) && num(lab.max) > num(lab.min) && num(lab.step) > 0;
  }

  function decisionView(lab, m) {
    const L = lab.labels;
    const costs = lab.plans.map((p) => ({ plan: p, shortage: num(p.shortage) * m, total: num(p.fixed) + num(p.shortage) * m }));
    const gap = Math.abs(costs[0].total - costs[1].total);
    const tie = Math.round(gap) === 0;
    const best = tie ? -1 : costs[0].total < costs[1].total ? 0 : 1;
    const total = num(lab.totalUnits);
    const cards = costs.map((c, i) => {
      const p = c.plan, other = lab.plans[1 - i];
      const status = best === i ? L.best : tie ? "" : fill(L.worse, { n: fmt(gap), plan: other.name });
      const boxes = lab.containers.map((k) => {
        const open = p.opened.includes(k.id);
        return `<li class="dlab__box dlab__box--${esc(k.id)}${open ? " is-open" : ""}"><span>${esc(k.label)}</span><small>${esc(open ? L.opened : L.notOpened)}</small></li>`;
      }).join("");
      return `<div class="dlab__plan${best === i ? " is-best" : ""}">
        <p class="dlab__tag">${esc(p.name)}</p>
        <p class="dlab__title">${esc(p.title)}</p>
        <p class="dlab__trait">${esc(p.trait)}</p>
        <ul class="dlab__boxes">${boxes}</ul>
        <p class="dlab__total"><span>${esc(L.total)}</span><b>${fmt(c.total)}</b></p>
        <p class="dlab__break">${esc(fill(L.breakdown, { fixed: fmt(num(p.fixed)), shortage: fmt(c.shortage) }))}</p>
        <div class="dlab__bar" role="img" aria-label="${esc(fill(L.shipped, { n: num(p.shipped) }) + ", " + fill(L.short, { n: num(p.short) }) + " " + fill(L.ofTotal, { n: total }))}"><span class="dlab__shipped" style="flex-grow:${num(p.shipped)}"></span><span class="dlab__short" style="flex-grow:${num(p.short)}"></span></div>
        <p class="dlab__units"><span>${esc(fill(L.shipped, { n: num(p.shipped) }))}</span><span>${esc(fill(L.short, { n: num(p.short) }))} ${esc(fill(L.ofTotal, { n: total }))}</span></p>
        <p class="dlab__status">${status ? esc(status) : "&nbsp;"}</p>
      </div>`;
    }).join("");
    const x = times(m);
    const verdict = tie ? fill(L.resultTie, { x }) : fill(L.resultBest, { x, plan: lab.plans[best].name, n: fmt(gap) });
    const text = `${verdict} ${fill(L.tipping, { t: oneDecimal(tippingPoint(lab)) })}`;
    return { html: `<div class="dlab__plans">${cards}</div><p class="dlab__result">${esc(text)}</p>`, text };
  }

  function enhanceDecisionLab(content) {
    const lab = content.site && content.site.hero && content.site.hero.decisionLab;
    if (!decisionLabValid(lab) || typeof document.querySelector !== "function" || typeof document.createElement !== "function") return;
    const figure = document.querySelector("[data-decision-lab]");
    const picture = figure && figure.querySelector("picture");
    if (!picture) return;
    const min = num(lab.min), max = num(lab.max), step = num(lab.step);
    const tip = Number(Math.min(max, Math.max(min, Math.round(tippingPoint(lab) / step) * step)).toFixed(4));
    const tipText = oneDecimal(tippingPoint(lab));
    const presets = lab.presets.map((p, i) => {
      const value = p.value === "tipping" ? tip : num(p.value);
      return `<button type="button" class="btn dlab__preset" data-dlab-preset="${i}" data-value="${esc(value)}">${esc(fill(p.label, { t: tipText }))}</button>`;
    }).join("");
    const lenses = lab.lenses.map((l) => `<li class="dlab__lens dlab__lens--${esc(l.tone)}"><b>${esc(l.label)}</b><span>${esc(l.text)}</span></li>`).join("");
    const holder = document.createElement("div");
    holder.className = "dlab";
    holder.innerHTML = `<div class="dlab__head"><p class="dlab__kicker">${esc(lab.kicker)}</p><p class="dlab__q">${esc(lab.question)}</p><p class="dlab__lede">${esc(lab.lede)}</p></div>
      <div class="dlab__control">
        <div class="dlab__label"><label for="dlab-range">${esc(lab.sliderLabel)}</label><output class="dlab__value" for="dlab-range" data-dlab-out></output></div>
        <input id="dlab-range" type="range" min="${min}" max="${max}" step="${step}" value="${num(lab.start)}" data-dlab-range>
        <div class="dlab__marks">${lab.marks.map((k) => `<span>${esc(k.label)}</span>`).join("")}</div>
        <div class="dlab__presets">${presets}</div>
      </div>
      <div class="dlab__view" data-dlab-view></div>
      <div class="dlab__lenses"><p class="dlab__lenses-title">${esc(lab.labels.lensesTitle)}</p><ul>${lenses}</ul></div>
      <p class="dlab__source">${esc(lab.source)}</p>`;
    const range = holder.querySelector("[data-dlab-range]");
    const out = holder.querySelector("[data-dlab-out]");
    const view = holder.querySelector("[data-dlab-view]");
    function update(m) {
      const result = decisionView(lab, m);
      const label = fill(lab.valueText, { x: times(m) });
      out.textContent = label;
      view.innerHTML = result.html;
      range.setAttribute("aria-valuetext", `${label}. ${result.text}`);
    }
    range.addEventListener("input", () => update(Math.min(max, Math.max(min, num(range.value)))));
    holder.querySelectorAll("[data-dlab-preset]").forEach((button) => button.addEventListener("click", () => {
      range.value = button.dataset.value;
      update(num(button.dataset.value));
    }));
    update(num(lab.start));
    if (picture.replaceWith) picture.replaceWith(holder);
    else picture.parentNode.replaceChild(holder, picture);
  }

  // Case studies: show the order walk-through one step at a time.
  function enhanceWalkthrough(content) {
    if (typeof document.querySelector !== "function" || typeof document.createElement !== "function") return;
    const root = document.querySelector("[data-walkthrough]");
    const project = (content.projects || []).find((p) => p.slug === body.dataset.project);
    const w = project && project.story && project.story.walkthrough;
    if (!root || !w) return;
    const steps = Array.from(root.querySelectorAll(".walk__step"));
    if (steps.length < 2) return;
    const L = w.labels;
    const bar = document.createElement("div");
    bar.className = "walk__controls";
    bar.innerHTML = `<button type="button" class="btn walk__btn" data-walk="-1">${esc(L.prev)}</button>
      <ol class="walk__dots" aria-label="${esc(L.stepsLabel)}">${steps.map((_, i) => `<li><button type="button" class="walk__dot" data-walk-to="${i}" aria-label="${esc(fill(L.step, { n: i + 1, total: steps.length }))}">${i + 1}</button></li>`).join("")}</ol>
      <button type="button" class="btn walk__btn" data-walk="1">${esc(L.next)}</button>`;
    const list = root.querySelector(".walk__steps");
    root.insertBefore(bar, list);
    root.classList.add("is-stepper");
    const dots = Array.from(bar.querySelectorAll("[data-walk-to]"));
    const prev = bar.querySelector('[data-walk="-1"]');
    const next = bar.querySelector('[data-walk="1"]');
    let at = 0;
    function show(i) {
      at = Math.min(steps.length - 1, Math.max(0, i));
      steps.forEach((step, k) => step.classList.toggle("is-current", k === at));
      dots.forEach((dot, k) => { if (k === at) dot.setAttribute("aria-current", "step"); else dot.removeAttribute("aria-current"); });
      prev.disabled = at === 0;
      next.disabled = at === steps.length - 1;
    }
    prev.addEventListener("click", () => show(at - 1));
    next.addEventListener("click", () => show(at + 1));
    dots.forEach((dot) => dot.addEventListener("click", () => show(num(dot.dataset.walkTo))));
    show(0);
  }

  // Case studies: mark the section being read in the "On this page" row.
  function enhanceStoryNav() {
    if (typeof document.querySelector !== "function") return;
    const nav = document.querySelector(".story-nav");
    if (!nav || typeof window === "undefined" || typeof window.addEventListener !== "function") return;
    const list = nav.querySelector("ul");
    const links = Array.from(nav.querySelectorAll("a"));
    const entries = links.map((link) => ({ link, section: document.getElementById(decodeURIComponent(link.getAttribute("href").slice(1))) })).filter((e) => e.section);
    if (!entries.length) return;
    let current = null, queued = false;
    function mark() {
      queued = false;
      const probe = nav.getBoundingClientRect().bottom + 48;
      let active = null;
      for (const e of entries) if (e.section.getBoundingClientRect().top <= probe) active = e;
      const root = document.documentElement;
      if (root && window.innerHeight + window.scrollY >= root.scrollHeight - 2) active = entries[entries.length - 1];
      if (active === current) return;
      if (current) current.link.removeAttribute("aria-current");
      current = active;
      if (!current) return;
      current.link.setAttribute("aria-current", "true");
      if (list && list.scrollTo && list.scrollWidth > list.clientWidth) list.scrollTo({ left: current.link.offsetLeft - (list.clientWidth - current.link.offsetWidth) / 2 });
    }
    window.addEventListener("scroll", () => { if (!queued) { queued = true; window.requestAnimationFrame(mark); } }, { passive: true });
    window.addEventListener("resize", mark);
    mark();
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
      content = hideUnset(await response.json());
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
      : page === "applied-thinking" ? renderAppliedThinking(content)
      : page === "process" ? renderProcess(content) : renderHome(content);
    document.getElementById("site-footer").innerHTML = renderFooter(content);
    enhanceDecisionLab(content);
    enhanceWalkthrough(content);
    enhanceStoryNav();

    // Content arrives after load, so jump to a #fragment once it exists.
    if (location.hash) {
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target) target.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }

  boot();
})();

