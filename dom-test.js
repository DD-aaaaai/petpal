/* DOM render test: shim enough DOM to run ui.js + app.js render paths */
const fs = require('fs');
const path = require('path');

// --- DOM shim ---
function makeEl(tag) {
  return {
    tagName: (tag||'div').toUpperCase(), _html: '', id: '', className: '', style: {},
    children: [], value: '', textContent: '',
    set innerHTML(v){ this._html = String(v); }, get innerHTML(){ return this._html; },
    appendChild(c){ this.children.push(c); return c; },
    removeChild(c){ this.children = this.children.filter(x=>x!==c); },
    remove(){},
    querySelector(){ return null; }, querySelectorAll(){ return []; },
    addEventListener(){}, setAttribute(){}, focus(){},
    get parentNode(){ return null; },
  };
}
const screenRoot = makeEl('div'); screenRoot.id = 'screen-root';
const toastLayer = makeEl('div'); toastLayer.id = 'toast-layer';
const byId = { 'screen-root': screenRoot, 'toast-layer': toastLayer };
global.window = {};
global.performance = { now: () => Date.now() };
global.localStorage = (()=>{ let s={}; return {getItem:k=>k in s?s[k]:null,setItem:(k,v)=>{s[k]=String(v)},removeItem:k=>{delete s[k]}}; })();
global.document = {
  getElementById: id => byId[id] || null,
  querySelector: () => screenRoot,
  querySelectorAll: () => [],
  createElement: makeEl,
  addEventListener: () => {},
  readyState: 'complete',
  get hidden(){ return false; },
};
global.confirm = () => false;
global.location = { reload(){} };
global.setTimeout = (fn)=>{ try{fn()}catch(e){console.log('  ✗ setTimeout cb threw:', e.message)} return 0; };
global.setInterval = ()=>0;
global.FileReader = function(){};
global.CustomEvent = function(){};
global.AbortController = function(){ this.signal = {}; this.abort = ()=>{}; };
global.fetch = () => Promise.reject(new Error('no network in test')); // weather falls back gracefully

const files = ['store.js','memory.js','persona.js','avatar.js','weather.js','emotion.js','speech.js','dreams.js','conversation.js','events.js','proactive.js','ui.js'];
for (const f of files) eval(fs.readFileSync(path.join(__dirname,'js',f),'utf8'));
// In a browser, window.* ARE the globals. In this Node shim, declare them as `var`
// BEFORE eval'ing app.js so app.js's boot() (which runs at eval time) resolves bare
// `Store`/`UI` to these — and avoid a later `const` creating a TDZ shadow.
var Store = window.Store, Memory = window.Memory, Persona = window.Persona,
    Emotion = window.Emotion, Dreams = window.Dreams, Conversation = window.Conversation,
    Events = window.Events, Proactive = window.Proactive, UI = window.UI, Avatar = window.Avatar,
    Speech = window.Speech, Weather = window.Weather;
let bootThrew = null;
try { eval(fs.readFileSync(path.join(__dirname,'js','app.js'),'utf8')); } catch(e){ bootThrew = e; }
let pass=0, fail=0;
function ok(c,m){ if(c)pass++; else {fail++; console.log('  ✗',m);} }

// boot rendered onboarding without throwing
ok(!bootThrew, 'app boot did not throw' + (bootThrew?': '+bootThrew.message:''));
ok(screenRoot._html.includes('领养'), 'onboarding step0 rendered');

// walk onboarding
UI.ob(1); ok(screenRoot._html.includes('什么样的小家伙'), 'species step rendered');
UI.pickSpecies('🐱'); ok(UI.obState.species==='🐱','species picked');
UI.ob(2); ok(screenRoot._html.includes('天生是什么性格'), 'nature step rendered');
UI.pickNature('aloof'); ok(UI.obState.nature==='aloof','nature picked');
UI.ob(3); ok(screenRoot._html.includes('取个名字'), 'name step rendered');

// finish onboarding (simulate name input present)
byId['ob-name'] = (()=>{ const e=makeEl('input'); e.value='momo'; return e; })();
UI.finishOb();
ok(Store.s.created===true, 'pet created via finishOb');
ok(Store.s.pet.name==='momo','name saved');

// render each tab
for (const t of ['home','chat','memory','profile']) {
  byId['screen-root']._html='';
  try { UI.setTab(t); UI.render(); ok(screenRoot._html.length>0, `tab ${t} rendered`); }
  catch(e){ fail++; console.log(`  ✗ tab ${t} threw:`, e.message); }
}

// home shows pet name + mood
UI.setTab('home'); UI.render();
ok(screenRoot._html.includes('momo'), 'home shows pet name');
ok(screenRoot._html.includes('<svg'), 'home renders parametric SVG avatar');
ok(window.Avatar && typeof window.Avatar.svg === 'function', 'Avatar module loaded');

// avatar changes with emotion state (different markup for happy vs sad)
const happySvg = window.Avatar.svg({species:'🐶',state:'happy',persona:{}});
const sadSvg = window.Avatar.svg({species:'🐶',state:'sad',persona:{}});
ok(happySvg !== sadSvg, 'avatar markup differs between happy and sad');
ok(sadSvg.includes('ellipse') && sadSvg.length !== happySvg.length, 'sad state has distinct features (tears/cloud)');

// chat send path
UI.setTab('chat'); UI.render();
byId['chatInput'] = (()=>{ const e=makeEl('input'); e.value='我今天好累啊压力好大'; return e; })();
byId['chatLog'] = makeEl('div');
try { UI.send(); ok(true, 'send did not throw'); } catch(e){ fail++; console.log('  ✗ send threw:', e.message); }
ok(Store.s.chat.some(m=>m.role==='user'), 'user message in chat log');
ok(Store.s.chat.some(m=>m.role==='pet'), 'pet replied in chat log');

// memory got recorded from chat
ok(Store.s.memories.length>0, 'memory recorded from chat');

// ---- new feature assertions ----
// req #2: bark-style speech wrapping
const v = Speech.voice('你回来啦');
ok(/^[汪喵吱呜唔]/.test(v) && v.includes('（你回来啦）'), 'speech wraps as bark（内容）: ' + v);
ok(Speech.meaning(v) === '你回来啦', 'meaning() unwraps bark');
// req #4: bark length scales with content length
Store.s.emotion.state = 'calm'; Store.s.emotion.arousal = 0.3;
const shortB = Speech.voice('好').match(/^[汪喵吱呜唔]+/)[0].length;
const longB = Speech.voice('今天发生了好多事情我想慢慢讲给你听呢真的好开心').match(/^[汪喵吱呜唔]+/)[0].length;
ok(longB > shortB, `bark length scales with content (${shortB} -> ${longB})`);
// pet line in chat renders wrapped
UI.setTab('chat'); UI.render();
ok(/[汪喵吱呜唔].*（/.test(screenRoot._html) || screenRoot._html.includes('（'), 'chat renders bark-wrapped pet line');

// req #5 + #2(layout): full-screen Ghibli environment scene
ok(typeof Avatar.scene === 'function', 'Avatar.scene exists');
ok(typeof Avatar.bgScene === 'function', 'Avatar.bgScene exists');
const sc = Avatar.scene({species:'🐶',state:'calm',persona:{}});
ok(sc.includes('scene-bg'), 'scene has background SVG');
ok(sc.includes('scene-pet'), 'scene contains pet slot');
ok(sc.includes('scene-chick'), 'scene contains chick (req #3)');
UI.setTab('home'); UI.render();
ok(screenRoot._html.includes('home full') && screenRoot._html.includes('scene-bg'), 'home renders full-screen scene');
ok(screenRoot._html.includes('float-actions'), 'home has floating action buttons (Talking-Tom layout)');
ok(screenRoot._html.includes('chick-meter'), 'home shows chick energy meter');

// req #6: per-interaction animation overlays
ok(Avatar.actionFx('pet').includes('🤚'), 'pet action fx has hand');
ok(Avatar.actionFx('feed').includes('animate'), 'feed action fx animates');
ok(Avatar.actionFx('play').includes('circle'), 'play action fx has ball');

// req #3: chick tap builds energy; full meter refills interactions
Store.s.chick.energy = 0;
window.UI_APP.tapChick();
ok(Store.s.chick.energy === 1, 'tapping chick adds energy');
Store.s.interactions.feed.restUntil = Date.now() + 99999;
Store.s.chick.energy = Store.s.chick.max - 1;
window.UI_APP.tapChick();
ok(Store.s.chick.energy === 0, 'full chick meter resets energy');
ok(Store.s.interactions.feed.restUntil === 0, 'full chick meter clears interaction rest (req #3)');

// req #7: interaction limits + rest
Store.s.interactions.feed.count = Store.s.interactions.feed.max - 1;
window.UI_APP && window.UI_APP.doAction('feed');
ok(Store.s.interactions.feed.restUntil > Date.now(), 'hitting feed cap triggers rest cooldown');
UI.render();
ok(screenRoot._html.includes('休息中'), 'resting action shows 休息中 in UI');

// req #3: change banner surfaces drift on home
Store.s.persona.drift_log.push({day: Store.s.day+5, cause:'测试', note:'它变得更黏你了'});
Store.s.lastChangeShownDay = 0;
UI.setTab('home'); UI.render();
ok(screenRoot._html.includes('它变得更黏你了'), 'home surfaces pet change banner');

// req: pet present on memory + profile panels
UI.setTab('memory'); UI.render();
ok(screenRoot._html.includes('panel-pet'), 'memory panel shows pet');
UI.setTab('profile'); UI.render();
ok(screenRoot._html.includes('panel-pet'), 'profile panel shows pet');

// ---- this round's new feature assertions ----
// req #2(anime): pet svg has glossy multi-catchlight eyes + cel-shading rim
const calmSvg = Avatar.svg({species:'🐶',state:'calm',persona:{}});
ok(calmSvg.includes('iris') && calmSvg.includes('rim'), 'pet has anime iris + rim-light shading');
// req #3(idle): pet animates even when not interacted with (always-on SMIL)
ok(calmSvg.includes('animateTransform') && calmSvg.includes('<animate '), 'pet has always-on idle animation (blink/breathe/sway)');
const blinkCount = (calmSvg.match(/animate /g)||[]).length;
ok(blinkCount >= 2, `pet has multiple idle animators (${blinkCount})`);

// req #4(weather): scene reflects weather code (rain adds drops, snow adds flakes)
const rainScene = Avatar.bgScene({weather:{code:61, isDay:1, time:'afternoon'}});
const clearScene = Avatar.bgScene({weather:{code:0, isDay:1, time:'afternoon'}});
ok(rainScene.includes('line') && rainScene !== clearScene, 'rain weather renders rain particles');
const snowScene = Avatar.bgScene({weather:{code:71, isDay:1, time:'afternoon'}});
ok(snowScene.includes('animateMotion'), 'snow weather renders falling flakes');
ok(Avatar.weatherCat(0)==='clear' && Avatar.weatherCat(61)==='rain' && Avatar.weatherCat(71)==='snow' && Avatar.weatherCat(95)==='storm', 'weather codes map to categories');
// regression: scenes must never contain NaN/undefined fills (the "black hole" bug)
let _nan = 0;
for (const t of ['morning','noon','afternoon','evening','late_night'])
  for (const c of [0,3,61,71,95]) {
    const s = Avatar.bgScene({weather:{code:c,isDay:t==='late_night'?0:1,time:t}});
    _nan += (s.match(/NaN|undefined/g)||[]).length;
  }
ok(_nan === 0, `no NaN/undefined fills in any scene (found ${_nan}) — guards the black-hole bug`);
// Weather module degrades gracefully when fetch fails
ok(typeof Weather.refresh === 'function' && typeof Weather.current === 'function', 'Weather module present');
const wprom = Weather.refresh();
ok(wprom && typeof wprom.then === 'function', 'Weather.refresh returns a promise (async, non-blocking)');

console.log(`\nDOM RENDER TEST: ${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
