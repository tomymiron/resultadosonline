import * as cheerio from 'cheerio';

function textOrNull(s) {
  const t = (s || '').trim();
  return t.length ? t : null;
}

function idFromUrl(url) {
  if (!url) return null;
  const m = url.match(/\/(\d+)\.html/);
  return m ? m[1] : null;
}

export function parseDayPage(html) {
  const $ = cheerio.load(html);
  const pruebas = [];

  $('table').each((_, table) => {
    const $t = $(table);

    const heading = $t.closest('.panel, .card').find('.panel-heading, .card-header').first().text().trim();
    const genero = /mujeres/i.test(heading) ? 'F' : /varones/i.test(heading) ? 'M' : null;

    $t.find('tbody tr').each((_, row) => {
      const cells = $(row).find('td');
      if (cells.length < 7) return;

      const resLinkEl = $(cells[cells.length - 1]).find('a').filter((__, a) => /Resultados/i.test($(a).text())).first();
      const inscLinkEl = $(cells[cells.length - 1]).find('a').filter((__, a) => /Inscriptos/i.test($(a).text())).first();
      const resUrl = resLinkEl.attr('href') || null;
      const inscUrl = inscLinkEl.attr('href') || null;
      const id = idFromUrl(resUrl) || idFromUrl(inscUrl);
      if (!id) return;

      pruebas.push({
        id,
        genero,
        fecha: textOrNull($(cells[0]).text()),
        prueba: textOrNull($(cells[1]).text()),
        serie: textOrNull($(cells[2]).text()),
        categoria: textOrNull($(cells[3]).text()),
        combinada: textOrNull($(cells[4]).text()),
        atletas: Number.parseInt($(cells[5]).text().trim(), 10) || 0,
        envivo: /VIVO/i.test($(cells[cells.length - 1]).text()),
        urls: { inscriptos: inscUrl, resultados: resUrl },
      });
    });
  });

  return pruebas;
}

export function parseEventHeader(html) {
  const $ = cheerio.load(html);
  const raw = $('body').text().replace(/\s+/g, ' ');
  const headerMatch = raw.match(/Resultados\s*\|\s*([^|]+?)(?:\s*CADA|$)/i);
  const eventoNombre = headerMatch ? headerMatch[1].trim() : null;
  return { eventoNombre };
}

export function parseResultPage(html) {
  const $ = cheerio.load(html);
  const tables = $('table').toArray();
  if (tables.length < 2) return null;

  const metaCells = $(tables[0]).find('tbody tr').first().find('td');
  const meta = {
    fecha: textOrNull($(metaCells[0]).text()),
    serie: textOrNull($(metaCells[1]).text()),
    viento: textOrNull($(metaCells[2]).text()),
    presion: textOrNull($(metaCells[3]).text()),
    humedad: textOrNull($(metaCells[4]).text()),
    temperatura: textOrNull($(metaCells[5]).text()),
  };

  const atletas = [];
  $(tables[1]).find('tbody tr').each((_, row) => {
    const c = $(row).find('td');
    if (c.length < 9) return;
    atletas.push({
      puesto: textOrNull($(c[0]).text()),
      dorsal: textOrNull($(c[1]).text()),
      andanivel: textOrNull($(c[2]).text()),
      nombre: textOrNull($(c[3]).text()),
      nacimiento: {
        dia: textOrNull($(c[4]).text()),
        mes: textOrNull($(c[5]).text()),
        anio: textOrNull($(c[6]).text()),
      },
      club: textOrNull($(c[7]).text()),
      marca: textOrNull($(c[8]).text()),
    });
  });

  return { meta, atletas };
}

export function parseCountryPage(html) {
  const $ = cheerio.load(html);
  const names = [];
  $('#dataTables-example tbody tr').each((_, row) => {
    const first = $(row).find('td').first().text().trim();
    if (first) names.push(first);
  });
  return names;
}

export function parseInscriptosPage(html) {
  const $ = cheerio.load(html);
  const tables = $('table').toArray();
  if (tables.length < 1) return null;

  let meta = null;
  let dataTable = null;

  for (const t of tables) {
    const headers = $(t).find('thead th').map((_, th) => $(th).text().trim().toLowerCase()).get();
    if (headers.includes('fecha') && headers.includes('serie')) {
      const c = $(t).find('tbody tr').first().find('td');
      meta = {
        fecha: textOrNull($(c[0]).text()),
        serie: textOrNull($(c[1]).text()),
        viento: textOrNull($(c[2]).text()),
        presion: textOrNull($(c[3]).text()),
        humedad: textOrNull($(c[4]).text()),
        temperatura: textOrNull($(c[5]).text()),
      };
    } else if (headers.includes('nombre') && (headers.includes('equipo') || headers.includes('club'))) {
      dataTable = t;
    }
  }

  if (!dataTable) return meta ? { meta, atletas: [] } : null;

  const atletas = [];
  $(dataTable).find('tbody tr').each((_, row) => {
    const c = $(row).find('td');
    if (c.length < 7) return;
    atletas.push({
      dorsal: textOrNull($(c[0]).text()),
      andanivel: textOrNull($(c[1]).text()),
      nombre: textOrNull($(c[2]).text()),
      nacimiento: {
        dia: textOrNull($(c[3]).text()),
        mes: textOrNull($(c[4]).text()),
        anio: textOrNull($(c[5]).text()),
      },
      club: textOrNull($(c[6]).text()),
      mejorMarca: textOrNull($(c[7]).text()),
    });
  });

  return { meta, atletas };
}
