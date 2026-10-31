import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TelemetryHistoryPoint } from '../../types/telemetry';
import { formatChartTooltipTime } from '../../utils/formatTime';
import { formatStat, getChartStats } from '../../utils/chart';

interface HumidityChartProps { data: TelemetryHistoryPoint[]; }

export function HumidityChart({ data }: HumidityChartProps) {
  const stats = getChartStats(data.map((point) => point.humidityPct));
  return (
    <article className="chart-card">
      <div className="chart-header"><div>
        <h3 className="chart-title"><span className="chart-dot bg-secondary" />Độ ẩm (%RH)</h3>
        <p className="chart-stats">Hiện tại: <strong className="text-secondary">{formatStat(stats.current)}%</strong> · Thấp nhất: {formatStat(stats.min)}% · Cao nhất: {formatStat(stats.max)}%</p>
      </div></div>
      <div className="h-44 w-full" aria-label="Biểu đồ lịch sử độ ẩm">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 12, right: 8, left: -20, bottom: 0 }}>
            <defs><linearGradient id="humidityFill" x1="0" y1="0" x2="0" y2="1"><stop offset="10%" stopColor="#4edea3" stopOpacity={0.22} /><stop offset="100%" stopColor="#4edea3" stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="receivedAtMs" type="number" scale="time" domain={['dataMin', 'dataMax']} hide />
            <YAxis domain={[0, 100]} tickFormatter={(value: number) => `${value}%`} tick={{ fill: '#869397', fontSize: 9, fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} />
            <Tooltip cursor={{ stroke: 'rgba(78, 222, 163, 0.35)', strokeWidth: 1 }} labelFormatter={(value) => formatChartTooltipTime(Number(value))} contentStyle={{ background: '#171f33', border: '1px solid #3d494c', borderRadius: 4, fontFamily: 'JetBrains Mono', fontSize: 11 }} formatter={(value) => [value === null || value === undefined ? '--' : `${Number(value).toFixed(1)}%`, 'Độ ẩm']} />
            <Area type="monotone" dataKey="humidityPct" connectNulls={false} stroke="#4edea3" strokeWidth={2} fill="url(#humidityFill)" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}
