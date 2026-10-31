const timeFormatter = new Intl.DateTimeFormat('vi-VN', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

export function formatClockTime(epochMs: number | null | undefined): string {
  return typeof epochMs === 'number' && Number.isFinite(epochMs) ? timeFormatter.format(epochMs) : '--:--:--';
}

export function formatChartTooltipTime(epochMs: number): string {
  return timeFormatter.format(epochMs);
}

export function formatRelativeTime(epochMs: number | null | undefined, now = Date.now()): string {
  if (typeof epochMs !== 'number' || !Number.isFinite(epochMs)) return 'Chưa có dữ liệu';
  const seconds = Math.max(0, Math.floor((now - epochMs) / 1_000));
  if (seconds < 60) return `${seconds} giây trước`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.floor(hours / 24)} ngày trước`;
}
