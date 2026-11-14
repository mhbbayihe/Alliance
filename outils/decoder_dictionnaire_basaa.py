"""Decode the Njock French-Basaa dictionary (legacy CamCam SIL Doulos font encoding) into Unicode."""
import sys, os, json, re, unicodedata, collections
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "pylib"))
import pymupdf

pdf, out = sys.argv[1:3]

GRAVE, ACUTE, CIRC, MACRON, CARON, DIAER, CEDILLA = "̀", "́", "̂", "̄", "̌", "̈", "̧"
SPECIAL = {
    "∆": GRAVE, " ": GRAVE, "–": GRAVE, "¶": GRAVE, "™": GRAVE,
    "æ": ACUTE,
    "»": CIRC, "Ã": CIRC, "®": CIRC,
    "‘": MACRON, "Œ": MACRON,
    "¿": CARON, "Ÿ": CARON,
    "‹": DIAER,
    "¡": CEDILLA,
    "Õ": "i",          # dotless i, base for a narrow accent
    "œ": "ŋ",     # ŋ
    "Ø": "Ŋ",     # Ŋ
    "—": "ɔ",     # ɔ
    "ø": "ɛ",     # ɛ
    "¬": "ɓ",     # ɓ
    "¢": "Ɓ",     # Ɓ
    "∫": "'",
    "·": "·",     # ditto mark
}
unknown = collections.Counter()

def decode(text):
    res = []
    for ch in text:
        if ch in SPECIAL:
            res.append(SPECIAL[ch])
        elif 0x21 <= ord(ch) <= 0x7D:
            res.append(chr(ord(ch) + 1))
        elif ch in " \n\t":
            res.append(" ")
        else:
            unknown[ch] += 1
            res.append("�")
    return unicodedata.normalize("NFC", "".join(res))

doc = pymupdf.open(pdf)
POS_RE = re.compile(r"^[A-Za-zé]{1,6}\.$")
entries = []
last_fr = None
pending_fr = None
for pno in range(1, doc.page_count):
    page = doc[pno]
    spans = []
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            for span in line["spans"]:
                t = span["text"].strip()
                if not t:
                    continue
                if "CamCam" in span["font"]:
                    if span["size"] > 14:
                        continue  # letter heading
                    txt = decode(span["text"])
                elif t == "·":
                    txt = "·"
                else:
                    continue
                yc = (span["bbox"][1] + span["bbox"][3]) / 2
                spans.append((yc, span["bbox"][0], " ".join(txt.split())))
    spans.sort()
    rows, cur = [], []
    for sp in spans:
        if cur and sp[0] - cur[0][0] > 6:
            rows.append(cur); cur = []
        cur.append(sp)
    if cur:
        rows.append(cur)
    for row in rows:
        row.sort(key=lambda s: s[1])
        fr = ""
        rest = row
        if row[0][1] < 100:
            fr = row[0][2]
            rest = row[1:]
        pos, ba = "", ""
        parts = [r[2] for r in rest]
        if parts and (POS_RE.match(parts[0]) or parts[0] == "·") and len(parts) > 1:
            pos = parts[0]
            ba = " ".join(parts[1:])
        else:
            ba = " ".join(parts)
        if pos == "·":
            pos = ""
        if fr in ("", "·"):
            if not ba:
                continue
            if fr == "" and pending_fr:
                fr_final = pending_fr
                last_fr = pending_fr
            elif fr == "" and not pos and entries and entries[-1]["page"] == pno + 1:
                entries[-1]["basaa"] += " " + ba
                continue
            else:
                fr_final = last_fr
            pending_fr = None
        else:
            if not ba:
                pending_fr = (pending_fr + " " + fr) if pending_fr else fr
                continue
            fr_final = (pending_fr + " " + fr) if pending_fr else fr
            pending_fr = None
            last_fr = fr_final
        if fr_final is None:
            continue
        entries.append({"fr": fr_final, "cat": pos, "basaa": ba, "page": pno + 1})

meta = {
    "titre": "Dictionnaire français-basaa",
    "auteur": "Dr Pierre Emmanuel Njock",
    "annee": 2005,
    "licence": "non indiquée dans le PDF — à vérifier avant toute diffusion",
    "note": "Extraction automatique. La police d'origine (CamCam SIL Doulos) utilisait un codage ancien ; le texte a été reconverti en Unicode. Les tons bas portent un accent grave, les tons hauts ne sont pas marqués. Vérifier toute forme sur la page indiquée du PDF avant usage.",
    "caracteres_non_decodes": {f"U+{ord(k):04X}": v for k, v in unknown.items()},
    "entrees": len(entries),
}
with open(out, "w", encoding="utf-8", newline="\n") as f:
    json.dump({"source": meta, "entrees": entries}, f, ensure_ascii=False, indent=0)
sys.stdout.buffer.write((json.dumps(meta, ensure_ascii=False) + "\n").encode("utf-8"))
for e in entries[:25] + entries[5000:5010]:
    sys.stdout.buffer.write((json.dumps(e, ensure_ascii=False) + "\n").encode("utf-8"))
