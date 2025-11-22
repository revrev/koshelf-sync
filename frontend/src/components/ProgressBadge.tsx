interface ProgressBadgeProps {
  label: string
  value: number
  tone?: 'lavender' | 'blue' | 'green'
}

const toneMap = {
  lavender: 'bg-ctp-lavender/15 text-ctp-lavender border-ctp-lavender/40',
  blue: 'bg-ctp-blue/15 text-ctp-blue border-ctp-blue/40',
  green: 'bg-ctp-green/15 text-ctp-green border-ctp-green/40',
}

export function ProgressBadge({ label, value, tone = 'lavender' }: ProgressBadgeProps) {
  const pct = Math.round(value * 100)
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold ${toneMap[tone]}`}>
      <span>{label}</span>
      <span className="text-ctp-text/70">{pct}%</span>
    </span>
  )
}
