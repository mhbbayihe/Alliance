(() => {
  const dataset = globalThis.ALLIANCE_DATASET;
  const lexicon = globalThis.ALLIANCE_DICTIONARY_LEXICON;
  if (!dataset || !Array.isArray(dataset.records) || !lexicon || !Array.isArray(lexicon.records)) {
    console.error("Alliance: corpus bilingue ou lexique introuvable/invalide.");
    return;
  }

  const entries = new Map();
  for (const record of dataset.records) {
    const key = normalize(record.source);
    const records = entries.get(key) || [];
    records.push(record);
    entries.set(key, records);
  }
  const originalText = new WeakMap();
  const aiAppliedText = new WeakMap();
  const aiAppliedNodes = new Set();
  const host = document.createElement("div");
  host.id = "alliance-host";
  host.style.position = "fixed";
  host.style.zIndex = "2147483647";
  document.documentElement.append(host);

  const root = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; }
    .launcher {
      position: fixed; right: 20px; bottom: 20px; border: 0; border-radius: 999px;
      padding: 12px 16px; background: #123b32; color: #fff; font: 600 14px/1.2 system-ui, sans-serif;
      box-shadow: 0 4px 18px #0003; cursor: pointer;
    }
    .launcher:focus-visible, button:focus-visible, select:focus-visible { outline: 3px solid #edc567; outline-offset: 3px; }
    .panel {
      position: fixed; right: 20px; bottom: 76px; width: min(390px, calc(100vw - 40px));
      max-height: min(76vh, 680px); overflow: auto; box-sizing: border-box;
      border: 1px solid #d5dfda; border-radius: 14px; padding: 18px;
      background: #fff; color: #16231f; box-shadow: 0 8px 32px #0003;
      font: 14px/1.5 system-ui, sans-serif;
    }
    .panel[hidden] { display: none; }
    .heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    h2 { margin: 0; font-size: 17px; }
    label { display: block; margin-top: 14px; font-weight: 600; }
    select { display: block; width: 100%; margin-top: 5px; padding: 9px; border: 1px solid #77877f; border-radius: 7px; background: #fff; color: #16231f; font: inherit; }
    .notice { margin: 12px 0 0; padding: 10px; border-radius: 8px; background: #fff6dc; color: #4a3b13; }
    .status { margin: 10px 0 0; color: #33453d; }
    .actions { display: grid; gap: 8px; margin-top: 12px; }
    .action, .suggestion button { border: 0; border-radius: 7px; padding: 9px 11px; background: #123b32; color: white; font: 600 13px/1.4 system-ui, sans-serif; cursor: pointer; }
    .action.secondary, .suggestion button.secondary { border: 1px solid #77877f; background: white; color: #16231f; }
    button:disabled { cursor: not-allowed; opacity: .6; }
    .suggestions { display: grid; gap: 10px; margin-top: 12px; }
    .suggestion { border: 1px solid #d5dfda; border-radius: 8px; padding: 10px; overflow-wrap: anywhere; }
    .suggestion p { margin: 0 0 6px; }
    .suggestion .source { color: #52635c; }
    .suggestion button { margin-top: 8px; }
    @media (max-width: 480px) { .launcher { right: 12px; bottom: 12px; } .panel { right: 12px; bottom: 64px; } }
  `;

  const launcher = document.createElement("button");
  launcher.className = "launcher";
  launcher.type = "button";
  launcher.textContent = "Langue : français";
  launcher.setAttribute("aria-expanded", "false");
  launcher.setAttribute("aria-controls", "alliance-panel");

  const panel = document.createElement("section");
  panel.className = "panel";
  panel.id = "alliance-panel";
  panel.setAttribute("aria-labelledby", "alliance-title");
  panel.hidden = true;
  panel.innerHTML = `
    <div class="heading"><h2 id="alliance-title">Langue de la page</h2></div>
    <label for="alliance-language">Choisir une langue</label>
    <select id="alliance-language">
      <option value="fr">Français</option>
      <option value="eton">Eton (phrases validées)</option>
      <option value="basaa-ai">Bàsàa — IA locale expérimentale</option>
    </select>
    <p class="notice"></p>
    <p class="status" role="status" aria-live="polite"></p>
    <div class="actions">
      <button class="action" id="alliance-generate" type="button" hidden>Générer un aperçu avec Ollama local</button>
      <button class="action secondary" id="alliance-restore" type="button" hidden>Rétablir les textes d’origine</button>
    </div>
    <div class="suggestions" id="alliance-suggestions"></div>
  `;
  root.append(style, launcher, panel);

  const languageSelect = panel.querySelector("#alliance-language");
  const notice = panel.querySelector(".notice");
  const status = panel.querySelector(".status");
  const generateButton = panel.querySelector("#alliance-generate");
  const restoreButton = panel.querySelector("#alliance-restore");
  const suggestionsContainer = panel.querySelector("#alliance-suggestions");
  let currentLanguage = "fr";
  let basaaAiMode = false;
  let generating = false;
  let generationId = 0;
  let suggestions = [];

  function normalize(value) {
    return value.replace(/\s+/gu, " ").trim().toLocaleLowerCase("fr");
  }

  function isProtectedNode(node) {
    const element = node.parentElement;
    return !element ||
      host.contains(element) ||
      Boolean(element.closest("input, textarea, [contenteditable], [role='textbox'], script, style, noscript"));
  }

  function translateNode(node) {
    if (node.nodeType !== Node.TEXT_NODE || isProtectedNode(node)) return;
    const currentText = node.nodeValue || "";
    const previous = originalText.get(node);
    const sourceText = previous && currentText === previous.translation
      ? previous.source
      : currentText;

    if (currentLanguage !== "eton") {
      if (previous && currentText === previous.translation) node.nodeValue = previous.source;
      originalText.delete(node);
      return;
    }

    if (/\p{N}/u.test(sourceText)) return;
    const candidates = entries.get(normalize(sourceText)) || [];
    const approvedTargets = [...new Set(
      candidates
        .filter((record) => record.status === "approved" && record.target.trim())
        .map((record) => record.target.trim())
    )];
    if (
      candidates.length === 0 ||
      candidates.some((record) => record.status !== "approved" || !record.target.trim()) ||
      approvedTargets.length !== 1
    ) {
      if (previous && currentText === previous.translation) node.nodeValue = previous.source;
      originalText.delete(node);
      return;
    }

    originalText.set(node, { source: sourceText, translation: approvedTargets[0] });
    if (currentText !== approvedTargets[0]) node.nodeValue = approvedTargets[0];
  }

  function visit(rootNode) {
    const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) translateNode(node);
  }

  function restoreAiTranslations() {
    for (const node of aiAppliedNodes) {
      const applied = aiAppliedText.get(node);
      if (applied && node.isConnected && node.nodeValue === applied.translation) {
        node.nodeValue = applied.source;
      }
      aiAppliedText.delete(node);
    }
    aiAppliedNodes.clear();
  }

  function looksLikeName(text) {
    const words = text.match(/[\p{L}][\p{L}'’-]*/gu) || [];
    return words.length >= 2 &&
      words.every((word) => /^\p{Lu}\p{Ll}+(?:['’-]\p{Ll}+)*$/u.test(word));
  }

  function isAiProtectedNode(node) {
    const element = node.parentElement;
    return !element ||
      host.contains(element) ||
      Boolean(element.closest(
        "input, textarea, select, option, [contenteditable], [role='textbox'], " +
        "script, style, noscript, a, button, [role='button'], [role='alert'], [aria-live]"
      ));
  }

  function collectAiCandidates() {
    const bySource = new Map();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (isAiProtectedNode(node)) continue;
      const value = node.nodeValue || "";
      const source = value.trim();
      if (
        source.length < 2 ||
        source.length > 240 ||
        /\p{N}/u.test(source) ||
        /https?:\/\/|www\.|@/iu.test(source) ||
        looksLikeName(source)
      ) continue;

      const candidates = bySource.get(source) || [];
      candidates.push({ node, value });
      bySource.set(source, candidates);
    }
    return [...bySource.entries()]
      .slice(0, 24)
      .map(([source, nodes]) => ({ source, nodes, translation: "", applied: false }));
  }

  function renderSuggestions() {
    suggestionsContainer.replaceChildren();
    for (const suggestion of suggestions) {
      const card = document.createElement("article");
      card.className = "suggestion";
      const source = document.createElement("p");
      source.className = "source";
      source.textContent = `Français : ${suggestion.source}`;
      const translation = document.createElement("p");
      const unchanged = suggestion.translation === suggestion.source;
      translation.textContent = unchanged
        ? "Le modèle n’a pas proposé de traduction pour cette phrase."
        : `Proposition bàsàa : ${suggestion.translation}`;
      const applyButton = document.createElement("button");
      applyButton.type = "button";
      applyButton.textContent = suggestion.applied
        ? "Suggestion appliquée — cliquer pour annuler"
        : unchanged ? "Aucune traduction à appliquer" : "Appliquer cette suggestion";
      applyButton.disabled = unchanged && !suggestion.applied;
      if (suggestion.applied) applyButton.classList.add("secondary");
      applyButton.addEventListener("click", () => toggleSuggestion(suggestion));
      card.append(source, translation, applyButton);
      suggestionsContainer.append(card);
    }
    restoreButton.hidden = aiAppliedNodes.size === 0;
  }

  function toggleSuggestion(suggestion) {
    if (suggestion.applied) {
      for (const { node } of suggestion.nodes) {
        const applied = aiAppliedText.get(node);
        if (applied && node.isConnected && node.nodeValue === applied.translation) {
          node.nodeValue = applied.source;
          aiAppliedText.delete(node);
          aiAppliedNodes.delete(node);
        }
      }
      suggestion.applied = false;
      renderSuggestions();
      updateStatus();
      return;
    }

    let appliedCount = 0;
    for (const { node, value } of suggestion.nodes) {
      if (!node.isConnected || node.nodeValue !== value) continue;
      const source = value.trim();
      const leadingWhitespace = value.slice(0, value.indexOf(source));
      const trailingWhitespace = value.slice(value.indexOf(source) + source.length);
      const translatedValue = leadingWhitespace + suggestion.translation + trailingWhitespace;
      aiAppliedText.set(node, { source: value, translation: translatedValue });
      aiAppliedNodes.add(node);
      node.nodeValue = translatedValue;
      appliedCount += 1;
    }
    if (appliedCount === 0) {
      status.textContent = "La page a changé depuis la génération ; cette suggestion n’a pas été appliquée.";
      return;
    }
    suggestion.applied = true;
    renderSuggestions();
    updateStatus();
  }

  function requestTranslation(texts) {
    return new Promise((resolve, reject) => {
      if (!globalThis.chrome?.runtime?.sendMessage) {
        reject(new Error("Rechargez l’extension pour activer la connexion à Ollama."));
        return;
      }
      chrome.runtime.sendMessage({ type: "alliance:translate-bassa", texts }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!response || response.error) {
          reject(new Error(response?.error || "Ollama n’a pas renvoyé de réponse."));
          return;
        }
        resolve(response.translations);
      });
    });
  }

  async function generateAiSuggestions() {
    if (generating) return;
    suggestions = collectAiCandidates();
    suggestionsContainer.replaceChildren();
    if (suggestions.length === 0) {
      status.textContent = "Aucun texte admissible : les champs, noms probables, liens et textes avec chiffres sont exclus.";
      return;
    }

    generating = true;
    const requestId = ++generationId;
    generateButton.disabled = true;
    const candidates = suggestions;
    try {
      const translations = [];
      for (let start = 0; start < candidates.length; start += 8) {
        if (requestId !== generationId || !basaaAiMode) return;
        status.textContent = `Traduction locale… lot ${Math.floor(start / 8) + 1} sur ${Math.ceil(candidates.length / 8)}.`;
        translations.push(...await requestTranslation(candidates.slice(start, start + 8).map((item) => item.source)));
      }
      if (requestId !== generationId || !basaaAiMode) return;
      suggestions = candidates.map((item, index) => ({ ...item, translation: translations[index] }));
      renderSuggestions();
      status.textContent = `${suggestions.length} suggestion(s) générée(s) localement. Aucune n’a été appliquée automatiquement.`;
    } catch (error) {
      if (requestId !== generationId) return;
      suggestions = [];
      suggestionsContainer.replaceChildren();
      status.textContent = `Échec de la traduction locale : ${error.message}`;
    } finally {
      if (requestId === generationId) {
        generating = false;
        generateButton.disabled = false;
      }
    }
  }

  function updateStatus() {
    const applicable = dataset.records.filter((record) => record.status === "approved" && record.target.trim()).length;
    const pending = dataset.records.length - applicable;
    generateButton.hidden = !basaaAiMode;
    restoreButton.hidden = !basaaAiMode || aiAppliedNodes.size === 0;

    if (basaaAiMode) {
      launcher.textContent = "Langue : bàsàa (IA locale)";
      notice.textContent = "Aperçu expérimental avec Aya Expanse via Ollama local (127.0.0.1). Les champs, noms probables, liens et textes contenant des chiffres sont exclus. Les suggestions ne sont jamais appliquées automatiquement : vérifiez-les avec un locuteur avant tout usage.";
      if (!generating && !status.textContent.startsWith("Échec") && !status.textContent.startsWith("La page a changé")) {
        status.textContent = `${aiAppliedNodes.size} élément(s) modifié(s) manuellement dans cet aperçu. Aucun texte n’est envoyé à un service distant.`;
      }
      return;
    }

    launcher.textContent = currentLanguage === "fr" ? "Langue : français" : "Langue : eton";
    if (currentLanguage === "fr") {
      notice.textContent = "La page est affichée en français.";
      status.textContent = "";
      return;
    }
    notice.textContent = "Seules les phrases éton validées par une personne compétente sont traduites. Les textes non validés restent en français.";
    status.textContent = `${applicable} phrase(s) validée(s) sur ${dataset.records.length}; ${pending} en attente. Le lexique de référence contient ${lexicon.records.length} entrées attestées par le dictionnaire, à interpréter selon le contexte.`;
  }

  function setLanguage(language) {
    generationId += 1;
    generating = false;
    generateButton.disabled = false;
    restoreAiTranslations();
    basaaAiMode = language === "basaa-ai";
    currentLanguage = language === "eton" ? "eton" : "fr";
    if (!basaaAiMode) {
      suggestions = [];
      suggestionsContainer.replaceChildren();
    }
    visit(document.body);
    updateStatus();
  }

  languageSelect.addEventListener("change", () => setLanguage(languageSelect.value));
  generateButton.addEventListener("click", generateAiSuggestions);
  restoreButton.addEventListener("click", () => {
    restoreAiTranslations();
    suggestions = suggestions.map((suggestion) => ({ ...suggestion, applied: false }));
    renderSuggestions();
    updateStatus();
  });
  launcher.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    launcher.setAttribute("aria-expanded", String(!panel.hidden));
    if (!panel.hidden) languageSelect.focus();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) {
      panel.hidden = true;
      launcher.setAttribute("aria-expanded", "false");
      launcher.focus();
    }
  });

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "characterData") {
        translateNode(mutation.target);
        continue;
      }
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.TEXT_NODE) translateNode(node);
        else if (node.nodeType === Node.ELEMENT_NODE && node !== host) visit(node);
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  updateStatus();
})();
