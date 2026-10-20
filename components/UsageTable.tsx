import { SourceIcon } from '@/components/SourceIcon';
import { formatCost, formatExact, formatMonth, formatShortDate } from '@/lib/format';
import type { UsageRow, UsageTotals, View } from '@/lib/types';

export function UsageTable({
  rows,
  totals,
  view,
}: {
  rows: UsageRow[];
  totals: UsageTotals;
  view: View;
}) {
  const daily = view === 'daily';

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th scope="col">{daily ? 'Date' : 'Month'}</th>
            {daily && (
              <>
                <th scope="col">Input</th>
                <th scope="col">Output</th>
                <th scope="col">Cache write</th>
                <th scope="col">Cache read</th>
              </>
            )}
            <th scope="col">Total tokens</th>
            <th scope="col">Cost</th>
            {daily && <th scope="col">Models used</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.period}>
              <th scope="row" className="row-head">
                {daily ? formatShortDate(row.period) : formatMonth(row.period)}
                {row.agents.length > 0 && (
                  <span className="chip chip--agents" title={row.agents.join(', ')}>
                    {row.agents.map((agent) => (
                      <SourceIcon key={agent} source={agent} />
                    ))}
                  </span>
                )}
              </th>
              {daily && (
                <>
                  <td>{formatExact(row.inputTokens)}</td>
                  <td>{formatExact(row.outputTokens)}</td>
                  <td>{formatExact(row.cacheCreationTokens)}</td>
                  <td>{formatExact(row.cacheReadTokens)}</td>
                </>
              )}
              <td className="cell-strong">{formatExact(row.totalTokens)}</td>
              <td>{formatCost(row.totalCost)}</td>
              {daily && (
                <td className="cell-models" title={row.modelsUsed.join(', ')}>
                  {row.modelsUsed.length === 0 ? '—' : row.modelsUsed.join(', ')}
                </td>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" className="row-head">
              All time
            </th>
            {daily && (
              <>
                <td>{formatExact(totals.inputTokens)}</td>
                <td>{formatExact(totals.outputTokens)}</td>
                <td>{formatExact(totals.cacheCreationTokens)}</td>
                <td>{formatExact(totals.cacheReadTokens)}</td>
              </>
            )}
            <td className="cell-strong">{formatExact(totals.totalTokens)}</td>
            <td>{formatCost(totals.totalCost)}</td>
            {daily && <td className="cell-models">—</td>}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}