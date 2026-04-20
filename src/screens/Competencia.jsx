import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import ResultTable from '../components/ResultTable';
import { useData } from '../lib/data.jsx';
import {
  buildAtletasIndex,
  buildClubesIndex,
  buildDisplayPruebaIds,
  buildForeignNamesSet,
  buildSerieLabels,
  isValidResult,
} from '../lib/indexes';
import {
  fechaCompleta,
  formatDia,
  formatHour,
  generoLabel,
  medallaEmoji,
  slugify,
  tiempoRelativo,
} from '../lib/format';
import './styles/competencia.scss';

const TABS = [
  { key: 'resultados', label: 'Resultados' },
  { key: 'inscriptos', label: 'Inscriptos' },
  { key: 'atletas', label: 'Atletas' },
  { key: 'clubes', label: 'Clubes' },
];

export default function Competencia() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { competencias, loading, error, refresh, refreshing } = useData();

  const comp = useMemo(
    () => (competencias ? competencias.find((c) => c.torneo.id === id) : null),
    [competencias, id]
  );

  const tab = searchParams.get('tab') || 'resultados';
  const setTab = (k) => setSearchParams(k === 'resultados' ? {} : { tab: k });

  const [query, setQuery] = useState('');
  useEffect(() => setQuery(''), [tab]);

  const mainRef = useRef(null);
  const [showTop, setShowTop] = useState(false);
  const onScroll = useCallback(() => {
    const mainY = mainRef.current?.scrollTop || 0;
    const winY = window.scrollY || document.documentElement.scrollTop || 0;
    setShowTop(Math.max(mainY, winY) > window.innerHeight * 0.5);
  }, []);
  useEffect(() => {
    const el = mainRef.current;
    window.addEventListener('scroll', onScroll, { passive: true });
    el?.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      el?.removeEventListener('scroll', onScroll);
    };
  }, [onScroll]);
  const scrollTop = () => {
    const el = mainRef.current;
    if (el && el.scrollTop > 0) el.scrollTo({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) return <div id="Competencia"><p className="loading">Cargando…</p></div>;
  if (error || !comp) {
    return (
      <div id="Competencia">
        <main><p className="loading">Competencia no encontrada</p></main>
      </div>
    );
  }

  const activeLabel = (TABS.find((t) => t.key === tab) || TABS[0]).label.toUpperCase();

  return (
    <div id="Competencia">
      <nav>
        <button type="button" id="refreshButton" onClick={refresh} disabled={refreshing}>
          <p>{refreshing ? 'Actualizando…' : 'Actualizar'}</p>
        </button>
      </nav>

      <main ref={mainRef}>
        <section>
          <div id="meetHeader">
            <p id="meetTimeLeft">{fechaCompleta(null, comp.torneo.fechas)}</p>
            <div id="meetTitleRow">
              <p id="meetDate">{activeLabel}</p>
            </div>
            <p id="meetName">
              {comp.torneo.nombre} · {comp.torneo.sede} · actualizado {tiempoRelativo(comp.actualizadoEn)}
            </p>

            <div className="tabs" role="tablist">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  role="tab"
                  className={`tab ${tab === t.key ? 'active' : ''}`}
                  onClick={() => setTab(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <input
              type="search"
              className="searchInput"
              placeholder={
                tab === 'atletas' ? 'Buscar atleta o club…'
                  : tab === 'clubes' ? 'Buscar club…'
                    : 'Buscar prueba…'
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {tab === 'resultados' && <EventosPanel comp={comp} mode="resultados" query={query} />}
          {tab === 'inscriptos' && <EventosPanel comp={comp} mode="inscriptos" query={query} />}
          {tab === 'atletas' && <ListaAtletas comp={comp} query={query} id={id} navigate={navigate} />}
          {tab === 'clubes' && <ListaClubes comp={comp} query={query} id={id} navigate={navigate} />}
        </section>
      </main>

      {showTop && (
        <button type="button" className="scrollToTopButton" onClick={scrollTop} aria-label="Subir">↑</button>
      )}
    </div>
  );
}

function roundOrder(serie) {
  if (/final/i.test(serie || '')) return 0;
  if (/semi/i.test(serie || '')) return 1;
  return 2;
}
function serieNum(serie) {
  const m = (serie || '').match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
}
function genderOrder(g) {
  return g === 'M' ? 0 : g === 'F' ? 1 : 2;
}

function EventosPanel({ comp, mode, query }) {
  const display = useMemo(() => buildDisplayPruebaIds(comp.pruebas), [comp]);
  const labelMap = useMemo(() => buildSerieLabels(comp.pruebas), [comp]);
  const q = query.trim().toLowerCase();
  const wanted = mode === 'resultados' ? 'ok' : 'pendiente';
  const pruebas = comp.pruebas
    .filter((p) => p.estado === wanted && display.has(p.id))
    .filter((p) => (q ? (p.prueba || '').toLowerCase().includes(q) : true));

  const withLabels = pruebas.map((p) => ({
    ...p,
    serieLabel: labelMap.get(p.id) || p.serie,
  }));

  const sortedPruebas = useMemo(() => {
    return [...withLabels].sort((a, b) => {
      const ga = genderOrder(a.genero) - genderOrder(b.genero);
      if (ga) return ga;
      const pa = (a.prueba || '').localeCompare(b.prueba || '');
      if (pa) return pa;
      const ra = roundOrder(a.serieLabel) - roundOrder(b.serieLabel);
      if (ra) return ra;
      return serieNum(a.serieLabel) - serieNum(b.serieLabel);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pruebas]);

  const refs = useRef({});
  const jumpTo = (pid) => refs.current[pid]?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  if (!sortedPruebas.length) {
    return <p className="emptyMessage">No hay {mode === 'resultados' ? 'resultados' : 'inscriptos'} que coincidan</p>;
  }

  return (
    <>
      <EventoNavigator pruebas={sortedPruebas} onJump={jumpTo} />

      {sortedPruebas.map((p) => (
        <PruebaSection
          key={p.id}
          prueba={p}
          mode={mode}
          sectionRef={(el) => { refs.current[p.id] = el; }}
        />
      ))}

      <footer className="sourceFooter">
        <p>
          Datos extraídos de{' '}
          <a href="https://www.resultadosonline.ar" target="_blank" rel="noreferrer">
            resultadosonline.ar
          </a>.
        </p>
        <p>
          Lo armé yo,{' '}
          <a href="https://instagram.com/tomymiron" target="_blank" rel="noreferrer">
            Tomás Miron
          </a>
          , en unos ratos como una herramienta auxiliar para ver los resultados de forma más dinámica.
        </p>
        <p>
          Los datos se cachean y van a seguir accesibles aunque se caiga el sitio fuente —
          siempre se muestran los últimos que se lograron obtener.
        </p>
        <p>
          El dominio es <strong>previateesta</strong> porque era el que tenía al alcance; si querés
          bancar el proyecto, descargate e instalate{' '}
          <a href="https://previateesta.com" target="_blank" rel="noreferrer">
            Previate Esta
          </a>{' '}
          y registrate en la app. ¡Gracias!
        </p>
      </footer>
    </>
  );
}

function EventoNavigator({ pruebas, onJump }) {
  const [open, setOpen] = useState(() => new Set());

  const grouped = useMemo(() => {
    const byGen = new Map([
      ['M', new Map()],
      ['F', new Map()],
      ['X', new Map()],
    ]);
    for (const p of pruebas) {
      const gen = p.genero === 'F' ? 'F' : p.genero === 'M' ? 'M' : 'X';
      const map = byGen.get(gen);
      if (!map.has(p.prueba)) map.set(p.prueba, []);
      map.get(p.prueba).push(p);
    }
    return byGen;
  }, [pruebas]);

  const toggle = (key) => {
    setOpen((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
  };

  const columns = [
    { gen: 'M', title: 'Varones', map: grouped.get('M') },
    { gen: 'F', title: 'Mujeres', map: grouped.get('F') },
    { gen: 'X', title: 'Mixto', map: grouped.get('X') },
  ].filter((c) => c.map && c.map.size > 0);

  return (
    <div className="eventNavigator">
      {columns.map(({ gen, title, map }) => (
        <div key={gen} className="navColumn">
          <h3 className="navTitle">{title}</h3>
          <div className="navList">
            {Array.from(map.entries()).map(([prueba, items]) => {
              const key = `${gen}|${prueba}`;
              const isOpen = open.has(key);
              return (
                <div key={key} className={`navPrueba${isOpen ? ' open' : ''}`}>
                  <button type="button" className="navHeader" onClick={() => toggle(key)}>
                    <span className="navCaret" aria-hidden>{isOpen ? '▾' : '▸'}</span>
                    <span className="navPruebaName">{prueba}</span>
                    <span className="navCount">{items.length}</span>
                  </button>
                  {isOpen && (
                    <div className="navSeries">
                      {items.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className="navSerie"
                          onClick={() => onJump(p.id)}
                        >
                          {p.serieLabel || p.serie}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function PruebaSection({ prueba, mode, sectionRef }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const p = prueba;

  const meta = (mode === 'resultados' ? p.resultado?.meta : p.inscriptos?.meta) || {};
  const metaParts = [
    formatDia(p.fecha) || meta.fecha,
    formatHour(p.fecha),
    p.categoria,
    meta.viento && `Viento ${meta.viento}`,
    meta.temperatura && `${meta.temperatura}°C`,
  ].filter(Boolean);

  const atletasRawAll = mode === 'resultados' ? p.resultado?.atletas ?? [] : p.inscriptos?.atletas ?? [];
  const atletasRaw = mode === 'resultados' ? atletasRawAll.filter(isValidResult) : atletasRawAll;
  const serieLabel = p.serieLabel || p.serie;

  if (!atletasRaw.length) {
    return (
      <div id="eventResults" ref={sectionRef}>
        <div className="eventResultsHeader">
          <h2>
            {generoLabel(p.genero)} {p.prueba}
            {serieLabel && <span className="eventBadge">{serieLabel}</span>}
          </h2>
          <div className="eventTimeWithRefresh">
            <span>{metaParts.join(' · ') || '—'}</span>
          </div>
        </div>
        <p className="emptyMessage small">Sin datos</p>
      </div>
    );
  }

  const rows = atletasRaw.map((a, i) => {
    const clubCode = (a.club || '').trim();
    const firstName = (a.nombre || '').split('/')[0].trim();
    return {
      _key: `${p.id}-${i}`,
      _atletaSlug: firstName ? slugify(`${firstName}-${clubCode}`) : null,
      _clubSlug: clubCode ? slugify(clubCode) : null,
      puestoDisplay: mode === 'resultados'
        ? `${medallaEmoji(a.puesto)}${medallaEmoji(a.puesto) ? ' ' : ''}${a.puesto || '—'}`
        : String(i + 1).padStart(2, '0'),
      marca: mode === 'resultados' ? (a.marca || '—') : (a.mejorMarca || '—'),
      atleta: a.nombre,
      anio: a.nacimiento?.anio || '—',
      club: clubCode || '—',
      dorsal: a.dorsal || '—',
    };
  });

  const columns = [
    { key: 'puestoDisplay', label: '#', align: 'center', fixed: true, bold: true, minWidth: 54 },
    { key: 'marca', label: mode === 'resultados' ? 'Marca' : 'Mejor marca', align: 'right', fixed: true, bold: true, danger: true },
    { key: 'atleta', label: 'Atleta', align: 'left', bold: true, isAthlete: true },
    { key: 'anio', label: 'FDN', align: 'right', fixed: true, minWidth: 54 },
    { key: 'club', label: 'Club', align: 'left', isClub: true },
    { key: 'dorsal', label: 'N°', align: 'right', fixed: true, minWidth: 48 },
  ];

  return (
    <div id="eventResults" ref={sectionRef}>
      <div className="eventResultsHeader">
        <h2>
          {generoLabel(p.genero)} {p.prueba}
          {serieLabel && <span className="eventBadge">{serieLabel}</span>}
        </h2>
        <div className="eventTimeWithRefresh">
          <span>{metaParts.join(' · ')}</span>
        </div>
      </div>

      <ResultTable
        data={rows}
        columns={columns}
        onCellClick={(col, row) => {
          if (col.isAthlete && row._atletaSlug) navigate(`/c/${id}/atleta/${row._atletaSlug}`);
          else if (col.isClub && row._clubSlug) navigate(`/c/${id}/club/${row._clubSlug}`);
        }}
      />
    </div>
  );
}

function ListaAtletas({ comp, query, id, navigate }) {
  const foreignNames = useMemo(() => buildForeignNamesSet(comp.atletasExtranjeros), [comp]);
  const atletas = useMemo(() => buildAtletasIndex(comp.pruebas, foreignNames), [comp, foreignNames]);
  const q = query.trim().toLowerCase();
  const filtered = q
    ? atletas.filter((a) => a.nombre.toLowerCase().includes(q) || (a.club || '').toLowerCase().includes(q))
    : atletas;

  const rows = filtered.map((a) => ({
    _key: a.slug,
    _slug: a.slug,
    _clubSlug: a.club && a.club !== '—' ? slugify(a.club) : null,
    nombre: a.nombre,
    club: a.club,
    anio: a.anio || '—',
    puntos: a.puntos || '—',
    resultados: a.resultados.length || '—',
    inscripciones: a.inscripciones.length || '—',
  }));

  const columns = [
    { key: 'nombre', label: 'Atleta', align: 'left', bold: true, isAthlete: true },
    { key: 'club', label: 'Club', align: 'left', isClub: true },
    { key: 'anio', label: 'FDN', align: 'right', fixed: true, minWidth: 60 },
    { key: 'puntos', label: 'Pts', align: 'right', fixed: true, bold: true, minWidth: 56 },
    { key: 'resultados', label: 'Corrió', align: 'right', fixed: true, minWidth: 64 },
    { key: 'inscripciones', label: 'Pendiente', align: 'right', fixed: true, minWidth: 84 },
  ];

  return (
    <div id="eventResults">
      <div className="eventResultsHeader">
        <h2>{filtered.length} atleta{filtered.length === 1 ? '' : 's'}</h2>
        <div className="eventTimeWithRefresh">
          <span className="metaInline">Puntos según finales · Top 10 suma 10→1</span>
        </div>
      </div>
      <ResultTable
        data={rows}
        columns={columns}
        onCellClick={(col, row) => {
          if (col.isAthlete && row._slug) navigate(`/c/${id}/atleta/${row._slug}`);
          else if (col.isClub && row._clubSlug) navigate(`/c/${id}/club/${row._clubSlug}`);
        }}
        empty="Sin atletas"
      />
    </div>
  );
}

function ListaClubes({ comp, query, id, navigate }) {
  const foreignNames = useMemo(() => buildForeignNamesSet(comp.atletasExtranjeros), [comp]);
  const clubes = useMemo(() => buildClubesIndex(comp.pruebas, foreignNames), [comp, foreignNames]);
  const q = query.trim().toLowerCase();
  const filtered = q ? clubes.filter((c) => c.codigo.toLowerCase().includes(q)) : clubes;

  const rows = filtered.map((c, i) => ({
    _key: c.slug,
    _slug: c.slug,
    posicion: String(i + 1).padStart(2, '0'),
    club: c.codigo,
    puntos: c.puntos || 0,
    atletas: c.atletasCount,
    pruebas: c.pruebasCount,
  }));

  const columns = [
    { key: 'posicion', label: '#', align: 'center', fixed: true, bold: true, minWidth: 54 },
    { key: 'puntos', label: 'Puntos', align: 'right', fixed: true, bold: true, minWidth: 72 },
    { key: 'club', label: 'Club', align: 'left', bold: true, isAthlete: true },
    { key: 'atletas', label: 'Atletas', align: 'right', fixed: true, minWidth: 72 },
    { key: 'pruebas', label: 'Pruebas', align: 'right', fixed: true, minWidth: 72 },
  ];

  return (
    <div id="eventResults">
      <div className="eventResultsHeader">
        <h2>{filtered.length} club{filtered.length === 1 ? '' : 'es'}</h2>
        <p className="warnInline">
          ⚠️ Cálculo aproximado, no son datos oficiales. Los resultados reales pueden variar.
        </p>
      </div>
      <ResultTable
        data={rows}
        columns={columns}
        onCellClick={(col, row) => {
          if (col.isAthlete && row._slug) navigate(`/c/${id}/club/${row._slug}`);
        }}
        empty="Sin clubes"
      />
    </div>
  );
}
