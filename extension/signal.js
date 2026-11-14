// Analyse de signal Alliance : mesure un enregistrement de voix pour le jouer avec le même rendu que
// les autres (silences de début et de fin écartés, même niveau sonore). Le fichier n'est pas modifié.
// Aucun accès au DOM ni au réseau ici, pour pouvoir le tester hors navigateur.
(() => {
  const FRAME = 0.02;          // fenêtre de mesure : 20 ms
  const HOP = 0.01;            // pas : 10 ms
  const TARGET_RMS = 0.1;      // niveau visé de la voix : -20 dBFS
  const PEAK_LIMIT = 0.89;     // crête maximale après gain : -1 dBFS
  const MAX_GAIN = 8;          // +18 dB au plus, pour ne pas faire monter le bruit de fond
  const PAD_BEFORE = 0.08;     // marge gardée avant la voix (s)
  const PAD_AFTER = 0.15;      // marge gardée après la voix (s)
  const MIN_RUN = 3;           // la voix doit tenir au moins 3 fenêtres : un clic isolé n'en est pas

  const db = (value) => (value > 0 ? 20 * Math.log10(value) : -Infinity);

  function percentile(sorted, fraction) {
    return sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))];
  }

  // samples : Float32Array mono entre -1 et 1. Renvoie les réglages de lecture et les mesures.
  function analyze(samples, sampleRate) {
    const duration = samples.length / sampleRate;
    const neutral = { start: 0, end: duration, gain: 1, duration, voiceDb: -Infinity, peakDb: -Infinity, noiseDb: -Infinity, clipped: false, voiced: false };
    const size = Math.round(FRAME * sampleRate);
    const hop = Math.round(HOP * sampleRate);
    if (samples.length < size * MIN_RUN) return neutral;

    const energy = [];
    for (let offset = 0; offset + size <= samples.length; offset += hop) {
      let sum = 0;
      for (let i = offset; i < offset + size; i += 1) sum += samples[i] * samples[i];
      energy.push(Math.sqrt(sum / size));
    }
    const sorted = [...energy].sort((a, b) => a - b);
    const noise = percentile(sorted, 0.1);
    const loud = percentile(sorted, 0.95);
    if (loud <= 1e-4) return neutral;   // fichier muet
    // Est « voix » ce qui dépasse nettement le bruit de fond, et au moins -26 dB sous les passages forts.
    const threshold = Math.max(noise * 3, loud * 0.05);

    const runAt = (index, step) => {
      for (let k = 0; k < MIN_RUN; k += 1) {
        const value = energy[index + k * step];
        if (value === undefined || value < threshold) return false;
      }
      return true;
    };
    let first = 0;
    while (first < energy.length && !runAt(first, 1)) first += 1;
    let last = energy.length - 1;
    while (last > first && !runAt(last, -1)) last -= 1;
    if (first >= energy.length) return neutral;

    const start = Math.max(0, (first * hop) / sampleRate - PAD_BEFORE);
    const end = Math.min(duration, (last * hop + size) / sampleRate + PAD_AFTER);

    let sum = 0;
    let count = 0;
    for (let i = first; i <= last; i += 1) {
      if (energy[i] >= threshold) { sum += energy[i] * energy[i]; count += 1; }
    }
    const voice = Math.sqrt(sum / count);
    let peak = 0;
    let saturated = 0;
    for (let i = Math.floor(start * sampleRate); i < Math.min(samples.length, Math.ceil(end * sampleRate)); i += 1) {
      const value = Math.abs(samples[i]);
      if (value > peak) peak = value;
      if (value >= 0.999) saturated += 1;
    }
    const gain = Math.min(TARGET_RMS / voice, PEAK_LIMIT / peak, MAX_GAIN);
    return {
      start, end, gain, duration,
      voiceDb: db(voice), peakDb: db(peak), noiseDb: db(noise),
      clipped: saturated > sampleRate * 0.001,   // plus d'une milliseconde écrêtée au total
      voiced: true,
    };
  }

  // Mélange les canaux d'un AudioBuffer en mono pour la mesure.
  function mono(buffer) {
    const mix = new Float32Array(buffer.length);
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < data.length; i += 1) mix[i] += data[i] / buffer.numberOfChannels;
    }
    return mix;
  }

  globalThis.AllianceSignal = { analyze, mono, db, TARGET_RMS, PEAK_LIMIT };
})();
