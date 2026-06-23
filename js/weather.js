/* ============================================================
   weather.js — real-world weather + time by IP (req #4)
   Flow: ipwho.is (lat/lon, free, CORS:*) -> open-meteo (weather
   code + is_day, free, CORS:*). Result cached ~30 min in the
   store so we don't refetch every render. The scene reads
   Weather.current() to pick sky + particles.

   Graceful degradation: if either fetch fails (offline, blocked),
   we fall back to time-of-day only (code=null) and the scene
   still renders a clear sky for the local time.
   ============================================================ */
(function () {
  const S = () => Store.s;
  const TTL = 30 * 60 * 1000; // 30 min

  // weather state lives on the store so it persists across renders/sessions
  function ensureSlot() {
    if (!S().weather) S().weather = { code: null, isDay: 1, temp: null, city: null, fetchedAt: 0, time: null };
    return S().weather;
  }

  function current() {
    const w = ensureSlot();
    // always reflect the *current* local time bucket, even if weather is cached
    w.time = (window.Store && Store.timeCtx) ? Store.timeCtx() : 'afternoon';
    return w;
  }

  function isFresh() {
    const w = ensureSlot();
    return w.fetchedAt && (Date.now() - w.fetchedAt) < TTL && w.code != null;
  }

  // fetch with timeout
  function fetchJSON(url, ms) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms || 8000);
    return fetch(url, { signal: ctl.signal })
      .then(r => { clearTimeout(t); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  }

  // refresh from network; resolves to the weather slot (or keeps fallback)
  async function refresh(force) {
    const w = ensureSlot();
    if (!force && isFresh()) return w;
    try {
      const loc = await fetchJSON('https://ipwho.is/', 7000);
      if (!loc || !loc.success || loc.latitude == null) throw new Error('geo failed');
      w.city = loc.city || loc.region || loc.country || null;
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=weather_code,is_day,temperature_2m`;
      const wx = await fetchJSON(url, 7000);
      const cur = wx && wx.current;
      if (!cur) throw new Error('weather failed');
      w.code = cur.weather_code;
      w.isDay = cur.is_day;
      w.temp = cur.temperature_2m;
      w.fetchedAt = Date.now();
      Store.save();
    } catch (e) {
      // keep fallback (code stays null -> scene uses clear sky for local time)
      console.warn('[weather] fallback, using time-of-day only:', e.message);
    }
    w.time = (window.Store && Store.timeCtx) ? Store.timeCtx() : 'afternoon';
    return w;
  }

  // human label for UI
  function label() {
    const w = ensureSlot();
    if (w.code == null) return '';
    const cat = Avatar.weatherCat(w.code);
    const map = { clear:'晴', cloud:'多云', rain:'下雨', snow:'下雪', fog:'雾', storm:'雷雨' };
    const t = w.temp != null ? ` ${Math.round(w.temp)}°` : '';
    const city = w.city ? w.city + ' · ' : '';
    return `${city}${map[cat]||''}${t}`;
  }

  window.Weather = { current, refresh, label, isFresh };
})();
