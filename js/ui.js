/* ============================================================
   ui.js — all screens + rendering
   Screens: onboarding (multi-step), home, chat, panels (memory/
   profile), sleep overlay, proactive toast, dev sheet.
   ============================================================ */
(function () {
  const S = () => Store.s;
  const root = () => document.getElementById('screen-root');
  const toastLayer = () => document.getElementById('toast-layer');

  let currentTab = 'home';
  let obState = { step: 0, species: '🐶', name: '', isTwin: false, photo: null, traits: '', nature: 'gentle' };

  // ---------------- ONBOARDING ----------------
  const NATURES = [
    { key: 'gentle', emoji: '🍼', label: '温顺黏人', core: { gentleness: 0.85, sociability: 0.7, sensitivity: 0.5 } },
    { key: 'lively', emoji: '⚡', label: '活泼好动', core: { gentleness: 0.6, sociability: 0.8, sensitivity: 0.4 } },
    { key: 'quiet', emoji: '🌙', label: '安静敏感', core: { gentleness: 0.7, sociability: 0.35, sensitivity: 0.75 } },
    { key: 'aloof', emoji: '🐈', label: '孤僻乖张', core: { gentleness: 0.45, sociability: 0.25, sensitivity: 0.6 } },
  ];

  function renderOnboarding() {
    const st = obState.step;
    let inner = '';
    if (st === 0) {
      inner = `
        <div class="ob fade-in">
          <div class="ob-step-dots">${dots(0)}</div>
          <div class="big-pet">🐾</div>
          <h1>领养一只属于你的小伙伴</h1>
          <p class="sub">它会记得你说的话，会因为你而慢慢改变，<br/>会在你看不到的时候，也惦记着你。</p>
          <button class="btn-primary" onclick="UI.ob(1)">开始 →</button>
          <button class="btn-ghost" onclick="UI.ob('twin')">我想接入我现实中的宠物</button>
        </div>`;
    } else if (st === 'twin') {
      inner = `
        <div class="ob fade-in">
          <div class="ob-step-dots">${dots(0)}</div>
          <h1>把你的宠物带进来</h1>
          <p class="sub">上传一张它的照片，告诉我它的样子，<br/>我会努力成为「它」陪在你身边。</p>
          ${obState.photo ? `<img class="upload-preview" src="${obState.photo}"/>` : ''}
          <label class="upload-label">
            📷 ${obState.photo ? '换一张照片' : '上传爱宠照片'}
            <input type="file" accept="image/*" style="display:none" onchange="UI.uploadPhoto(event)"/>
          </label>
          <input id="ob-traits" type="text" placeholder="它的小习惯/口头禅/爱吃什么" value="${esc(obState.traits)}"/>
          <button class="btn-primary" onclick="UI.obTwinNext()">下一步 →</button>
          <button class="btn-ghost" onclick="UI.ob(0)">← 返回，创建一只虚拟伙伴</button>
        </div>`;
    } else if (st === 1) {
      inner = `
        <div class="ob fade-in">
          <div class="ob-step-dots">${dots(1)}</div>
          <h1>它是什么样的小家伙？</h1>
          <div class="species-row">
            ${['🐶','🐱','🐰'].map(s => `<button class="species ${obState.species===s?'selected':''}" onclick="UI.pickSpecies('${s}')">${typeof Avatar!=='undefined' ? Avatar.svg({species:s,state:'happy',size:64}) : s}</button>`).join('')}
          </div>
          <p class="sub">这只是它的样子，真正让它独一无二的，<br/>是接下来你和它一起经历的一切。</p>
          <button class="btn-primary" onclick="UI.ob(2)">下一步 →</button>
        </div>`;
    } else if (st === 2) {
      inner = `
        <div class="ob fade-in">
          <div class="ob-step-dots">${dots(2)}</div>
          <h1>你希望它，天生是什么性格？</h1>
          <p class="sub">这是它的「天性」。它会在天性的基础上，<br/>因为你怎么对它，慢慢长成自己的样子。</p>
          <div class="choices">
            ${NATURES.map(n => `
              <button class="choice ${obState.nature===n.key?'selected':''}" onclick="UI.pickNature('${n.key}')">
                <span class="emoji">${n.emoji}</span><span>${n.label}</span>
              </button>`).join('')}
          </div>
          <button class="btn-primary" onclick="UI.ob(3)">下一步 →</button>
        </div>`;
    } else if (st === 3) {
      inner = `
        <div class="ob fade-in">
          <div class="ob-step-dots">${dots(3)}</div>
          <div class="big-pet">${obState.photo ? `<img class="upload-preview" src="${obState.photo}"/>` : (typeof Avatar!=='undefined' ? Avatar.svg({species:obState.species,state:'happy',persona:{clinginess:0.6},size:150}) : obState.species)}</div>
          <h1>给它取个名字吧</h1>
          <p class="sub">这个名字，会是它认得你的开始。</p>
          <input id="ob-name" type="text" maxlength="12" placeholder="比如：豆豆" value="${esc(obState.name)}" oninput="UI.onName(this.value)"/>
          <button class="btn-primary" id="ob-finish" ${obState.name.trim()?'':'disabled'} onclick="UI.finishOb()">就叫这个名字 →</button>
        </div>`;
    }
    root().innerHTML = `<div class="screen">${inner}</div>`;
    // restore focus value
    if (st === 3) { const i = document.getElementById('ob-name'); if (i) i.value = obState.name; }
  }
  function dots(active) {
    return [0,1,2,3].map(i => `<span class="${i<=active?'on':''}"></span>`).join('');
  }

  // ---------------- HOME ----------------
  // Avatar markup: digital twins keep their real photo but get an emotion-tinted
  // glow ring + ambient FX; virtual pets get the full parametric SVG (avatar.js).
  function avatarMarkup(size) {
    const pet = S().pet;
    const state = S().emotion.state;
    if (pet.isTwin && pet.twinPhoto) {
      const ring = {
        happy:'#ffb0c0', excited:'#ffd36b', calm:'#cfe8d8', sleepy:'#c5cbe0', sad:'#b9c4d6', wary:'#9fb0d0'
      }[state] || '#f5b7c4';
      const fxState = (typeof Avatar !== 'undefined') ? Avatar : null;
      return `<div class="twin-wrap ${Emotion.animClass()}" style="--ring:${ring}">
                <img class="twin-photo" src="${pet.twinPhoto}"/>
                <div class="twin-fx">${twinFx(state)}</div>
              </div>`;
    }
    if (typeof Avatar !== 'undefined') {
      return Avatar.svg({ species: pet.species, state, persona: Persona.effective(), size: size || 200 });
    }
    return `<span class="${Emotion.animClass()}">${Emotion.face()}</span>`;
  }
  // small emoji FX for twin photos (reuse emotion vocabulary)
  function twinFx(state) {
    const m = { happy:'💕', excited:'✨', calm:'', sleepy:'💤', sad:'🌧️', wary:'' };
    const e = m[state];
    return e ? `<span class="twin-fx-emoji">${e}</span>` : '';
  }

  function renderHome() {
    Emotion.recompute();
    const pet = S().pet;
    const says = currentPetLine();
    const banner = changeBanner();
    const ck = S().chick;
    // Full-screen environment (req #2): scene fills the screen, everything floats on top.
    root().innerHTML = `
      <div class="home full fade-in">
        ${sceneMarkup()}

        <!-- floating top bar -->
        <div class="float-top">
          <div class="ft-name">${esc(pet.name)} ${Emotion.moodEmoji()}</div>
          <div class="ft-tags">
            <span class="mood-tag">${Emotion.moodTag()}</span>
            <span class="mood-tag light">第${S().day}天 · ${Persona.stageLabel()}</span>
            ${weatherTag()}
          </div>
        </div>
        <button class="dev-btn float" onclick="UI.toggleDev()">DEV</button>

        <!-- chick energy meter (req #3) -->
        <div class="chick-meter">
          <span class="cm-ico">🐣</span>
          <div class="cm-bar"><div class="cm-fill" id="chickFill" style="width:${Math.round(ck.energy/ck.max*100)}%"></div></div>
          <span class="cm-hint" id="chickHint">${ck.energy>=ck.max?'喂它一下→+体力':'戳小鸡攒体力'}</span>
        </div>

        <!-- floating speech bubble over the pet -->
        <div class="float-says" id="petSays">${esc(typeof Speech!=='undefined'?Speech.voice(says):says)}</div>
        ${banner}

        <!-- floating action buttons (Talking-Tom style) -->
        <div class="float-actions">
          ${actionBtn('pet','🤚','摸摸')}
          ${actionBtn('feed','🍖','喂食')}
          ${actionBtn('play','🎾','玩耍')}
          <button class="action-btn" onclick="UI.sleepFlow()"><span class="ico">🌙</span><span>睡觉</span></button>
        </div>

        ${tabbar()}
      </div>`;
    // attach 2.5D parallax to the freshly-rendered scene
    if (typeof Parallax !== 'undefined') Parallax.attach();
  }

  // scene markup: virtual pet uses Avatar.scene; twin keeps photo (overlaid in meadow)
  function sceneMarkup() {
    const pet = S().pet;
    const state = S().emotion.state;
    const wx = (typeof Weather !== 'undefined') ? Weather.current() : null;
    if (typeof Avatar === 'undefined') {
      return `<div class="pet-avatar" id="petAvatar" onclick="UI.pokePet()">${avatarMarkup(220)}</div>`;
    }
    if (pet.isTwin && pet.twinPhoto) {
      const sc = Avatar.scene({ species: pet.species, state, persona: Persona.effective(), twinPhoto: true, weather: wx });
      const ring = { happy:'#ffb0c0', excited:'#ffd36b', calm:'#cfe8d8', sleepy:'#c5cbe0', sad:'#b9c4d6', wary:'#9fb0d0' }[state] || '#f5b7c4';
      const overlay = `<div class="scene-pet" id="petAvatar" onclick="UI.pokePet()">
          <div class="twin-wrap ${Emotion.animClass()}" style="--ring:${ring}"><img class="twin-photo" src="${pet.twinPhoto}"/><div class="twin-fx">${twinFx(state)}</div></div>
        </div>`;
      return sc.replace(/<div class="scene-pet"[^>]*>[\s\S]*?<\/div>\s*<div class="scene-chick"/, overlay + '<div class="scene-chick"');
    }
    return Avatar.scene({ species: pet.species, state, persona: Persona.effective(), weather: wx });
  }

  // weather chip in the top bar (req #4); empty until first fetch resolves
  function weatherTag() {
    if (typeof Weather === 'undefined') return '';
    const lbl = Weather.label();
    return lbl ? `<span class="mood-tag light">🌤 ${esc(lbl)}</span>` : '';
  }

  // req #3: a banner that announces when the pet has changed (drift / new day)
  function changeBanner() {
    const log = S().persona.drift_log || [];
    if (!log.length) return '';
    const latest = log[log.length - 1];
    if (latest.day <= (S().lastChangeShownDay || 0)) return '';
    S().lastChangeShownDay = latest.day;
    Store.save();
    return `<div class="change-banner float fade-in">🌱 ${esc(latest.note)}</div>`;
  }

  // action button reflects interaction limit / rest state (req #7)
  function actionBtn(kind, ico, label) {
    const it = S().interactions[kind];
    const now = Date.now();
    const resting = it.restUntil > now;
    if (resting) {
      const secs = Math.ceil((it.restUntil - now) / 1000);
      return `<button class="action-btn resting" disabled><span class="ico">😴</span><span>休息中</span><span class="rest-timer" data-kind="${kind}">${fmtRest(secs)}</span></button>`;
    }
    const left = it.max - it.count;
    return `<button class="action-btn" onclick="UI.doAction('${kind}')"><span class="ico">${ico}</span><span>${label}</span><span class="act-left">剩${left}</span></button>`;
  }
  function fmtRest(s) { const m = Math.floor(s/60), ss = s%60; return m>0 ? `${m}:${String(ss).padStart(2,'0')}` : `${ss}s`; }

  function renderHomeLegacyAvatar() {}

  function currentPetLine() {
    // surface pending dream first (wake share)
    if (S()._wakeDream) { const d = S()._wakeDream; S()._wakeDream = null; return d; }
    const stage = Memory.bondStage();
    const st = S().emotion.state;
    if (st === 'sleepy') return '我有点困了…要不要哄哄我睡觉？';
    if (st === 'sad') return '我今天有点低落…你愿意陪我说说话吗？';
    if (st === 'wary') return '我最近有点不安，你多陪陪我好不好。';
    const m = {
      stranger: '我们还在慢慢认识，多跟我说说话吧。',
      building: '你来啦～今天想跟我聊点什么？',
      close: '就知道你会来！我等你呢。',
      inseparable: '你一来我就安心了，有你真好。',
    };
    return m[stage] || m.building;
  }

  function tabbar() {
    const tabs = [
      { k: 'home', ico: '🏠', label: '主页' },
      { k: 'chat', ico: '💬', label: '聊天' },
      { k: 'memory', ico: '📔', label: '回忆' },
      { k: 'profile', ico: '🐾', label: 'TA' },
    ];
    return `<div class="tabbar">${tabs.map(t =>
      `<button class="${currentTab===t.k?'active':''}" onclick="UI.tab('${t.k}')"><span class="ico">${t.ico}</span>${t.label}</button>`
    ).join('')}</div>`;
  }

  // ---------------- CHAT ----------------
  function renderChat() {
    const pet = S().pet;
    const log = S().chat.map(renderMsg).join('');
    root().innerHTML = `
      <div class="chat fade-in">
        <div class="chat-head">
          <button class="back" onclick="UI.tab('home')">‹</button>
          <span class="avatar-mini">${pet.isTwin && pet.twinPhoto ? `<img class="upload-preview" style="width:34px;height:34px" src="${pet.twinPhoto}"/>` : (typeof Avatar!=='undefined' ? Avatar.svg({species:pet.species,state:S().emotion.state,persona:Persona.effective(),size:38}) : Emotion.face())}</span>
          <div class="info"><span class="nm">${esc(pet.name)}</span><span class="st">${Emotion.moodTag()} · ${Persona.stageLabel()}</span></div>
        </div>
        <div class="chat-log" id="chatLog">${log || sysMsg('和'+esc(pet.name)+'说点什么吧，它会记住的。')}</div>
        <div class="chat-input">
          <input id="chatInput" type="text" placeholder="说点什么…" onkeydown="if(event.key==='Enter')UI.send()"/>
          <button onclick="UI.send()">➤</button>
        </div>
      </div>`;
    scrollChat();
    setTimeout(() => { const i = document.getElementById('chatInput'); if (i) i.focus(); }, 100);
  }

  function renderMsg(m) {
    if (m.role === 'sys') return sysMsg(m.text);
    // dream: keep the narration but give it a soft bark lead-in
    if (m.role === 'dream') return `<div class="msg dream">💭 ${esc(wrapPet(m.text, m))}</div>`;
    if (m.role === 'event') {
      // events with unresolved choices
      if (m.choices) {
        return `<div class="msg event">${esc(m.text)}
          <div class="ev-choices">${m.choices.map((c,i)=>`<button onclick="UI.eventChoice('${m.eventId}',${i})">${esc(c.label)}</button>`).join('')}</div>
        </div>`;
      }
      return `<div class="msg event">${esc(m.text)}</div>`;
    }
    // pet lines are wrapped as 汪汪汪（内容） at render time
    if (m.role === 'pet') return `<div class="msg pet">${esc(wrapPet(m.text, m))}</div>`;
    return `<div class="msg ${m.role}">${esc(m.text)}</div>`;
  }
  // wrap a stored raw meaning into bark speech (no double-wrap)
  function wrapPet(text, m) {
    if (typeof Speech === 'undefined') return text;
    if (/^[汪喵吱呜唔]/.test(text)) return text; // already wrapped
    return Speech.voice(text);
  }
  function sysMsg(t) { return `<div class="msg sys">${t}</div>`; }

  function scrollChat() {
    const el = document.getElementById('chatLog');
    if (el) el.scrollTop = el.scrollHeight;
  }

  // ---------------- MEMORY PANEL ----------------
  function renderMemory() {
    const mems = [...S().memories].sort((a,b) => b.created_day - a.created_day || (b.salience - a.salience));
    const tierName = { long: '深刻记忆', mid: '记着', short: '最近' };
    let body;
    if (!mems.length) {
      body = `<div class="empty-note">还没有什么回忆呢。<br/>多和它聊聊、一起经历一些事，<br/>它会把重要的都记在心里。</div>`;
    } else {
      body = mems.map(m => `
        <div class="mem-card ${m.is_milestone?'milestone':''}">
          <div class="mc-top">
            <span>第${m.created_day}天 · ${m.type==='emotional'?'💗 情感':'📌 事实'}${m.is_milestone?' · ⭐里程碑':''}</span>
            <span class="mc-tier tier-${m.tier}">${tierName[m.tier]||m.tier}</span>
          </div>
          <div class="mc-body">${esc(m.summary)}</div>
        </div>`).join('');
    }
    root().innerHTML = `
      <div class="home fade-in" style="background:var(--bg)">
        <div class="panel">
          <div class="panel-pet">${miniPet(96)}<div class="panel-pet-says">${esc(typeof Speech!=='undefined'?Speech.voice('这些都是我记得的事哦'):'')}</div></div>
          <h2>📔 ${esc(S().pet.name)}记得的事</h2>
          <p style="font-size:12px;color:var(--ink-soft);margin-top:-8px;margin-bottom:14px;line-height:1.5">
            它会牢牢记住重要的时刻，也会自然淡忘琐碎的小事——就像真的一样。</p>
          ${body}
        </div>
        ${tabbar()}
      </div>`;
  }

  // a small pet avatar for use in panels (req: pet present on all screens)
  function miniPet(size) {
    const pet = S().pet;
    if (pet.isTwin && pet.twinPhoto) return `<img class="panel-pet-img" src="${pet.twinPhoto}"/>`;
    if (typeof Avatar !== 'undefined') return Avatar.svg({ species: pet.species, state: S().emotion.state, persona: Persona.effective(), size: size||96 });
    return `<span style="font-size:${size||96}px">${Emotion.face()}</span>`;
  }

  // ---------------- PROFILE / PERSONA PANEL ----------------
  function renderProfile() {
    const p = Persona.effective();
    const intim = S().persona.intimacy;
    const driftLog = [...S().persona.drift_log].reverse().slice(0, 4);
    const traitBar = (label, val) => `
      <div class="persona-trait">
        <div class="pt-label"><span>${label}</span><span>${Math.round(val*100)}%</span></div>
        <div class="pt-bar-bg"><div class="pt-bar-fill" style="width:${Math.round(val*100)}%"></div></div>
      </div>`;
    root().innerHTML = `
      <div class="home fade-in" style="background:var(--bg)">
        <div class="panel">
          <div class="panel-pet big">${miniPet(120)}</div>
          <h2 style="text-align:center">🐾 ${esc(S().pet.name)}</h2>
          <div class="bond-bar-wrap">
            <div style="display:flex;justify-content:space-between;font-size:14px">
              <span>你们的关系</span><span style="color:var(--pink-deep);font-weight:600">${Persona.stageLabel()}</span>
            </div>
            <div class="bond-bar-bg"><div class="bond-bar-fill" style="width:${Math.round(intim*100)}%"></div></div>
            <div style="font-size:11px;color:var(--ink-soft);margin-top:8px">关系靠陪伴一点点变深，急不来，也买不到。</div>
          </div>
          <div class="bond-bar-wrap">
            <div style="font-size:14px;margin-bottom:6px">它现在的样子</div>
            ${traitBar('温顺', p.gentleness)}
            ${traitBar('黏人', p.clinginess)}
            ${traitBar('爱玩', p.playfulness)}
            ${traitBar('戒备', p.wariness)}
            <div style="font-size:11px;color:var(--ink-soft);margin-top:4px">这些会随着你怎么对它，慢慢改变。</div>
          </div>
          ${driftLog.length ? `<div class="bond-bar-wrap">
            <div style="font-size:14px;margin-bottom:8px">它最近的变化</div>
            ${driftLog.map(d => `<div class="drift-note">第${d.day}天：${d.note}（因为${d.cause}）</div>`).join('')}
          </div>` : ''}
          ${S().pet.isTwin ? `<div class="bond-bar-wrap"><div style="font-size:13px;color:var(--ink-soft)">💞 这是你现实宠物的数字分身。<br/>${esc(S().pet.twinTraits||'')}</div></div>` : ''}
        </div>
        ${tabbar()}
      </div>`;
  }

  // ---------------- SLEEP OVERLAY ----------------
  function renderSleep(onDone) {
    const overlay = document.createElement('div');
    overlay.className = 'sleep-overlay';
    overlay.innerHTML = `
      <div class="stars">${Array.from({length:8}).map((_,i)=>`<span style="left:${(i*37)%90+5}%;top:${(i*53)%60+10}%;font-size:${10+i%3*4}px">✦</span>`).join('')}</div>
      <div class="moon">🌙</div>
      <div style="font-size:18px">${esc(S().pet.name)} 睡着了…</div>
      <div class="zzz" id="sleepZzz">它在梦里整理着今天的一切：<br/>把重要的记进心里，慢慢长大一点点。</div>
      <div class="sleep-log" id="sleepLog"></div>
    `;
    root().appendChild(overlay);
    // run consolidation pipeline with a little theater
    const steps = [
      () => setText('sleepLog', '✨ 正在把今天重要的事记牢…'),
      () => { Memory.consolidate(); setText('sleepLog', '💗 正在消化今天的情绪…'); },
      () => { const d = Persona.driftAtSleep(); setText('sleepLog', d ? '🌱 它好像有了一点小变化…' : '😌 今天平平稳稳的'); },
      () => { const dream = Dreams.build(); if (dream) { S().dreams.push(dream); } setText('sleepLog', '💭 它做了一个梦…'); },
      () => {
        // advance day
        S().day += 1;
        S().lastSleepDay = S().day;
        S().eventCooldown = Math.max(0, S().eventCooldown - 2);
        Proactive.resetDaily();
        // reset interaction limits after a good night's sleep (req #7)
        for (const k in S().interactions) { S().interactions[k].count = 0; S().interactions[k].restUntil = 0; }
        Emotion.wakeRefresh();
        // queue dream to share on home
        const dr = S().dreams.shift();
        if (dr) S()._wakeDream = dr.text;
        Store.save();
        setText('sleepLog', '🌅 新的一天开始了');
      },
    ];
    let i = 0;
    const iv = setInterval(() => {
      if (i >= steps.length) {
        clearInterval(iv);
        setTimeout(() => { overlay.remove(); onDone && onDone(); }, 700);
        return;
      }
      steps[i](); i++;
    }, 850);
  }
  function setText(id, t) { const el = document.getElementById(id); if (el) el.innerHTML = t; }

  // ---------------- TOAST (proactive) ----------------
  function showToast(msg) {
    // toast display is bark-wrapped; chat stores raw meaning (rendered wrapped later)
    const wrapped = (typeof Speech !== 'undefined' && !/^[汪喵吱呜唔]/.test(msg.text)) ? Speech.voice(msg.text) : msg.text;
    const raw = (typeof Speech !== 'undefined') ? Speech.meaning(msg.text) : msg.text;
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<div class="t-ico">${msg.ico}</div><div class="t-body"><div class="t-title">${esc(msg.title)}</div><div class="t-text">${esc(wrapped)}</div></div>`;
    t.onclick = () => { t.remove(); UI.tab('chat'); };
    toastLayer().appendChild(t);
    // drop into chat log silently (raw meaning; renderMsg wraps it)
    pushChat('pet', raw, true);
    setTimeout(() => { if (t.parentNode) t.remove(); }, 6000);
  }

  // ---------------- DEV SHEET ----------------
  // (The dev sheet markup + toggle live in app.js renderDevSheetSafe, since the
  //  buttons call app-layer handlers. Kept there to avoid a cross-closure dependency.)

  // ---------------- helpers ----------------
  function pushChat(role, text, noRender) {
    S().chat.push({ role, text, ts: Date.now() });
    if (S().chat.length > 200) S().chat = S().chat.slice(-200);
    Store.save();
    if (!noRender && currentTab === 'chat') { renderChat(); }
  }
  function esc(s) { return (s == null ? '' : String(s)).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

  function render() {
    if (!S().created) { renderOnboarding(); return; }
    if (currentTab === 'home') renderHome();
    else if (currentTab === 'chat') renderChat();
    else if (currentTab === 'memory') renderMemory();
    else if (currentTab === 'profile') renderProfile();
  }

  // re-inject avatar markup in place (called after emotion changes on home)
  function refreshAvatar() {
    const host = document.getElementById('petAvatar');
    if (host) host.innerHTML = avatarMarkup(210);
    const tag = document.querySelector('.home-top .mood-tag');
    if (tag) tag.textContent = `${Emotion.moodTag()} · 第${S().day}天`;
    const nm = document.querySelector('.home-top .name');
    if (nm) nm.innerHTML = esc(S().pet.name) + ' ' + Emotion.moodEmoji();
    refreshActions();
  }
  // re-render just the action bar (limits/rest timers) without rebuilding scene
  function refreshActions() {
    const bar = document.querySelector('.float-actions');
    if (!bar) return;
    bar.innerHTML = `${actionBtn('pet','🤚','摸摸')}${actionBtn('feed','🍖','喂食')}${actionBtn('play','🎾','玩耍')}<button class="action-btn" onclick="UI.sleepFlow()"><span class="ico">🌙</span><span>睡觉</span></button>`;
  }
  // play an interaction animation overlay inside the scene
  function playActionFx(kind) {
    const fx = document.getElementById('sceneFx');
    if (!fx || typeof Avatar === 'undefined') return;
    fx.innerHTML = Avatar.actionFx(kind);
    setTimeout(() => { if (fx) fx.innerHTML = ''; }, 2600);
  }

  window.UI = {
    render, renderOnboarding, renderHome, renderChat, showToast, renderSleep, pushChat,
    scrollChat, refreshAvatar, refreshActions, playActionFx,
    get currentTab() { return currentTab; },
    get obState() { return obState; },
    set obState(v) { obState = v; },
    setTab(t) { currentTab = t; },
  };
})();
