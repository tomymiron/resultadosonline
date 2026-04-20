import { expandNombres, isFinal, puestoNumero, slugify } from './format';

const POINTS_TABLE = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

function eventoKey(p) {
  return `${(p.prueba || '').trim()}::${p.genero || ''}::${(p.categoria || '').trim()}`;
}

const FIELD_EVENT_RE = /^(bala|jabalina|disco|martillo|largo|alto|triple|garrocha|peso|pentatl|heptatl|decatl)/i;
function isHigherBetter(prueba) {
  return FIELD_EVENT_RE.test((prueba || '').trim());
}

function parseMarca(m) {
  if (!m) return null;
  const raw = String(m).trim().split(/\s+/)[0];
  if (!/^\d[\d.]*$/.test(raw)) return null;
  const parts = raw.split('.').map((p) => parseFloat(p));
  if (parts.some((n) => Number.isNaN(n))) return null;
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts[0] + parts[1] / 100;
  if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 100;
  return null;
}

function pointsKey(pruebaId, nombre, club) {
  return `${pruebaId}|${nombre}|${club || ''}`;
}

function isSemi(serie) {
  return /semi/i.test(serie || '');
}

function roundRank(p) {
  if (isFinal(p.serie)) return 3;
  if (isSemi(p.serie)) return 2;
  return 1;
}

export function isValidResult(atleta) {
  const pn = puestoNumero(atleta?.puesto);
  if (pn && pn >= 90) return false;
  const m = (atleta?.marca || '').trim();
  if (/^(DN[FSQ]|NM|SCR)$/i.test(m)) return false;
  return true;
}

function normalizeMarca(m) {
  return String(m || '').trim().split(/\s+/)[0];
}

function isAggregate(p, others) {
  const atletas = p?.resultado?.atletas || [];
  if (atletas.length < 3 || others.length === 0) return false;

  const maxOther = Math.max(...others.map((o) => (o.resultado?.atletas || []).length));
  if (atletas.length <= maxOther) return false;

  const byName = new Map();
  for (const o of others) {
    for (const a of o.resultado?.atletas || []) {
      if (!a?.nombre) continue;
      if (!byName.has(a.nombre)) byName.set(a.nombre, new Set());
      byName.get(a.nombre).add(normalizeMarca(a.marca));
    }
  }
  let matched = 0;
  let counted = 0;
  for (const a of atletas) {
    const marca = normalizeMarca(a.marca);
    if (!marca) continue;
    counted++;
    if (byName.get(a.nombre)?.has(marca)) matched++;
  }
  if (counted < 3) return false;
  return matched / counted >= 0.75;
}

export function buildDisplayPruebaIds(pruebas) {
  const byEvento = new Map();
  for (const p of pruebas) {
    const k = eventoKey(p);
    if (!byEvento.has(k)) byEvento.set(k, []);
    byEvento.get(k).push(p);
  }
  const ids = new Set();
  for (const [, arr] of byEvento) {
    for (const p of arr) {
      const others = arr.filter((o) => o.id !== p.id);
      if (!isAggregate(p, others)) ids.add(p.id);
    }
  }
  return ids;
}

export function buildScoringPruebaIds(pruebas) {
  const display = buildDisplayPruebaIds(pruebas);
  const byEvento = new Map();
  for (const p of pruebas) {
    if (p.estado !== 'ok' || !display.has(p.id)) continue;
    const k = eventoKey(p);
    if (!byEvento.has(k)) byEvento.set(k, []);
    byEvento.get(k).push(p);
  }
  const ids = new Set();
  for (const [, arr] of byEvento) {
    const maxRank = Math.max(...arr.map(roundRank));
    for (const p of arr) if (roundRank(p) === maxRank) ids.add(p.id);
  }
  return ids;
}

export function buildRepresentativePruebaIds(pruebas) {
  return buildDisplayPruebaIds(pruebas);
}

function normalizeName(n) {
  return String(n || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

export function buildForeignNamesSet(atletasExtranjeros) {
  const set = new Set();
  for (const a of atletasExtranjeros || []) {
    const k = normalizeName(a.nombre);
    if (k) set.add(k);
  }
  return set;
}

export function buildPointsMap(pruebas, foreignNames) {
  const scoring = buildScoringPruebaIds(pruebas);
  const byEvento = new Map();
  for (const p of pruebas) {
    if (!scoring.has(p.id)) continue;
    const k = eventoKey(p);
    if (!byEvento.has(k)) byEvento.set(k, []);
    byEvento.get(k).push(p);
  }

  const points = new Map();
  for (const [, arr] of byEvento) {
    const higher = isHigherBetter(arr[0].prueba);
    const bestByAtleta = new Map();

    for (const p of arr) {
      for (const a of p.resultado?.atletas || []) {
        if (!isValidResult(a)) continue;
        const value = parseMarca(a.marca);
        if (value === null) continue;
        const nombres = expandNombres(a.nombre);
        if (nombres.length === 0) continue;
        const anyForeign = foreignNames && nombres.some((n) => foreignNames.has(normalizeName(n)));
        if (anyForeign) continue;
        for (const nombre of nombres) {
          const key = `${nombre}|${a.club || ''}`;
          const entry = { pruebaId: p.id, nombre, club: a.club || '', value };
          const prev = bestByAtleta.get(key);
          if (!prev || (higher ? value > prev.value : value < prev.value)) {
            bestByAtleta.set(key, entry);
          }
        }
      }
    }

    const sorted = Array.from(bestByAtleta.values()).sort((a, b) =>
      higher ? b.value - a.value : a.value - b.value
    );
    sorted.forEach((e, i) => {
      if (i < POINTS_TABLE.length) {
        points.set(pointsKey(e.pruebaId, e.nombre, e.club), POINTS_TABLE[i]);
      }
    });
  }
  return points;
}

export function buildSerieLabels(pruebas) {
  const byEvento = new Map();
  for (const p of pruebas) {
    const k = eventoKey(p);
    if (!byEvento.has(k)) byEvento.set(k, []);
    byEvento.get(k).push(p);
  }
  const labels = new Map();
  for (const [, arr] of byEvento) {
    const finals = arr.filter((p) => isFinal(p.serie));
    const semis = arr.filter((p) => isSemi(p.serie));
    const finalsAllAggregate =
      finals.length > 0 &&
      finals.every((f) => isAggregate(f, arr.filter((o) => o.id !== f.id)));

    if (finalsAllAggregate && semis.length > 0) {
      const sorted = [...semis].sort((a, b) => {
        const na = parseInt((a.serie || '').match(/\d+/)?.[0] || '0', 10);
        const nb = parseInt((b.serie || '').match(/\d+/)?.[0] || '0', 10);
        return na - nb;
      });
      sorted.forEach((p, i) => {
        labels.set(p.id, `Final ${String.fromCharCode(65 + i)}`);
      });
    }
  }
  return labels;
}

export function buildAtletasIndex(pruebas, foreignNames) {
  const display = buildDisplayPruebaIds(pruebas);
  const pointsMap = buildPointsMap(pruebas, foreignNames);
  const map = new Map();

  const ensure = (nombre, club) => {
    const key = `${nombre}__${club || ''}`;
    if (!map.has(key)) {
      map.set(key, {
        slug: slugify(`${nombre}-${club || ''}`),
        nombre,
        club: club || '—',
        anio: null,
        puntos: 0,
        resultados: [],
        inscripciones: [],
      });
    }
    return map.get(key);
  };

  const bestResult = new Map();
  const inscriptionsSeen = new Map();

  for (const p of pruebas) {
    if (!display.has(p.id)) continue;

    if (p.estado === 'ok') {
      for (const a of p.resultado?.atletas ?? []) {
        if (!isValidResult(a)) continue;
        const nombres = expandNombres(a.nombre);
        if (nombres.length === 0) continue;
        const esPosta = nombres.length > 1;
        for (const nombre of nombres) {
          const key = `${nombre}|${a.club || ''}|${eventoKey(p)}`;
          const cand = { p, a, esPosta, rank: roundRank(p) };
          const prev = bestResult.get(key);
          if (!prev || cand.rank > prev.rank) bestResult.set(key, cand);
        }
      }
    }

    if (p.estado !== 'ok' && p.inscriptos?.atletas?.length) {
      for (const a of p.inscriptos.atletas) {
        const nombres = expandNombres(a.nombre);
        if (nombres.length === 0) continue;
        const esPosta = nombres.length > 1;
        for (const nombre of nombres) {
          const key = `${nombre}|${a.club || ''}|${eventoKey(p)}`;
          const cand = { p, a, esPosta, rank: roundRank(p) };
          const prev = inscriptionsSeen.get(key);
          if (!prev || cand.rank > prev.rank) inscriptionsSeen.set(key, cand);
        }
      }
    }
  }

  for (const [key, { p, a, esPosta }] of bestResult) {
    const [nombre, club] = key.split('|');
    const e = ensure(nombre, club);
    if (!esPosta && a.nacimiento?.anio && !e.anio) e.anio = a.nacimiento.anio;
    const pts = pointsMap.get(pointsKey(p.id, nombre, club)) || 0;
    e.puntos += pts;
    e.resultados.push({
      pruebaId: p.id,
      prueba: p.prueba,
      serie: p.serie,
      genero: p.genero,
      categoria: p.categoria,
      fecha: p.fecha,
      puesto: a.puesto,
      dorsal: a.dorsal,
      marca: a.marca,
      puntos: pts,
      esPosta,
    });
  }

  for (const [key, { p, a, esPosta }] of inscriptionsSeen) {
    const [nombre, club] = key.split('|');
    const e = ensure(nombre, club);
    if (!esPosta && a.nacimiento?.anio && !e.anio) e.anio = a.nacimiento.anio;
    e.inscripciones.push({
      pruebaId: p.id,
      prueba: p.prueba,
      serie: p.serie,
      genero: p.genero,
      categoria: p.categoria,
      fecha: p.fecha,
      dorsal: a.dorsal,
      mejorMarca: a.mejorMarca,
      esPosta,
    });
  }

  return Array.from(map.values()).sort((a, b) => {
    if (b.puntos !== a.puntos) return b.puntos - a.puntos;
    return a.nombre.localeCompare(b.nombre);
  });
}

export function buildClubesIndex(pruebas, foreignNames) {
  const display = buildDisplayPruebaIds(pruebas);
  const pointsMap = buildPointsMap(pruebas, foreignNames);
  const map = new Map();

  const ensure = (club) => {
    if (!map.has(club)) {
      map.set(club, {
        codigo: club,
        slug: slugify(club),
        puntos: 0,
        atletas: new Map(),
        pruebas: new Set(),
      });
    }
    return map.get(club);
  };

  const bestPerEvento = new Map();

  for (const p of pruebas) {
    if (p.estado !== 'ok' || !display.has(p.id)) continue;
    for (const a of p.resultado?.atletas ?? []) {
      if (!isValidResult(a)) continue;
      const club = (a.club || '').trim() || 'Sin club';
      const nombres = expandNombres(a.nombre);
      if (nombres.length === 0) continue;
      for (const nombre of nombres) {
        const key = `${nombre}|${club}|${eventoKey(p)}`;
        const cand = { p, a, club, nombre, rank: roundRank(p) };
        const prev = bestPerEvento.get(key);
        if (!prev || cand.rank > prev.rank) bestPerEvento.set(key, cand);
      }
    }
  }

  for (const [, { p, club, nombre }] of bestPerEvento) {
    const e = ensure(club);
    e.pruebas.add(p.id);
    if (!e.atletas.has(nombre)) {
      e.atletas.set(nombre, { nombre, pruebas: 0, puntos: 0 });
    }
    const ae = e.atletas.get(nombre);
    ae.pruebas += 1;
    const pts = pointsMap.get(pointsKey(p.id, nombre, club)) || 0;
    ae.puntos += pts;
    e.puntos += pts;
  }

  const arr = Array.from(map.values()).map((c) => ({
    codigo: c.codigo,
    slug: c.slug,
    puntos: c.puntos,
    atletasCount: c.atletas.size,
    pruebasCount: c.pruebas.size,
    atletas: Array.from(c.atletas.values()).sort((a, b) => {
      if (b.puntos !== a.puntos) return b.puntos - a.puntos;
      return a.nombre.localeCompare(b.nombre);
    }),
  }));

  return arr.sort((a, b) => {
    if (b.puntos !== a.puntos) return b.puntos - a.puntos;
    return a.codigo.localeCompare(b.codigo);
  });
}
