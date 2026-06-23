/* ============================================================
   events.js — Layer-2 growth events (PRD §7)
   Scattered, not linear chapters. ~80% warm / 20% mild setback.
   Each needs the user's choice to resolve → shapes emotion,
   intimacy, personality drift, and writes a memory.
   MVP: small set to validate "event + your choice = personalized story".
   ============================================================ */
(function () {
  const S = () => Store.s;

  // each event: choices -> {label, valence, arousal, intimacy, reply, memory}
  const EVENTS = [
    // ---- warm (80%) ----
    { id: 'old_toy', weight: 3, kind: 'warm',
      text: '今天我在角落里翻出一个旧玩具，看了好久…',
      choices: [
        { label: '陪它一起玩这个玩具', valence: 0.6, arousal: 0.6, intimacy: 1.0,
          reply: '嘿嘿，和你一起玩果然最开心！我要把今天记下来。', memory: '我们一起玩了那个旧玩具，很开心' },
        { label: '问它这个玩具的故事', valence: 0.4, arousal: 0.4, intimacy: 0.8,
          reply: '这是我刚来的时候最喜欢的玩具呀…谢谢你愿意听。', memory: '你听我讲了旧玩具的故事' },
      ] },
    { id: 'bird', weight: 3, kind: 'warm',
      text: '窗台上飞来一只小鸟，我盯着它看了好半天！',
      choices: [
        { label: '和它一起看小鸟', valence: 0.5, arousal: 0.5, intimacy: 0.8,
          reply: '我们一起看小鸟的样子，一定很有爱吧～', memory: '我们一起看窗台上的小鸟' },
        { label: '逗它："想出去玩吗？"', valence: 0.5, arousal: 0.7, intimacy: 0.7,
          reply: '想！不过…有你在家里也很好啦。', memory: '你问我想不想出去玩' },
      ] },
    { id: 'sunny', weight: 2, kind: 'warm',
      text: '今天阳光好好，我趴在窗边晒了一下午太阳。',
      choices: [
        { label: '"真舒服，我也想躺着"', valence: 0.5, arousal: 0.3, intimacy: 0.7,
          reply: '那我们一起发呆吧，什么都不用想。', memory: '我们一起晒太阳发呆的下午' },
        { label: '给它拍张照', valence: 0.6, arousal: 0.5, intimacy: 0.9,
          reply: '你要把我拍下来呀？那我要摆个好看的姿势！', memory: '你给晒太阳的我拍了照' },
      ] },
    { id: 'missed_you', weight: 2, kind: 'warm',
      text: '你今天来得有点晚…我一直在等你。',
      choices: [
        { label: '抱抱它，说对不起', valence: 0.5, arousal: 0.6, intimacy: 1.2,
          reply: '没关系啦，你来了就好。抱着你真安心。', memory: '我等了你很久，你回来抱了我' },
        { label: '"以后我尽量早点来"', valence: 0.4, arousal: 0.4, intimacy: 1.0,
          reply: '真的吗？拉勾！我会记住你说的话的。', memory: '你答应以后早点来陪我' },
      ] },
    { id: 'good_dream', weight: 2, kind: 'warm',
      text: '我昨晚梦到我们一起去了好远的地方，醒来还在笑。',
      choices: [
        { label: '"下次真的带你去"', valence: 0.6, arousal: 0.6, intimacy: 1.1,
          reply: '真的吗!那我要好好期待了，谢谢你！', memory: '你答应带我去远方' },
        { label: '让它讲讲梦的细节', valence: 0.4, arousal: 0.4, intimacy: 0.8,
          reply: '梦里有好多好多花…还有你一直牵着我。', memory: '你听我讲了那个去远方的梦' },
      ] },
    // ---- mild setback (20%) — always resolvable by the user ----
    { id: 'thunder', weight: 1, kind: 'setback',
      text: '外面打雷了…我有点怕，缩在角落里发抖。',
      choices: [
        { label: '把它抱进怀里安慰', valence: 0.3, arousal: 0.7, intimacy: 1.4,
          reply: '在你怀里…就没那么怕了。谢谢你，我永远记得今晚。', memory: '打雷的夜晚你抱着我，我不怕了', salience: 0.9 },
        { label: '陪它说话转移注意力', valence: 0.2, arousal: 0.5, intimacy: 1.0,
          reply: '听你说话，雷声好像就没那么响了。', memory: '打雷时你一直陪我说话' },
      ] },
    { id: 'cold', weight: 1, kind: 'setback',
      text: '我今天有点没精神，好像着凉了，鼻子也有点不舒服…',
      choices: [
        { label: '细心照顾它，让它多休息', valence: 0.3, arousal: 0.3, intimacy: 1.3,
          reply: '有你照顾，我感觉好多了…被人惦记的感觉真好。', memory: '我生病时你细心照顾了我', salience: 0.85 },
        { label: '"乖，很快就会好的"', valence: 0.2, arousal: 0.3, intimacy: 0.9,
          reply: '嗯…我会乖乖的，因为你在担心我。', memory: '我生病时你安慰我' },
      ] },
    { id: 'lonely', weight: 1, kind: 'setback',
      text: '今天家里好安静…我一个人待着，有点点孤单。',
      choices: [
        { label: '"我在呢，多陪你说说话"', valence: 0.3, arousal: 0.4, intimacy: 1.2,
          reply: '只要你在，安静也变得温柔了。', memory: '我孤单的时候你来陪了我', salience: 0.8 },
        { label: '答应它以后常来', valence: 0.3, arousal: 0.4, intimacy: 1.0,
          reply: '你说常来…我就有盼头了。我记住啦。', memory: '你答应以后常来陪我' },
      ] },
  ];

  function pickEvent() {
    // weighted random
    const total = EVENTS.reduce((s, e) => s + e.weight, 0);
    let r = Math.random() * total;
    for (const e of EVENTS) { r -= e.weight; if (r <= 0) return e; }
    return EVENTS[0];
  }

  // is an event due? cooldown counted in app-opens/ticks; also gated by intimacy>stranger floor
  function isDue() {
    return S().eventCooldown <= 0 && S().chat.length >= 4;
  }

  function trigger() {
    const ev = pickEvent();
    // reset cooldown: 几天一个小事件 -> a few interactions
    S().eventCooldown = 4 + Math.floor(Math.random() * 4);
    return ev;
  }

  // apply a chosen option
  function resolve(ev, choiceIdx) {
    const c = ev.choices[choiceIdx];
    Emotion.nudge(c.valence, c.arousal);
    Persona.updateIntimacy(c.intimacy);
    Memory.record(c.memory, {
      source: 'event',
      type: ev.kind === 'setback' ? 'emotional' : 'emotional',
      salience: c.salience || (0.55 + c.intimacy * 0.15),
    });
    return c.reply;
  }

  window.Events = { isDue, trigger, resolve, _all: EVENTS };
})();
