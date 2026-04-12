interface WeightGaugeProps {
  current: number;
  max: number;
  compact?: boolean;
}

export default function WeightGauge({ current, max, compact = false }: WeightGaugeProps) {
  const pct = Math.min((current / max) * 100, 100);
  const color = pct >= 95 ? "bg-red-500" : pct >= 80 ? "bg-yellow-500" : "bg-green-500";

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs text-gray-600">{current.toLocaleString()}/{max.toLocaleString()}</span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">Weight</span>
        <span className={`font-medium ${pct >= 95 ? "text-red-600" : "text-gray-900"}`}>
          {current.toLocaleString()} / {max.toLocaleString()} lbs
        </span>
      </div>
      <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-gray-500 mt-1">{(max - current).toLocaleString()} lbs remaining</p>
    </div>
  );
}
