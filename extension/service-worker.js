const OLLAMA_URL = "http://127.0.0.1:11434/api/chat";
const MODEL = "aya-expanse:8b";
const MAX_BATCH_SIZE = 8;

function isAllowedPage(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.origin === "https://safinum.cm" &&
      (parsed.pathname === "/hackathon-test" || parsed.pathname.startsWith("/hackathon-test/"));
  } catch {
    return false;
  }
}

function normalizeTranslations(translations, texts) {
  let candidates = translations;
  if (
    candidates.length === texts.length * 2 &&
    texts.every((text, index) => candidates[index * 2] === text)
  ) {
    candidates = texts.map((_, index) => candidates[index * 2 + 1]);
  }

  if (candidates.length !== texts.length) {
    throw new Error("Le modèle a renvoyé un nombre inattendu de traductions.");
  }

  return candidates.map((candidate, index) => {
    const source = texts[index];
    let translation = candidate;
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      if (candidate.source !== source || typeof candidate.translation !== "string") {
        throw new Error("Le modèle a renvoyé une phrase source inattendue.");
      }
      translation = candidate.translation;
    }
    if (typeof translation !== "string") {
      throw new Error("Le modèle a renvoyé une traduction invalide.");
    }

    const prefixedSource = new RegExp(`^${source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[:：—-]\\s*`, "u");
    translation = translation.trim().replace(prefixedSource, "").trim();
    translation = translation.replace(/^["'“‘]|["'”’]$/gu, "").trim();
    return translation;
  });
}

async function translateBatch(texts) {
  if (
    !Array.isArray(texts) ||
    texts.length === 0 ||
    texts.length > MAX_BATCH_SIZE ||
    texts.some((text) =>
      typeof text !== "string" ||
      !text.trim() ||
      text.length > 240 ||
      /\p{N}/u.test(text)
    )
  ) {
    throw new Error("Le lot de textes à traduire est invalide.");
  }

  const schema = {
    type: "object",
    properties: {
      translations: {
        type: "array",
        minItems: texts.length,
        maxItems: texts.length,
        items: { type: "string" },
      },
    },
    required: ["translations"],
    additionalProperties: false,
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 240_000);

  try {
    const response = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL,
        stream: false,
        format: schema,
        options: { temperature: 0, num_predict: 400 },
        messages: [
          {
            role: "system",
            content: [
              "Translate each French user-interface phrase into Basaa (Bassa, ɓàsàa) as spoken in Cameroon.",
              "This is an experimental translation. Do not invent a translation when uncertain; return the original French phrase unchanged instead.",
              "Keep personal names, proper nouns, and the meaning of every phrase unchanged.",
              "Return exactly one short Basaa phrase for each input, in the same order, in the required JSON object.",
              "Do not repeat or prepend the French source; if unsure, return that source unchanged.",
            ].join(" "),
          },
          {
            role: "user",
            content: JSON.stringify({ texts }),
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama a répondu avec le statut ${response.status}.`);
    }

    const payload = await response.json();
    const result = JSON.parse(payload.message?.content || "");
    if (!Array.isArray(result.translations)) {
      throw new Error("Le modèle a renvoyé un résultat invalide.");
    }

    const translations = normalizeTranslations(result.translations, texts);
    if (
      translations.some((text) =>
        !text ||
        text.length > 1000 ||
        /\p{N}/u.test(text)
      )
    ) {
      throw new Error("Le modèle a renvoyé un résultat invalide.");
    }
    return translations;
  } finally {
    clearTimeout(timeout);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "safilang:translate-bassa") return undefined;
  if (!isAllowedPage(sender.tab?.url || sender.url)) {
    sendResponse({ error: "Cette page n'est pas autorisée à utiliser le modèle local." });
    return undefined;
  }

  translateBatch(message.texts)
    .then((translations) => sendResponse({ translations }))
    .catch((error) => {
      console.error("SafiLang: échec de la traduction locale.", error);
      sendResponse({
        error: error.name === "AbortError"
          ? "Ollama n'a pas répondu dans le délai prévu."
          : error.message || "Impossible de joindre Ollama en local.",
      });
    });

  return true;
});
