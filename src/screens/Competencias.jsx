import { useNavigate } from 'react-router-dom';
import { useData } from '../lib/data.jsx';
import { tiempoRelativo } from '../lib/format.js';
import './styles/competencias.scss';

function stats(pruebas) {
  let ok = 0, pend = 0;
  for (const p of pruebas) {
    if (p.estado === 'ok') ok++;
    else if (p.estado === 'pendiente') pend++;
  }
  return { ok, pend, total: pruebas.length };
}

export default function Competencias() {
  const navigate = useNavigate();
  const { competencias, loading, error, refresh, refreshing } = useData();

  if (loading) return <div id="Competencias"><p className="state">Cargando…</p></div>;
  if (error || !competencias) {
    return (
      <div id="Competencias">
        <p className="state">Error: {error || 'sin datos'}</p>
        <button onClick={refresh}>Reintentar</button>
      </div>
    );
  }

  return (
    <div id="Competencias">
      <header>
        <div>
          <h1>Competencias</h1>
          <p className="sub">{competencias.length} disponible{competencias.length === 1 ? '' : 's'}</p>
        </div>
        <button className="refresh" onClick={refresh} disabled={refreshing}>
          {refreshing ? 'Actualizando…' : 'Actualizar'}
        </button>
      </header>

      <div className="grid">
        {competencias.map((c) => {
          const s = stats(c.pruebas);
          return (
            <button
              key={c.torneo.id}
              className="compCard"
              onClick={() => navigate(`/c/${c.torneo.id}`)}
            >
              <p className="date">{c.torneo.fechas.map((f) => f.slice(0, 5)).join(' y ')}</p>
              <p className="name">{c.torneo.nombre}</p>
              <p className="sede">{c.torneo.sede}</p>

              <div className="badges">
                <span className="badge ok">{s.ok} finalizadas</span>
                {s.pend > 0 && <span className="badge pend">{s.pend} pendientes</span>}
              </div>

              <div className="footerRow">
                <span className="update">Actualizado {tiempoRelativo(c.actualizadoEn)}</span>
                <span className="arrow">→</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
