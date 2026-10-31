interface ErrorStateProps {
  message?: string;
}

export function ErrorState({ message = 'Không thể tải dữ liệu' }: ErrorStateProps) {
  return (
    <div className="rounded-panel border border-error/30 bg-error/5 p-4 text-error" role="alert">
      <p className="font-mono text-xs uppercase tracking-wider">{message}</p>
    </div>
  );
}
