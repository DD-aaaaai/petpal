/* ============================================================
   avatar.js — anime-style (Ghibli/Shinkai-inspired) pet, chick,
   and environment, all code-drawn SVG with always-on idle life.

   Avatar.svg(opts)    -> the pet (cel-shaded, big glossy anime eyes,
                          idle: blink / breathe / ear-twitch / tail-sway /
                          occasional look-around)
   Avatar.bgScene(opts)-> full-screen painterly environment (layered
                          hills, atmospheric haze, light rays, weather
                          particles). Honors weather+time when given.
   Avatar.scene(opts)  -> bgScene + pet slot + chick slot + fx slot
   Avatar.chick()      -> anime chick sprite
   Avatar.actionFx()   -> interaction overlays

   opts.weather: { code, isDay } from weather.js (optional). When
   absent, falls back to time-of-day only.

   NOTE: still code-drawn vector (no raster). Pushed toward anime via
   cel-shading, rim light, big catchlight eyes, soft gradients, haze
   and god-rays. For true film-grade frames, drop images into
   Avatar.RASTER[species][state].
   ============================================================ */
(function () {
  let _uid = 0;
  const RASTER = {};

  // anime-leaning palettes: brighter base, clear shadow tone, warm rim
  const PAL = {
    '🐶': { base:'#e9c79a', shade:'#c79a64', dark:'#a87b45', light:'#fbedd2', belly:'#fff6e8', nose:'#5b4636', ear:'#d2a771', rim:'#fff2d0' },
    '🐱': { base:'#cfd6e2', shade:'#a9b2c6', dark:'#8590a8', light:'#eef2f8', belly:'#fbfcff', nose:'#e08698', ear:'#bcc4d6', rim:'#eaf2ff' },
    '🐰': { base:'#f4ecf0', shade:'#dcc9d4', dark:'#bfa3b3', light:'#fffdfe', belly:'#ffffff', nose:'#ec8aa2', ear:'#f6d6e2', rim:'#fff0f6' },
  };

  function defs(id, c) {
    return `<defs>
      <radialGradient id="body${id}" cx="40%" cy="30%" r="78%">
        <stop offset="0%" stop-color="${c.light}"/><stop offset="50%" stop-color="${c.base}"/>
        <stop offset="82%" stop-color="${c.shade}"/><stop offset="100%" stop-color="${c.dark}"/>
      </radialGradient>
      <radialGradient id="head${id}" cx="38%" cy="28%" r="76%">
        <stop offset="0%" stop-color="${c.light}"/><stop offset="55%" stop-color="${c.base}"/>
        <stop offset="100%" stop-color="${c.shade}"/>
      </radialGradient>
      <radialGradient id="belly${id}" cx="50%" cy="38%" r="68%">
        <stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="${c.belly}"/>
      </radialGradient>
      <radialGradient id="iris${id}" cx="42%" cy="30%" r="80%">
        <stop offset="0%" stop-color="#9fd0e8"/><stop offset="38%" stop-color="#4f93c4"/>
        <stop offset="78%" stop-color="#2c5e94"/><stop offset="100%" stop-color="#1c2f55"/>
      </radialGradient>
      <linearGradient id="rim${id}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${c.rim}" stop-opacity="0.9"/><stop offset="60%" stop-color="${c.rim}" stop-opacity="0"/>
      </linearGradient>
    </defs>`;
  }

  // ears with idle twitch
  function ears(sp, c, id, state) {
    const lift = (state==='excited'||state==='happy') ? -5 : (state==='sad'||state==='wary'||state==='sleepy') ? 6 : 0;
    const twitchL = `<animateTransform attributeName="transform" type="rotate" values="-2 60 62;-2 60 62;-9 60 62;-2 60 62" keyTimes="0;0.82;0.88;1" dur="5s" repeatCount="indefinite"/>`;
    const twitchR = `<animateTransform attributeName="transform" type="rotate" values="2 140 62;2 140 62;9 140 62;2 140 62" keyTimes="0;0.6;0.66;1" dur="6s" repeatCount="indefinite"/>`;
    if (sp === '🐶') {
      return `<g>
        <path d="M58,60 Q26,72 32,122 Q54,120 70,86 Z" fill="url(#head${id})">${twitchL}</path>
        <path d="M58,60 Q40,74 44,104 Q56,104 66,84 Z" fill="${c.dark}" opacity="0.25"/>
        <path d="M142,60 Q174,72 168,122 Q146,120 130,86 Z" fill="url(#head${id})">${twitchR}</path>
        <path d="M142,60 Q160,74 156,104 Q144,104 134,84 Z" fill="${c.dark}" opacity="0.25"/>
      </g>`;
    }
    if (sp === '🐱') {
      return `<g transform="translate(0 ${lift})">
        <path d="M64,52 L44,14 L88,42 Z" fill="url(#head${id})">${twitchL}</path><path d="M65,50 L54,28 L80,44 Z" fill="${c.ear}"/>
        <path d="M136,52 L156,14 L112,42 Z" fill="url(#head${id})">${twitchR}</path><path d="M135,50 L146,28 L120,44 Z" fill="${c.ear}"/>
      </g>`;
    }
    return `<g>
      <g>${twitchL}<ellipse cx="78" cy="28" rx="12" ry="38" fill="url(#head${id})"/><ellipse cx="78" cy="30" rx="5.5" ry="28" fill="${c.ear}"/></g>
      <g>${twitchR}<ellipse cx="122" cy="28" rx="12" ry="38" fill="url(#head${id})"/><ellipse cx="122" cy="30" rx="5.5" ry="28" fill="${c.ear}"/></g>
    </g>`;
  }

  // big anime eyes with multiple catchlights + idle blink + pupil drift (look around)
  function eyes(state, c, id) {
    const look = `<animateTransform attributeName="transform" type="translate" values="0 0;0 0;-2.5 0;2.5 0;0 0;0 0" keyTimes="0;0.4;0.5;0.6;0.7;1" dur="7s" repeatCount="indefinite"/>`;
    const blink = `<animate attributeName="ry" values="15;15;15;1.5;15" keyTimes="0;0.9;0.93;0.955;0.98" dur="4.5s" repeatCount="indefinite"/>`;
    const eye = (cx) => `
      <g>
        <ellipse cx="${cx}" cy="98" rx="13" ry="15.5" fill="#fff"/>
        <g>${look}
          <ellipse cx="${cx}" cy="99" rx="11" ry="13.5" fill="url(#iris${id})">${blink}</ellipse>
          <circle cx="${cx}" cy="101" r="5.2" fill="#10203c"/>
          <ellipse cx="${cx-4}" cy="93" rx="3.6" ry="4.4" fill="#fff" opacity="0.96"/>
          <circle cx="${cx+4}" cy="103" r="1.8" fill="#cfeaff" opacity="0.85"/>
          <ellipse cx="${cx+3}" cy="95" rx="1.2" ry="1.6" fill="#fff" opacity="0.7"/>
        </g>
        <path d="M${cx-13},90 Q${cx},82 ${cx+13},90" fill="none" stroke="${c.dark}" stroke-width="1.6" opacity="0.5"/>
      </g>`;
    switch (state) {
      case 'happy':
        return `<path d="M71,99 Q84,86 97,99" stroke="#3a2c1c" stroke-width="5" fill="none" stroke-linecap="round"/>
                <path d="M103,99 Q116,86 129,99" stroke="#3a2c1c" stroke-width="5" fill="none" stroke-linecap="round"/>`;
      case 'excited':
        return `<g>${eye(82)}${eye(118)}
          <path d="M82,76 l2.4,6 6,2.4 -6,2.4 -2.4,6 -2.4,-6 -6,-2.4 6,-2.4z" fill="#fff0a8"><animateTransform attributeName="transform" type="scale" values="1;1.5;1" dur="0.8s" repeatCount="indefinite" additive="sum"/></path></g>`;
      case 'sleepy':
        return `<path d="M71,100 Q84,106 97,100" stroke="#3a2c1c" stroke-width="4.4" fill="none" stroke-linecap="round"/>
                <path d="M103,100 Q116,106 129,100" stroke="#3a2c1c" stroke-width="4.4" fill="none" stroke-linecap="round"/>`;
      case 'sad':
        return `<g>${eye(82)}${eye(118)}
          <path d="M68,84 Q80,80 92,86" stroke="${c.dark}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
          <path d="M108,86 Q120,80 132,84" stroke="${c.dark}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
          <ellipse cx="88" cy="116" rx="3.8" ry="5.4" fill="#a7d8f0"><animate attributeName="cy" values="112;134" dur="2.2s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;1;0" dur="2.2s" repeatCount="indefinite"/></ellipse></g>`;
      case 'wary':
        return `<g>${eye(82)}${eye(118)}
          <path d="M69,84 L93,90" stroke="${c.dark}" stroke-width="3" stroke-linecap="round"/>
          <path d="M131,84 L107,90" stroke="${c.dark}" stroke-width="3" stroke-linecap="round"/></g>`;
      default:
        return `<g>${eye(82)}${eye(118)}</g>`;
    }
  }

  function muzzle(sp, state, c, id) {
    const nose = sp === '🐱' || sp === '🐰'
      ? `<path d="M100,109 l-5.5,5 5.5,4.2 5.5,-4.2z" fill="${c.nose}"/>`
      : `<ellipse cx="100" cy="111" rx="7.5" ry="5.4" fill="${c.nose}"/><ellipse cx="97" cy="109" rx="2.2" ry="1.5" fill="#fff" opacity="0.55"/>`;
    let m;
    switch (state) {
      case 'happy': m = `<path d="M100,115 Q100,125 90,127 M100,115 Q100,125 110,127" stroke="#6a523a" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M86,125 Q100,137 114,125" stroke="#6a523a" stroke-width="2.6" fill="none" stroke-linecap="round"/>`; break;
      case 'excited': m = `<path d="M100,115 L100,121" stroke="#6a523a" stroke-width="2.4"/><path d="M83,121 Q100,144 117,121 Q100,131 83,121 Z" fill="#a23a48"/><ellipse cx="100" cy="131" rx="6.5" ry="4.2" fill="#ff9eb0"/>`; break;
      case 'sleepy': m = `<ellipse cx="100" cy="125" rx="6.5" ry="9" fill="#8a3a46"/>`; break;
      case 'sad': m = `<path d="M100,115 L100,121" stroke="#6a523a" stroke-width="2.4"/><path d="M88,131 Q100,122 112,131" stroke="#6a523a" stroke-width="2.8" fill="none" stroke-linecap="round"/>`; break;
      case 'wary': m = `<path d="M100,115 L100,121" stroke="#6a523a" stroke-width="2.4"/><path d="M89,125 q5.5,-4 11,0 q5.5,4 11,0" stroke="#6a523a" stroke-width="2.6" fill="none" stroke-linecap="round"/>`; break;
      default: m = `<path d="M100,115 Q100,123 91,125 M100,115 Q100,123 109,125" stroke="#6a523a" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
    }
    return `<ellipse cx="100" cy="117" rx="21" ry="16" fill="url(#belly${id})" opacity="0.9"/>${nose}${m}`;
  }

  function cheeks(state, persona) {
    const show = state==='happy'||state==='excited'||(persona&&persona.clinginess>0.5);
    if (!show) return '';
    return `<ellipse cx="64" cy="116" rx="11" ry="6.5" fill="#ff9eb0" opacity="0.45"/><ellipse cx="136" cy="116" rx="11" ry="6.5" fill="#ff9eb0" opacity="0.45"/>`;
  }

  // tail with idle sway, faster when happy/excited
  function tail(sp, c, id, state) {
    let dur='2.6s', sw='9';
    if (state==='excited'){dur='0.4s';sw='26';} else if (state==='happy'){dur='0.7s';sw='18';}
    else if (state==='sad'||state==='wary'||state==='sleepy'){dur='4.4s';sw='4';}
    const wag = `<animateTransform attributeName="transform" type="rotate" values="-${sw} 150 158;${sw} 150 158;-${sw} 150 158" dur="${dur}" repeatCount="indefinite"/>`;
    if (sp==='🐰') return `<g><circle cx="154" cy="160" r="14" fill="url(#belly${id})">${wag}</circle></g>`;
    return `<g><path d="M146,158 Q182,146 186,118 Q175,121 162,141 Q152,150 144,158 Z" fill="url(#body${id})">${wag}</path></g>`;
  }

  function svg(opts) {
    opts = opts || {};
    const sp = opts.species || '🐶';
    const state = opts.state || 'calm';
    const persona = opts.persona || {};
    const size = opts.size || 220;
    if (RASTER[sp] && RASTER[sp][state]) {
      return `<img class="petimg ${state}" src="${RASTER[sp][state]}" width="${size}" height="${size}" alt="pet"/>`;
    }
    const c = PAL[sp] || PAL['🐶'];
    const id = (_uid++);
    // always-on idle: gentle breathe (scale) + bob; the eyes/ears/tail animate internally
    const breatheDur = state==='excited'?'0.6s':state==='sleepy'?'4.6s':state==='sad'?'4.8s':'3.4s';
    const bob = state==='sleepy'?'0;2':state==='sad'?'0;3':state==='excited'?'0;-9':'0;-5';
    return `
<svg class="petsvg" width="${size}" height="${size}" viewBox="0 0 200 210" xmlns="http://www.w3.org/2000/svg" style="overflow:visible">
  ${defs(id,c)}
  <ellipse cx="100" cy="198" rx="50" ry="9" fill="#000" opacity="0.10">
    <animate attributeName="rx" values="50;46;50" dur="${breatheDur}" repeatCount="indefinite"/></ellipse>
  <g>
    <animateTransform attributeName="transform" type="translate" values="${bob.split(';').map(v=>'0 '+v).join(';')};0 ${bob.split(';')[0]}" dur="${breatheDur}" repeatCount="indefinite"/>
    <g style="transform-origin:100px 150px">
      <animateTransform attributeName="transform" type="scale" values="1 1;1.025 0.985;1 1" dur="${breatheDur}" repeatCount="indefinite" additive="sum"/>
      ${tail(sp,c,id,state)}
      ${ears(sp,c,id,state)}
      <!-- soft storybook outline + rounded body, connected to head -->
      <path d="M62,116 Q56,150 70,178 Q100,200 130,178 Q144,150 138,116 Z" fill="${c.shade}" opacity="0.0"/>
      <ellipse cx="100" cy="156" rx="48" ry="44" fill="${c.dark}" opacity="0.25"/>
      <ellipse cx="100" cy="154" rx="46" ry="42" fill="url(#body${id})"/>
      <ellipse cx="100" cy="164" rx="28" ry="26" fill="url(#belly${id})"/>
      <path d="M58,128 Q100,150 142,128 Q140,108 100,112 Q60,108 58,128 Z" fill="url(#rim${id})" opacity="0.5"/>
      <circle cx="100" cy="98" r="53" fill="${c.dark}" opacity="0.22"/>
      <circle cx="100" cy="98" r="52" fill="url(#head${id})"/>
      <path d="M52,86 Q72,52 110,54 Q70,62 60,96 Z" fill="url(#rim${id})" opacity="0.6"/>
      <ellipse cx="100" cy="120" rx="35" ry="27" fill="url(#belly${id})" opacity="0.5"/>
      ${cheeks(state,persona)}
      ${eyes(state,c,id)}
      ${muzzle(sp,state,c,id)}
    </g>
  </g>
</svg>`;
  }

  // ---------- weather/time -> palette + sky orb ----------
  // weatherCat: 'clear' | 'cloud' | 'rain' | 'snow' | 'fog' | 'storm'
  function weatherCat(code) {
    if (code == null) return 'clear';
    if ([0,1].includes(code)) return 'clear';
    if ([2,3,45,48].includes(code)) return code>=45?'fog':'cloud';
    if ([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code)) return 'rain';
    if ([71,73,75,77,85,86].includes(code)) return 'snow';
    if ([95,96,99].includes(code)) return 'storm';
    return 'cloud';
  }
  function timeOfDay() { return (window.Store && Store.timeCtx) ? Store.timeCtx() : 'afternoon'; }

  // sky palette by time, dimmed/greyed by weather. Ghibli signatures:
  // vivid cobalt-to-pale-blue daytime sky, lush saturated greens.
  function skyColors(time, cat, isDay) {
    const night = time === 'late_night' || isDay === 0;
    let top, mid, bot, hillFar, hillNear, grass, orb;
    if (night) { top='#1b2350'; mid='#2c3568'; bot='#46518c'; hillFar='#2f3a60'; hillNear='#243056'; grass='#33503f'; orb='🌙'; }
    else {
      const M = {
        // Ghibli: strong blue up top fading to pale near horizon
        morning:  ['#7db8e8','#bfe0f2','#fbf0d8','☀️'],
        noon:     ['#4a9fe0','#9fd2f2','#e6f7fb','☀️'],
        afternoon:['#5aabe2','#aed8ee','#fde7c8','🌤️'],
        evening:  ['#e89a6a','#f4b0a8','#ffe0b0','🌇'],
      };
      const m = M[time]||M.afternoon; top=m[0]; mid=m[1]; bot=m[2]; orb=m[3];
      // lush, saturated meadow greens
      hillFar='#8fc49a'; hillNear='#6fae74'; grass='#9ed27e';
    }
    // weather desaturation
    if (cat==='rain'||cat==='storm'||cat==='fog'||cat==='snow') {
      top = blend(top,'#8a96a4',0.4); mid = blend(mid,'#9ba6b2',0.35); bot = blend(bot,'#aeb6c0',0.3);
      hillFar = blend(hillFar,'#7d8a80',0.25); hillNear = blend(hillNear,'#6a7a6e',0.25); grass = blend(grass,'#7d9070',0.2);
    }
    return { top, mid, bot, hillFar, hillNear, grass, orb, night };
  }
  function blend(hex, hex2, t) {
    const a=hx(hex), b=hx(hex2);
    const r=Math.round(a[0]+(b[0]-a[0])*t), g=Math.round(a[1]+(b[1]-a[1])*t), bl=Math.round(a[2]+(b[2]-a[2])*t);
    return '#'+[r,g,bl].map(x=>x.toString(16).padStart(2,'0')).join('');
  }
  function hx(h){
    h = h.replace('#','');
    // expand 3-digit shorthand (#000 -> 000000, #fff -> ffffff) so slice(4,6) is valid
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
  }

  // weather particle layer
  function weatherFx(cat, night) {
    if (cat==='rain'||cat==='storm') {
      const drops = Array.from({length:30}).map((_,i)=>`<line x1="${(i*27)%380}" y1="-10" x2="${(i*27)%380 -8}" y2="14" stroke="#aac4e0" stroke-width="2" opacity="0.55"><animateTransform attributeName="transform" type="translate" values="0 0;-30 360" dur="${0.7+(i%4)*0.15}s" repeatCount="indefinite"/></line>`).join('');
      const lightning = cat==='storm'?`<rect x="0" y="0" width="380" height="640" fill="#fff" opacity="0"><animate attributeName="opacity" values="0;0;0.5;0;0.3;0" dur="6s" repeatCount="indefinite"/></rect>`:'';
      return drops+lightning;
    }
    if (cat==='snow') {
      return Array.from({length:26}).map((_,i)=>`<circle cx="${(i*31)%380}" cy="-8" r="${2+(i%3)}" fill="#fff" opacity="0.85"><animateMotion path="M0,0 q${(i%2?20:-20)},300 ${(i%2?-10:10)},648" dur="${5+(i%5)}s" repeatCount="indefinite"/></circle>`).join('');
    }
    if (cat==='fog') {
      return `<g opacity="0.5"><ellipse cx="120" cy="380" rx="200" ry="40" fill="#fff"><animate attributeName="cx" values="80;300;80" dur="22s" repeatCount="indefinite"/></ellipse><ellipse cx="280" cy="460" rx="180" ry="34" fill="#fff" opacity="0.7"><animate attributeName="cx" values="300;60;300" dur="28s" repeatCount="indefinite"/></ellipse></g>`;
    }
    return '';
  }

  // ---------- full-screen painterly environment ----------
  function bgScene(opts) {
    opts = opts || {};
    const time = (opts.weather && opts.weather.time) || timeOfDay();
    const cat = weatherCat(opts.weather ? opts.weather.code : null);
    const isDay = opts.weather ? opts.weather.isDay : (time==='late_night'?0:1);
    const { top, mid, bot, hillFar, hillNear, grass, orb, night } = skyColors(time, cat, isDay);
    const id = (_uid++);
    const showOrb = (cat==='clear'||cat==='cloud');
    const clouds = (cat==='clear'||cat==='cloud') ? `<g opacity="${cat==='cloud'?0.95:0.8}">${cloud(70,80,1,'0s','70s',night)}${cloud(250,56,0.85,'-25s','85s',night)}${cloud(165,120,0.6,'-45s','100s',night)}${cat==='cloud'?cloud(310,110,0.7,'-10s','90s',night):''}</g>` : (cat==='rain'||cat==='storm'||cat==='snow'||cat==='fog'?`<g opacity="0.9">${cloud(80,70,1.1,'0s','60s',true)}${cloud(240,90,1,'-20s','70s',true)}${cloud(330,60,0.8,'-40s','80s',true)}</g>`:'');
    const stars = night ? Array.from({length:24}).map((_,i)=>`<circle cx="${(i*47)%380}" cy="${(i*31)%170+6}" r="${0.8+(i%3)*0.7}" fill="#fff" opacity="${0.4+(i%3)*0.2}"><animate attributeName="opacity" values="0.2;0.95;0.2" dur="${2+i%4}s" repeatCount="indefinite"/></circle>`).join('') : '';
    // Shinkai-ish god-rays for clear day
    const rays = (cat==='clear' && !night) ? `<g opacity="0.18"><path d="M70,40 L20,360 L120,360 Z" fill="#fff"/><path d="M90,40 L120,360 L200,360 Z" fill="#fff"/></g>` : '';
    const motes = (cat==='clear'||cat==='cloud') ? Array.from({length:9}).map((_,i)=>`<circle r="${1.2+(i%3)*0.8}" fill="#fff" opacity="0.5"><animateMotion path="M${(i*43)%360},${440+(i%5)*20} q30,-200 -10,-400" dur="${15+i*2}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;0.6;0" dur="${15+i*2}s" repeatCount="indefinite"/></circle>`).join('') : '';
    const treeLeaf = night?'#3a5448':(cat==='clear'?'#7fb27f':'#74a47a');
    return `
  <svg class="scene-bg" viewBox="0 0 380 640" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="sky${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${top}"/><stop offset="45%" stop-color="${mid}"/><stop offset="100%" stop-color="${bot}"/></linearGradient>
      <radialGradient id="glow${id}" cx="50%" cy="0%" r="80%"><stop offset="0%" stop-color="#fff7e0" stop-opacity="${night?0.12:0.55}"/><stop offset="100%" stop-color="#fff7e0" stop-opacity="0"/></radialGradient>
      <linearGradient id="hf${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${hillFar}"/><stop offset="100%" stop-color="${hillNear}"/></linearGradient>
      <linearGradient id="gr${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${hillNear}"/><stop offset="100%" stop-color="${grass}"/></linearGradient>
    </defs>
    <!-- depth-layered for parallax (parallax.js transforms each .plx group) -->
    <g class="plx" data-depth="0.12">
      <rect x="-60" y="-60" width="500" height="760" fill="url(#sky${id})"/>
      <rect x="-60" y="-60" width="500" height="460" fill="url(#glow${id})"/>
      ${stars}
      ${showOrb && !night ? `<g><circle cx="${time==='evening'?300:70}" cy="96" r="46" fill="#fff6d8" opacity="0.55"/><circle cx="${time==='evening'?300:70}" cy="96" r="30" fill="#fff3c4"/></g>` : (showOrb?`<text x="300" y="100" font-size="52" opacity="0.95">🌙</text>`:'')}
      ${rays}
    </g>
    <g class="plx" data-depth="0.3">${clouds}</g>
    <!-- far hills -->
    <g class="plx" data-depth="0.5">
      <path d="M-60,300 Q95,248 190,294 Q285,248 440,288 L440,700 L-60,700 Z" fill="${hillFar}" opacity="0.55"/>
      <path d="M-60,356 Q110,306 210,352 Q300,316 440,346 L440,700 L-60,700 Z" fill="url(#hf${id})" opacity="0.9"/>
      <path d="M-60,356 Q110,306 210,352 Q300,316 440,346 L440,360 Q210,318 -60,366 Z" fill="${blend(hillNear,'#ffffff',0.22)}" opacity="0.5"/>
    </g>
    <!-- meadow + tree + flowers -->
    <g class="plx" data-depth="0.78">
      <path d="M-60,432 Q120,388 250,432 Q330,458 440,424 L440,700 L-60,700 Z" fill="url(#gr${id})"/>
      <path d="M-60,432 Q120,388 250,432 Q330,458 440,424 L440,440 Q250,446 -60,448 Z" fill="${blend(grass,'#ffffff',0.25)}" opacity="0.45"/>
      <g opacity="0.96">
        <rect x="44" y="384" width="16" height="74" rx="7" fill="#8a6a40"/>
        <ellipse cx="52" cy="372" rx="46" ry="42" fill="${blend(treeLeaf,'#000',0.06)}"/>
        <circle cx="26" cy="388" r="26" fill="${blend(treeLeaf,'#000',0.12)}"/><circle cx="80" cy="390" r="28" fill="${blend(treeLeaf,'#000',0.16)}"/>
        <circle cx="46" cy="356" r="30" fill="${treeLeaf}"/>
        <circle cx="40" cy="350" r="13" fill="${blend(treeLeaf,'#fff',0.22)}" opacity="0.7"/>
      </g>
      ${[[70,520],[300,540],[150,560],[330,500],[40,560],[210,585]].map(([x,y],i)=>i%2?`<path d="M${x},${y} q-4,-12 0,-18 M${x},${y} q4,-12 0,-18 M${x},${y} q0,-12 0,-20" stroke="${blend(grass,'#000',0.18)}" stroke-width="2.4" fill="none"/>`:`<g><circle cx="${x}" cy="${y}" r="5.5" fill="#fff" opacity="0.95"/><circle cx="${x}" cy="${y}" r="2.4" fill="#ffd36b"/><path d="M${x},${y+6} l0,12" stroke="${blend(grass,'#000',0.2)}" stroke-width="2" /></g>`).join('')}
    </g>
    <!-- foreground grass band (closest, darkest, swaying) -->
    <g class="plx" data-depth="1.35">
      <g>
        <animateTransform attributeName="transform" type="rotate" values="-0.6 190 640;0.6 190 640;-0.6 190 640" dur="5s" repeatCount="indefinite"/>
        ${Array.from({length:34}).map((_,i)=>{const x=i*13-20;const h=26+(i%4)*10;return `<path d="M${x},700 Q${x+6},${640-h} ${x+12},700" fill="${blend(grass,'#000',0.32)}"/>`;}).join('')}
      </g>
    </g>
    ${motes}
    ${weatherFx(cat, night)}
  </svg>`;
  }
  // Ghibli cumulus: billowy stacked lobes, bright top, soft shaded underside, flat-ish base.
  function cloud(x,y,s,begin,dur,dim){
    const top = dim ? '#e2e7ec' : '#ffffff';
    const under = dim ? '#b9c2cc' : '#dfe9f0';
    return `<g transform="translate(${x} ${y}) scale(${s})" opacity="0.97">
      <animateTransform attributeName="transform" type="translate" values="${x} ${y};${x+40} ${y};${x} ${y}" dur="${dur}" begin="${begin}" repeatCount="indefinite" additive="sum"/>
      <!-- shaded underside -->
      <ellipse cx="0" cy="12" rx="58" ry="20" fill="${under}"/>
      <!-- billowing top lobes -->
      <circle cx="-34" cy="6" r="20" fill="${top}"/>
      <circle cx="-10" cy="-8" r="26" fill="${top}"/>
      <circle cx="20" cy="-12" r="28" fill="${top}"/>
      <circle cx="44" cy="2" r="22" fill="${top}"/>
      <circle cx="10" cy="8" r="24" fill="${top}"/>
      <ellipse cx="0" cy="14" rx="56" ry="14" fill="${top}"/>
      <!-- a couple of highlight pops -->
      <circle cx="14" cy="-16" r="9" fill="#fff" opacity="0.8"/>
    </g>`;
  }

  // ---------- anime chick (idle hop handled by CSS) ----------
  function chick() {
    return `
    <svg class="chick-svg" viewBox="0 0 60 64" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="30" cy="58" rx="16" ry="4" fill="#000" opacity="0.12"/>
      <g class="chick-hop">
        <defs><radialGradient id="ck" cx="40%" cy="30%" r="80%"><stop offset="0%" stop-color="#fff0b0"/><stop offset="60%" stop-color="#ffd24a"/><stop offset="100%" stop-color="#f0b430"/></radialGradient></defs>
        <ellipse cx="30" cy="38" rx="17" ry="15" fill="url(#ck)"/>
        <path d="M14,40 q-6,2 -2,7" stroke="#f0b840" stroke-width="3" fill="none" stroke-linecap="round"/>
        <circle cx="30" cy="20" r="13" fill="url(#ck)"/>
        <path d="M30,12 q4,-6 9,-4 q-3,3 -3,7z" fill="#f5b342"/>
        <ellipse cx="25" cy="18" rx="2.6" ry="3" fill="#2a1c0e"/><ellipse cx="35" cy="18" rx="2.6" ry="3" fill="#2a1c0e"/>
        <circle cx="24" cy="16.8" r="1" fill="#fff"/><circle cx="34" cy="16.8" r="1" fill="#fff"/>
        <path d="M30,22 l7,4 -7,3z" fill="#ef8b3c"/>
        <ellipse cx="22" cy="22" rx="3" ry="2" fill="#ff9eb0" opacity="0.5"/><ellipse cx="38" cy="22" rx="3" ry="2" fill="#ff9eb0" opacity="0.5"/>
        <path d="M27,52 l-3,6 M33,52 l3,6" stroke="#ef8b3c" stroke-width="2.6" stroke-linecap="round"/>
      </g>
    </svg>`;
  }

  function scene(opts) {
    opts = opts || {};
    const sp = opts.species || '🐶';
    const petSvg = opts.twinPhoto ? '' : svg({ species: sp, state: opts.state || 'calm', persona: opts.persona || {}, size: 230 });
    return `
<div class="scene-wrap">
  ${bgScene(opts)}
  <div class="scene-pet" id="petAvatar" onclick="UI.pokePet&&UI.pokePet()">${petSvg}</div>
  <div class="scene-chick" id="sceneChick" onclick="UI.tapChick&&UI.tapChick()">${chick()}</div>
  <div class="scene-fx" id="sceneFx"></div>
</div>`;
  }

  // ---------- interaction overlays ----------
  function actionFx(kind) {
    if (kind === 'pet') {
      return `<svg class="fx-svg" viewBox="0 0 200 200">
        <g><animateTransform attributeName="transform" type="translate" values="0 -30;0 6;0 -30" dur="1.1s" repeatCount="3"/><text x="86" y="70" font-size="42">🤚</text></g>
        ${heart(118,90,'0s')}${heart(72,80,'0.4s')}${heart(100,100,'0.8s')}</svg>`;
    }
    if (kind === 'feed') {
      return `<svg class="fx-svg" viewBox="0 0 200 200">
        <g transform="translate(70 150)"><ellipse cx="30" cy="34" rx="34" ry="9" fill="#000" opacity="0.08"/>
          <path d="M2,18 Q30,40 58,18 L54,30 Q30,46 6,30 Z" fill="#d98b5a"/><ellipse cx="30" cy="18" rx="28" ry="9" fill="#b5642f"/>
          <circle cx="22" cy="16" r="4" fill="#e9b27a"><animate attributeName="r" values="4;0" dur="1.2s" begin="0.3s" fill="freeze"/></circle>
          <circle cx="34" cy="18" r="4" fill="#e9b27a"><animate attributeName="r" values="4;0" dur="1.2s" begin="0.7s" fill="freeze"/></circle>
          <circle cx="28" cy="20" r="3.5" fill="#e9b27a"><animate attributeName="r" values="3.5;0" dur="1.2s" begin="1.1s" fill="freeze"/></circle></g>
        ${spark(112,96,'0.2s')}</svg>`;
    }
    if (kind === 'play') {
      return `<svg class="fx-svg" viewBox="0 0 200 200">
        <g><animateTransform attributeName="transform" type="translate" values="20 60;150 60;60 60;140 60;90 60" dur="1.6s" repeatCount="2"/>
          <circle cx="0" cy="0" r="14" fill="#ff6b6b"/><path d="M-14,0 a14,14 0 0,1 28,0" fill="#fff" opacity="0.85"/>
          <animateTransform attributeName="transform" type="translate" values="0 0;0 -34;0 0" dur="0.4s" repeatCount="8" additive="sum"/></g>
        ${spark(100,70,'0s')}</svg>`;
    }
    return '';
  }
  function heart(x,y,d){ return `<path d="M0,4 C-6,-4 -14,2 0,14 C14,2 6,-4 0,4z" fill="#ff7e98" transform="translate(${x} ${y})"><animateTransform attributeName="transform" type="translate" values="${x} ${y};${x} ${y-34}" dur="1.6s" begin="${d}" repeatCount="2" additive="sum"/><animate attributeName="opacity" values="0;1;1;0" dur="1.6s" begin="${d}" repeatCount="2"/></path>`; }
  function spark(x,y,d){ return `<path d="M0,-7 L2,-2 7,0 2,2 0,7 -2,2 -7,0 -2,-2z" fill="#ffd36b" transform="translate(${x} ${y})"><animate attributeName="opacity" values="0.2;1;0.2" dur="1.2s" begin="${d}" repeatCount="2"/></path>`; }

  window.Avatar = { svg, scene, bgScene, chick, actionFx, weatherCat, RASTER, PAL };
})();
