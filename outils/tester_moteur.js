// Vérifie le moteur de correspondance hors navigateur : node outils/tester_moteur.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ext = path.join(__dirname, "..", "extension");
vm.runInThisContext(fs.readFileSync(path.join(ext, "engine.js"), "utf8"));
const read = (name) => JSON.parse(fs.readFileSync(path.join(ext, "locales", name), "utf8"));
const index = read("index.json");
const tables = Object.fromEntries(index.langues.map((l) => [l.code, read(l.fichier)]));
const engine = AllianceEngine.create(index, tables);

let failures = 0;
const check = (label, ok, detail = "") => {
  if (!ok) { failures += 1; console.log(`ECHEC ${label} ${detail}`); }
};

// 1. Mêmes clés partout, aucune valeur vide.
const keys = Object.keys(tables.fr);
for (const { code } of index.langues) {
  check(`cles ${code}`, JSON.stringify(Object.keys(tables[code]).sort()) === JSON.stringify([...keys].sort()));
  // null est admis hors langues source : « pas encore d'équivalent ».
  const isSource = index.languesSource.includes(code);
  check(`valeurs vides ${code}`, Object.values(tables[code]).every((v) => (v === null && !isSource) || (typeof v === "string" && v.trim())));
  const missing = Object.values(tables[code]).filter((v) => v === null).length;
  if (missing) console.log(`${code} : ${missing} cle(s) sans equivalent`);
}

// 2. Chaque texte source (fr et en) est reconnu et rendu dans chaque langue.
const fill = (text) => text
  .replace("{prenom}", "Amina").replace("{numero_compte}", "CM 001 2345 6789 01")
  .replace("{taux}", "1,5").replace("{min}", "100").replace("{max}", "2 500");
let pairs = 0;
for (const source of index.languesSource) {
  for (const key of keys) {
    const sourceText = fill(tables[source][key]);
    // une même phrase source peut servir plusieurs clés : toutes les réponses possibles sont acceptées
    const sameSource = keys.filter((k) => tables[source][k] === tables[source][key]);
    for (const { code } of index.langues) {
      const result = engine.translate(` ${sourceText} `, code);
      pairs += 1;
      if (tables[code][sameSource[0]] === null) {
        // la première clé décide : sans équivalent, le texte doit rester intact
        check(`${source}->${code} ${key} (sans equivalent : intact)`, result === null, JSON.stringify(result));
        continue;
      }
      const accepted = sameSource.filter((k) => tables[code][k] !== null).map((k) => ` ${fill(tables[code][k])} `);
      check(`${source}->${code} ${key}`, result && accepted.includes(result.text), JSON.stringify(result));
    }
  }
}

// 3. Les valeurs sont conservées à l'identique dans les phrases à variables.
const templated = [
  ["Bonjour, Amina", ["Amina"]],
  ["Hello, Amina", ["Amina"]],
  ["Numéro de compte : CM 001 2345 6789 01", ["CM 001 2345 6789 01"]],
  ["Account number : CM 001 2345 6789 01", ["CM 001 2345 6789 01"]],
  ["Frais de 1,5 % (min. 100 FCFA, max. 2 500 FCFA)", ["1,5", "100", "2 500", "FCFA"]],
  ["Frais de 2 % (min. 200 FCFA, max. 5 000 FCFA)", ["2", "200", "5 000", "FCFA"]],
  ["1.5% fee (min. 100 FCFA, max. 2,500 FCFA)", ["1.5", "100", "2,500", "FCFA"]],
  ["2% fee (min. 200 FCFA, max. 5,000 FCFA)", ["2", "200", "5,000", "FCFA"]],
];
for (const [text, values] of templated) {
  for (const { code } of index.langues) {
    const result = engine.translate(text, code);
    // sans équivalent dans cette langue le texte reste intact ; sinon les valeurs doivent être conservées
    check(`variables ${code} "${text}"`, result === null || values.every((v) => result.text.includes(v)), JSON.stringify(result));
  }
}

// 4. Les valeurs protégées et les textes inconnus ne sont jamais touchés.
const untouched = [
  "250 000 FCFA", "-12 500 FCFA", "+180 000 FCFA", "25 000 FCFA", "0 FCFA", "FCFA",
  "Amina Ngo Bell", "AN", "Jean-Paul Mbarga", "+237 6 99 12 34 56", "CM 001 2345 6789 01",
  "SAF-2026-A1B2C3", "05 nov. 2026", "Nov 5, 2026", "AMOUNT_002", "SECURITY_001",
  "Safinum Pay", "EN", "FR", "1", "5", "Paiement de services",
  "Bonjour, votre compte est bloqué", "Un message important pour les clients",
  "Numéro de compte : inconnu pour le moment.",
];
for (const text of untouched) {
  for (const { code } of index.langues) {
    check(`intact ${code} "${text}"`, engine.translate(text, code) === null, JSON.stringify(engine.translate(text, code)));
  }
}

// 5. Tables audio : clés connues, fichiers présents, valeurs prononcées déclarées pour les phrases à variables.
for (const language of index.langues.filter((l) => l.audio)) {
  const audio = JSON.parse(fs.readFileSync(path.join(ext, language.audio), "utf8"));
  for (const [key, entry] of Object.entries(audio.cles)) {
    check(`audio ${language.code} ${key} : cle connue`, keys.includes(key));
    check(`audio ${language.code} ${key} : fichier present`, fs.existsSync(path.join(ext, audio.dossier, entry.fichier)), entry.fichier);
    check(`audio ${language.code} ${key} : valeurs declarees`, /\{\w+\}/.test(tables.fr[key]) === Boolean(entry.valeurs));
  }
  console.log(`audio ${language.code} : ${Object.keys(audio.cles).length} cle(s) sur ${keys.length}`);
}

// 6. Analyse de signal : un son faible entouré de silence est recadré et ramené au niveau visé ;
//    un son fort est atténué ; un fichier muet est laissé tel quel.
vm.runInThisContext(fs.readFileSync(path.join(ext, "signal.js"), "utf8"));
const RATE = 16000;
const tone = (amplitude) => {
  const samples = new Float32Array(RATE * 2.5);
  for (let i = RATE; i < RATE * 1.5; i += 1) samples[i] = amplitude * Math.sin((2 * Math.PI * 220 * i) / RATE);
  return samples;
};
const quiet = AllianceSignal.analyze(tone(0.02), RATE);
check("signal : silence de debut coupe", quiet.start > 0.85 && quiet.start <= 1, String(quiet.start));
check("signal : silence de fin coupe", quiet.end >= 1.5 && quiet.end < 1.75, String(quiet.end));
check("signal : son faible remonte a -20 dB", Math.abs(quiet.voiceDb + AllianceSignal.db(quiet.gain) + 20) < 0.5, String(quiet.gain));
const loud = AllianceSignal.analyze(tone(0.9), RATE);
check("signal : son fort attenue a -20 dB", loud.gain < 1 && Math.abs(loud.voiceDb + AllianceSignal.db(loud.gain) + 20) < 0.5, String(loud.gain));
const mute = AllianceSignal.analyze(new Float32Array(RATE), RATE);
check("signal : fichier muet inchange", mute.gain === 1 && mute.start === 0 && !mute.voiced);

console.log(`${keys.length} cles, ${index.langues.length} langues, ${pairs} correspondances verifiees, ${failures} echec(s)`);
process.exit(failures ? 1 : 0);
