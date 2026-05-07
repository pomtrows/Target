export default function Badge({ label, icon, color, size = 'sm' }) {
  const textSizes = {
    xs: 'text-xs',
    sm: 'text-xs',
    md: 'text-sm',
  };

  const paddings = {
    xs: '2px 10px',
    sm: '4px 10px',
    md: '6px 12px',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${textSizes[size]}`}
      style={{
        backgroundColor: `${color}20`,
        color: color,
        border: `1px solid ${color}30`,
        padding: paddings[size],
      }}
    >
      {icon && <span>{icon}</span>}
      {label}
    </span>
  );
}
