"use client";

import { useState, useEffect, useCallback, use } from "react";
import JumperSearch from "@/components/JumperSearch";
import ManifestTable from "@/components/ManifestTable";
import WeightGauge from "@/components/WeightGauge";

const JUMP_TYPES = [
  { value: "solo", label: "Solo" },
  { value: "tandem", label: "Tandem" },
  { value: "aff", label: "AFF" },
  { value: "hop_n_pop", label: "Hop-n-Pop" },
  { value: "high_altitude", label: "High Alt" },
  { value: "coach", label: "Coach" },
  { value: "video", label: "Video" },
];

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  boarding: "Boarding",
  in_flight: "In Flight",
  landed: "Landed",
  closed: "Closed",
};

const NEXT_STATUS: Record<string, string> = {
  open: "boarding",
  boarding: "in_flight",
  in_flight: "landed",
  landed: "closed",
};

interface LoadData {
  id: number;
  loadNumber: number;
  aircraft: { id: number; tailNumber: string; name: string; slotCount: number; maxGrossWeight: number };
  fuelWeight: number;
  defaultAltitude: number;
  status: string;
  slotsUsed: number;
  slotsAvailable: number;
  currentWeight: number;
  maxWeight: number;
  manifest: Array<{
    id: number;
    jumper: { id: number; firstName: string; lastName: string; weight: number };
    jumpType: string;
    altitude: number;
    exitOrder: number;
    ticketPrice: number;
  }>;
}

export default function LoadDetailPage({ params }: { params: Promise<{ loadId: string }> }) {
  const { loadId } = use(params);
  const [load, setLoad] = useState<LoadData | null>(null);
  const [jumpType, setJumpType] = useState("solo");
  const [error, setError] = useState("");

  const fetchLoad = useCallback(() => {
    fetch(`/api/loads?status=open,boarding,in_flight,landed,closed`)
      .then((r) => r.json())
      .then((data) => {
        const found = data.loads?.find((l: LoadData) => l.id === Number(loadId));
        if (found) setLoad(found);
      });
  }, [loadId]);

  useEffect(() => { fetchLoad(); }, [fetchLoad]);

  const editable = load?.status === "open" || load?.status === "boarding";

  async function addJumper(jumper: { id: number; canManifest: boolean }) {
    if (!jumper.canManifest) {
      setError("Jumper cannot manifest — check waiver and reserve status");
      return;
    }
    setError("");
    const res = await fetch(`/api/loads/${loadId}/manifest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jumperId: jumper.id, jumpType }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    fetchLoad();
  }

  async function removeJumper(jumperId: number) {
    const res = await fetch(`/api/loads/${loadId}/manifest`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jumperId }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    fetchLoad();
  }

  async function advanceStatus() {
    if (!load) return;
    const next = NEXT_STATUS[load.status];
    if (!next) return;

    if (next === "in_flight" && !confirm("Advance to In Flight? Manifest will be locked.")) return;

    const res = await fetch(`/api/loads/${loadId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    fetchLoad();
  }

  async function updateFuel(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await fetch(`/api/loads/${loadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fuelWeight: Number(form.get("fuelWeight")) }),
    });
    fetchLoad();
  }

  if (!load) return <div className="p-8 text-center text-gray-500">Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">Load #{load.loadNumber}</h1>
          <p className="text-gray-600">{load.aircraft.tailNumber} {load.aircraft.name && `— ${load.aircraft.name}`}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            load.status === "open" ? "bg-green-100 text-green-800" :
            load.status === "boarding" ? "bg-yellow-100 text-yellow-800" :
            load.status === "in_flight" ? "bg-blue-100 text-blue-800" :
            load.status === "landed" ? "bg-gray-100 text-gray-800" :
            "bg-gray-200 text-gray-600"
          }`}>
            {STATUS_LABELS[load.status]}
          </span>
          {NEXT_STATUS[load.status] && (
            <button onClick={advanceStatus} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
              {load.status === "open" ? "Start Boarding" :
               load.status === "boarding" ? "Take Off" :
               load.status === "in_flight" ? "Landed" :
               "Close Load"}
            </button>
          )}
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <div className="text-sm text-gray-600 mb-1">Slots</div>
          <div className="text-2xl font-bold">{load.slotsUsed} / {load.aircraft.slotCount}</div>
          <div className="text-sm text-gray-500">{load.slotsAvailable} available</div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <WeightGauge current={load.currentWeight} max={load.maxWeight} />
        </div>
      </div>

      {/* Fuel */}
      {editable && (
        <form onSubmit={updateFuel} className="bg-white rounded-xl border p-4 flex items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fuel Weight (lbs)</label>
            <input name="fuelWeight" type="number" min="0" defaultValue={load.fuelWeight} className="border rounded-lg px-3 py-2 w-32" />
          </div>
          <button type="submit" className="bg-gray-200 px-4 py-2 rounded-lg hover:bg-gray-300 text-sm">Update Fuel</button>
        </form>
      )}

      {/* Add Jumper */}
      {editable && (
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <h2 className="font-semibold">Add Jumper</h2>
          <div className="flex gap-3">
            <div className="flex-1">
              <JumperSearch onSelect={addJumper} placeholder="Search by name or USPA #..." />
            </div>
            <select value={jumpType} onChange={(e) => setJumpType(e.target.value)} className="border rounded-lg px-3 py-2">
              {JUMP_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Manifest */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50">
          <h2 className="font-semibold">Manifest</h2>
        </div>
        <ManifestTable entries={load.manifest} editable={editable} onRemove={removeJumper} />
      </div>
    </div>
  );
}
