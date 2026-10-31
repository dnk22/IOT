import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TelemetryHistoryPoint } from '../../types/telemetry';
import { formatStat, getChartStats } from '../../utils/chart';
import { formatChartTooltipTime } from '../../utils/formatTime';

interface LightChartProps { data: TelemetryHistoryPoint[]; }

export function LightChart({ data }: LightChartProps) {
  const stats = getChartStats(data.map((point) => point.lightRaw));
  return (
    <article className="chart-card">
      <div className="chart-header"><div>
        <h3 className="chart-title"><span className="chart-dot bg-tertiary" />Ánh sáng (ADC thô)</h3>
        <p className="chart-stats">Hiện tại: <strong className="text-tertiary">{formatStat(stats.current, 0)} ADC</strong> · Thấp nhất: {formatStat(stats.min, 0)} · Cao nhất: {formatStat(stats.max, 0)}</p>
      </div></div>
      <div className="h-44 w-full" aria-label="Biểu đồ lịch sử ánh sáng ADC">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 12, right: 8, left: -12, bottom: 0 }}>
            <defs><linearGradient id="lightFill" x1="0" y1="0" x2="0" y2="1"><stop offset="10%" stopColor="#ffb95f" stopOpacity={0.22} /><stop offset="100%" stopColor="#ffb95f" stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="receivedAtMs" type="number" scale="time" domain={['dataMin', 'dataMax']} hide />
            <YAxis domain={[0, 4095]} ticks={[0, 1500, 3000, 4095]} tick={{ fill: '#869397', fontSize: 9, fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} />
            <Tooltip cursor={{ stroke: 'rgba(255, 185, 95, 0.35)', strokeWidth: 1 }} labelFormatter={(value) => formatChartTooltipTime(Number(value))} contentStyle={{ background: '#171f33', border: '1px solid #3d494c', borderRadius: 4, fontFamily: 'JetBrains Mono', fontSize: 11 }} formatter={(value) => [`${Number(value ?? 0).toFixed(0)} ADC`, 'Ánh sáng']} />
            <Area type="stepAfter" dataKey="lightRaw" stroke="#ffb95f" strokeWidth={2} fill="url(#lightFill)" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}
