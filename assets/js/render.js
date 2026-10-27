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
          <li><a href="${home}#about">About</a></li>
          <li><a href="${home}#contact">Contact</a></li>
        </ul>
      </nav>
    </div>`;
  }

  function renderBanner(content) {
    const items = pendingItems(content);
    if (!items.length) return "";
    const links = items.filter((i) => i.kind === "link").length;
    const fields = items.length - links;
    const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
    return `<div class="wrap">
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
      <p>${inline(content.site.footer)}</p>
      <p>${inline(content.site.privacy)}</p>
    </div>`;
  }

  function tags(list) {
    return `<ul class="tags">${list.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`;
  }

  function pageTitle(content, prefix) {
    const name = content.owner.name;
    const suffix = name ? `${name} · Portfolio` : "Portfolio (draft)";
    return prefix ? `${prefix} · ${suffix}` : suffix;
  }

  /* ---------- home page ---------- */

  function renderCard(project) {
    const c = project.card;
    return `<li>
      <article class="card" aria-labelledby="card-${esc(project.slug)}">
        <p class="chip">${esc(project.label)}</p>
        <h3 id="card-${esc(project.slug)}">${esc(project.title)}</h3>
        <dl class="facts">
          <dt>Problem</dt><dd>${inline(c.problem)}</dd>
          <dt>Method</dt><dd>${inline(c.method)}</dd>
          <dt>Recorded result</dt><dd>${inline(c.evidence)}</dd>
        </dl>
        ${tags(project.focus)}
        <div class="actions">
          <a class="btn btn--primary" href="${home}projects/${esc(project.slug)}/">Read case study<span class="visually-hidden">: ${esc(project.title)}</span></a>
          ${repoLinks(project, false)}
        </div>
      </article>
    </li>`;
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
      rows.push(["Resume", href ? `<a href="${href}">${esc(o.resume.label || "Resume")}</a>`
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

  function renderHome(content) {
    const o = content.owner;
    const name = o.name === null ? ph(content, "owner.name") : esc(o.name || "Portfolio");
    const intro = ownerText(content, o.intro, "owner.intro");
    const bio = ownerText(content, o.bio, "owner.bio");
    const skills = o.skills === false ? null
      : o.skills === null || o.skills === undefined ? phBlock(content, "owner.skills") : tags(o.skills);
    const tools = [...new Set(content.projects.flatMap((p) => p.focus))];

    document.title = pageTitle(content, "");

    return `
    <section class="hero wrap" aria-labelledby="intro-title">
      <p class="eyebrow">Portfolio</p>
      <h1 id="intro-title">${name}</h1>
      ${intro ? `<div class="hero__intro">${intro}</div>` : ""}
      <p class="hero__summary">${inline(content.site.summary)}</p>
    </section>

    <section class="section" id="projects" aria-labelledby="projects-title">
      <div class="wrap">
        <h2 id="projects-title">Featured projects</h2>
        <p class="section__lede">${inline(content.site.projectsIntro)}</p>
        <ul class="cards">${content.projects.map(renderCard).join("")}</ul>
      </div>
    </section>

    <section class="section" id="about" aria-labelledby="about-title">
      <div class="wrap">
        <h2 id="about-title">About</h2>
        <div class="about-grid">
          ${bio ? `<div><h3>Background</h3>${bio}</div>` : ""}
          ${skills ? `<div><h3>Skills</h3>${skills}</div>` : ""}
          <div>
            <h3>Methods and tools in these projects</h3>
            ${tags(tools)}
            <p class="note">Collected from the project pages above.</p>
          </div>
        </div>
      </div>
    </section>

    <section class="section" id="contact" aria-labelledby="contact-title">
      <div class="wrap">
        <h2 id="contact-title">Contact and resume</h2>
        ${renderContact(content)}
      </div>
    </section>`;
  }

  /* ---------- case study page ---------- */

  const STATUS = [
    [/^NOT VERIFIED/, "open"],
    [/^VERIFIED/, "ok"],
    [/^FAILED/, "bad"]
  ];

  function status(text) {
    const m = String(text).match(/^(NOT VERIFIED|VERIFIED|FAILED)\s*(.*)$/);
    if (!m) return esc(text);
    const kind = STATUS.find(([re]) => re.test(m[1]))[1];
    const note = m[2].replace(/^\((.*)\)$/, "$1");
    return `<span class="status status--${kind}">${m[1]}</span>${note ? `<span class="status__note">${esc(note)}</span>` : ""}`;
  }

  function renderValidation(content, project, statements) {
    const path = `owner.projectStatements.${project.slug}.ownerVerification`;
    const own = statements.ownerVerification;
    const v = project.validation;
    const lead = own === null || own === undefined
      ? `${phBlock(content, path)}<p>${inline(v.intro)}</p>`
      : `<p>${own === false ? "" : inline(own) + " "}${inline(v.intro)}</p>`;
    const rows = v.rows.map((r) => `<tr role="row">
        <th scope="row" role="rowheader">${inline(r.claim)}</th>
        <td role="cell" data-label="Command and result">${inline(r.evidence)}</td>
        <td role="cell" data-label="Status">${status(r.status)}</td>
      </tr>`).join("");
    return `${lead}
      <table class="evidence" role="table">
        <caption class="visually-hidden">Claims, evidence and verification status: ${esc(project.title)}</caption>
        <thead role="rowgroup"><tr role="row">
          <th scope="col" role="columnheader">Public-demo claim</th>
          <th scope="col" role="columnheader">Command and result</th>
          <th scope="col" role="columnheader">Status</th>
        </tr></thead>
        <tbody role="rowgroup">${rows}</tbody>
      </table>`;
  }

  function renderReproduce(content, project) {
    const r = project.reproduce;
    return `<div class="actions">${repoLinks(project, true)}</div>
      <p>${inline(r.summary)}</p>
      <p class="code-label">${esc(r.shell)}</p>
      <div class="code" role="region" tabindex="0" aria-label="Setup and check commands">
        <pre><code>${r.commands.map(esc).join("\n")}</code></pre>
      </div>
      <p class="note"><strong>Tested environment:</strong> ${inline(r.tested)}</p>
      <p class="note">${inline(content.site.runNote)}</p>`;
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

  function renderProject(content, slug) {
    const index = content.projects.findIndex((p) => p.slug === slug);
    if (index < 0) {
      document.title = pageTitle(content, "Project not found");
      return `<div class="wrap notice"><h1>Project not found</h1>
        <p>No project with the id <code>${esc(slug)}</code> is listed in <code>content/site.json</code>.</p>
        <p><a href="${home}#projects">Back to all projects</a></p></div>`;
    }

    const p = content.projects[index];
    const s = statementsFor(content, p.slug);
    const base = `owner.projectStatements.${p.slug}`;
    document.title = pageTitle(content, p.title);

    const sections = [
      ["problem", "The problem", paras(p.problem)],
      ["built", "What I built", paras(p.built)],
      ["approach", "Technical approach", paras(p.approach)],
      ["validation", "Validation and results", renderValidation(content, p, s)],
      ["limitations", "Tradeoffs and limitations", paras(p.limitations)],
      ["contribution", "My contribution", ownerText(content, s.contribution, `${base}.contribution`)],
      ["learned", "What I learned", ownerText(content, s.learned, `${base}.learned`)],
      ["reproduce", "Source and reproducibility", renderReproduce(content, p)],
      ["professional", "Related professional experience", ownerText(content, s.professionalContext, `${base}.professionalContext`)]
    ].filter(([, , html]) => html);

    return `
    <div class="wrap">
      <nav class="crumbs" aria-label="Breadcrumb">
        <ol>
          <li><a href="${home}">Home</a></li>
          <li><a href="${home}#projects">Projects</a></li>
          <li><span aria-current="page">${esc(p.title)}</span></li>
        </ol>
      </nav>
      <header class="cs-head">
        <p class="chip">${esc(p.label)}</p>
        <h1>${esc(p.title)}</h1>
        <p class="cs-type"><strong>Type:</strong> ${inline(p.type)}</p>
        ${tags(p.focus)}
        <div class="actions">${repoLinks(p, true)}</div>
      </header>
      <div class="cs-layout">
        <nav class="toc" aria-label="On this page">
          <p class="toc__title">On this page</p>
          <ol>${sections.map(([id, title]) => `<li><a href="#${id}">${title}</a></li>`).join("")}</ol>
        </nav>
        <article class="prose">
          ${sections.map(([id, title, html]) => `<section id="${id}" aria-labelledby="${id}-title">
            <h2 id="${id}-title">${title}</h2>${html}</section>`).join("")}
          <p class="independence"><strong>Independence statement:</strong> ${inline(p.independence)}</p>
        </article>
      </div>
    </div>
    ${renderPager(content, index)}`;
  }

  /* ---------- boot ---------- */

  function renderError(error) {
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
    document.getElementById("main").innerHTML = body.dataset.page === "project"
      ? renderProject(content, body.dataset.project)
      : renderHome(content);
    document.getElementById("site-footer").innerHTML = renderFooter(content);

    // Content arrives after load, so jump to a #fragment once it exists.
    if (location.hash) {
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target) target.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }

  boot();
})();
