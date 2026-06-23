/* headless smoke test: simulate core flows without a browser */
const fs = require('fs');
const path = require('path');

// --- minimal browser shims ---
global.window = {};
global.performance = { now: () => Date.now() };
global.localStorage = (() => {
  let store = {};
  return {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  };
})();
global.document = { getElementById: () => null, querySelector: () => null, addEventListener: () => {} };

// load modules in index.html order
const files = ['store.js','memory.js','persona.js','emotion.js','dreams.js','conversation.js','events.js','proactive.js'];
for (const f of files) {
  const code = fs.readFileSync(path.join(__dirname, 'js', f), 'utf8');
  eval(code);
}

const { Store, Memory, Persona, Emotion, Dreams, Conversation, Events, Proactive } = window;
let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.log('  ✗ FAIL:', msg); } }

(async () => {
  // 1. boot
  Store.load();
  ok(Store.s.created === false, 'fresh state not created');

  // 2. create pet (gentle nature)
  Store.s.created = true;
  Store.s.pet.name = '豆豆';
  Store.s.persona.core_nature = { gentleness: 0.85, sociability: 0.7, sensitivity: 0.5 };
  Memory.record('你给我取名叫「豆豆」，这是我们的开始', { type:'emotional', salience:0.7 });
  ok(Store.s.memories.length === 1, 'first memory recorded');

  // 3. salience: emotional disclosure scores higher than chitchat
  const sadM = Memory.record('我今天加班到崩溃，特别累特别迷茫，好难过');
  const chit = Memory.record('嗯');
  ok(sadM.salience > chit.salience, `emotional salience(${sadM.salience.toFixed(2)}) > chitchat(${chit.salience.toFixed(2)})`);
  ok(sadM.type === 'emotional', 'distress flagged emotional');
  ok(sadM.cues.user_mood === 'distressed', 'distress mood tagged');

  // 4. conversation responds & acknowledges sadness
  const reply = await Conversation.respond('我今天好难过，压力好大');
  ok(typeof reply === 'string' && reply.length > 0, 'conversation returns text');

  // 5. recall: topic-matching memory surfaces in same mood context
  Memory.record('我最近工作压力好大，老板天天让我加班', { salience: 0.7 });
  const rec = Memory.recall('又要加班了，工作真的好累');
  ok(rec !== null, 'recall surfaces a work memory in distressed context');

  // 6. recall guard: don't surface negative memory when user is happy
  const recHappy = Memory.recall('今天好开心好幸福哈哈哈');
  ok(recHappy === null || recHappy.emotion_valence >= -0.3, 'no negative memory surfaced when happy');

  // 7. growth event resolve -> intimacy up + memory
  const beforeIntim = Store.s.persona.intimacy;
  const ev = Events.trigger();
  const evReply = Events.resolve(ev, 0);
  ok(Store.s.persona.intimacy > beforeIntim, 'event raised intimacy');
  ok(typeof evReply === 'string', 'event returns reply');

  // 8. sleep consolidation: milestone promoted to long, pending cleared
  // force a milestone
  Memory.record('打雷的夜晚你抱着我，我永远记得今晚', { type:'emotional', salience:0.9 });
  const pendBefore = Store.s.pendingConsolidation.length;
  ok(pendBefore > 0, 'pending consolidation queued');
  const res = Memory.consolidate();
  ok(Store.s.pendingConsolidation.length === 0, 'pending cleared after consolidate');
  const hasLong = Store.s.memories.some(m => m.tier === 'long' && m.is_milestone);
  ok(hasLong, 'milestone promoted to long tier');

  // 9. dream builds from a long memory
  const dream = Dreams.build();
  ok(dream && typeof dream.text === 'string', 'dream generated from memory: ' + (dream && dream.text));

  // 10. personality drift: many negative days on gentle nature -> wariness up, slow & bounded
  const wBefore = Store.s.persona.drift_vector.wariness;
  for (let d = 0; d < 5; d++) {
    Store.s.day++;
    Memory.record('今天又被吼了，好害怕好委屈，我好难过', { type:'emotional' });
    Persona.driftAtSleep();
  }
  const wAfter = Store.s.persona.drift_vector.wariness;
  ok(wAfter > wBefore, `gentle pet drifts toward wariness (${wBefore.toFixed(3)} -> ${wAfter.toFixed(3)})`);
  ok(wAfter <= Store.s.persona.drift_bounds.wariness[1] + 1e-6, 'wariness stays within bounds (有界)');
  ok(Store.s.persona.drift_log.length > 0, 'drift has explainable cause log (可解释)');

  // 11. aloof nature drifts differently (toward less playful/contrarian) than gentle
  Store.reset();
  Store.s.created = true;
  Store.s.persona.core_nature = { gentleness: 0.45, sociability: 0.25, sensitivity: 0.6 };
  for (let d = 0; d < 4; d++) { Store.s.day++; Memory.record('又被凶了，烦死了，讨厌', { type:'emotional' }); Persona.driftAtSleep(); }
  ok(Store.s.persona.drift_vector.playfulness <= 0, 'aloof nature: negative events reduce playfulness (向外对抗方向)');

  // 12. drift magnitude per day is bounded (慢)
  ok(Math.abs(Store.s.persona.drift_vector.gentleness) <= Persona.MAX_DAILY_DRIFT * 6, 'daily drift stays slow');

  console.log(`\nSMOKE TEST: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
