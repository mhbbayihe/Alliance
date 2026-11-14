// Alliance : remplace les textes de la page par leurs équivalents (fichiers locales/*.json).
// La page n'est pas modifiée à la source : on ne touche qu'aux nœuds texte reconnus et à
// quelques attributs de libellé. Les valeurs (montants, noms, numéros, champs) ne sont jamais écrites.
(async () => {
  const STORAGE_KEY = "alliance.langue";
  const ORIGINAL = "original";
  const SKIP = "script, style, noscript, textarea, pre, code, [contenteditable=''], [contenteditable='true']";

  async function loadJson(path) {
    const response = await fetch(chrome.runtime.getURL(path));
    if (!response.ok) throw new Error(`${path} : ${response.status}`);
    return response.json();
  }

  let index;
  const tables = {};
  try {
    index = await loadJson("locales/index.json");
    await Promise.all(index.langues.map(async (language) => {
      tables[language.code] = await loadJson(`locales/${language.fichier}`);
    }));
  } catch (error) {
    console.error("Alliance : fichiers de traduction introuvables ou invalides.", error);
    return;
  }

  // Enregistrements audio : facultatifs, une table clé -> fichier par langue (audio/<langue>.json).
  const audioTables = {};
  await Promise.all(index.langues.filter((language) => language.audio).map(async (language) => {
    try {
      audioTables[language.code] = await loadJson(language.audio);
    } catch (error) {
      console.warn(`Alliance : pas d'audio pour ${language.nom}.`, error);
    }
  }));

  const engine = globalThis.AllianceEngine.create(index, tables);
  const attributes = index.attributsTraduits || [];
  const textState = new WeakMap();   // nœud texte -> { source, rendered }
  const attrState = new WeakMap();   // élément -> Map(attribut -> { source, rendered })
  let currentLanguage = ORIGINAL;
  let observer;

  // ---------- interface ----------
  const host = document.createElement("div");
  host.id = "alliance-host";
  host.style.position = "fixed";
  host.style.zIndex = "2147483647";
  document.documentElement.append(host);
  const root = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; }
    /* Identité : les trois couleurs et l'étoile du drapeau camerounais, sur un fond ébène ; une frise de
       losanges, forme courante de la vannerie et du tissage du pays ; un cadre de lecture en pointillé
       comme un point de broderie. Aucun motif propre à un peuple n'est repris. */
    * { box-sizing: border-box; }
    .star {
      display: inline-block; flex: none; width: 15px; height: 15px; background: #fcd116;
      clip-path: polygon(50% 0, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
    }
    .launcher {
      position: fixed; left: 20px; bottom: 20px; display: flex; align-items: center; gap: 9px;
      border: 0; border-radius: 10px; padding: 11px 15px 11px 20px; overflow: hidden;
      background: #1c1410; color: #fff; font: 700 14px/1.2 system-ui, sans-serif;
      box-shadow: 0 4px 18px #0005; cursor: pointer;
    }
    /* ruban tricolore sur le bord gauche */
    .launcher::before {
      content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 9px;
      background: linear-gradient(90deg, #007a5e 0 3px, #ce1126 3px 6px, #fcd116 6px 9px);
    }
    button:focus-visible { outline: 3px solid #fcd116; outline-offset: 3px; box-shadow: 0 0 0 3px #1c1410; }
    .panel {
      position: fixed; left: 20px; bottom: 82px; width: min(320px, calc(100vw - 40px));
      max-height: min(76vh, 620px); overflow: auto;
      border: 2px solid #1c1410; border-radius: 12px; padding: 0 0 14px;
      background: #fffdf5; color: #1c1410; box-shadow: 0 10px 34px #0006;
      font: 14px/1.5 system-ui, sans-serif;
    }
    .panel[hidden] { display: none; }
    .head {
      display: flex; align-items: center; gap: 9px; padding: 15px 16px 13px;
      background: linear-gradient(90deg, #007a5e 0 33.34%, #ce1126 33.34% 66.67%, #fcd116 66.67%) top / 100% 5px no-repeat, #1c1410;
      color: #fff;
    }
    /* Le nom du projet d'abord, en grand ; l'action en dessous. */
    .head .star { width: 22px; height: 22px; }
    h2 { margin: 0; font: 800 22px/1.1 system-ui, sans-serif; letter-spacing: .02em; }
    .head p { margin: 3px 0 0; font: 400 13px/1.3 system-ui, sans-serif; color: #fcd116; }
    .brand { display: block; font: 800 15px/1.15 system-ui, sans-serif; letter-spacing: .02em; }
    .current { display: block; margin-top: 2px; font: 400 12px/1.2 system-ui, sans-serif; color: #fcd116; text-align: left; }
    /* frise de losanges jaunes à cœur rouge */
    .frieze {
      height: 14px; background-color: #1c1410; background-size: 14px 14px;
      background-image:
        linear-gradient(45deg, #1c1410 25%, transparent 25% 75%, #1c1410 75%),
        linear-gradient(-45deg, #1c1410 25%, transparent 25% 75%, #1c1410 75%),
        radial-gradient(circle at 50% 50%, #ce1126 0 2.2px, #fcd116 2.4px);
      border-bottom: 2px solid #1c1410;
    }
    .languages { display: grid; gap: 7px; padding: 14px 14px 0; }
    .language {
      display: flex; align-items: baseline; justify-content: space-between; gap: 10px; width: 100%;
      border: 2px solid #1c1410; border-left-width: 8px; border-radius: 8px; padding: 9px 11px;
      background: #fff; color: #1c1410; font: 600 15px/1.3 system-ui, sans-serif; text-align: left; cursor: pointer;
    }
    .language:hover { background: #fff3c2; }
    .language[aria-pressed="true"] { border-color: #007a5e; border-left-color: #fcd116; background: #007a5e; color: #fff; }
    .language small { font-weight: 400; font-size: 11px; opacity: .85; text-align: right; }
    .read {
      display: flex; align-items: center; justify-content: center; gap: 9px;
      width: calc(100% - 28px); margin: 12px 14px 0; border: 2px solid #1c1410; border-radius: 8px; padding: 11px;
      background: #fcd116; color: #1c1410; font: 700 15px/1.3 system-ui, sans-serif; cursor: pointer;
      box-shadow: 0 3px 0 #1c1410;
    }
    .read[hidden] { display: none; }
    .read:active { transform: translateY(2px); box-shadow: 0 1px 0 #1c1410; }
    .read[data-etat="lecture"] { background: #ce1126; color: #fff; }
    .tools { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; margin: 9px 14px 0; }
    .tools[hidden] { display: none; }
    .tool {
      border: 2px solid #1c1410; border-radius: 8px; padding: 9px 6px; background: #fff; color: #1c1410;
      font: 600 13px/1.25 system-ui, sans-serif; cursor: pointer;
    }
    .tool:hover:not(:disabled) { background: #fff3c2; }
    .tool:disabled { border-color: #a39a94; color: #857b74; cursor: default; }
    .tool[aria-pressed="true"] { border-color: #007a5e; background: #007a5e; color: #fff; }
    .status[hidden] { display: none; }
    .status { margin: 12px 14px 0; color: #4a3f38; font-size: 13px; }
    .speaker {
      position: fixed; width: 34px; height: 34px; padding: 6px;
      border: 2px solid #1c1410; border-radius: 50%; background: #fcd116; color: #1c1410;
      box-shadow: 0 2px 0 #1c1410, 0 4px 12px #0004; cursor: pointer;
    }
    .speaker[hidden] { display: none; }
    .speaker[data-etat="lecture"] { background: #007a5e; color: #fff; }
    .speaker[data-etat="erreur"] { background: #ce1126; color: #fff; }
    .speaker svg { display: block; width: 100%; height: 100%; }
    .marker {
      position: fixed; border: 3px dashed #ce1126; border-radius: 8px;
      box-shadow: 0 0 0 3px #fcd116, 0 0 0 5px #1c1410; pointer-events: none;
    }
    .marker[hidden] { display: none; }
    @media (max-width: 480px) { .launcher { left: 12px; bottom: 12px; } .panel { left: 12px; bottom: 64px; } }
    @media (prefers-reduced-motion: reduce) { .read:active { transform: none; } }
  `;

  const launcher = document.createElement("button");
  launcher.className = "launcher";
  launcher.type = "button";
  launcher.setAttribute("aria-expanded", "false");
  launcher.setAttribute("aria-controls", "alliance-panel");
  const star = () => { const mark = document.createElement("span"); mark.className = "star"; mark.setAttribute("aria-hidden", "true"); return mark; };
  const launcherText = document.createElement("span");
  const brand = document.createElement("span");
  brand.className = "brand";
  brand.textContent = "Alliance";
  const launcherLabel = document.createElement("span");
  launcherLabel.className = "current";
  launcherText.append(brand, launcherLabel);
  launcher.append(star(), launcherText);

  const panel = document.createElement("section");
  panel.className = "panel";
  panel.id = "alliance-panel";
  panel.setAttribute("aria-labelledby", "alliance-title");
  panel.hidden = true;

  const head = document.createElement("div");
  head.className = "head";
  const title = document.createElement("h2");
  title.id = "alliance-title";
  title.textContent = "Alliance";
  const subtitle = document.createElement("p");
  subtitle.textContent = "Choisir la langue de la page";
  const headText = document.createElement("div");
  headText.append(title, subtitle);
  head.append(star(), headText);
  const frieze = document.createElement("div");
  frieze.className = "frieze";
  frieze.setAttribute("aria-hidden", "true");
  const list = document.createElement("div");
  list.className = "languages";
  const status = document.createElement("p");
  status.className = "status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  // Lecture de toute la page : bouton dans le panneau, et cadre qui suit le texte en cours de lecture.
  const readButton = document.createElement("button");
  readButton.className = "read";
  readButton.type = "button";
  readButton.hidden = true;
  const marker = document.createElement("div");
  marker.className = "marker";
  marker.hidden = true;
  // Sous le bouton de lecture : réécouter le dernier texte, et ralentir la voix.
  const tools = document.createElement("div");
  tools.className = "tools";
  tools.hidden = true;
  const repeatButton = document.createElement("button");
  repeatButton.className = "tool";
  repeatButton.type = "button";
  repeatButton.textContent = "Répéter";
  repeatButton.disabled = true;
  const speedButton = document.createElement("button");
  speedButton.className = "tool";
  speedButton.type = "button";
  tools.append(repeatButton, speedButton);
  panel.append(head, frieze, list, readButton, tools, status);
  // Bouton d'écoute : il flotte à côté du texte survolé ou sélectionné au clavier, hors du DOM de la page.
  const speaker = document.createElement("button");
  speaker.className = "speaker";
  speaker.type = "button";
  speaker.hidden = true;
  speaker.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 9v6h4l5 4V5L7 9H3z"/>' +
    '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12"/></svg>';
  root.append(style, launcher, panel, speaker, marker);

  const choices = [{ code: ORIGINAL, nom: "Page d’origine", statut: "" }, ...index.langues];
  const buttons = new Map();
  for (const choice of choices) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "language";
    const name = document.createElement("span");
    name.textContent = choice.nom;
    button.append(name);
    if (choice.etiquette) {
      const note = document.createElement("small");
      note.textContent = choice.etiquette;
      button.append(note);
    }
    button.addEventListener("click", () => setLanguage(choice.code, true));
    buttons.set(choice.code, button);
    list.append(button);
  }

  // ---------- remplacement ----------
  function isSkipped(element) {
    return !element || host.contains(element) || Boolean(element.closest(SKIP));
  }

  // external = true quand la page vient d'écrire ce nœud : sa valeur est alors la nouvelle source.
  function processText(node, external) {
    if (node.nodeType !== Node.TEXT_NODE || isSkipped(node.parentElement)) return;
    const current = node.nodeValue || "";
    const state = textState.get(node);
    const source = !external && state && current === state.rendered ? state.source : current;
    const result = currentLanguage === ORIGINAL ? null : engine.translate(source, currentLanguage);

    if (!result) {
      if (current !== source) node.nodeValue = source;
      textState.delete(node);
      return;
    }
    textState.set(node, { source, rendered: result.text, key: result.key, values: result.values });
    if (current !== result.text) node.nodeValue = result.text;
  }

  function processAttributes(element, external) {
    if (isSkipped(element)) return;
    for (const name of attributes) {
      if (!element.hasAttribute(name)) continue;
      const current = element.getAttribute(name);
      const states = attrState.get(element) || new Map();
      const state = states.get(name);
      const source = !external && state && current === state.rendered ? state.source : current;
      const result = currentLanguage === ORIGINAL ? null : engine.translate(source, currentLanguage);
      if (!result) {
        if (current !== source) element.setAttribute(name, source);
        states.delete(name);
      } else {
        states.set(name, { source, rendered: result.text, key: result.key, values: result.values });
        if (current !== result.text) element.setAttribute(name, result.text);
      }
      if (states.size) attrState.set(element, states);
      else attrState.delete(element);
    }
  }

  function processTree(rootNode, external) {
    if (rootNode.nodeType === Node.TEXT_NODE) {
      processText(rootNode, external);
      return;
    }
    if (rootNode.nodeType !== Node.ELEMENT_NODE || rootNode === host) return;
    const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let node = rootNode;
    while (node) {
      if (node.nodeType === Node.TEXT_NODE) processText(node, external);
      else if (attributes.length) processAttributes(node, external);
      node = walker.nextNode();
    }
  }

  // Nos propres écritures ne doivent pas être relues comme des changements de la page.
  function withoutEcho(work) {
    work();
    if (observer) observer.takeRecords();
  }

  // ---------- écoute ----------
  // Adresse de base calculée une fois : si l'extension est rechargée pendant que la page reste ouverte,
  // chrome.runtime n'est plus utilisable ici, mais les fichiers restent lisibles à la même adresse.
  const baseUrl = chrome.runtime.getURL("");
  const flat = (text) => String(text).replace(/[\s  ]+/gu, " ").trim();

  // Voix de synthèse : pour une langue qui en déclare une (« voix » dans index.json : français, anglais),
  // le texte est lu par une voix installée sur l'appareil. Les voix en ligne sont écartées, pour que
  // rien de ce qui est affiché ne quitte le navigateur. Aucune voix de synthèse n'existe pour le bàsàa.
  const voiceCache = new Map();
  function voiceFor(code) {
    const language = index.langues.find((item) => item.code === code);
    if (!language || !language.voix || !("speechSynthesis" in window)) return null;
    if (!voiceCache.has(code)) {
      const wanted = language.voix.toLowerCase();
      const tag = (voice) => voice.lang.toLowerCase().replace("_", "-");
      const local = speechSynthesis.getVoices().filter((voice) => voice.localService && tag(voice).startsWith(wanted.slice(0, 2)));
      if (!local.length) return null;
      voiceCache.set(code, local.find((voice) => tag(voice) === wanted) || local[0]);
    }
    return voiceCache.get(code);
  }
  const hasSound = () => Boolean(audioTables[currentLanguage] || voiceFor(currentLanguage));

  // Identifiant du son d'un texte, ou null : l'adresse de son enregistrement s'il en a un, sinon
  // « voix:<texte> » quand la langue a une voix de synthèse. Un enregistrement qui prononce une valeur
  // (prénom, numéro de compte) n'est proposé que si la page affiche exactement cette valeur.
  function audioUrl(state, text) {
    const table = audioTables[currentLanguage];
    const entry = state && table && table.cles[state.key];
    if (!entry) {
      const clean = flat(text || "");
      return /[\p{L}\p{N}]/u.test(clean) && voiceFor(currentLanguage) ? `voix:${clean}` : null;
    }
    if (entry.valeurs) {
      const shown = state.values || {};
      const same = Object.entries(entry.valeurs).every(([name, value]) => shown[name] !== undefined && flat(shown[name]) === flat(value));
      if (!same) return null;
    }
    return `${baseUrl}${table.dossier}/${encodeURIComponent(entry.fichier)}`;
  }

  function rectOf(node) {
    if (node.nodeType !== Node.TEXT_NODE) return node.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(node);
    return range.getBoundingClientRect();
  }

  // Cherche l'enregistrement du texte porté par cet élément : ses nœuds texte directs, ses libellés,
  // puis le contenu entier s'il s'agit d'un bouton, d'un lien, d'un libellé de champ ou d'une liste.
  function findAudio(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE || isSkipped(element)) return null;
    const control = element.closest("button, a, label, select, summary, [role='button']");
    for (const scope of control && control !== element ? [element, control] : [element]) {
      if (scope.tagName === "SELECT") {
        const option = scope.selectedOptions[0];
        const url = option && option.firstChild && audioUrl(textState.get(option.firstChild), option.firstChild.nodeValue);
        if (url) return { url, rect: scope.getBoundingClientRect() };
        continue;
      }
      const nodes = scope === control
        ? (() => { const w = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT); const all = []; let n; while ((n = w.nextNode())) all.push(n); return all; })()
        : [...scope.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE);
      for (const node of nodes) {
        const url = audioUrl(textState.get(node), node.nodeValue);
        if (url) return { url, rect: rectOf(node) };
      }
      for (const state of (attrState.get(scope) || new Map()).values()) {
        const url = audioUrl(state, state.rendered);
        if (url) return { url, rect: scope.getBoundingClientRect() };
      }
    }
    return null;
  }

  // Lecture : chaque enregistrement est décodé puis mesuré (signal.js) pour être joué sans ses silences
  // de début et de fin et au même niveau sonore que les autres. Les fichiers ne sont pas modifiés.
  const sounds = new Map();   // adresse -> promesse { buffer, reglage }
  let audioContext = null;
  let playing = null;         // { source } pendant une lecture
  let playToken = 0;
  let speakerUrl = null;
  let hideTimer = 0;

  function loadSound(url) {
    if (!sounds.has(url)) {
      sounds.set(url, (async () => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`${url} : ${response.status}`);
        const buffer = await audioContext.decodeAudioData(await response.arrayBuffer());
        const signal = globalThis.AllianceSignal;
        return { buffer, reglage: signal.analyze(signal.mono(buffer), buffer.sampleRate) };
      })());
      sounds.get(url).catch(() => sounds.delete(url));
    }
    return sounds.get(url);
  }

  function stopAudio() {
    playToken += 1;
    if (playing) {
      try { playing.source.stop(); } catch { /* déjà arrêtée */ }
      playing = null;
    }
    if ("speechSynthesis" in window && (speechSynthesis.speaking || speechSynthesis.pending)) speechSynthesis.cancel();
    speaker.dataset.etat = "";
  }

  // Lit un texte avec la voix de synthèse de la langue choisie. Même contrat que playSound.
  function speak(text, token) {
    const voice = voiceFor(currentLanguage);
    if (!voice) throw new Error("aucune voix locale pour cette langue");
    const french = voice.lang.toLowerCase().startsWith("fr");
    const utterance = new SpeechSynthesisUtterance(text.replace(/\bFCFA\b/g, french ? "francs CFA" : "CFA francs"));
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = 0.95 * speed();
    return new Promise((resolve, reject) => {
      utterance.onend = () => resolve(token === playToken);
      utterance.onerror = (event) => (event.error === "canceled" || event.error === "interrupted" ? resolve(false) : reject(new Error(event.error)));
      speechSynthesis.speak(utterance);
    });
  }

  // Joue un enregistrement. La promesse rend true s'il est allé au bout, false s'il a été interrompu.
  async function playSound(url, token) {
    lastSound = url;
    repeatButton.disabled = false;
    if (url.startsWith("voix:")) return speak(url.slice(5), token);
    audioContext = audioContext || new AudioContext();
    await audioContext.resume();
    const { buffer, reglage } = await loadSound(url);
    if (token !== playToken) return false;   // arrêt ou autre texte demandé entre-temps
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    const level = audioContext.createGain();
    const now = audioContext.currentTime;
    const length = reglage.end - reglage.start;
    // Lecture lente : l'enregistrement est ralenti, ce qui rend aussi la voix un peu plus grave.
    source.playbackRate.value = speed();
    const heard = length / speed();   // durée réellement entendue
    // Montée et descente de 10 ms pour éviter un clic aux points de coupe.
    level.gain.setValueAtTime(0, now);
    level.gain.linearRampToValueAtTime(reglage.gain, now + 0.01);
    level.gain.setValueAtTime(reglage.gain, now + Math.max(0.01, heard - 0.01));
    level.gain.linearRampToValueAtTime(0, now + heard);
    source.connect(level).connect(audioContext.destination);
    speaker.dataset.reglage = `${reglage.start.toFixed(2)}-${reglage.end.toFixed(2)} s, gain ${reglage.gain.toFixed(2)}`;
    return new Promise((resolve) => {
      source.onended = () => {
        if (playing && playing.source === source) playing = null;
        resolve(token === playToken);
      };
      playing = { source };
      source.start(now, reglage.start, length);
    });
  }

  // ---------- vitesse et répétition ----------
  const SPEED_KEY = "alliance.lent";
  const SLOW = 0.85;
  let slow = false;
  let lastSound = null;
  const speed = () => (slow ? SLOW : 1);
  function showSpeed() {
    speedButton.textContent = slow ? "Voix lente" : "Voix normale";
    speedButton.setAttribute("aria-pressed", String(slow));
    speedButton.title = slow ? "Revenir à la vitesse normale" : "Ralentir la voix";
  }

  async function playAudio(url) {
    stopReading();
    stopAudio();
    const token = playToken;
    speaker.dataset.etat = "lecture";
    try {
      await playSound(url, token);
      if (token === playToken) speaker.dataset.etat = "";
    } catch (error) {
      if (token === playToken) {
        speaker.dataset.etat = "erreur";
        speaker.title = "Écoute impossible : rechargez la page.";
        speaker.setAttribute("aria-label", speaker.title);
      }
      console.warn("Alliance : lecture audio impossible.", error);
    }
  }

  // ---------- lecture de toute la page ----------
  let reading = false;
  let readId = 0;
  let markedNode = null;

  // Les textes de l'écran qui ont un enregistrement, dans l'ordre de la page. Les valeurs (montants,
  // noms, numéros) n'ont pas d'enregistrement : elles ne sont pas lues.
  function collectReadable() {
    const items = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (isSkipped(parent)) continue;
      const url = audioUrl(textState.get(node), node.nodeValue);
      if (!url) continue;
      // Dans une liste déroulante, seul le choix affiché est lu, et c'est la liste qui est montrée.
      const anchor = parent.tagName === "OPTION" ? (parent.selected ? parent.closest("select") : null) : node;
      if (!anchor) continue;
      const rect = rectOf(anchor);
      if (!rect.width || !rect.height) continue;   // texte masqué
      if (items.length && items[items.length - 1].url === url) continue;   // même phrase deux fois de suite
      items.push({ url, anchor });
    }
    return items;
  }

  function placeMarker() {
    if (!reading || !markedNode || !markedNode.isConnected) { marker.hidden = true; return; }
    const rect = rectOf(markedNode);
    marker.style.left = `${Math.round(rect.left - 6)}px`;
    marker.style.top = `${Math.round(rect.top - 4)}px`;
    marker.style.width = `${Math.round(rect.width + 12)}px`;
    marker.style.height = `${Math.round(rect.height + 8)}px`;
    marker.hidden = false;
    requestAnimationFrame(placeMarker);
  }

  function showReadState() {
    readButton.textContent = reading ? "Arrêter la lecture" : "Lire toute la page";
    readButton.dataset.etat = reading ? "lecture" : "";
    readButton.setAttribute("aria-pressed", String(reading));
  }

  function stopReading() {
    if (!reading) return;
    readId += 1;
    reading = false;
    markedNode = null;
    marker.hidden = true;
    stopAudio();
    showReadState();
  }

  async function readPage() {
    stopReading();
    hideSpeaker();
    readId += 1;
    const id = readId;
    reading = true;
    readButton.dataset.lus = "0";
    showReadState();
    try {
      for (const item of collectReadable()) {
        if (id !== readId) return;
        if (!item.anchor.isConnected) continue;   // l'écran a changé pendant la lecture
        const element = item.anchor.nodeType === Node.TEXT_NODE ? item.anchor.parentElement : item.anchor;
        const rect = rectOf(item.anchor);
        if (rect.top < 60 || rect.bottom > window.innerHeight - 60) element.scrollIntoView({ block: "center", behavior: "smooth" });
        markedNode = item.anchor;
        placeMarker();
        stopAudio();
        const done = await playSound(item.url, playToken);
        if (!done || id !== readId) return;
        readButton.dataset.lus = String(Number(readButton.dataset.lus) + 1);
        await new Promise((resolve) => setTimeout(resolve, 350));   // respiration entre deux phrases
      }
    } catch (error) {
      console.warn("Alliance : lecture de la page interrompue.", error);
    } finally {
      if (id === readId) {
        reading = false;
        markedNode = null;
        marker.hidden = true;
        showReadState();
      }
    }
  }

  function hideSpeaker() {
    clearTimeout(hideTimer);
    speaker.hidden = true;
    speakerUrl = null;
    if (!reading) stopAudio();
  }
  function showSpeaker(found) {
    clearTimeout(hideTimer);
    if (speakerUrl !== found.url && !reading) stopAudio();
    speakerUrl = found.url;
    const { rect } = found;
    const size = 32;
    let left = rect.right + 6;
    if (left + size > window.innerWidth - 4) left = Math.max(4, rect.left - size - 6);
    const top = Math.min(Math.max(4, rect.top + (rect.height - size) / 2), window.innerHeight - size - 4);
    speaker.style.left = `${Math.round(left)}px`;
    speaker.style.top = `${Math.round(top)}px`;
    speaker.hidden = false;
  }
  function pointAt(target) {
    if (target === host) { clearTimeout(hideTimer); return; }   // le pointeur est sur notre bouton
    const found = findAudio(target);
    if (found) { showSpeaker(found); return; }
    // Laisse le temps d'aller du texte jusqu'au bouton, et de finir une écoute en cours.
    clearTimeout(hideTimer);
    if (!speaker.hidden) hideTimer = setTimeout(() => { if (speaker.dataset.etat !== "lecture") hideSpeaker(); }, 1500);
  }

  speaker.addEventListener("click", () => {
    if (!speakerUrl) return;
    if (speaker.dataset.etat === "lecture") stopAudio();
    else playAudio(speakerUrl);
  });
  readButton.addEventListener("click", () => { if (reading) stopReading(); else readPage(); });
  repeatButton.addEventListener("click", () => { if (lastSound) playAudio(lastSound); });
  speedButton.addEventListener("click", () => {
    slow = !slow;
    showSpeed();
    try { chrome.storage.local.set({ [SPEED_KEY]: slow }); } catch { /* préférence non enregistrée */ }
  });

  // ---------- écoute au toucher : un appui long sur un texte le lit ----------
  // Sur un écran tactile il n'y a pas de survol. Un appui maintenu une demi-seconde lit le texte, et le
  // clic qui suivrait au relâchement est annulé, pour ne pas activer le bouton qu'on voulait écouter.
  const LONG_PRESS = 500;
  let pressTimer = 0;
  let pressStart = null;
  let swallowClick = false;
  function cancelPress() {
    clearTimeout(pressTimer);
    pressStart = null;
  }
  document.addEventListener("pointerdown", (event) => {
    cancelPress();
    swallowClick = false;
    if (event.button !== 0 || event.target === host) return;
    const found = findAudio(event.target);
    if (!found) return;
    pressStart = { x: event.clientX, y: event.clientY };
    pressTimer = setTimeout(() => {
      pressStart = null;
      swallowClick = true;
      host.dataset.appuiLong = found.url.startsWith("voix:") ? "voix" : "enregistrement";
      showSpeaker(found);
      playAudio(found.url);
      try { navigator.vibrate(30); } catch { /* pas de vibreur */ }
    }, LONG_PRESS);
  }, true);
  document.addEventListener("pointermove", (event) => {
    if (pressStart && Math.hypot(event.clientX - pressStart.x, event.clientY - pressStart.y) > 10) cancelPress();
  }, true);
  for (const type of ["pointerup", "pointercancel"]) document.addEventListener(type, cancelPress, true);
  document.addEventListener("click", (event) => {
    if (!swallowClick || event.target === host) return;
    swallowClick = false;
    event.preventDefault();
    event.stopPropagation();
  }, true);
  document.addEventListener("contextmenu", (event) => { if (swallowClick) event.preventDefault(); }, true);
  document.addEventListener("pointerover", (event) => pointAt(event.target), true);
  document.addEventListener("focusin", (event) => pointAt(event.target), true);
  window.addEventListener("scroll", () => { cancelPress(); hideSpeaker(); }, true);
  window.addEventListener("resize", hideSpeaker);
  // Les voix de l'appareil arrivent parfois après le chargement de la page.
  if ("speechSynthesis" in window) speechSynthesis.addEventListener("voiceschanged", () => { voiceCache.clear(); updatePanel(); });

  function updatePanel() {
    const choice = choices.find((item) => item.code === currentLanguage) || choices[0];
    launcherLabel.textContent = `Langue : ${choice.nom}`;
    for (const [code, button] of buttons) button.setAttribute("aria-pressed", String(code === currentLanguage));
    speaker.setAttribute("aria-label", `Écouter en ${choice.nom}`);
    speaker.title = `Écouter en ${choice.nom}`;
    // Le panneau ne garde que les indications utiles à l'utilisateur : comment écouter, et l'état d'une langue à confirmer.
    readButton.hidden = !hasSound();
    tools.hidden = !hasSound();
    showSpeed();
    showReadState();
    status.textContent = currentLanguage === ORIGINAL ? "" : [
      hasSound() ? "Pour écouter un seul texte : survolez-le puis appuyez sur le haut-parleur, ou gardez le doigt appuyé dessus." : "",
      choice.etiquette && choice.statut ? choice.statut : "",
    ].filter(Boolean).join(" ");
    status.hidden = !status.textContent;
  }

  function setLanguage(code, remember) {
    stopReading();
    lastSound = null;
    repeatButton.disabled = true;
    currentLanguage = choices.some((choice) => choice.code === code) ? code : ORIGINAL;
    hideSpeaker();
    withoutEcho(() => processTree(document.body, false));
    updatePanel();
    if (remember) {
      try { chrome.storage.local.set({ [STORAGE_KEY]: currentLanguage }); } catch { /* préférence non enregistrée */ }
    }
  }

  // ---------- événements ----------
  launcher.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    launcher.setAttribute("aria-expanded", String(!panel.hidden));
    if (!panel.hidden) {
      updatePanel();
      (buttons.get(currentLanguage) || launcher).focus();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") stopReading();
    if (event.key === "Escape" && !panel.hidden) {
      panel.hidden = true;
      launcher.setAttribute("aria-expanded", "false");
      launcher.focus();
    }
  });

  observer = new MutationObserver((mutations) => {
    withoutEcho(() => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          processText(mutation.target, true);
        } else if (mutation.type === "attributes") {
          processAttributes(mutation.target, true);
        } else {
          for (const node of mutation.addedNodes) processTree(node, true);
        }
      }
    });
    // Changement d'écran : le texte désigné par le bouton d'écoute a pu disparaître.
    if (!speaker.hidden && mutations.some((mutation) => mutation.removedNodes.length)) hideSpeaker();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: attributes.length > 0,
    attributeFilter: attributes.length > 0 ? attributes : undefined,
  });

  let stored = ORIGINAL;
  try {
    stored = (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY] || ORIGINAL;
  } catch { /* première utilisation */ }
  try {
    slow = Boolean((await chrome.storage.local.get(SPEED_KEY))[SPEED_KEY]);
  } catch { /* première utilisation */ }
  setLanguage(stored, false);
})();
