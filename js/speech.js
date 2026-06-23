/* ============================================================
   speech.js — pet utterances as 汪汪汪（内容）
   The pet is a PET, not a chatbot. Every line it "says" is
   wrapped: a species bark/meow (length scaled by arousal) +
   the human-readable meaning in parentheses.
   Sleepy state softens the bark. Used at EVERY utterance site.
   ============================================================ */
(function () {
  const S = () => Store.s;

  // base syllables per species
  const SOUND = {
    '🐶': '汪',
    '🐱': '喵',
    '🐰': '吱',
  };
  // softer/variant sounds for low-energy or tender moments
  const SOFT = {
    '🐶': '呜',
    '🐱': '喵～',
    '🐰': '唔',
  };

  // build the bark prefix. Length scales with the MEANING text length
  // (longer thing to say -> more barks), still modulated by emotion.
  function bark(species, opts) {
    opts = opts || {};
    const sp = species || (S().pet && S().pet.species) || '🐶';
    const st = (S().emotion && S().emotion.state) || 'calm';
    const arousal = (S().emotion && S().emotion.arousal != null) ? S().emotion.arousal : 0.3;
    const base = SOUND[sp] || '汪';
    const len = opts.contentLen || 0;   // length of the meaning text

    if (st === 'sleepy') {
      return (SOFT[sp] || '呜') + '…';
    }
    if (st === 'sad' || st === 'wary') {
      // low, hesitant — short regardless of content
      const n = len > 18 ? 2 : 1;
      return (SOFT[sp] || '呜') + base.repeat(n) + '…';
    }
    // base count from content length, then nudged by arousal
    // ~1 bark per 5 chars, clamped 2..7
    let n = Math.round(len / 5);
    if (arousal >= 0.7) n += 2;
    else if (arousal >= 0.5) n += 1;
    n = Math.max(2, Math.min(7, n || 2));
    const tail = (st === 'happy' || st === 'excited') ? '～' : '';
    return base.repeat(n) + tail;
  }

  // wrap a human-meaning line into pet speech: 汪汪汪（内容）
  // text may be '' (pure bark). Returns the full display string.
  function voice(text, opts) {
    opts = opts || {};
    const sp = opts.species || (S().pet && S().pet.species) || '🐶';
    const clean = text ? String(text).replace(/^[汪喵吱呜唔～…]+[（(]?/, '').replace(/[）)]$/, '') : '';
    const prefix = bark(sp, Object.assign({ contentLen: clean.length }, opts));
    if (!clean) return prefix;
    return `${prefix}（${clean}）`;
  }

  // for places that already stored a wrapped line, get just the meaning back
  function meaning(line) {
    const m = String(line).match(/[（(]([^）)]*)[）)]\s*$/);
    return m ? m[1] : line;
  }

  window.Speech = { voice, bark, meaning };
})();
