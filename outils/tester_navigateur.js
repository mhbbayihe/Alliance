// Test de bout en bout dans un vrai navigateur, sur la page de test officielle (opérations simulées).
// Usage : node outils/tester_navigateur.js "<chemin de msedge.exe ou chrome.exe>" [dossier de profil temporaire] [capture.png]
// Demande Node 22 ou plus récent (WebSocket intégré). N'utilise aucune bibliothèque.
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const browser = process.argv[2];
const profile = process.argv[3] || fs.mkdtempSync(path.join(os.tmpdir(), "alliance-profil-"));
const shot = process.argv[4];
const ext = path.join(__dirname, "..", "extension");
const read = (name) => JSON.parse(fs.readFileSync(path.join(ext, "locales", name), "utf8"));
const L = { fr: read("fr.json"), en: read("en.json"), basaa: read("basaa.json"), eton: read("eton.json") };
const PORT = 9337;
const URL_TEST = "https://safinum.cm/hackathon-test";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
const check = (label, ok, detail = "") => {
  console.log(`${ok ? "ok   " : "ECHEC"} ${label}${ok ? "" : " " + detail}`);
  if (!ok) failures += 1;
};

(async () => {
  const child = spawn(browser, [
    "--headless=new", `--user-data-dir=${profile}`, `--load-extension=${ext}`,
    `--disable-extensions-except=${ext}`, `--remote-debugging-port=${PORT}`,
    "--no-first-run", "--no-default-browser-check", "--autoplay-policy=no-user-gesture-required", "--window-size=1280,1600", "about:blank",
  ], { stdio: "ignore" });

  try {
    let target;
    for (let i = 0; i < 40 && !target; i += 1) {
      await sleep(500);
      try {
        const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
        target = list.find((t) => t.type === "page");
      } catch { /* le navigateur démarre */ }
    }
    if (!target) throw new Error("navigateur injoignable");

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    let id = 0;
    const pending = new Map();
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
    };
    const send = (method, params = {}) => new Promise((resolve) => {
      id += 1; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params }));
    });
    const run = async (expression) => {
      const reply = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (reply.result.exceptionDetails) throw new Error(JSON.stringify(reply.result.exceptionDetails).slice(0, 400));
      return reply.result.result.value;
    };
    // textContent (et non innerText) : sans les majuscules de mise en forme ; espaces insécables ramenées à des espaces.
    const page = () => run(`document.querySelector("#app").textContent.replace(/[\\u00A0\\u202F]/g, " ")`);
    const pick = async (name) => {
      await run(`(() => { const b = [...document.querySelector("#alliance-host").shadowRoot.querySelectorAll(".language")]
        .find((x) => x.firstChild.textContent === ${JSON.stringify(name)}); b.click(); })()`);
      await sleep(150);
    };
    const clickButton = async (text) => {
      const done = await run(`(() => { const b = [...document.querySelectorAll("#app button")]
        .find((x) => x.textContent.trim() === ${JSON.stringify(text)}); if (b) b.click(); return Boolean(b); })()`);
      await sleep(400);
      return done;
    };

    await send("Page.enable");
    await send("Page.navigate", { url: URL_TEST });
    let ready = false;
    for (let i = 0; i < 40 && !ready; i += 1) {
      await sleep(500);
      ready = await run(`Boolean(document.querySelector("#alliance-host")?.shadowRoot?.querySelector(".language")) && document.body.innerText.includes("FCFA")`).catch(() => false);
    }
    check("extension chargée sur la page", ready);
    if (!ready) throw new Error("l'extension n'est pas active dans ce navigateur");

    const original = await page();
    check("page d'origine en français", original.includes(L.fr.availableBalance));

    // 1. Changement de langue immédiat, dans toutes les langues, valeurs intactes.
    for (const [name, code] of [["Bàsàa", "basaa"], ["Eton", "eton"], ["English", "en"], ["Français", "fr"]]) {
      await pick(name);
      const text = await page();
      const expected = [L[code].availableBalance, L[code].overviewSubtitle, L[code].hello.replace("{prenom}", "Amina"),
        L[code].accountNumberLabel.replace("{numero_compte}", "CM 001 2345 6789 01"), L[code]["transactions.2"], L[code].securityTip];
      const missing = expected.filter((e) => !text.includes(e));
      check(`${name} : textes remplacés`, missing.length === 0, JSON.stringify(missing));
      check(`${name} : valeurs intactes`, ["250 000 FCFA", "Amina Ngo Bell", "CM 001 2345 6789 01", "-12 500 FCFA", "05 nov. 2026"].every((v) => text.includes(v)));
    }
    await pick("Eton");
    const etonText = await page();
    const noEquivalent = Object.keys(L.eton).filter((k) => L.eton[k] === null && !/\{/.test(L.fr[k]) && original.includes(L.fr[k]));
    check(`Eton : ${noEquivalent.length} texte(s) sans équivalent laissés en français sur cet écran`, noEquivalent.every((k) => etonText.includes(L.fr[k])));
    await pick("Page d’origine");
    check("retour à la page d'origine identique", (await page()) === original);

    // 2. Parcours complet en bàsàa.
    await pick("Bàsàa");
    const B = L.basaa;

    // 2 bis. Écoute (enregistrements éton) : le bouton apparaît près d'un texte enregistré et la lecture démarre.
    const speakerState = (text) => run(`(async () => {
      const s = document.querySelector("#alliance-host").shadowRoot.querySelector(".speaker");
      const el = [...document.querySelectorAll("#app *")].find((x) => [...x.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.replace(/[\\u00A0\\u202F]/g, " ").trim() === ${JSON.stringify(text)}));
      if (!el) return "texte introuvable";
      el.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 1800));   // délai de disparition du bouton précédent
      if (s.hidden) return "masqué";
      s.click();
      await new Promise((r) => setTimeout(r, 800));
      const etat = s.dataset.etat; s.click(); return etat;
    })()`);
    const speakerSetting = () => run(`document.querySelector("#alliance-host").shadowRoot.querySelector(".speaker").dataset.reglage || ""`);
    await pick("Eton");
    const audioState = await speakerState(L.eton.availableBalance);
    check("audio éton : lecture d'un texte enregistré", audioState === "lecture", audioState);
    const setting = await speakerSetting();
    check(`audio éton : silences coupés et niveau réglé (${setting})`, /^\d+\.\d+-\d+\.\d+ s, gain \d+\.\d+$/.test(setting) && !setting.startsWith("0.00-"), setting);
    check("audio éton : pas de bouton pour un texte sans enregistrement", (await speakerState(L.eton.overviewTitle)) === "masqué");
    const afterAudio = await page();
    check("audio : la page n'est pas modifiée par l'écoute", afterAudio.includes(L.eton.availableBalance) && afterAudio.includes("250 000 FCFA"));
    // 2 ter. Lecture de toute la page : plusieurs enregistrements s'enchaînent, le cadre suit, l'arrêt fonctionne.
    const reader = (js) => run(`(() => { const r = document.querySelector("#alliance-host").shadowRoot; const b = r.querySelector(".read"); const m = r.querySelector(".marker"); ${js} })()`);
    check("lecture de la page : bouton proposé en éton", (await reader(`return !b.hidden && b.textContent;`)) === "Lire toute la page");
    await reader(`b.click();`);
    let readCount = 0;
    for (let i = 0; i < 40 && readCount < 2; i += 1) { await sleep(500); readCount = Number(await reader(`return b.dataset.lus;`)); }
    check("lecture de la page : les enregistrements s'enchaînent", readCount >= 2, String(readCount));
    check("lecture de la page : cadre affiché sur le texte lu", (await reader(`return b.dataset.etat + "|" + m.hidden;`)) === "lecture|false");
    await reader(`b.click();`);
    await sleep(200);
    check("lecture de la page : arrêt", (await reader(`return b.dataset.etat + "|" + m.hidden + "|" + b.textContent;`)) === "|true|Lire toute la page");
    check("lecture de la page : la page n'est pas modifiée", (await page()) === afterAudio);
    // 2 quater. Français et anglais : voix de synthèse installée sur l'appareil (jamais une voix en ligne).
    const localVoices = await run(`new Promise((r) => { const list = () => speechSynthesis.getVoices().filter((v) => v.localService).map((v) => v.lang.slice(0, 2).toLowerCase());
      if (list().length) r(list()); else { speechSynthesis.onvoiceschanged = () => r(list()); setTimeout(() => r(list()), 3000); } })`);
    for (const [name, code] of [["Français", "fr"], ["English", "en"]]) {
      await pick(name);
      await sleep(300);
      if (!localVoices.includes(code)) {
        console.log(`info  ${name} : aucune voix locale sur cet appareil, écoute non proposée`);
        check(`${name} : sans voix locale, pas de bouton de lecture`, await reader(`return b.hidden;`));
        continue;
      }
      check(`${name} : lecture de page proposée (voix locale)`, !(await reader(`return b.hidden;`)));
      const voiceState = await speakerState("250 000 FCFA");
      check(`${name} : un montant peut être écouté`, voiceState === "lecture", voiceState);
      check(`${name} : la page n'est pas modifiée par la voix`, (await page()).includes("250 000 FCFA"));
    }
    await pick("Bàsàa");
    check("bàsàa : lecture de page proposée", !(await reader(`return b.hidden;`)));
    const basaaState = await speakerState(B.availableBalance);
    check("bàsàa : lecture d'un texte enregistré (ogg)", basaaState === "lecture", basaaState);
    check("étape 2 ouverte", await clickButton(B.startTransfer) && (await page()).includes(B.feesSubtitle));
    await run(`(() => { const s = document.querySelector("#app select"); s.value = "mobile_money"; s.dispatchEvent(new Event("change", { bubbles: true })); })()`);
    await sleep(300);
    // La description des frais prononce des chiffres : son enregistrement n'est pas joué tant qu'il n'est pas vérifié.
    check("bàsàa : pas d'écoute pour la description des frais (audio à vérifier)",
      (await speakerState(B["operation.fee_description"].replace("{taux}", "1,5").replace("{min}", "100").replace("{max}", "2 500"))) === "masqué");
    await sleep(300);
    let text = await page();
    check("description des frais : libellé traduit, chiffres intacts",
      text.includes(B["operation.fee_description"].replace("{taux}", "1,5").replace("{min}", "100").replace("{max}", "2 500")), text.slice(0, 600));
    check("frais calculés affichés tels quels", text.includes("375 FCFA") && text.includes("25 375 FCFA"));
    check("options de la liste traduites", (await run(`[...document.querySelectorAll("#app option")].map((o) => o.textContent).join("|")`)) ===
      [B["operation.safinum.label"], B["operation.mobile_money.label"], B["operation.other_bank.label"]].join("|"));
    check("étape 3 ouverte", await clickButton(B.continue) && (await page()).includes(B.newBeneficiaryWarning));
    check("champs de saisie non modifiés", (await run(`[...document.querySelectorAll("#app input[type=text], #app input[type=tel]")].map((i) => i.value).join("|")`)) ===
      "Jean-Paul Mbarga|+237 6 99 12 34 56|Paiement de services");
    await clickButton(B.continue);
    text = await page();
    check("alerte de sécurité traduite (case non cochée)", text.includes(B.securityTitle) && text.includes(B["error.SECURITY_001"]) && text.includes("SECURITY_001"));
    check("libellé accessible du bouton de fermeture traduit", (await run(`document.querySelector("#app button[aria-label]")?.getAttribute("aria-label")`)) === B.dismiss);
    await run(`document.querySelector("#app input[type=checkbox]").click()`);
    check("étape 4 ouverte", await clickButton(B.continue) && (await page()).includes(B.summarySubtitle));
    text = await page();
    check("récapitulatif : valeurs intactes", ["25 000 FCFA", "375 FCFA", "25 375 FCFA", "Jean-Paul Mbarga", "+237 6 99 12 34 56"].every((v) => text.includes(v)) && /SAF-\d{4}-[A-Z0-9]{6}/.test(text));
    await run(`document.querySelector("#app input[type=checkbox]").click()`);
    check("étape 5 ouverte", await clickButton(B.confirmButton) && (await page()).includes(B.receiptTitle));
    text = await page();
    check("reçu traduit, valeurs intactes", text.includes(B.receiptStatusValue) && text.includes("25 375 FCFA") && text.includes("Jean-Paul Mbarga"));

    // 3. Le contrôle d'intégrité de la page elle-même.
    const log = JSON.parse(await run(`sessionStorage.getItem("safinum-test-log") || "[]"`));
    check(`journal d'intégrité de la page : ${log.length} étape(s), toutes intactes`, log.length >= 4 && log.every((e) => e.status === "intact"),
      JSON.stringify(log.filter((e) => e.status !== "intact").map((e) => e.diff)));

    // 4. Contenu ajouté après le chargement, puis bascule FR/EN de la page.
    await run(`(() => { const d = document.createElement("div"); d.id = "essai-dynamique";
      d.innerHTML = "<p>Solde insuffisant pour effectuer ce transfert.</p><p>Texte libre jamais vu : 12 000 FCFA pour Awa.</p>";
      document.querySelector("#app").append(d); })()`);
    await sleep(300);
    text = await run(`document.querySelector("#essai-dynamique").textContent`);
    check("contenu dynamique connu traduit sans rechargement", text.includes(B["error.AMOUNT_002"]));
    check("contenu inconnu laissé tel quel", text.includes("Texte libre jamais vu : 12 000 FCFA pour Awa."));
    await clickButton("EN");
    text = await page();
    check("page basculée en anglais : toujours affichée en bàsàa", text.includes(B.receiptTitle) && !text.includes(L.en.receiptTitle));
    await pick("Page d’origine");
    text = await page();
    check("page d'origine : anglais de la page, pas l'ancien français", text.includes(L.en.receiptTitle) && !text.includes(L.fr.receiptTitle));

    // 5. La langue choisie est mémorisée après rechargement.
    await pick("Eton");
    await send("Page.navigate", { url: URL_TEST });
    for (let i = 0; i < 20; i += 1) {
      await sleep(500);
      if (await run(`document.body.textContent.includes(${JSON.stringify(L.eton.availableBalance)})`).catch(() => false)) break;
    }
    check("langue mémorisée après rechargement", (await page()).includes(L.eton.availableBalance));

    if (shot) {
      const png = await send("Page.captureScreenshot", { format: "png" });
      fs.writeFileSync(shot, Buffer.from(png.result.data, "base64"));
    }
    ws.close();
  } catch (error) {
    failures += 1;
    console.log("ERREUR", error.message);
  } finally {
    child.kill();
  }
  console.log(`${failures} echec(s)`);
  process.exit(failures ? 1 : 0);
})();
