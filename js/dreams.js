/* ============================================================
   dreams.js — Channel B narrative wrapper (PRD §6.3 通道B)
   Turns a recalled long-term memory into a "dream" the pet
   shares on waking. Gives an un-awkward reason to surface old
   memories ("我昨晚梦到...") — random is allowed in dreams.
   ============================================================ */
(function () {
  const S = () => Store.s;

  const FRAMES_WARM = [
    mem => `我昨晚做了个梦…梦到${snippet(mem)}。醒来还觉得心里暖暖的。`,
    mem => `诶，我梦见你了。梦里${snippet(mem)}，好真实呀。`,
    mem => `昨晚的梦好奇怪又好幸福，是关于${snippet(mem)}的。`,
  ];
  const FRAMES_TENDER = [
    mem => `我做了个梦…梦到${snippet(mem)}。醒来有点想你。`,
    mem => `昨晚梦到${snippet(mem)}，我在梦里一直在找你。`,
  ];

  function snippet(mem) {
    let s = mem.summary || mem.content || '我们在一起';
    s = s.replace(/^主人/, '你');
    if (s.length > 22) s = s.slice(0, 22) + '…';
    return s;
  }

  // build dream object at sleep; stored to be shared on wake
  function build() {
    const mem = Memory.generateDream();
    if (!mem) return null;
    const warm = mem.emotion_valence >= -0.1;
    const frames = warm ? FRAMES_WARM : FRAMES_TENDER;
    const idx = Math.floor(Math.random() * frames.length);
    return { text: frames[idx](mem), fromMemId: mem.id, day: S().day };
  }

  window.Dreams = { build };
})();
