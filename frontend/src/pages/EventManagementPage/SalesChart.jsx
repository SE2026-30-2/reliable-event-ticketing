import { useState } from 'react';
import { useResource } from './useResource';
import { Panel, ResourceState, Table } from './managementUi';
import { money, number } from './eventManagementUtils';

export default function SalesChart({ api, eventId }) {
  const [days, setDays] = useState(7), [refresh, setRefresh] = useState(0);
  const resource = useResource(api.analytics, [eventId, days], refresh);
  const points = resource.data?.daily || [];
  const totals = points.reduce((sum, p) => ({ tickets: sum.tickets + p.ticketsSold, revenue: sum.revenue + p.revenueCents }), { tickets: 0, revenue: 0 });
  const maxSales = Math.max(1, ...points.map((p) => p.ticketsSold)), maxMoney = Math.max(1, ...points.map((p) => p.revenueCents));
  const x = (i) => 50 + i * 610 / Math.max(1, points.length - 1), y = (value, max) => 175 - value / max * 145;
  return <Panel title="Doanh thu & lượt bán vé" action={<select aria-label="Khoảng thời gian báo cáo" value={days} onChange={(e) => setDays(Number(e.target.value))}>{[7, 30, 90].map((n) => <option key={n} value={n}>{n} ngày qua</option>)}</select>}>
    <ResourceState resource={resource} retry={() => setRefresh((n) => n + 1)} />
    {resource.data && <><p className="em-muted">{number(totals.tickets)} vé mua · {money(totals.revenue)} tiền thu · {resource.data.timezone}</p>
      <div className="em-chart-legend"><span>● Vé mua (trục trái)</span><span>● Tiền thu (triệu đồng, trục phải)</span></div>
      <svg className="em-chart" viewBox="0 0 750 210" role="img" aria-label="Biểu đồ doanh thu và số vé mua theo ngày">
        {[0, .25, .5, .75, 1].map((f) => <g key={f}><line x1="50" x2="660" y1={y(f, 1)} y2={y(f, 1)} stroke="#edf0fa" /><text x="4" y={y(f, 1) + 4}>{Math.round(f * maxSales)}</text><text x="670" y={y(f, 1) + 4}>{number(f * maxMoney / 100_000_000)}</text></g>)}
        {[['ticketsSold', maxSales, '#6346ff'], ['revenueCents', maxMoney, '#8da5ff']].map(([key, max, color]) => <g key={key} stroke={color}><polyline fill="none" strokeWidth="2.5" points={points.map((p, i) => `${x(i)},${y(p[key], max)}`).join(' ')} />{points.map((p, i) => <circle key={p.date} cx={x(i)} cy={y(p[key], max)} r="3" fill="white"><title>{p.date}: {number(p.ticketsSold)} vé · {money(p.revenueCents)}</title></circle>)}</g>)}
        {points.map((p, i) => (i === 0 || i === points.length - 1 || i % Math.ceil(points.length / 6) === 0) && <text key={p.date} x={x(i)} y="200" textAnchor="middle">{p.date.slice(5).split('-').reverse().join('/')}</text>)}
      </svg>
      {totals.tickets === 0 && <p className="em-muted">Chưa có giao dịch hoàn tất trong khoảng thời gian này.</p>}
      <details><summary>Xem số liệu theo ngày</summary><Table headers={['Ngày', 'Vé mua', 'Tiền thu']} rows={points.map((p) => ({ key: p.date, cells: [p.date, number(p.ticketsSold), money(p.revenueCents)] }))} /></details>
      <p className="em-muted">Theo ngày hoàn tất thanh toán; không gồm vé mời và giao dịch đã hoàn tiền.</p>
    </>}
  </Panel>;
}
