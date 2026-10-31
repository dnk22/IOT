export function LoadingState() {
  return (
    <div className="panel flex min-h-32 items-center justify-center gap-3 text-on-surface-variant" role="status">
      <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
      <span className="font-mono text-xs uppercase tracking-wider">Đang tải dữ liệu</span>
    </div>
  );
}
