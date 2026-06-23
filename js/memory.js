/* ============================================================
   memory.js — the core differentiator (PRD §6)
   - salience scoring (卡点1: what's worth remembering)
   - three tiers (short/mid/long) + emotional/factual
   - cue tagging on write (卡点2: cues for natural recall)
   - three-channel recall: A 情境线索 / B 做梦 / C 抑制
   - sleep consolidation: 情感闪光 / 重复强化 / 衰减遗忘
   ============================================================ */
(function () {
  const S = () => Store.s;

  // --- tiny lexicons for on-device sentiment & topic (stand-in for the LLM salience model) ---
  const POS = ['开心','高兴','喜欢','爱','棒','好','幸福','满足','谢谢','感谢','温暖','治愈','哈哈','嘻嘻','可爱','想你','陪','安心'];
  const NEG = ['累','难过','伤心','孤独','寂寞','焦虑','迷茫','烦','压力','哭','痛','失败','害怕','怕','糟','崩溃','委屈','生气','讨厌','烦躁','失望'];
  const HIGH_AROUSAL = ['崩溃','哭','痛','害怕','激动','兴奋','愤怒','生气','震惊','受不了','受伤'];
  const SELF_DISCLOSE = ['我觉得','我其实','我害怕','我担心','我想','我希望','我难过','我喜欢','我讨厌','我最近','我今天','对我来说','我一直'];
  const EXPLICIT_REMEMBER = ['记住','别忘','记得','要记得','你要知道'];
  const RELATION_EVENT = ['第一次','永远','保证','答应','谢谢你','幸好有你','离不开','只有你','想你了'];
  const TOPIC_MAP = {
    work: ['工作','上班','加班','老板','同事','项目','开会','deadline','下班','离职'],
    study: ['学习','考试','作业','学校','论文','毕业','复习'],
    love: ['喜欢的人','男朋友','女朋友','对象','分手','暗恋','约会','前任'],
    family: ['爸','妈','父母','家人','家里','奶奶','爷爷'],
    health: ['生病','感冒','失眠','睡不着','头疼','医院','身体','累'],
    mood: ['孤独','寂寞','焦虑','迷茫','开心','难过','压力','心情'],
    food: ['吃','饿','美食','奶茶','火锅','零食','晚饭','午饭'],
    pet_self: ['你','宝贝','乖','摸摸','抱抱'],
  };

  function analyze(text) {
    const t = (text || '');
    let pos = 0, neg = 0, arousal = 0.15, selfDis = 0, relEvent = 0, explicit = 0;
    POS.forEach(w => { if (t.includes(w)) pos++; });
    NEG.forEach(w => { if (t.includes(w)) neg++; });
    HIGH_AROUSAL.forEach(w => { if (t.includes(w)) arousal += 0.28; });
    SELF_DISCLOSE.forEach(w => { if (t.includes(w)) selfDis += 0.5; });
    EXPLICIT_REMEMBER.forEach(w => { if (t.includes(w)) explicit += 1; });
    RELATION_EVENT.forEach(w => { if (t.includes(w)) relEvent += 0.6; });
    // length & punctuation as weak arousal signals
    if (t.length > 30) arousal += 0.1;
    if ((t.match(/[!！?？]/g) || []).length >= 1) arousal += 0.12;
    arousal = Math.min(1, arousal);
    const valence = Math.max(-1, Math.min(1, (pos - neg) * 0.4 + (pos || neg ? 0 : 0.05)));
    // topics
    const topics = [];
    for (const k in TOPIC_MAP) { if (TOPIC_MAP[k].some(w => t.includes(w))) topics.push(k); }
    return {
      valence, arousal,
      selfDisclosure: Math.min(1, selfDis),
      relationEvent: Math.min(1, relEvent),
      explicit: Math.min(1, explicit),
      topics,
      isRoutine: pos === 0 && neg === 0 && selfDis === 0 && t.length < 12,
    };
  }

  // salience = weighted blend (PRD §6.2)
  function salienceFrom(a) {
    const s =
      0.30 * a.arousal +
      0.25 * Math.abs(a.valence) +
      0.20 * a.selfDisclosure +
      0.25 * a.relationEvent +
      0.30 * a.explicit -
      0.20 * (a.isRoutine ? 1 : 0);
    return Math.max(0, Math.min(1, s));
  }

  const MILESTONE_TH = 0.6;
  const PROMOTE_REINFORCE = 3;
  const FORGET_TH = 0.18;
  const DECAY_RATE = 0.82;

  // write a memory (goes to short tier + pending consolidation)
  function record(text, opts) {
    opts = opts || {};
    const a = analyze(text);
    const sal = opts.salience != null ? opts.salience : salienceFrom(a);
    const mem = {
      id: Store.uid('mem'),
      content: text,
      summary: opts.summary || text.slice(0, 40),
      type: (Math.abs(a.valence) > 0.25 || a.arousal > 0.5 || opts.type === 'emotional') ? 'emotional' : 'factual',
      tier: 'short',
      salience: sal,
      emotion_valence: a.valence,
      emotion_arousal: a.arousal,
      cues: {
        time_ctx: Store.timeCtx(),
        user_mood: a.valence < -0.2 ? 'distressed' : (a.valence > 0.3 ? 'happy' : 'neutral'),
        topics: a.topics,
        relation_stage: bondStage(),
        source: opts.source || 'chat',
      },
      reinforce_count: 1,
      last_recalled_day: null,
      recall_count: 0,
      decay_score: 1.0,
      is_milestone: sal >= 0.85 || a.explicit >= 1,
      created_day: S().day,
    };
    S().memories.push(mem);
    S().pendingConsolidation.push(mem.id);
    return mem;
  }

  function bondStage() {
    const i = S().persona.intimacy;
    if (i < 0.2) return 'stranger';
    if (i < 0.5) return 'building';
    if (i < 0.8) return 'close';
    return 'inseparable';
  }

  // ---------- Channel A: cue-based recall (主力) ----------
  // returns the single best memory to surface, or null (宁可不提)
  function recall(currentText) {
    const a = analyze(currentText || '');
    const ctx = {
      time_ctx: Store.timeCtx(),
      user_mood: a.valence < -0.2 ? 'distressed' : (a.valence > 0.3 ? 'happy' : 'neutral'),
      topics: a.topics,
    };
    let best = null, bestScore = 0;
    for (const m of S().memories) {
      if (m.tier === 'short' && m.salience < 0.4) continue; // 琐碎短期不召回
      // semantic-ish: topic + keyword overlap
      const topicMatch = ctx.topics.filter(t => (m.cues.topics || []).includes(t)).length;
      const wordMatch = overlapWords(currentText, m.content);
      const semantic = Math.min(1, topicMatch * 0.5 + wordMatch * 0.15);
      // cue match
      let cue = 0;
      if (m.cues.time_ctx === ctx.time_ctx) cue += 0.25;
      if (m.cues.user_mood === ctx.user_mood && ctx.user_mood !== 'neutral') cue += 0.45;
      // over-recall penalty (避尬)
      const daysSinceRecall = m.last_recalled_day == null ? 999 : (S().day - m.last_recalled_day);
      const penalty = daysSinceRecall < 1 ? 0.6 : (daysSinceRecall < 2 ? 0.25 : 0);
      const score = 0.5 * semantic + 0.9 * cue + 0.4 * m.salience - penalty;
      if (score > bestScore) { bestScore = score; best = m; }
    }
    // 护栏: 分不够高就不提；用户当前情绪不适合时不提负向记忆
    if (!best || bestScore < 0.7) return null;
    if (ctx.user_mood === 'happy' && best.emotion_valence < -0.3) return null;
    best.last_recalled_day = S().day;
    best.recall_count += 1;
    return best;
  }

  function overlapWords(a, b) {
    if (!a || !b) return 0;
    const setB = b;
    let n = 0;
    // crude bigram overlap for Chinese
    for (let i = 0; i < a.length - 1; i++) {
      const bg = a.substr(i, 2);
      if (bg.trim().length === 2 && setB.includes(bg)) n++;
    }
    return Math.min(3, n);
  }

  // ---------- Channel B: dream generation (做梦, run at sleep) ----------
  function generateDream() {
    const longs = S().memories.filter(m => m.tier === 'long');
    const pool = longs.length ? longs : S().memories.filter(m => m.salience >= 0.4);
    if (!pool.length) return null;
    // weighted random: salience * recency (older more dream-worthy)
    let total = 0;
    const weighted = pool.map(m => {
      const age = Math.max(1, S().day - m.created_day);
      const w = m.salience * (1 + Math.log(age + 1) * 0.4);
      total += w;
      return { m, w };
    });
    let r = pseudoRandom() * total;
    let picked = weighted[0].m;
    for (const x of weighted) { r -= x.w; if (r <= 0) { picked = x.m; break; } }
    return picked;
  }

  // deterministic-ish randomness (Math.random is fine in-app; kept simple)
  function pseudoRandom() { return Math.random(); }

  // ---------- Sleep consolidation (PRD §6.4 ①②) ----------
  function consolidate() {
    const log = [];
    const pend = S().pendingConsolidation
      .map(id => S().memories.find(m => m.id === id))
      .filter(Boolean);

    for (const mem of pend) {
      if (mem.salience >= MILESTONE_TH) {
        // 情感闪光通道: short -> long
        mem.tier = 'long';
        mem.is_milestone = mem.salience >= 0.85 ? true : mem.is_milestone;
        log.push('把今天一件重要的事记进了心里');
      } else {
        // 重复强化通道: merge with similar existing
        const similar = findSimilar(mem);
        if (similar && similar.id !== mem.id) {
          similar.reinforce_count += 1;
          similar.salience = Math.min(1, similar.salience + 0.05);
          if (similar.reinforce_count >= PROMOTE_REINFORCE && similar.tier === 'short') similar.tier = 'mid';
          if (similar.reinforce_count >= PROMOTE_REINFORCE + 2 && similar.tier === 'mid') similar.tier = 'long';
          // drop the duplicate
          S().memories = S().memories.filter(m => m.id !== mem.id);
        } else if (mem.salience >= 0.4) {
          mem.tier = 'mid';
        } else {
          mem.tier = 'short';
        }
      }
    }
    S().pendingConsolidation = [];

    // 衰减与遗忘
    let forgot = 0;
    for (const m of S().memories) {
      if (m.tier === 'long' || m.is_milestone) continue;
      const sinceReinforce = Math.max(0, S().day - m.created_day);
      m.decay_score = m.decay_score * Math.pow(DECAY_RATE, Math.max(1, sinceReinforce));
    }
    const before = S().memories.length;
    S().memories = S().memories.filter(m => m.is_milestone || m.tier === 'long' || m.decay_score >= FORGET_TH);
    forgot = before - S().memories.length;
    // 注意: 里程碑永不删、且永不明示遗忘(不向用户报告 forgot 细节)

    return { log };
  }

  function findSimilar(mem) {
    let best = null, bestScore = 0;
    for (const m of S().memories) {
      if (m.id === mem.id) continue;
      const topicOverlap = (m.cues.topics || []).filter(t => (mem.cues.topics || []).includes(t)).length;
      const wordOverlap = overlapWords(mem.content, m.content);
      const score = topicOverlap * 0.6 + wordOverlap * 0.2;
      if (score > bestScore) { bestScore = score; best = m; }
    }
    return bestScore >= 0.8 ? best : null;
  }

  window.Memory = {
    analyze, salienceFrom, record, recall, generateDream, consolidate, bondStage,
    constants: { MILESTONE_TH },
  };
})();
