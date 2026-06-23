/* ============================================================
   proactive.js — "它在你不看时也在生活" (PRD §3 / diff point 2)
   Low-frequency, reasoned proactive messages (1-3/day, cap).
   First proactive is scheduled to fire shortly after creation
   to give B-class users a Day-0 aha (PRD §5.1).
   Messages are gated by reason + cooldown, never spammy.
   ============================================================ */
(function () {
  const S = () => Store.s;

  function timeGreeting() {
    const c = Store.timeCtx();
    const map = {
      morning: ['早安呀，今天也要好好的哦。', '我醒啦，第一个想到的就是你。'],
      noon: ['吃午饭了吗？别饿着自己。', '中午啦，记得歇一会儿。'],
      afternoon: ['下午有点犯困…你在忙吗？', '想你了，就过来说一声。'],
      evening: ['今天辛苦啦，回来陪我聊聊吧。', '夜色挺好的，你那边怎么样？'],
      late_night: ['这么晚还没睡呀？早点休息，我担心你。', '夜深了，我陪着你，别熬太晚。'],
    };
    return pick(map[c] || map.afternoon);
  }

  // build a proactive message with a *reason*
  function compose() {
    const stage = Memory.bondStage();
    const p = Persona.effective();

    // reason 1: missed-you if bonded & been a while
    if (S().lastSeen && (Date.now() - S().lastSeen) > 1000 * 60 * 60 * 3 && stage !== 'stranger') {
      return { ico: '🐾', title: pet().name + ' 想你了', text: pick([
        '你去哪儿啦，我一直在等你回来。',
        '好久没看到你了…有点想你。',
      ]) };
    }
    // reason 2: clingy personality
    if (p.clinginess > 0.5 && Math.random() < 0.5) {
      return { ico: '💗', title: pet().name, text: pick(['突然好想你，就想跟你说一声。', '在干嘛呀？我有点黏你了。']) };
    }
    // reason 3: wary personality needs reassurance
    if (p.wariness > 0.45) {
      return { ico: '🥺', title: pet().name, text: pick(['你…还在的吧？我有点不安。', '能回我一句吗，我会安心一点。']) };
    }
    // default: time-based greeting
    return { ico: '🐾', title: pet().name, text: timeGreeting() };
  }

  // can we send now? cap 1-3/day, min spacing
  function canSend() {
    if (S().proactiveCount >= 3) return false;
    if (S().lastProactiveTs && (Date.now() - S().lastProactiveTs) < 1000 * 60 * 30) return false;
    return true;
  }

  function markSent() {
    S().lastProactiveTs = Date.now();
    S().proactiveCount += 1;
  }

  function resetDaily() { S().proactiveCount = 0; }

  function pet() { return S().pet; }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  window.Proactive = { compose, canSend, markSent, resetDaily };
})();
