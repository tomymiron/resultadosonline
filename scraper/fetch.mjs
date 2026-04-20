const UA = 'Mozilla/5.0 (compatible; resultados-mirror/0.1; +https://github.com/tomymiron)';

export async function fetchWithRetry(url, options = {}) {
  const { retries = 3, timeoutMs = 15000 } = options;
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: ac.signal,
        headers: {
          'User-Agent': UA,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'es-AR,es;q=0.9',
        },
        redirect: 'follow',
      });
      clearTimeout(to);
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      return await res.text();
    } catch (e) {
      clearTimeout(to);
      lastErr = e;
      if (attempt < retries) {
        const backoff = 500 * 2 ** (attempt - 1);
        await new Promise((r) => setTimeout(r, backoff));
      }
    }
  }
  throw lastErr;
}
