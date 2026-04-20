import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ResultTable from '../components/ResultTable';
import { useData } from '../lib/data.jsx';
import { buildAtletasIndex, buildForeignNamesSet, buildSerieLabels } from '../lib/indexes';
import { formatDia, formatHour, generoLabel, medallaEmoji, slugify } from '../lib/format';
import './styles/athleteDetail.scss';

export default function AtletaDetail() {
  const { id, slug } = useParams();
  const navigate = useNavigate();
  const { competencias, loading, error } = useData();

  const comp = useMemo(
    () => (competencias ? competencias.find((c) => c.torneo.id === id) : null),
    [competencias, id]
  );

  const atleta = useMemo(() => {
    if (!comp) return null;
    const foreignNames = buildForeignNamesSet(comp.atletasExtranjeros);
    const idx = buildAtletasIndex(comp.pruebas, foreignNames);
    return idx.find((a) => a.slug === slug) || null;
  }, [comp, slug]);

  const labelMap = useMemo(() => (comp ? buildSerieLabels(comp.pruebas) : new Map()), [comp]);

  if (loading) return <div id="AtletaDetail"><p className="loading">Cargando…</p></div>;
  if (error || !comp) {
    return (
      <div id="AtletaDetail">
        <nav><BackBtn onClick={() => navigate(-1)} /></nav>
        <main><p className="loading">Competencia no encontrada</p></main>
      </div>
    );
  }
  if (!atleta) {
    return (
      <div id="AtletaDetail">
        <nav><BackBtn onClick={() => navigate(-1)} /></nav>
        <main><p className="loading">Atleta no encontrado</p></main>
      </div>
    );
  }

  const resultadosRows = [...atleta.resultados]
    .sort((a, b) => {
      const finalA = /final/i.test(a.serie || '') ? 0 : 1;
      const finalB = /final/i.test(b.serie || '') ? 0 : 1;
      if (finalA !== finalB) return finalA - finalB;
      return (a.prueba || '').localeCompare(b.prueba || '');
    })
    .map((p, i) => ({
      _key: `r-${p.pruebaId}-${i}`,
      puesto: `${medallaEmoji(p.puesto)}${medallaEmoji(p.puesto) ? ' ' : ''}${p.puesto || '—'}`,
      marca: p.marca || '—',
      prueba: p.prueba,
      serie: labelMap.get(p.pruebaId) || p.serie || '—',
      genero: generoLabel(p.genero),
      puntos: p.puntos || '—',
      fecha: [formatDia(p.fecha), formatHour(p.fecha)].filter(Boolean).join(' · ') || '—',
    }));

  const resultadosCols = [
    { key: 'puesto', label: '#', align: 'center', fixed: true, bold: true, minWidth: 64 },
    { key: 'marca', label: 'Marca', align: 'right', fixed: true, bold: true, danger: true },
    { key: 'prueba', label: 'Prueba', align: 'left', bold: true },
    { key: 'serie', label: 'Serie', align: 'left' },
    { key: 'genero', label: 'Cat.', align: 'left' },
    { key: 'puntos', label: 'Pts', align: 'right', fixed: true, bold: true, minWidth: 50 },
    { key: 'fecha', label: 'Fecha', align: 'left', fixed: true, minWidth: 120 },
  ];

  const inscripcionesRows = [...atleta.inscripciones]
    .sort((a, b) => (a.prueba || '').localeCompare(b.prueba || ''))
    .map((p, i) => ({
      _key: `i-${p.pruebaId}-${i}`,
      prueba: p.prueba,
      serie: labelMap.get(p.pruebaId) || p.serie || '—',
      genero: generoLabel(p.genero),
      marca: p.mejorMarca || '—',
      dorsal: p.dorsal || '—',
      fecha: [formatDia(p.fecha), formatHour(p.fecha)].filter(Boolean).join(' · ') || '—',
    }));

  const inscripcionesCols = [
    { key: 'prueba', label: 'Prueba', align: 'left', bold: true },
    { key: 'serie', label: 'Serie', align: 'left' },
    { key: 'genero', label: 'Cat.', align: 'left' },
    { key: 'marca', label: 'Mejor marca', align: 'right', fixed: true, bold: true },
    { key: 'dorsal', label: 'N°', align: 'right', fixed: true, minWidth: 52 },
    { key: 'fecha', label: 'Fecha', align: 'left', fixed: true, minWidth: 120 },
  ];

  return (
    <div id="AtletaDetail">
      <nav>
        <BackBtn onClick={() => navigate(-1)} />
      </nav>

      <main>
        <section>
          <div id="meetHeader">
            <p id="meetTimeLeft">{comp.torneo.nombre}</p>
            <div id="meetTitleRow">
              <h1 id="atletaName">{atleta.nombre}</h1>
            </div>
            <div className="atletaBadges">
              <span className="badge">{atleta.club}</span>
              {atleta.anio && <span className="badge">Año {atleta.anio}</span>}
              {atleta.puntos > 0 && <span className="badge gold">{atleta.puntos} pts</span>}
              {atleta.resultados.length > 0 && (
                <span className="badge">
                  {atleta.resultados.length} prueba{atleta.resultados.length === 1 ? '' : 's'}
                </span>
              )}
              {atleta.inscripciones.length > 0 && (
                <span className="badge pend">
                  {atleta.inscripciones.length} pendiente{atleta.inscripciones.length === 1 ? '' : 's'}
                </span>
              )}
              {atleta.club && atleta.club !== '—' && (
                <button
                  type="button"
                  className="clubLink"
                  onClick={() => navigate(`/c/${id}/club/${slugify(atleta.club)}`)}
                >
                  Ver club →
                </button>
              )}
            </div>
          </div>

          {resultadosRows.length > 0 && (
            <>
              <h3>Resultados</h3>
              <ResultTable data={resultadosRows} columns={resultadosCols} empty="Sin resultados aún" />
            </>
          )}

          {inscripcionesRows.length > 0 && (
            <>
              <h3>Inscripto en</h3>
              <ResultTable data={inscripcionesRows} columns={inscripcionesCols} empty="Sin inscripciones pendientes" />
            </>
          )}

          {!resultadosRows.length && !inscripcionesRows.length && (
            <p className="loading">Sin participaciones registradas</p>
          )}
        </section>
      </main>
    </div>
  );
}

function BackBtn({ onClick }) {
  return (
    <button type="button" id="backButton" onClick={onClick} aria-label="Volver">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M15 18l-6-6 6-6" stroke="#171921" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
