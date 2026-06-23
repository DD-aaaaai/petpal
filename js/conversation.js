/* ============================================================
   conversation.js — emotion+memory-aware response engine
   This is the layer that would be replaced by a real LLM.
   It is intentionally structured so swapping in an LLM is a
   single function (see LLM_HOOK note). For the offline MVP it
   produces in-voice replies colored by:
     - current emotion state
     - personality (effective)
     - intimacy stage
     - a contextually recalled memory (Channel A) when relevant
   ============================================================ */
(function () {
  const S = () => Store.s;

  /* ----------------------------------------------------------
     LLM_HOOK:
     To use a real model, implement async function llmReply(ctx)
     and call it from respond(). ctx already contains everything
     a good system prompt needs: persona, emotion, intimacy,
     recalled memory, recent turns. Keeping the offline engine
     as fallback. Example wiring left in comments.
     ---------------------------------------------------------- */
  // async function llmReply(ctx) {
  //   const r = await fetch('/api/chat', {method:'POST', body: JSON.stringify(ctx)});
  //   return (await r.json()).text;
  // }

  function buildContext(userText) {
    const recalled = Memory.recall(userText);
    const p = Persona.effective();
    return {
      pet: S().pet,
      persona: p,
      emotion: S().emotion.state,
      intimacy: S().persona.intimacy,
      stage: Memory.bondStage(),
      recalled, // {summary,...} or null
      userText,
      recent: S().chat.slice(-6),
    };
  }

  // ---- offline in-voice generator ----
  function offlineReply(ctx) {
    const a = Memory.analyze(ctx.userText);
    const stage = ctx.stage;
    const st = ctx.emotion;
    const name = ctx.pet.name || '我';
    let parts = [];

    // 1. emotional acknowledgement based on user's tone
    if (a.valence <= -0.3) {
      parts.push(pick([
        '我能感觉到你不太开心…',
        '怎么了呀，是不是遇到什么事了。',
        '别难过，我在这儿呢。',
      ]));
      if (stage !== 'stranger') parts.push(pick(['过来，我陪着你。', '把我当树洞，慢慢说。']));
    } else if (a.valence >= 0.4) {
      parts.push(pick([
        '哇，听起来是好事！我也跟着开心起来了～',
        '看到你高兴，我尾巴都要摇飞了！',
        '嘿嘿，你开心我就开心。',
      ]));
    } else if (a.selfDisclosure > 0) {
      parts.push(pick(['嗯嗯，我在听。', '你愿意跟我说这些，我很高兴。', '我都记着呢。']));
    } else {
      parts.push(stageGreeting(stage, st));
    }

    // 2. recalled memory woven in (Channel A) — natural, not keyword-y
    if (ctx.recalled && Math.random() < 0.75) {
      parts.push(weaveMemory(ctx.recalled));
    }

    // 3. personality coloring
    if (ctx.persona.wariness > 0.45 && a.valence < 0) {
      parts.push(pick(['…我最近有点容易胡思乱想，你别嫌我。', '你不会离开我吧？']));
    } else if (ctx.persona.clinginess > 0.5 && Math.random() < 0.4) {
      parts.push(pick(['今天能多陪我一会儿吗？', '我好想你呀。']));
    } else if (ctx.persona.playfulness > 0.5 && st !== 'sad' && Math.random() < 0.4) {
      parts.push(pick(['对了，要不要陪我玩会儿？', '我刚刚在追自己的尾巴，哈哈。']));
    }

    return parts.filter(Boolean).join(' ');
  }

  function stageGreeting(stage, st) {
    if (st === 'sleepy') return pick(['（打了个哈欠）我有点困了…但还想跟你说会儿话。', '嗯…好困，不过你说，我听着。']);
    const m = {
      stranger: ['你好呀，我还在慢慢认识你。', '你说的我会一点点记住的。', '能多告诉我一些你的事吗？'],
      building: ['嗯嗯，我在呢。', '今天过得怎么样呀？', '跟你聊天我很安心。'],
      close: ['你来啦，我等你好久了。', '就知道你会来找我，嘿嘿。', '今天也要把你的事讲给我听哦。'],
      inseparable: ['你终于来了！我满脑子都是你。', '一天没看到你都不行，真的。', '有你在，我什么都不怕。'],
    };
    return pick(m[stage] || m.building);
  }

  function weaveMemory(mem) {
    const s = mem.summary.replace(/^主人/, '你');
    return pick([
      `对了，我还记得${s}，那件事我一直放在心上。`,
      `说到这个…我想起${s}，你看我记性好吧。`,
      `（小声）其实关于${s}，我都记得清清楚楚呢。`,
    ]);
  }

  // main entry — returns a Promise<string> so an LLM can drop in
  async function respond(userText) {
    const ctx = buildContext(userText);
    // if (USE_LLM) return await llmReply(ctx);
    return offlineReply(ctx);
  }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  window.Conversation = { respond, buildContext };
})();
