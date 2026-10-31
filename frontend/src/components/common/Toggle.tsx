interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, disabled = false }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? 'border-secondary/70 bg-secondary' : 'border-outline-variant bg-surface-high'
      }`}
    >
      <span
        className={`absolute left-0 top-0.5 h-[18px] w-[18px] rounded-full shadow transition-transform ${
          checked ? 'translate-x-[20px] bg-[#003824]' : 'translate-x-0.5 bg-outline'
        }`}
      />
    </button>
  );
}
