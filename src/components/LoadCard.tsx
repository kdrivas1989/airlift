import Link from "next/link";
import WeightGauge from "./WeightGauge";

const STATUS_COLORS: Record<string, string> = {
  open: "bg-green-100 text-green-800 border-green-200",
  boarding: "bg-yellow-100 text-yellow-800 border-yellow-200",
  in_flight: "bg-blue-100 text-blue-800 border-blue-200",
  landed: "bg-gray-100 text-gray-700 border-gray-200",
  closed: "bg-gray-50 text-gray-500 border-gray-100",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  boarding: "Boarding",
  in_flight: "In Flight",
  landed: "Landed",
  closed: "Closed",
};

interface LoadCardProps {
  load: {
    id: number;
    loadNumber: number;
    aircraft: { tailNumber: string; name: string; slotCount: number };
    status: string;
    slotsUsed: number;
    slotsAvailable: number;
    currentWeight: number;
    maxWeight: number;
    manifest: Array<{ jumper: { firstName: string; lastName: string } }>;
  };
}

export default function LoadCard({ load }: LoadCardProps) {
  return (
    <Link href={`/manifest/loads/${load.id}`} className="block">
      <div className={`bg-white rounded-xl border-2 p-4 hover:shadow-md transition ${
        load.status === "open" ? "border-green-200" :
        load.status === "boarding" ? "border-yellow-200" :
        load.status === "in_flight" ? "border-blue-200" :
        "border-gray-200"
      }`}>
        {/* Header */}
        <div className="flex justify-between items-start mb-3">
          <div>
            <span className="text-lg font-bold">Load #{load.loadNumber}</span>
            <span className="text-gray-500 text-sm ml-2">{load.aircraft.tailNumber}</span>
          </div>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[load.status]}`}>
            {STATUS_LABELS[load.status]}
          </span>
        </div>

        {/* Slots */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">Slots</span>
          <span className="text-sm font-medium">
            {load.slotsUsed} / {load.aircraft.slotCount}
            {load.slotsAvailable === 0 && <span className="text-red-600 ml-1">FULL</span>}
          </span>
        </div>

        {/* Weight */}
        <WeightGauge current={load.currentWeight} max={load.maxWeight} compact />

        {/* Jumper names */}
        {load.manifest.length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <div className="flex flex-wrap gap-1">
              {load.manifest.slice(0, 8).map((m, i) => (
                <span key={i} className="bg-gray-100 px-2 py-0.5 rounded text-xs text-gray-700">
                  {m.jumper.firstName} {m.jumper.lastName[0]}.
                </span>
              ))}
              {load.manifest.length > 8 && (
                <span className="text-xs text-gray-500 px-2 py-0.5">+{load.manifest.length - 8} more</span>
              )}
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}
