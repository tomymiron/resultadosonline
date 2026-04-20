import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const INDEX_URL = '/data/index.json';
const DataContext = createContext(null);

async function fetchCompetencias() {
  try {
    const res = await fetch(`${INDEX_URL}?t=${Date.now()}`);
    if (res.ok) {
      const j = await res.json();
      if (Array.isArray(j?.competencias)) return j.competencias;
    }
  } catch {}
  const res = await fetch(`/data/torneo-631.json?t=${Date.now()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return [await res.json()];
}

function signature(list) {
  if (!Array.isArray(list)) return '';
  return list
    .map((c) => `${c.torneo?.id}:${c.actualizadoEn}:${c.stats?.ok}:${c.stats?.pendientes}:${c.stats?.fail}`)
    .join('|');
}

export function DataProvider({ children }) {
  const [competencias, setCompetencias] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const showToast = useCallback((kind, message) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    const id = Date.now();
    setToast({ id, kind, message });
    toastTimer.current = setTimeout(() => {
      setToast((t) => (t && t.id === id ? null : t));
    }, 2800);
  }, []);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const list = await fetchCompetencias();
        if (isRefresh) {
          const prev = signature(competencias);
          const next = signature(list);
          if (prev && prev === next) {
            showToast('unchanged', 'Sin cambios — los datos ya estaban al día');
          } else {
            showToast('updated', 'Datos actualizados');
          }
        }
        setCompetencias(list);
        setError(null);
      } catch (e) {
        setError(e.message);
        if (isRefresh) showToast('error', `Error al actualizar: ${e.message}`);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [competencias, showToast]
  );

  useEffect(() => {
    load();
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  return (
    <DataContext.Provider
      value={{ competencias, loading, refreshing, error, toast, refresh: () => load(true) }}
    >
      {children}
      {toast && (
        <div className={`globalToast globalToast-${toast.kind}`} role="status" aria-live="polite">
          {toast.kind === 'updated' && <span className="ico">✓</span>}
          {toast.kind === 'unchanged' && <span className="ico">=</span>}
          {toast.kind === 'error' && <span className="ico">!</span>}
          <span>{toast.message}</span>
        </div>
      )}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData outside of provider');
  return ctx;
}
