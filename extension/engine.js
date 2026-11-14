// Moteur de correspondance SafiLang : texte source -> clé -> texte dans la langue choisie.
// Aucun accès au DOM ni au réseau ici, pour pouvoir le tester hors navigateur.
(() => {
  function normalize(text) {
    return text
      .replace(/[‘’]/g, "'")
      .replace(/[\s  ]+/gu, " ")
      .trim();
  }

  function escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // "Bonjour, {prenom}" -> /^Bonjour, (?<prenom>...)$/u
  function compileTemplate(source, variables) {
    const names = [];
    const pattern = normalize(source)
      .split(/(\{\w+\})/u)
      .map((part) => {
        const variable = /^\{(\w+)\}$/u.exec(part);
        if (!variable) return escapeRegex(part).replace(/ /g, "[\\s\\u00A0\\u202F]+");
        names.push(variable[1]);
        return `(?<${variable[1]}>${variables[variable[1]] || ".+?"})`;
      })
      .join("");
    return { regex: new RegExp(`^${pattern}$`, "u"), names };
  }

  function create(index, tables) {
    const exact = new Map();   // texte source normalisé -> clé
    const templates = [];      // { key, regex, names }
    const variables = index.variables || {};

    for (const language of index.languesSource) {
      const table = tables[language] || {};
      for (const [key, value] of Object.entries(table)) {
        if (/\{\w+\}/u.test(value)) {
          templates.push({ key, ...compileTemplate(value, variables) });
        } else if (!exact.has(normalize(value))) {
          exact.set(normalize(value), key);
        }
      }
    }

    // Renvoie { text, key } (et values pour une phrase à variables) ou null si le texte n'a pas de correspondance.
    function translate(raw, language) {
      const table = tables[language];
      if (!table || typeof raw !== "string") return null;
      const parts = /^([\s  ]*)([\s\S]*?)([\s  ]*)$/u.exec(raw);
      const core = parts[2];
      if (!core) return null;

      const key = exact.get(normalize(core));
      if (key !== undefined) {
        const target = table[key];
        if (typeof target !== "string" || !target) return null;
        return { text: parts[1] + target + parts[3], key };
      }

      for (const template of templates) {
        const match = template.regex.exec(core);
        if (!match) continue;
        const target = table[template.key];
        if (typeof target !== "string" || !target) return null;
        let complete = true;
        const text = target.replace(/\{(\w+)\}/gu, (_, name) => {
          const value = match.groups[name];
          if (value === undefined) complete = false;
          return value;
        });
        // Chaque valeur capturée doit se retrouver telle quelle dans le résultat.
        if (!complete || template.names.some((name) => !text.includes(match.groups[name]))) return null;
        return { text: parts[1] + text + parts[3], key: template.key, values: { ...match.groups } };
      }
      return null;
    }

    return { translate, size: exact.size + templates.length };
  }

  globalThis.SafiLangEngine = { create, normalize };
})();
