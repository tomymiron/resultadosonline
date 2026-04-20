export function tiempoRelativo(iso) {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return `hace ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} d`;
}

export function fechaCompleta(dmy, fechas) {
  if (Array.isArray(fechas) && fechas.length) {
    return fechas.map((f) => formatDmy(f)).join(' y ');
  }
  return formatDmy(dmy);
}

export function formatDmy(dmy) {
  if (!dmy) return '—';
  const m = dmy.match(/^(\d{2})-(\d{2})-(\d{4})/);
  if (!m) return dmy;
  return `${m[1]}/${m[2]}/${m[3]}`;
}

export function formatHour(dmy) {
  if (!dmy) return null;
  const m = dmy.match(/(\d{2}\.\d{2})$/);
  return m ? m[1].replace('.', ':') + 'hs' : null;
}

export function formatDia(dmy) {
  if (!dmy) return '—';
  const m = dmy.match(/^(\d{2})-(\d{2})/);
  return m ? `${m[1]}/${m[2]}` : dmy;
}

export function puestoNumero(p) {
  if (!p) return null;
  const n = Number.parseInt(String(p).trim(), 10);
  return Number.isNaN(n) ? null : n;
}

export function expandNombres(raw) {
  if (!raw) return [];
  if (!raw.includes('/')) return [raw.trim()];
  return raw
    .split('/')
    .map((s) => s.trim())
    .filter((n) => n && !/^sin atleta$/i.test(n));
}

export function medallaEmoji(puesto) {
  const n = puestoNumero(puesto);
  if (n === 1) return '🥇';
  if (n === 2) return '🥈';
  if (n === 3) return '🥉';
  return '';
}

export function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function generoLabel(g) {
  return g === 'M' ? 'Varones' : g === 'F' ? 'Mujeres' : 'Mixto';
}

export function generoLetra(g) {
  return g === 'M' ? 'V' : g === 'F' ? 'M' : 'X';
}

export function isFinal(serie) {
  return /Final/i.test(serie || '');
}
