import './styles/resultTable.scss';

function cellValue(col, row) {
  if (col.format) return col.format(row[col.key], row);
  const v = row[col.key];
  return v === null || v === undefined || v === '' ? '—' : String(v);
}

export default function ResultTable({
  data,
  columns,
  onRowClick,
  onCellClick,
  highlight,
  empty = 'Sin datos',
}) {
  if (!Array.isArray(data) || data.length === 0) {
    return <div className="resultTable-empty">{empty}</div>;
  }

  return (
    <div className="resultTable-wrap">
      <table className="resultTable">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={[
                  col.align === 'right' ? 'right' : col.align === 'center' ? 'center' : 'left',
                  col.fixed ? 'fixed' : '',
                ].join(' ')}
                style={{ minWidth: col.minWidth || undefined }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => {
            const highlighted = highlight && highlight(row);
            return (
              <tr
                key={row._key ?? idx}
                className={[highlighted ? 'highlighted' : '', onRowClick ? 'clickable' : ''].join(' ')}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((col) => {
                  const v = cellValue(col, row);
                  const cellClickable = !!(onCellClick && (col.isClub || col.isAthlete));
                  const cn = [
                    col.align === 'right' ? 'right' : col.align === 'center' ? 'center' : 'left',
                    col.fixed ? 'fixed' : '',
                    col.bold ? 'bold' : '',
                    col.danger && /^DN[FS]$/i.test(String(row[col.key] || '')) ? 'danger' : '',
                    col.isAthlete ? 'athlete' : '',
                    col.isClub ? 'club' : '',
                    cellClickable ? 'cell-clickable' : '',
                  ].join(' ');
                  return (
                    <td
                      key={col.key}
                      className={cn}
                      onClick={cellClickable ? (e) => { e.stopPropagation(); onCellClick(col, row); } : undefined}
                    >
                      {col.bold ? <b>{v}</b> : v}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
