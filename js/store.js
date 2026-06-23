/* ============================================================
   store.js — state model + persistence + clock
   Single global `Store`. State shape mirrors the PRD:
   pet_persona (core_nature, drift_vector, intimacy), memories,
   emotion, day/clock, chat log, event cooldowns.
   ============================================================ */
(function () {
  const KEY = 'petpal.v1';

  const DEFAULT = {
    version: 1,
    created: false,
    pet: {
      id: 'pet_1',
      name: '',
      species: '🐶',          // 🐶 🐱 🐰
      isTwin: false,            // 真宠数字分身
      twinPhoto: null,          // dataURL
      twinTraits: '',           // 用户填写的真实细节
    },
    // pet_persona (PRD §1.2)
    persona: {
      core_nature: { gentleness: 0.7, sociability: 0.5, sensitivity: 0.5 },
      drift_vector: { gentleness: 0, wariness: 0, clinginess: 0, playfulness: 0 },
      drift_bounds: {
        gentleness: [-0.4, 0.2],
        wariness: [0, 0.6],
        clinginess: [-0.2, 0.6],
        playfulness: [-0.3, 0.4],
      },
      drift_log: [],            // {day, cause, delta} — 可解释因果
      intimacy: 0.05,           // 关系刻度，后台驱动，不暴露为进度条
      last_drift_day: 0,
    },
    // emotion state machine (PRD §3)
    emotion: {
      state: 'calm',            // happy/excited/calm/sleepy/sad/wary
      valence: 0.2,             // -1..1
      arousal: 0.3,             // 0..1
      energy: 0.8,              // 0..1 (drops over time/awake)
      lastUpdate: null,
    },
    memories: [],               // see memory.js
    chat: [],                   // {role:'pet'|'user'|'sys'|'dream'|'event', text, ts, eventId?}
    dreams: [],                 // pending dreams to share on wake
    day: 1,                     // in-world day counter
    lastSleepDay: 0,
    lastSeen: null,             // ts of last app open (for "missed you")
    lastProactiveTs: null,
    proactiveCount: 0,          // today's proactive count (cap 1-3)
    eventCooldown: 0,           // in-world ticks until next event eligible
    firstProactiveScheduled: false,
    pendingConsolidation: [],   // memory ids created today, processed at sleep
    // interaction limits (req #7): each action has a daily/session cap; hitting it
    // forces a rest cooldown before it can be used again. Reset on sleep.
    interactions: {
      pet:  { count: 0, max: 8, restUntil: 0 },
      feed: { count: 0, max: 4, restUntil: 0 },
      play: { count: 0, max: 5, restUntil: 0 },
    },
    // chick: continuous-interaction sprite (req #3). Tapping fills energy;
    // when full it refills interaction counts / clears rest cooldowns.
    chick: { energy: 0, max: 12, totalTaps: 0 },
    lastChangeShownDay: 0,      // last day the home "pet changed" banner was shown
    weather: { code: null, isDay: 1, temp: null, city: null, fetchedAt: 0, time: null }, // real weather (req #4)
    flags: {},
  };

  let state = null;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        state = Object.assign(clone(DEFAULT), JSON.parse(raw));
        // shallow-merge nested defaults that may be missing after upgrades
        state.persona = Object.assign(clone(DEFAULT.persona), state.persona || {});
        state.emotion = Object.assign(clone(DEFAULT.emotion), state.emotion || {});
        state.pet = Object.assign(clone(DEFAULT.pet), state.pet || {});
      } else {
        state = clone(DEFAULT);
      }
    } catch (e) {
      console.warn('load failed, resetting', e);
      state = clone(DEFAULT);
    }
    return state;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { console.warn('save failed', e); }
  }

  function reset() {
    state = clone(DEFAULT);
    save();
  }

  // monotonic id
  let _seq = 0;
  function uid(prefix) {
    _seq += 1;
    return (prefix || 'id') + '_' + state.day + '_' + _seq + '_' + Math.floor(performance.now());
  }

  // time-of-day context derived from real device clock
  function timeCtx() {
    const h = new Date().getHours();
    if (h >= 5 && h < 11) return 'morning';
    if (h >= 11 && h < 14) return 'noon';
    if (h >= 14 && h < 18) return 'afternoon';
    if (h >= 18 && h < 23) return 'evening';
    return 'late_night';
  }

  window.Store = {
    load, save, reset, uid, timeCtx,
    get s() { return state; },
    DEFAULT,
  };
})();
