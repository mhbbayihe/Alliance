// Mesure tous les enregistrements de extension/audio avec l'analyse de signal de l'extension (signal.js),
// dans un vrai navigateur (c'est lui qui décode l'AAC), et affiche les réglages de lecture de chacun.
// Usage : node outils/analyser_audio.js "<chemin de msedge.exe ou chrome.exe>" [langue]
// Demande Node 22 ou plus récent. Aucun fichier n'est modifié.
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const browser = process.argv[2];
const ext = path.join(__dirname, "..", "extension");
// Tous les enregistrements, par dossier de langue : « eton/03 - Bénéficiaire.aac ».
const only = process.argv[3];   // facultatif : une seule langue
const files = fs.readdirSync(path.join(ext, "audio"), { withFileTypes: true }).filter((d) => d.isDirectory() && (!only || d.name === only))
  .flatMap((d) => fs.readdirSync(path.join(ext, "audio", d.name)).filter((name) => /\.(aac|ogg|mp3|m4a|opus|wav)$/i.test(name)).sort().map((name) => `${d.name}/${name}`));
const PORT = 9338;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const child = spawn(browser, [
    "--headless=new", `--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(), "safilang-audio-"))}`,
    `--load-extension=${ext}`, `--disable-extensions-except=${ext}`, `--remote-debugging-port=${PORT}`,
    "--no-first-run", "--no-default-browser-check", "--autoplay-policy=no-user-gesture-required", "about:blank",
  ], { stdio: "ignore" });
  let code = 0;
  try {
    let target;
    for (let i = 0; i < 40 && !target; i += 1) {
      await sleep(500);
      try {
        target = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find((t) => t.type === "page");
      } catch { /* le navigateur démarre */ }
    }
    if (!target) throw new Error("navigateur injoignable");
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    let id = 0;
    const pending = new Map();
    const contexts = [];
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.method === "Runtime.executionContextCreated") contexts.push(message.params.context);
      if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
    };
    const send = (method, params = {}) => new Promise((resolve) => {
      id += 1; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params }));
    });

    await send("Page.enable");
    await send("Runtime.enable");
    await send("Page.navigate", { url: "https://safinum.cm/hackathon-test" });
    // Le monde isolé de l'extension : là où signal.js est chargé et où ses fichiers sont lisibles.
    let context;
    for (let i = 0; i < 40 && !context; i += 1) {
      await sleep(500);
      context = contexts.filter((c) => c.origin.startsWith("chrome-extension://")).pop();
    }
    if (!context) throw new Error("l'extension n'est pas active dans ce navigateur");
    await sleep(1500);
    context = contexts.filter((c) => c.origin.startsWith("chrome-extension://")).pop();

    const reply = await send("Runtime.evaluate", {
      contextId: context.id, returnByValue: true, awaitPromise: true,
      expression: `(async () => {
        const audio = new AudioContext();
        const out = [];
        for (const name of ${JSON.stringify(files)}) {
          try {
            const data = await (await fetch(chrome.runtime.getURL("audio/" + name.split("/").map(encodeURIComponent).join("/")))).arrayBuffer();
            const buffer = await audio.decodeAudioData(data);
            out.push({ name, ...SafiLangSignal.analyze(SafiLangSignal.mono(buffer), buffer.sampleRate) });
          } catch (error) { out.push({ name, error: String(error) }); }
        }
        return out;
      })()`,
    });
    if (reply.result.exceptionDetails) throw new Error(JSON.stringify(reply.result.exceptionDetails).slice(0, 400));
    const rows = reply.result.result.value;

    const f = (value, digits = 1) => (Number.isFinite(value) ? value.toFixed(digits) : "  -");
    console.log("durée  gardé   voix dB  crête dB  bruit dB  gain dB  remarques   fichier");
    for (const r of rows) {
      if (r.error) { console.log(`ILLISIBLE ${r.name} : ${r.error}`); code = 1; continue; }
      const gainDb = 20 * Math.log10(r.gain);
      const notes = [];
      if (!r.voiced) notes.push("pas de voix détectée");
      if (r.clipped) notes.push("saturé");
      if (r.voiceDb - r.noiseDb < 20) notes.push("bruit de fond fort");
      if (gainDb >= 17.9) notes.push("très faible, gain plafonné");
      const afterDb = r.voiceDb + gainDb;
      if (r.voiced && afterDb < -23) notes.push(`reste à ${f(afterDb)} dB (crêtes)`);
      if (r.duration - (r.end - r.start) > 1) notes.push(`${f(r.duration - (r.end - r.start))} s de silence coupé`);
      console.log(`${f(r.duration).padStart(5)}  ${f(r.end - r.start).padStart(5)}  ${f(r.voiceDb).padStart(7)}  ${f(r.peakDb).padStart(8)}  ${f(r.noiseDb).padStart(8)}  ${((gainDb >= 0 ? "+" : "") + f(gainDb)).padStart(7)}  ${(notes.join(", ") || "-")}   ${r.name}`);
    }
    const ok = rows.filter((r) => r.voiced);
    const before = ok.map((r) => r.voiceDb);
    const after = ok.map((r) => r.voiceDb + 20 * Math.log10(r.gain));
    const spread = (list) => `${f(Math.min(...list))} à ${f(Math.max(...list))} dB`;
    console.log(`\n${rows.length} fichier(s). Niveau de la voix avant : ${spread(before)} ; après réglage : ${spread(after)} (cible -20 dB).`);
    ws.close();
  } catch (error) {
    code = 1;
    console.log("ERREUR", error.message);
  } finally {
    child.kill();
  }
  process.exit(code);
})();
