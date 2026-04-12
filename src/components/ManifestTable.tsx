"use client";

interface ManifestEntry {
  id: number;
  jumper: {
    id: number;
    firstName: string;
    lastName: string;
    weight: number;
  };
  jumpType: string;
  altitude: number;
  exitOrder: number;
  ticketPrice: number;
}

interface ManifestTableProps {
  entries: ManifestEntry[];
  editable: boolean;
  onRemove?: (jumperId: number) => void;
  onUpdateType?: (entryId: number, jumpType: string) => void;
}

const JUMP_TYPES = [
  { value: "solo", label: "Solo" },
  { value: "tandem", label: "Tandem" },
  { value: "aff", label: "AFF" },
  { value: "hop_n_pop", label: "Hop-n-Pop" },
  { value: "high_altitude", label: "High Alt" },
  { value: "coach", label: "Coach" },
  { value: "video", label: "Video" },
];

export default function ManifestTable({ entries, editable, onRemove, onUpdateType }: ManifestTableProps) {
  const sorted = [...entries].sort((a, b) => a.exitOrder - b.exitOrder);

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="text-center px-3 py-2 text-xs font-medium text-gray-600 w-12">#</th>
            <th className="text-left px-3 py-2 text-xs font-medium text-gray-600">Name</th>
            <th className="text-center px-3 py-2 text-xs font-medium text-gray-600">Weight</th>
            <th className="text-center px-3 py-2 text-xs font-medium text-gray-600">Type</th>
            <th className="text-center px-3 py-2 text-xs font-medium text-gray-600">Alt</th>
            <th className="text-center px-3 py-2 text-xs font-medium text-gray-600">Price</th>
            {editable && <th className="w-16"></th>}
          </tr>
        </thead>
        <tbody>
          {sorted.map((entry) => (
            <tr key={entry.id} className="border-b hover:bg-gray-50">
              <td className="text-center px-3 py-2 text-sm font-mono">{entry.exitOrder}</td>
              <td className="px-3 py-2 text-sm font-medium">
                {entry.jumper.firstName} {entry.jumper.lastName}
              </td>
              <td className="text-center px-3 py-2 text-sm text-gray-600">{entry.jumper.weight} lbs</td>
              <td className="text-center px-3 py-2 text-sm">
                {editable && onUpdateType ? (
                  <select
                    value={entry.jumpType}
                    onChange={(e) => onUpdateType(entry.id, e.target.value)}
                    className="border rounded px-1 py-0.5 text-xs"
                  >
                    {JUMP_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                ) : (
                  <span className="bg-gray-100 px-2 py-0.5 rounded text-xs">
                    {JUMP_TYPES.find((t) => t.value === entry.jumpType)?.label || entry.jumpType}
                  </span>
                )}
              </td>
              <td className="text-center px-3 py-2 text-sm text-gray-600">{(entry.altitude / 1000).toFixed(1)}k</td>
              <td className="text-center px-3 py-2 text-sm text-gray-600">${(entry.ticketPrice / 100).toFixed(2)}</td>
              {editable && (
                <td className="text-center px-3 py-2">
                  <button
                    onClick={() => onRemove?.(entry.jumper.id)}
                    className="text-red-500 hover:text-red-700 text-xs"
                  >
                    Remove
                  </button>
                </td>
              )}
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr><td colSpan={editable ? 7 : 6} className="px-3 py-8 text-center text-gray-400 text-sm">No jumpers manifested</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
