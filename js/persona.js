/* ============================================================
   persona.js — personality drift (PRD §6.3 / §8 MVP part)
   有效人格 = 天性内核 + 偏移向量
   偏移【方向】由天性决定，偏移【量】由经历强度决定
   三道闸: 慢 (MAX_DAILY_DRIFT) / 有界 (drift_bounds) / 可解释 (drift_log)
   MVP: 仅线性偏移；预留 v2 相变 hook (computeDrift extreme branch)。
   黑化封顶 + 可逆 + 永不向用户。
   ============================================================ */
(function () {
  const S = () => Store.s;
  const MAX_DAILY_DRIFT = 0.06; // 每天只能动一点点 -> "慢"

  // effective personality = nature + drift, clamped
  function effective() {
    const n = S().persona.core_nature;
    const d = S().persona.drift_vector;
    return {
      gentleness: clamp01(n.gentleness + d.gentleness),
      wariness: clamp01(d.wariness),              // 天性默认不设防，戒备全来自经历
      clinginess: clamp01(0.3 + n.sociability * 0.3 + d.clinginess),
      playfulness: clamp01(0.4 + n.sociability * 0.3 + d.playfulness),
      sensitivity: clamp01(n.sensitivity),
    };
  }

  // direction map: same event, different nature -> different drift direction (PRD §6.3)
  // returns delta object for drift_vector
  function directionForEvent(valence, arousal) {
    const n = S().persona.core_nature;
    const mag = Math.min(MAX_DAILY_DRIFT, arousal * 0.05 + Math.abs(valence) * 0.03);
    const delta = { gentleness: 0, wariness: 0, clinginess: 0, playfulness: 0 };

    if (valence >= 0) {
      // 正向经历 -> 更亲密、更爱玩、戒备下降；温顺天性回升
      delta.clinginess += mag;
      delta.playfulness += mag * 0.6;
      delta.wariness -= mag * 0.7;
      delta.gentleness += mag * 0.3;
    } else {
      // 负向经历 -> 方向由天性决定
      if (n.gentleness >= 0.6) {
        // 温顺天性: 向内退缩 (胆怯/戒备上升，黏人下降，温顺度小幅下降但有下界)
        delta.wariness += mag;
        delta.clinginess -= mag * 0.4;
        delta.gentleness -= mag * 0.5;
      } else {
        // 孤僻乖张天性: 向外对抗 (戒备上升、爱玩下降，温顺下降更明显)
        delta.wariness += mag * 1.2;
        delta.playfulness -= mag * 0.8;
        delta.gentleness -= mag * 0.7;
      }
      // —— v2 hook: 极端事件相变会在此跳过 MAX_DAILY_DRIFT 限制；MVP 不实现 ——
    }
    return { delta, mag, valence };
  }

  // applied once per sleep, using the day's emotional memories
  function driftAtSleep() {
    const todays = S().memories.filter(m =>
      m.created_day === S().day && m.type === 'emotional');
    if (!todays.length) return null;

    // average tone of the day
    let v = 0, ar = 0;
    todays.forEach(m => { v += m.emotion_valence; ar += m.emotion_arousal; });
    v /= todays.length; ar /= todays.length;

    const { delta } = directionForEvent(v, ar);
    const dv = S().persona.drift_vector;
    const bounds = S().persona.drift_bounds;
    let moved = false;
    for (const k in delta) {
      if (!delta[k]) continue;
      const b = bounds[k] || [-1, 1];
      const next = clamp(dv[k] + delta[k], b[0], b[1]); // 有界
      if (Math.abs(next - dv[k]) > 0.001) moved = true;
      dv[k] = next;
    }
    if (!moved) return null;

    // 可解释因果: store why it changed
    const cause = v < -0.15 ? '今天有点不开心的事'
      : (v > 0.2 ? '今天和你相处得很温暖' : '今天平平淡淡');
    const note = describeDrift(v);
    S().persona.drift_log.push({ day: S().day, cause, valence: +v.toFixed(2), note });
    if (S().persona.drift_log.length > 30) S().persona.drift_log.shift();
    S().persona.last_drift_day = S().day;
    return { valence: v, note };
  }

  function describeDrift(v) {
    const e = effective();
    if (v < -0.2) {
      if (e.wariness > 0.4) return '它最近有点敏感、容易受惊，需要你多一点耐心';
      return '它今天有点闷闷的';
    }
    if (v > 0.2) {
      if (e.clinginess > 0.5) return '它越来越黏你了，开始离不开你';
      return '它今天很开心，和你更亲近了一点';
    }
    return '它今天心情平稳';
  }

  // intimacy update (后台刻度，不暴露为进度条)
  function updateIntimacy(interactionScore) {
    const cur = S().persona.intimacy;
    // diminishing returns + slow
    const gain = interactionScore * 0.04 * (1 - cur * 0.6);
    S().persona.intimacy = clamp01(cur + gain);
    return S().persona.intimacy;
  }

  // describe current relationship stage in human words (for profile panel)
  function stageLabel() {
    const i = S().persona.intimacy;
    if (i < 0.2) return '还在熟悉你';
    if (i < 0.5) return '开始信任你';
    if (i < 0.8) return '很依赖你';
    return '离不开你了';
  }

  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
  function clamp01(x) { return clamp(x, 0, 1); }

  window.Persona = {
    effective, driftAtSleep, updateIntimacy, stageLabel, describeDrift,
    MAX_DAILY_DRIFT,
  };
})();
