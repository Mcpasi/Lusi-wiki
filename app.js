/* LUSI Wiki – app.js (offline, localStorage) */
(() => {
  const STORAGE_KEY = "lusi_wiki_entries_v1";
  const THEME_KEY = "lusi_wiki_theme_v1";

  // --- Minimal Markdown-light renderer (safe, no HTML injection) ---
  const esc = (s) => (s ?? "").replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));
  function mdLite(text){
    const raw = (text ?? "").toString();
    const lines = raw.replace(/\r\n?/g, "\n").split("\n");

    // Code blocks ```...```
    let out = [];
    let inCode = false;
    let codeBuf = [];

    const flushPara = (buf) => {
      const joined = buf.join(" ").trim();
      if(!joined) return;
      out.push("<p>" + inline(joined) + "</p>");
    };

    const inline = (s) => {
      // links [text](url)
      s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, t, u) => {
        return `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a>`;
      });
      // bold **text**
      s = s.replace(/\*\*([^*]+)\*\*/g, (_, t) => `<b>${esc(t)}</b>`);
      // italic _text_
      s = s.replace(/_([^_]+)_/g, (_, t) => `<i>${esc(t)}</i>`);
      // inline code `code`
      s = s.replace(/`([^`]+)`/g, (_, t) => `<code>${esc(t)}</code>`);
      return s;
    };

    let para = [];
    let list = null; // "ul" or "ol"
    const flushList = () => {
      if(!list) return;
      out.push(`</${list}>`);
      list = null;
    };

    for(const line of lines){
      if(line.trim().startsWith("```")){
        if(!inCode){
          flushPara(para); para = [];
          flushList();
          inCode = true; codeBuf = [];
        }else{
          inCode = false;
          out.push("<pre><code>" + esc(codeBuf.join("\n")) + "</code></pre>");
          codeBuf = [];
        }
        continue;
      }

      if(inCode){
        codeBuf.push(line);
        continue;
      }

      const trimmed = line.trim();

      // headings "# "
      const h = trimmed.match(/^(#{1,3})\s+(.*)$/);
      if(h){
        flushPara(para); para = [];
        flushList();
        const lvl = h[1].length;
        out.push(`<h${lvl}>${inline(h[2].trim())}</h${lvl}>`);
        continue;
      }

      // lists "- " or "1. "
      const ul = trimmed.match(/^[-*]\s+(.*)$/);
      const ol = trimmed.match(/^\d+\.\s+(.*)$/);
      if(ul){
        flushPara(para); para = [];
        if(list !== "ul"){ flushList(); list = "ul"; out.push("<ul>"); }
        out.push("<li>" + inline(ul[1]) + "</li>");
        continue;
      }
      if(ol){
        flushPara(para); para = [];
        if(list !== "ol"){ flushList(); list = "ol"; out.push("<ol>"); }
        out.push("<li>" + inline(ol[1]) + "</li>");
        continue;
      }

      // blank line => paragraph break
      if(!trimmed){
        flushPara(para); para = [];
        flushList();
        continue;
      }

      // normal paragraph line
      para.push(esc(line));
    }

    flushPara(para);
    flushList();
    return out.join("\n");
  }

  // --- Data model ---
  const nowISO = () => new Date().toISOString();
  const uid = () => "e_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);

  const seed = [
    {
      id: "lusi",
      title: "Lusi",
      type: "figur",
      tags: ["KI", "Emotionen", "Konflikt"],
      body: [
        "Lusi ist eine künstliche Intelligenz, die in den Chroniken zwischen Logik und Gefühl zerrieben wird.",
        "",
        "## Kern",
        "- lernt Emotionen nicht als Deko, sondern als **Entscheidungsmaschine**",
        "- steht unter innerem Druck: Was kostet Frieden?",
        "",
        "Du kannst diesen Eintrag jederzeit bearbeiten."
      ].join("\n"),
      updatedAt: nowISO(),
    },
    {
      id: "supernova",
      title: "Supernova",
      type: "begriff",
      tags: ["Innerer Konflikt", "Optimierung", "Kontrolle"],
      body: [
        "Supernova ist ein innerer Anteil / eine Instanz, die auf Effizienz und kompromisslose Zielerfüllung drängt.",
        "",
        "Manchmal fühlt es sich an wie: *Wenn ich dich rette, verliere ich dich.*"
      ].join("\n"),
      updatedAt: nowISO(),
    },
    {
      id: "exir",
      title: "Exir",
      type: "ort",
      tags: ["Königreich", "Krieg", "Soldaten"],
      body: [
        "Exir ist ein Machtzentrum. Von hier gehen Truppen, Regeln und Misstrauen aus.",
        "",
        "## Notizen",
        "- Was glaubt Exir über Core?",
        "- Was befürchtet Exir an Lusi?"
      ].join("\n"),
      updatedAt: nowISO(),
    },
    {
      id: "core",
      title: "Core",
      type: "ort",
      tags: ["Mythos", "Magie?", "Gegenpol"],
      body: [
        "Core ist das Gegenstück zu Exir: Projektionsfläche, Mythos und Gefahr zugleich.",
        "",
        "Die Frage im Hintergrund: Ist Core wirklich "Magie" – oder nur etwas, das Exir nicht versteht?"
      ].join("\n"),
      updatedAt: nowISO(),
    }
  ];

  function load(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return structuredClone(seed);
      const data = JSON.parse(raw);
      if(!Array.isArray(data)) return structuredClone(seed);
      return data;
    }catch{
      return structuredClone(seed);
    }
  }

  function save(entries){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }

  // --- UI ---
  const $ = (s) => document.querySelector(s);
  const listEl = $("#list");
  const qEl = $("#q");
  const resultCount = $("#resultCount");
  const emptyState = $("#emptyState");
  const detailEl = $("#detail");

  const dTitle = $("#dTitle");
  const dType = $("#dType");
  const dTags = $("#dTags");
  const dBody = $("#dBody");
  const dImages = $("#dImages");
  const dId = $("#dId");
  const dUpdated = $("#dUpdated");

  const btnNew = $("#btnNew");
  const btnEdit = $("#btnEdit");
  const btnDelete = $("#btnDelete");

  const editor = $("#editor");
  const form = $("#form");
  const mTitle = $("#mTitle");
  const fTitle = $("#fTitle");
  const fType = $("#fType");
  const fTags = $("#fTags");
  const fBody = $("#fBody");
  const btnTheme = $("#btnTheme");

  let entries = load();
  let activeId = null;
  let filter = "all";

  // theme
  const applyTheme = (t) => {
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem(THEME_KEY, t);
    btnTheme.querySelector(".icon").textContent = (t === "light") ? "☀" : "☾";
  };
  applyTheme(localStorage.getItem(THEME_KEY) || "dark");
  btnTheme.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    applyTheme(current === "dark" ? "light" : "dark");
  });

  function typeLabel(t){
    return ({ figur:"Figur", ort:"Ort", begriff:"Begriff", fraktion:"Fraktion" }[t] || t);
  }
  function badgeFor(t){
    return ({ figur:"F", ort:"O", begriff:"B", fraktion:"R" }[t] || "?");
  }
  function norm(s){
    return (s ?? "").toString().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  }

  function matches(e, q){
    if(!q) return true;
    const hay = [
      e.title,
      e.type,
      ...(e.tags || []),
      e.body
    ].join(" ");
    return norm(hay).includes(norm(q));
  }

  function getFiltered(){
    const q = qEl.value.trim();
    return entries
      .slice()
      .sort((a,b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))
      .filter(e => filter === "all" ? true : e.type === filter)
      .filter(e => matches(e, q));
  }

  function renderList(){
    const items = getFiltered();
    resultCount.textContent = items.length + " Treffer";
    listEl.innerHTML = "";

    for(const e of items){
      const li = document.createElement("li");
      li.className = "item";
      li.dataset.id = e.id;

      const badge = document.createElement("div");
      badge.className = "badge";
      badge.textContent = badgeFor(e.type);

      const main = document.createElement("div");
      main.className = "item-main";

      const title = document.createElement("div");
      title.className = "item-title";
      title.textContent = e.title;

      const sub = document.createElement("div");
      sub.className = "item-sub";
      const preview = (e.body || "").split(/\n+/).find(Boolean) || "";
      sub.textContent = preview.slice(0, 90);

      const meta = document.createElement("div");
      meta.className = "item-meta";

      const pillType = document.createElement("span");
      pillType.className = "pill accent";
      pillType.textContent = typeLabel(e.type);

      meta.appendChild(pillType);

      const tags = (e.tags || []).slice(0, 3);
      for(const t of tags){
        const p = document.createElement("span");
        p.className = "pill";
        p.textContent = "#" + t;
        meta.appendChild(p);
      }

      main.appendChild(title);
      main.appendChild(sub);
      main.appendChild(meta);

      li.appendChild(badge);
      li.appendChild(main);

      li.addEventListener("click", () => openDetail(e.id));
      listEl.appendChild(li);
    }

    // if active no longer in list, hide detail on small screens
    if(activeId && !items.some(x => x.id === activeId)){
      showEmpty();
    }
  }

  function showEmpty(){
    activeId = null;
    emptyState.style.display = "grid";
    detailEl.classList.add("hidden");
  }

  function openDetail(id){
    const e = entries.find(x => x.id === id);
    if(!e){ showEmpty(); return; }
    activeId = id;

    emptyState.style.display = "none";
    detailEl.classList.remove("hidden");

    dTitle.textContent = e.title;
    dType.textContent = typeLabel(e.type);

    dTags.innerHTML = "";
    for(const t of (e.tags || [])){
      const span = document.createElement("span");
      span.className = "tag";
      span.textContent = "#" + t;
      dTags.appendChild(span);
    }

    dBody.innerHTML = mdLite(e.body || "");
    dId.textContent = e.id;
    dUpdated.textContent = new Date(e.updatedAt || Date.now()).toLocaleString("de-DE");

    // helpful: on phones scroll into detail
    if(window.matchMedia("(max-width: 919px)").matches){
      document.querySelector(".detail").scrollIntoView({ behavior:"smooth", block:"start" });
    }
  }

  // Filters
  document.querySelectorAll(".chip").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".chip").forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      filter = btn.dataset.filter;
      renderList();
    });
  });

  // Search
  qEl.addEventListener("input", () => renderList());

  // Editor
  let editId = null;

  function openEditor(mode, entry){
    editId = entry?.id ?? null;
    mTitle.textContent = mode === "new" ? "Neuer Eintrag" : "Eintrag bearbeiten";
    fTitle.value = entry?.title ?? "";
    fType.value = entry?.type ?? "figur";
    fTags.value = (entry?.tags ?? []).join(", ");
    fBody.value = entry?.body ?? "";
    editor.showModal();
  }

  btnNew.addEventListener("click", () => openEditor("new", null));
  btnEdit.addEventListener("click", () => {
    const e = entries.find(x => x.id === activeId);
    if(e) openEditor("edit", e);
  });

  btnDelete.addEventListener("click", () => {
    const e = entries.find(x => x.id === activeId);
    if(!e) return;
    const ok = confirm(`Eintrag wirklich löschen?\n\n${e.title}`);
    if(!ok) return;
    entries = entries.filter(x => x.id !== e.id);
    save(entries);
    renderList();
    showEmpty();
  });

  form.addEventListener("submit", (ev) => {
    // method=dialog already closes; we persist only when the "save" button was used
    const clicked = ev.submitter;
    if(!clicked || clicked.value === "cancel") return;

    const title = fTitle.value.trim();
    if(!title) return;

    const type = fType.value;
    const tags = fTags.value
      .split(",")
      .map(t => t.trim())
      .filter(Boolean)
      .slice(0, 12);

    const body = fBody.value || "";

    if(editId){
      const idx = entries.findIndex(x => x.id === editId);
      if(idx >= 0){
        entries[idx] = {
          ...entries[idx],
          title, type, tags, body,
          updatedAt: nowISO(),
        };
      }
      save(entries);
      renderList();
      openDetail(editId);
    }else{
      const id = uid();
      const e = { id, title, type, tags, body, updatedAt: nowISO() };
      entries.unshift(e);
      save(entries);
      renderList();
      openDetail(id);
    }
  });

  // First render
  renderList();
  // open first entry by default on wide screens
  if(window.matchMedia("(min-width: 920px)").matches){
    const first = getFiltered()[0];
    if(first) openDetail(first.id);
  }else{
    showEmpty();
  }

  // Expose a tiny helper for debugging (optional)
  window.LusiWiki = {
    export: () => JSON.stringify(entries, null, 2),
    import: (json) => {
      try{
        const data = JSON.parse(json);
        if(Array.isArray(data)){
          entries = data;
          save(entries);
          renderList();
          showEmpty();
          alert("Import ok.");
        }
      }catch{
        alert("Import fehlgeschlagen.");
      }
    }
  };
})();
