import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TelemetryHistoryPoint } from '../../types/telemetry';
import { formatStat, getChartStats } from '../../utils/chart';
import { formatChartTooltipTime } from '../../utils/formatTime';

interface TemperatureChartProps { data: TelemetryHistoryPoint[]; }

export function TemperatureChart({ data }: TemperatureChartProps) {
  const stats = getChartStats(data.map((point) => point.temperatureC));
  return (
    <article className="chart-card border-primary/20">
      <div className="chart-header"><div>
        <h3 className="chart-title"><span className="chart-dot bg-primary" />Nhiệt độ (°C)</h3>
        <p className="chart-stats">Hiện tại: <strong className="text-primary">{formatStat(stats.current)}°C</strong> · Trung bình: {formatStat(stats.average)}°C · Thấp nhất: {formatStat(stats.min)}°C · Cao nhất: {formatStat(stats.max)}°C</p>
      </div></div>
      <div className="h-64 w-full sm:h-72" aria-label="Biểu đồ lịch sử nhiệt độ">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 18, right: 12, left: -12, bottom: 0 }}>
            <defs><linearGradient id="temperatureFill" x1="0" y1="0" x2="0" y2="1"><stop offset="10%" stopColor="#4cd7f6" stopOpacity={0.25} /><stop offset="100%" stopColor="#4cd7f6" stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="receivedAtMs" type="number" scale="time" domain={['dataMin', 'dataMax']} hide />
            <YAxis domain={[20, 40]} ticks={[20, 25, 30, 35, 40]} tickFormatter={(value: number) => `${value}°`} tick={{ fill: '#869397', fontSize: 9, fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} />
            <Tooltip cursor={{ stroke: 'rgba(76, 215, 246, 0.35)', strokeWidth: 1 }} labelFormatter={(value) => formatChartTooltipTime(Number(value))} contentStyle={{ background: '#171f33', border: '1px solid #4cd7f6', borderRadius: 4, fontFamily: 'JetBrains Mono', fontSize: 11 }} formatter={(value) => [value === null || value === undefined ? '--' : `${Number(value).toFixed(1)}°C`, 'Nhiệt độ']} />
            <Area type="monotone" dataKey="temperatureC" connectNulls={false} stroke="#4cd7f6" strokeWidth={2.5} fill="url(#temperatureFill)" dot={false} activeDot={{ r: 5 }} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}
