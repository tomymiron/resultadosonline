import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDayPage, parseResultPage, parseInscriptosPage, parseCountryPage, parseEventHeader } from './parse.mjs';
import { fetchWithRetry } from './fetch.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const TORNEO = {
  id: '631',
  slug: '631-cada-copa-nacional-de-clubes-mayores',
  nombre: 'CADA - Copa Nacional de Clubes Mayores',
  sede: 'Cenard, CABA',
  fechas: ['18-04-2026', '19-04-2026'],
};

const BASE = 'https://www.resultadosonline.ar';
const CONCURRENCY = 3;
const DELAY_MS = 150;
const PAISES_EXTRANJEROS = ['BOL', 'BRA', 'CHI', 'COL', 'PAN', 'PAR', 'PER', 'URU'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runPool(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const n = Math.min(limit, items.length);
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (cursor < items.length) {
        const i = cursor++;
        try {
          results[i] = await worker(items[i], i);
        } catch (e) {
          results[i] = { __error: e.message, item: items[i] };
        }
        if (DELAY_MS) await sleep(DELAY_MS);
      }
    })
  );
  return results;
}

async function main() {
  const t0 = Date.now();
  console.log(`[scraper] ${TORNEO.nombre}`);
  console.log(`[scraper] fechas: ${TORNEO.fechas.join(', ')}\n`);

  const pruebasByDay = {};
  for (const fecha of TORNEO.fechas) {
    const url = `${BASE}/index3.php/${TORNEO.slug}/${fecha}.html`;
    console.log(`[día ${fecha}] GET ${url}`);
    const html = await fetchWithRetry(url);
    const pruebas = parseDayPage(html);
    pruebasByDay[fecha] = pruebas;
    console.log(`[día ${fecha}]   → ${pruebas.length} pruebas detectadas`);
  }

  const allPruebas = Object.values(pruebasByDay).flat();
  console.log(`\n[scraper] fetcheando resultados de ${allPruebas.length} pruebas (concurrencia ${CONCURRENCY})…\n`);

  let ok = 0;
  let fail = 0;
  let pendientes = 0;
  const enriched = await runPool(allPruebas, CONCURRENCY, async (p, i) => {
    const tag = `[${String(i + 1).padStart(3, '0')}/${allPruebas.length}]`;

    let inscriptos = null;
    if (p.urls.inscriptos) {
      try {
        const htmlI = await fetchWithRetry(p.urls.inscriptos);
        inscriptos = parseInscriptosPage(htmlI);
      } catch (e) {
        console.log(`${tag}   inscriptos fail — ${e.message}`);
      }
    }

    if (!p.urls.resultados) {
      pendientes++;
      console.log(`${tag} · ${p.prueba} · ${p.serie} · ${p.genero || '?'} — pendiente · ${inscriptos?.atletas?.length ?? 0} inscriptos`);
      return { ...p, eventoNombre: null, resultado: null, inscriptos, estado: 'pendiente' };
    }
    try {
      const html = await fetchWithRetry(p.urls.resultados);
      const { eventoNombre } = parseEventHeader(html);
      const result = parseResultPage(html);
      ok++;
      console.log(`${tag} ✓ ${eventoNombre || p.prueba} · ${p.serie} · ${p.genero || '?'} · ${result?.atletas.length ?? 0} atletas · ${inscriptos?.atletas?.length ?? 0} insc`);
      return { ...p, eventoNombre, resultado: result, inscriptos, estado: 'ok' };
    } catch (e) {
      fail++;
      console.log(`${tag} ✗ ${p.prueba} ${p.serie} — ${e.message}`);
      return { ...p, eventoNombre: null, resultado: null, inscriptos, estado: 'error', error: e.message };
    }
  });

  console.log(`\n[scraper] fetcheando páginas de países extranjeros (${PAISES_EXTRANJEROS.length})…`);
  const atletasExtranjeros = [];
  for (const pais of PAISES_EXTRANJEROS) {
    const url = `${BASE}/paises.php/${TORNEO.slug}/${pais}.html`;
    try {
      const html = await fetchWithRetry(url);
      const nombres = parseCountryPage(html);
      for (const nombre of nombres) atletasExtranjeros.push({ nombre, pais });
      console.log(`  [${pais}] ${nombres.length} atletas`);
      await sleep(DELAY_MS);
    } catch (e) {
      console.log(`  [${pais}] fail — ${e.message}`);
    }
  }
  console.log(`[scraper] ${atletasExtranjeros.length} atletas extranjeros en total\n`);

  const data = {
    torneo: TORNEO,
    actualizadoEn: new Date().toISOString(),
    stats: { total: allPruebas.length, ok, fail, pendientes, extranjeros: atletasExtranjeros.length },
    pruebas: enriched,
    atletasExtranjeros,
  };

  const outDir = path.join(ROOT, 'public', 'data');
  await fs.mkdir(outDir, { recursive: true });
  const out = path.join(outDir, `torneo-${TORNEO.id}.json`);
  await fs.writeFile(out, JSON.stringify(data, null, 2));

  const size = (JSON.stringify(data).length / 1024).toFixed(1);
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n[scraper] ✓ ${out} (${size} KB) — ${secs}s — ok ${ok} / pendientes ${pendientes} / fail ${fail}`);
}

main().catch((e) => {
  console.error('[scraper] fatal:', e);
  process.exit(1);
});
