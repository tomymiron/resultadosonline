import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ResultTable from '../components/ResultTable';
import { useData } from '../lib/data.jsx';
import {
  buildAtletasIndex,
  buildClubesIndex,
  buildForeignNamesSet,
  buildSerieLabels,
} from '../lib/indexes';
import { formatDia, generoLabel, medallaEmoji, slugify } from '../lib/format';
import './styles/athleteDetail.scss';

export default function ClubDetail() {
  const { id, slug } = useParams();
  const navigate = useNavigate();
  const { competencias, loading, error } = useData();

  const comp = useMemo(
    () => (competencias ? competencias.find((c) => c.torneo.id === id) : null),
    [competencias, id]
  );

  const { club, clubIndex, atletasIdx, labelMap } = useMemo(() => {
    if (!comp) return { club: null, clubIndex: 0, atletasIdx: [], labelMap: new Map() };
    const foreignNames = buildForeignNamesSet(comp.atletasExtranjeros);
    const idx = buildClubesIndex(comp.pruebas, foreignNames);
    const pos = idx.findIndex((c) => c.slug === slug);
    return {
      club: pos >= 0 ? idx[pos] : null,
      clubIndex: pos,
      atletasIdx: buildAtletasIndex(comp.pruebas, foreignNames),
      labelMap: buildSerieLabels(comp.pruebas),
    };
  }, [comp, slug]);

  const participaciones = useMemo(() => {
    if (!club) return [];
    const items = [];
    for (const a of atletasIdx) {
      if (a.club !== club.codigo) continue;
      for (const r of a.resultados) {
        items.push({
          pruebaId: r.pruebaId,
          prueba: r.prueba,
          serie: labelMap.get(r.pruebaId) || r.serie,
          genero: r.genero,
          fecha: r.fecha,
          puesto: r.puesto,
          marca: r.marca || '—',
          atleta: a.nombre,
          atletaSlug: a.slug,
          puntos: r.puntos || 0,
        });
      }
    }
    return items.sort((a, b) => {
      if (b.puntos !== a.puntos) return b.puntos - a.puntos;
      const pa = parseInt(a.puesto, 10) || 999;
      const pb = parseInt(b.puesto, 10) || 999;
      return pa - pb;
    });
  }, [club, atletasIdx, labelMap]);

  if (loading) return <div id="ClubDetail"><p className="loading">Cargando…</p></div>;
  if (error || !comp) {
    return (
      <div id="ClubDetail">
        <nav><BackBtn onClick={() => navigate(-1)} /></nav>
        <main><p className="loading">Competencia no encontrada</p></main>
      </div>
    );
  }
  if (!club) {
    return (
      <div id="ClubDetail">
        <nav><BackBtn onClick={() => navigate(-1)} /></nav>
        <main><p className="loading">Club no encontrado</p></main>
      </div>
    );
  }

  const atletasRows = club.atletas.map((a) => ({
    _key: slugify(`${a.nombre}-${club.codigo}`),
    _slug: slugify(`${a.nombre}-${club.codigo}`),
    nombre: a.nombre,
    pruebas: a.pruebas,
    puntos: a.puntos || '—',
  }));
  const atletasCols = [
    { key: 'nombre', label: 'Atleta', align: 'left', bold: true, isAthlete: true },
    { key: 'pruebas', label: 'Pruebas', align: 'right', fixed: true, minWidth: 72 },
    { key: 'puntos', label: 'Pts', align: 'right', fixed: true, bold: true, minWidth: 56 },
  ];

  const resultsRows = participaciones.map((p, i) => ({
    _key: `${p.pruebaId}-${i}`,
    _slug: p.atletaSlug,
    posicion: `${medallaEmoji(p.puesto)}${medallaEmoji(p.puesto) ? ' ' : ''}${p.puesto || '—'}`,
    marca: p.marca,
    atleta: p.atleta,
    prueba: p.prueba,
    serie: p.serie,
    genero: generoLabel(p.genero),
    puntos: p.puntos || '—',
    fecha: formatDia(p.fecha),
  }));
  const resultsCols = [
    { key: 'posicion', label: '#', align: 'center', fixed: true, bold: true, minWidth: 64 },
    { key: 'marca', label: 'Marca', align: 'right', fixed: true, bold: true, danger: true },
    { key: 'atleta', label: 'Atleta', align: 'left', bold: true, isAthlete: true },
    { key: 'prueba', label: 'Prueba', align: 'left' },
    { key: 'serie', label: 'Serie', align: 'left' },
    { key: 'genero', label: 'Cat.', align: 'left' },
    { key: 'puntos', label: 'Pts', align: 'right', fixed: true, bold: true, minWidth: 50 },
    { key: 'fecha', label: 'Fecha', align: 'left', fixed: true, minWidth: 70 },
  ];

  return (
    <div id="ClubDetail">
      <nav>
        <BackBtn onClick={() => navigate(-1)} />
      </nav>

      <main>
        <section>
          <div id="meetHeader">
            <p id="meetTimeLeft">{comp.torneo.nombre}</p>
            <div id="meetTitleRow">
              <h1 id="clubName">{club.codigo}</h1>
            </div>
            <div className="clubBadges">
              {club.puntos > 0 && (
                <span className="badge gold">{club.puntos} pts · #{clubIndex + 1}</span>
              )}
              <span className="badge">{club.atletasCount} atleta{club.atletasCount === 1 ? '' : 's'}</span>
              <span className="badge">{club.pruebasCount} prueba{club.pruebasCount === 1 ? '' : 's'}</span>
            </div>
          </div>

          <h3>Atletas</h3>
          <ResultTable
            data={atletasRows}
            columns={atletasCols}
            onCellClick={(col, row) => {
              if (col.isAthlete && row._slug) navigate(`/c/${id}/atleta/${row._slug}`);
            }}
            empty="Sin atletas"
          />

          <h3>Resultados</h3>
          <ResultTable
            data={resultsRows}
            columns={resultsCols}
            onCellClick={(col, row) => {
              if (col.isAthlete && row._slug) navigate(`/c/${id}/atleta/${row._slug}`);
            }}
            empty="Sin resultados"
          />
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
