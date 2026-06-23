/* ============================================================
   app.js — bootstrap + all UI event handlers + lifecycle
   Wires onboarding, home actions, chat send, events, sleep,
   proactive scheduling, and app-open "decay/missed-you" logic.
   ============================================================ */
(function () {
  const S = () => Store.s;

  // ---------- boot ----------
  function boot() {
    Store.load();
    handleReturn();   // decay + missed-you on open
    UI.render();
    scheduleProactive();
    scheduleRestTick();
    // req #4 (weather): fetch real weather by IP, then re-render so the sky updates
    if (typeof Weather !== 'undefined') {
      Weather.refresh().then(() => {
        if (S().created && UI.currentTab === 'home') UI.render();
      });
    }
    // req #4 (proactive): pet proactively initiates even on first/return login
    if (S().created) {
      setTimeout(() => {
        if (UI.currentTab === 'home' && Proactive.canSend()) {
          const msg = Proactive.compose();
          Proactive.markSent();
          UI.showToast(msg);
          Store.save();
        }
      }, 4000);
    }
  }

  // when app reopens, apply time-based emotion decay & maybe a welcome-back
  function handleReturn() {
    if (!S().created) return;
    const now = Date.now();
    if (S().lastSeen) {
      const mins = (now - S().lastSeen) / 60000;
      Emotion.decay(mins);
      // welcome-back proactive if away a while
      if (mins > 30 && Proactive.canSend()) {
        setTimeout(() => {
          const msg = Proactive.compose();
          Proactive.markSent();
          UI.showToast(msg);
          Store.save();
        }, 1200);
      }
    }
    S().lastSeen = now;
    Store.save();
  }

  // schedule first proactive shortly after creation (Day-0 aha), and periodic
  function scheduleProactive() {
    setInterval(() => {
      if (!S().created) return;
      if (document.getElementById('devSheet')) return;
      if (!Proactive.canSend()) return;
      // ~ every few minutes of active use, low chance, only if not mid-chat typing
      if (Math.random() < 0.35) {
        const msg = Proactive.compose();
        Proactive.markSent();
        UI.showToast(msg);
        Store.save();
      }
    }, 1000 * 90); // check every 90s
  }

  // 1s tick to update interaction rest countdowns + re-enable buttons on home
  function scheduleRestTick() {
    setInterval(() => {
      if (!S().created || UI.currentTab !== 'home') return;
      const timers = document.querySelectorAll('.rest-timer');
      if (!timers.length) return;
      const now = Date.now();
      let anyEnded = false;
      timers.forEach(t => {
        const kind = t.getAttribute('data-kind');
        const it = S().interactions[kind];
        if (!it) return;
        const secs = Math.ceil((it.restUntil - now) / 1000);
        if (secs <= 0) { anyEnded = true; }
        else { const m = Math.floor(secs/60), ss = secs%60; t.textContent = m>0 ? `${m}:${String(ss).padStart(2,'0')}` : `${ss}s`; }
      });
      if (anyEnded && UI.refreshActions) UI.refreshActions();
    }, 1000);
  }

  // first-ever proactive: fire ~20s after creation for Day-0 aha
  function scheduleFirstProactive() {
    setTimeout(() => {
      if (!S().created || S().firstProactiveScheduled) return;
      S().firstProactiveScheduled = true;
      const msg = { ico: '🐾', title: S().pet.name, text: Speech.voice(pick([
        '你还在吗？我刚刚一直在看着你呢',
        '我们才刚认识，但我已经有点喜欢你了',
        '在这边坐坐嘛，我想多看看你',
      ])) };
      Proactive.markSent();
      UI.showToast(msg);
      Store.save();
    }, 9000); // ~9s after onboarding: pet initiates first (req #4)
  }

  // ---------- onboarding handlers ----------
  function ob(step) { UI.obState.step = step; UI.renderOnboarding(); }
  function pickSpecies(s) { UI.obState.species = s; UI.renderOnboarding(); }
  function pickNature(k) { UI.obState.nature = k; UI.renderOnboarding(); }
  function onName(v) {
    UI.obState.name = v;
    const btn = document.getElementById('ob-finish');
    if (btn) btn.disabled = !v.trim();
  }
  function uploadPhoto(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => { UI.obState.photo = r.result; UI.obState.isTwin = true; UI.renderOnboarding(); };
    r.readAsDataURL(f);
  }
  function obTwinNext() {
    const t = document.getElementById('ob-traits');
    UI.obState.traits = t ? t.value : '';
    UI.obState.step = 1; UI.renderOnboarding();
  }
  function finishOb() {
    const nameInput = document.getElementById('ob-name');
    const name = (nameInput ? nameInput.value : UI.obState.name).trim();
    if (!name) return;
    const o = UI.obState;
    S().created = true;
    S().pet.name = name;
    S().pet.species = o.species;
    S().pet.isTwin = !!o.isTwin;
    S().pet.twinPhoto = o.photo || null;
    S().pet.twinTraits = o.traits || '';
    // set core nature
    const NAT = { gentle:{gentleness:0.85,sociability:0.7,sensitivity:0.5}, lively:{gentleness:0.6,sociability:0.8,sensitivity:0.4},
                  quiet:{gentleness:0.7,sociability:0.35,sensitivity:0.75}, aloof:{gentleness:0.45,sociability:0.25,sensitivity:0.6} };
    S().persona.core_nature = NAT[o.nature] || NAT.gentle;
    S().lastSeen = Date.now();
    Emotion.recompute();
    // seed first memory + a warm first line
    Memory.record(`你给我取名叫「${name}」，这是我们的开始`, { source:'system', type:'emotional', salience: 0.7 });
    if (o.isTwin && o.traits) Memory.record(`关于我：${o.traits}`, { source:'system', type:'factual', salience: 0.6 });
    Store.save();
    UI.setTab('home');
    UI.render();
    // greeting into chat (stored as raw meaning; rendered as 汪汪汪（…）)
    const hi = o.isTwin
      ? `我们好像见过…我是${name}呀，能再陪在你身边真好`
      : `你好呀，我是${name}，谢谢你选择了我，我会努力成为你最好的小伙伴`;
    UI.pushChat('pet', hi, true);
    // req #4: pet proactively reaches out right after onboarding (Day-0 aha)
    scheduleFirstProactive();
  }

  // ---------- home handlers ----------
  function tab(t) { UI.setTab(t); UI.render(); maybeEventOnHome(t); }

  // req #3: tapping the chick builds energy; full meter -> refill interactions / clear rest
  function tapChick() {
    const ck = S().chick;
    ck.totalTaps += 1;
    // chick hop + tiny feedback
    const sprite = document.getElementById('sceneChick');
    if (sprite) { sprite.classList.remove('tapped'); void sprite.offsetWidth; sprite.classList.add('tapped'); }
    chickFloat(pick(['🌾','✨','＋','🐥']));
    ck.energy = Math.min(ck.max, ck.energy + 1);
    // update meter live
    const fill = document.getElementById('chickFill');
    if (fill) fill.style.width = Math.round(ck.energy / ck.max * 100) + '%';
    if (ck.energy >= ck.max) {
      // cash it in: refill all interactions + clear rests, mood lifts
      for (const k in S().interactions) { S().interactions[k].count = 0; S().interactions[k].restUntil = 0; }
      ck.energy = 0;
      Emotion.nudge(0.4, 0.6);
      Persona.updateIntimacy(0.4);
      const el = document.getElementById('petSays');
      if (el) el.textContent = Speech.voice(pick(['小鸡喂饱啦，我又有精神陪你玩咯','谢谢你照顾小鸡，我好开心','体力满满，再来陪我玩吧']));
      Emotion.recompute();
      if (window.UI && UI.refreshAvatar) UI.refreshAvatar();
      const hint = document.getElementById('chickHint');
      if (hint) hint.textContent = '体力满了！互动次数已恢复';
      if (fill) fill.style.width = '0%';
    }
    Store.save();
  }
  function chickFloat(txt) {
    const host = document.getElementById('sceneChick');
    if (!host) return;
    const f = document.createElement('div');
    f.className = 'chick-float'; f.textContent = txt;
    host.appendChild(f);
    setTimeout(() => f.remove(), 900);
  }

  function pokePet() {
    floatReact(pick(['💕','✨','🐾','💗']));
    Emotion.nudge(0.2, 0.35);
    Persona.updateIntimacy(0.2);
    const el = document.getElementById('petSays');
    if (el) el.textContent = Speech.voice(pick(['痒痒的，别闹啦','你戳我呀，我才不躲呢','喜欢你摸我','再多陪我玩会儿嘛']));
    Emotion.recompute();
    if (window.UI && UI.refreshAvatar) UI.refreshAvatar();
    Store.save();
  }

  // interaction with per-action limit + rest cooldown (req #7) and animated fx (req #6)
  function doAction(kind) {
    const map = {
      pet:  { v:0.3, a:0.4, i:0.4, react:'🤚', say:['好舒服…我最喜欢你摸我的头了','蹭蹭你，我们的关系又近了一点','在你手心里好安心'] },
      feed: { v:0.35, a:0.5, i:0.4, react:'🍖', say:['谢谢你，这个我最爱吃啦','吃饱饱，浑身都是力气','你总是记得喂我，我都记在心里'] },
      play: { v:0.45, a:0.7, i:0.5, react:'🎾', say:['玩得好开心，和你在一起最快乐了','再来再来，我还想玩','跑累啦…但好幸福'] },
    };
    const m = map[kind]; if (!m) return;
    const it = S().interactions[kind];
    const now = Date.now();
    // rest gate
    if (it.restUntil > now) {
      const el = document.getElementById('petSays');
      if (el) el.textContent = Speech.voice(pick(['我有点累了，让我歇会儿好不好','呼…刚玩过，先休息一下嘛']));
      return;
    }
    it.count += 1;
    // hit the cap -> enter rest (a few minutes; demo-friendly)
    if (it.count >= it.max) {
      const restMs = { pet: 90, feed: 180, play: 150 }[kind] * 1000; // seconds
      it.restUntil = now + restMs;
      it.count = 0;
    }

    if (window.UI && UI.playActionFx) UI.playActionFx(kind);  // animated reaction
    floatReact(m.react);
    Emotion.nudge(m.v, m.a);
    Persona.updateIntimacy(m.i);
    Memory.record(`你${kind==='pet'?'摸了摸我':kind==='feed'?'喂我吃东西':'陪我玩耍'}`, { source:'action', salience: 0.2 });
    const el = document.getElementById('petSays');
    if (el) el.textContent = Speech.voice(pick(m.say));
    Emotion.recompute();
    if (window.UI && UI.refreshAvatar) UI.refreshAvatar();
    Store.save();
  }

  function floatReact(emoji) {
    const stage = document.querySelector('.scene-wrap') || document.querySelector('.home') || root();
    if (!stage) return;
    const f = document.createElement('div');
    f.className = 'float-react'; f.textContent = emoji;
    f.style.left = (42 + Math.random()*16) + '%';
    setTimeout(() => f.remove(), 1000);
    stage.appendChild(f);
  }

  function sleepFlow() {
    Emotion.setSleepy();
    UI.renderSleep(() => { UI.setTab('home'); UI.render(); });
  }

  // ---------- chat ----------
  function send() {
    const input = document.getElementById('chatInput');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    UI.pushChat('user', text);
    // record memory + nudge emotion from user's tone
    const a = Memory.analyze(text);
    Emotion.nudge(a.valence, a.arousal);
    Persona.updateIntimacy(0.5 + a.selfDisclosure * 0.5);
    Memory.record(text, { source:'chat' });
    Store.save();
    // typing indicator then reply
    showTyping();
    const delay = 600 + Math.min(1600, text.length * 40);
    setTimeout(async () => {
      removeTyping();
      const reply = await Conversation.respond(text);
      UI.pushChat('pet', reply);
      Store.save();
      // chance to trigger a growth event after a few exchanges
      maybeEventInChat();
    }, delay);
  }

  function showTyping() {
    const log = document.getElementById('chatLog');
    if (!log) return;
    const t = document.createElement('div');
    t.className = 'typing'; t.id = 'typingIndicator';
    t.innerHTML = '<span></span><span></span><span></span>';
    log.appendChild(t); UI.scrollChat();
  }
  function removeTyping() { const t = document.getElementById('typingIndicator'); if (t) t.remove(); }

  // ---------- growth events ----------
  function maybeEventInChat() {
    S().eventCooldown = Math.max(0, S().eventCooldown - 1);
    if (Events.isDue() && Math.random() < 0.5) {
      fireEvent();
    }
  }
  function maybeEventOnHome(t) {
    if (t !== 'chat') return;
  }
  function fireEvent() {
    const ev = Events.trigger();
    // store event with choices into chat
    S().chat.push({ role:'event', text: ev.text, eventId: ev.id, choices: ev.choices, ts: Date.now() });
    Store.save();
    if (UI.currentTab === 'chat') UI.renderChat();
    else { UI.setTab('chat'); UI.render(); }
  }
  function eventChoice(eventId, idx) {
    const ev = Events._all.find(e => e.id === eventId);
    if (!ev) return;
    // remove choices from the event message (mark resolved)
    const msg = [...S().chat].reverse().find(m => m.role==='event' && m.eventId===eventId && m.choices);
    if (msg) { msg.text = msg.text + '\n· 你选择了：' + ev.choices[idx].label; delete msg.choices; }
    const reply = Events.resolve(ev, idx);
    Store.save();
    UI.renderChat();
    showTyping();
    setTimeout(() => { removeTyping(); UI.pushChat('pet', reply); Store.save(); }, 900);
  }

  // ---------- dev ----------
  function toggleDev() { renderDevSheetSafe(); }
  function renderDevSheetSafe() {
    // Dev-only "experience accelerator" sheet. Toggles open/closed.
    const old = document.getElementById('devSheet');
    if (old) { old.remove(); return; }
    const root = document.getElementById('screen-root');
    const sheet = document.createElement('div');
    sheet.className = 'dev-sheet'; sheet.id = 'devSheet';
    sheet.innerHTML = `
      <h3>🛠 体验加速器（仅用于演示）</h3>
      <p>真实产品里这些会随真实时间自然发生。这里让你立刻体验「记忆沉淀 / 做梦 / 人格偏移」的完整闭环。</p>
      <div class="dev-row">
        <button onclick="UI_APP.devProactive()">📨 主动消息</button>
        <button onclick="UI_APP.devEvent()">🎬 成长事件</button>
        <button onclick="UI_APP.devSleep()">🌙 快进到明天</button>
        <button onclick="UI_APP.devClose()">关闭</button>
        <button class="danger" onclick="UI_APP.devReset()">⟲ 重置数据</button>
      </div>`;
    root.appendChild(sheet);
  }
  function devProactive() { const m = Proactive.compose(); UI.showToast(m); Store.save(); }
  function devEvent() { devClose(); fireEvent(); }
  function devSleep() { devClose(); sleepFlow(); }
  function devClose() { const s = document.getElementById('devSheet'); if (s) s.remove(); }
  function devReset() { if (confirm('确定要重置全部数据，重新开始吗？')) { Store.reset(); location.reload(); } }

  function root() { return document.getElementById('screen-root'); }
  function pick(a) { return a[Math.floor(Math.random()*a.length)]; }

  // expose handlers used by inline onclick (both UI.* and UI_APP.*)
  const handlers = {
    ob, pickSpecies, pickNature, onName, uploadPhoto, obTwinNext, finishOb,
    tab, pokePet, doAction, sleepFlow, send, eventChoice, toggleDev, tapChick,
    devProactive, devEvent, devSleep, devClose, devReset,
  };
  Object.assign(window.UI, handlers);
  window.UI_APP = handlers;

  // save on background
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && S().created) { S().lastSeen = Date.now(); Store.save(); }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
