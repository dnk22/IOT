interface AddRuleButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export function AddRuleButton({ onClick, disabled = false }: AddRuleButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center justify-center gap-2 rounded-panel border border-primary/30 bg-surface-high px-3 py-2.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-primary transition hover:border-primary hover:bg-surface-highest focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-45"
      aria-label="Thêm quy tắc tự động"
    >
      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">add_circle</span>
      Thêm quy tắc
    </button>
  );
}
