/* ============================================================
   emotion.js — emotion state machine (PRD §3 Day0-7 engine)
   States: happy / excited / calm / sleepy / sad / wary
   Driven by: interactions, time/energy decay, personality drift.
   Avatar rendering reads this.
   ============================================================ */
(function () {
  const S = () => Store.s;

  const FACES = {
    '🐶': { happy: '🐶', excited: '🐶', calm: '🐶', sleepy: '😴', sad: '🐶', wary: '🐶' },
    '🐱': { happy: '🐱', excited: '🐱', calm: '🐱', sleepy: '😴', sad: '🐱', wary: '🐱' },
    '🐰': { happy: '🐰', excited: '🐰', calm: '🐰', sleepy: '😴', sad: '🐰', wary: '🐰' },
  };
  // mood overlay emoji shown in bubble area
  const MOOD_EMOJI = {
    happy: '💕', excited: '✨', calm: '🌿', sleepy: '💤', sad: '🌧️', wary: '😟',
  };
  const MOOD_TAG = {
    happy: '心情很好', excited: '超级兴奋', calm: '安安静静', sleepy: '有点困了', sad: '有点低落', wary: '有点不安',
  };

  function recompute() {
    const e = S().emotion;
    // energy decays while awake (driven elsewhere via tick)
    let { valence, arousal, energy } = e;
    let state = 'calm';
    if (energy < 0.2) state = 'sleepy';
    else if (valence <= -0.35) state = 'sad';
    else if (Persona.effective().wariness > 0.45 && valence < 0) state = 'wary';
    else if (valence >= 0.5 && arousal >= 0.55) state = 'excited';
    else if (valence >= 0.3) state = 'happy';
    else state = 'calm';
    e.state = state;
    e.lastUpdate = Date.now();
    return state;
  }

  // nudge emotion from an interaction or message tone
  function nudge(valence, arousal) {
    const e = S().emotion;
    // smooth toward new tone (emotional inertia)
    e.valence = clamp(e.valence * 0.6 + valence * 0.55, -1, 1);
    e.arousal = clamp(e.arousal * 0.6 + arousal * 0.5, 0, 1);
    e.energy = clamp(e.energy - 0.02, 0, 1); // interaction costs a little energy
    recompute();
  }

  // time-based decay: called on app open with elapsed real minutes
  function decay(minutesAway) {
    const e = S().emotion;
    // energy recovers a bit if away long (resting), but mood drifts toward lonely if very long
    if (minutesAway > 1) {
      e.energy = clamp(e.energy + Math.min(0.3, minutesAway / 600), 0, 1);
    }
    // valence relaxes toward a mild baseline set by intimacy
    const baseline = -0.1 + S().persona.intimacy * 0.35;
    e.valence = e.valence * 0.7 + baseline * 0.3;
    // long absence -> a touch of "missing you" sadness if bonded
    if (minutesAway > 240 && S().persona.intimacy > 0.25) {
      e.valence = clamp(e.valence - 0.15, -1, 1);
    }
    recompute();
  }

  function setSleepy() { S().emotion.energy = 0.1; recompute(); }
  function wakeRefresh() { S().emotion.energy = 0.9; S().emotion.valence = clamp(S().emotion.valence + 0.15, -1, 1); recompute(); }

  function face() {
    const sp = S().pet.species || '🐶';
    const st = S().emotion.state;
    return (FACES[sp] && FACES[sp][st]) || sp;
  }
  function moodEmoji() { return MOOD_EMOJI[S().emotion.state] || ''; }
  function moodTag() { return MOOD_TAG[S().emotion.state] || ''; }
  function animClass() { return 'emo-' + S().emotion.state; }

  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

  window.Emotion = { recompute, nudge, decay, setSleepy, wakeRefresh, face, moodEmoji, moodTag, animClass };
})();
