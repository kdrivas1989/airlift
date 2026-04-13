"use client";

import { useState, useEffect, useCallback } from "react";
import WeightGauge from "@/components/WeightGauge";
import JumperSearch from "@/components/JumperSearch";
import ComplianceBadge from "@/components/ComplianceBadge";

interface Aircraft {
  id: number;
  tail_number: string;
  name: string | null;
  slot_count: number;
}

interface ManifestEntry {
  id: number;
  jumper: { id: number; firstName: string; lastName: string; weight: number };
  jumpType: string;
  altitude: number;
  exitOrder: number;
  ticketPrice: number;
}

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
  manifest: ManifestEntry[];
  departureTime: string | null;
}

interface CheckedInJumper {
  id: number;
  firstName: string;
  lastName: string;
  weight: number;
  uspaNumber: string | null;
  licenseLevel: string;
  balance: number;
  jumpBlockRemaining: number;
  reserveExpired: boolean;
  hasWaiver: boolean;
  uspaActive: boolean;
  canManifest: boolean;
  checkedInAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  open: "border-green-400 bg-green-50",
  boarding: "border-yellow-400 bg-yellow-50",
  in_flight: "border-blue-400 bg-blue-50",
  landed: "border-gray-300 bg-gray-50",
  closed: "border-gray-200 bg-gray-50",
};

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

const JUMP_TYPES = [
  { value: "solo", label: "Solo" },
  { value: "tandem", label: "Tandem" },
  { value: "aff", label: "AFF" },
  { value: "hop_n_pop", label: "Hop-n-Pop" },
  { value: "high_altitude", label: "High Alt" },
  { value: "coach", label: "Coach" },
  { value: "video", label: "Video" },
];

export default function ManifestDashboard() {
  const [loads, setLoads] = useState<LoadData[]>([]);
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [selectedLoadId, setSelectedLoadId] = useState<number | null>(null);
  const [checkedIn, setCheckedIn] = useState<CheckedInJumper[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [jumpType, setJumpType] = useState("solo");
  const [error, setError] = useState("");
  const [dragOverLoad, setDragOverLoad] = useState<number | null>(null);
  const [balanceModal, setBalanceModal] = useState<CheckedInJumper | null>(null);

  // Auto-timer state
  const [timerMode, setTimerMode] = useState<"auto" | "manual">("auto");
  const [flightTime, setFlightTime] = useState("25");
  const [taxiTime, setTaxiTime] = useState("3");
  const cycleMinutes = Number(flightTime || 0) + Number(taxiTime || 0);

  const fetchLoads = useCallback(() => {
    fetch("/api/loads?status=open,boarding,in_flight,landed")
      .then((r) => r.json())
      .then((data) => setLoads(data.loads || []))
      .catch(() => {});
  }, []);

  const fetchCheckedIn = useCallback(() => {
    fetch("/api/checkin")
      .then((r) => r.json())
      .then((data) => setCheckedIn(data.jumpers || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchLoads();
    fetchCheckedIn();
    fetch("/api/aircraft").then((r) => r.json()).then((data) => setAircraft(data.aircraft || []));
    const interval = setInterval(() => { fetchLoads(); fetchCheckedIn(); }, 5000);
    return () => clearInterval(interval);
  }, [fetchLoads, fetchCheckedIn]);

  // Auto-select first open load
  useEffect(() => {
    if (selectedLoadId === null && loads.length > 0) {
      const open = loads.find((l) => l.status === "open" || l.status === "boarding");
      if (open) setSelectedLoadId(open.id);
      else setSelectedLoadId(loads[0].id);
    }
  }, [loads, selectedLoadId]);

  const selectedLoad = loads.find((l) => l.id === selectedLoadId) || null;
  const editable = selectedLoad?.status === "open" || selectedLoad?.status === "boarding";

  // Check which jumpers are already on any active load
  const manifestedJumperIds = new Set(
    loads.flatMap((l) =>
      ["open", "boarding"].includes(l.status) ? l.manifest.map((m) => m.jumper.id) : []
    )
  );

  async function createLoad(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);

    let departureMinutes = 0;
    if (timerMode === "auto") {
      // Find the last load's departure time and add cycleMinutes
      const openLoads = loads.filter((l) => ["open", "boarding"].includes(l.status));
      const lastDep = openLoads
        .filter((l) => l.departureTime)
        .map((l) => new Date(l.departureTime!).getTime())
        .sort((a, b) => b - a)[0];

      if (lastDep) {
        // Next departure = last departure + cycle time
        const nextDepMs = lastDep + cycleMinutes * 60 * 1000;
        departureMinutes = Math.max(1, Math.round((nextDepMs - Date.now()) / 60000));
      } else {
        // First load — use cycle time as initial departure
        departureMinutes = cycleMinutes;
      }
    } else {
      departureMinutes = Number(form.get("departureMinutes")) || 0;
    }

    const res = await fetch("/api/loads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        aircraftId: Number(form.get("aircraftId")),
        fuelWeight: Number(form.get("fuelWeight")) || 0,
        defaultAltitude: Number(form.get("defaultAltitude")) || 13500,
        departureMinutes,
      }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    setShowCreate(false);
    fetchLoads();
    if (data.load) setSelectedLoadId(data.load.id);
  }

  async function addJumperToLoad(jumperId: number, loadId: number) {
    setError("");
    const res = await fetch(`/api/loads/${loadId}/manifest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jumperId, jumpType }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    fetchLoads();
    fetchCheckedIn();
  }

  async function removeJumper(jumperId: number) {
    if (!selectedLoadId) return;
    const res = await fetch(`/api/loads/${selectedLoadId}/manifest`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jumperId }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    fetchLoads();
  }

  async function advanceStatus() {
    if (!selectedLoad) return;
    const next = NEXT_STATUS[selectedLoad.status];
    if (!next) return;
    if (next === "in_flight" && !confirm("Advance to In Flight? Manifest will be locked.")) return;
    const res = await fetch(`/api/loads/${selectedLoad.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    fetchLoads();
  }

  async function checkInJumper(jumper: { id: number }) {
    await fetch("/api/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jumperId: jumper.id }),
    });
    fetchCheckedIn();
  }

  async function addBalance(jumperId: number, type: string, amount: number, description?: string) {
    const res = await fetch(`/api/jumpers/${jumperId}/balance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, amount, description }),
    });
    if (res.ok) { fetchCheckedIn(); setBalanceModal(null); }
  }

  // Drag handlers
  function onDragStart(e: React.DragEvent, jumperId: number) {
    e.dataTransfer.setData("jumperId", String(jumperId));
    e.dataTransfer.effectAllowed = "move";
  }

  function onDragOverLoad(e: React.DragEvent, loadId: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverLoad(loadId);
  }

  function onDragLeaveLoad() {
    setDragOverLoad(null);
  }

  async function onDropOnLoad(e: React.DragEvent, loadId: number) {
    e.preventDefault();
    setDragOverLoad(null);
    const jumperId = Number(e.dataTransfer.getData("jumperId"));
    if (jumperId) {
      await addJumperToLoad(jumperId, loadId);
      setSelectedLoadId(loadId);
    }
  }

  // Also allow drop on the middle panel
  function onDropOnMiddle(e: React.DragEvent) {
    e.preventDefault();
    if (!selectedLoadId) return;
    const jumperId = Number(e.dataTransfer.getData("jumperId"));
    if (jumperId) addJumperToLoad(jumperId, selectedLoadId);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 text-sm mx-2 mt-2 rounded-lg">
          {error}
          <button onClick={() => setError("")} className="ml-2 font-bold">&times;</button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* LEFT COLUMN — Loads */}
        <div className="w-64 border-r bg-gray-50 flex flex-col overflow-hidden">
          <div className="p-3 border-b flex items-center justify-between">
            <h2 className="font-bold text-sm">Loads</h2>
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="bg-blue-600 text-white text-xs px-2 py-1 rounded hover:bg-blue-700"
            >
              + New
            </button>
          </div>

          {/* Timer mode toggle */}
          <div className="p-2 border-b bg-gray-100 space-y-2">
            <div className="flex rounded overflow-hidden border text-[11px]">
              <button onClick={() => setTimerMode("auto")}
                className={`flex-1 py-1 font-medium ${timerMode === "auto" ? "bg-blue-600 text-white" : "bg-white text-gray-600"}`}>
                Auto
              </button>
              <button onClick={() => setTimerMode("manual")}
                className={`flex-1 py-1 font-medium ${timerMode === "manual" ? "bg-blue-600 text-white" : "bg-white text-gray-600"}`}>
                Manual
              </button>
            </div>
            {timerMode === "auto" && (
              <div className="flex gap-1 items-center text-[11px]">
                <div className="flex-1">
                  <label className="text-gray-500">Flight</label>
                  <input type="number" min="1" value={flightTime} onChange={(e) => setFlightTime(e.target.value)}
                    className="w-full border rounded px-1 py-0.5 text-center text-xs" />
                </div>
                <span className="text-gray-400 mt-3">+</span>
                <div className="flex-1">
                  <label className="text-gray-500">Taxi</label>
                  <input type="number" min="0" value={taxiTime} onChange={(e) => setTaxiTime(e.target.value)}
                    className="w-full border rounded px-1 py-0.5 text-center text-xs" />
                </div>
                <span className="text-gray-400 mt-3">=</span>
                <div className="flex-1">
                  <label className="text-gray-500">Cycle</label>
                  <div className="text-center text-xs font-bold text-blue-700 py-0.5">{cycleMinutes}m</div>
                </div>
              </div>
            )}
          </div>

          {showCreate && (
            <form onSubmit={createLoad} className="p-3 border-b bg-white space-y-2">
              <select name="aircraftId" required className="w-full border rounded px-2 py-1 text-sm">
                <option value="">Aircraft...</option>
                {aircraft.map((a) => (
                  <option key={a.id} value={a.id}>{a.tail_number} {a.name ? `- ${a.name}` : ""}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <input name="fuelWeight" type="number" min="0" defaultValue="500" placeholder="Fuel lbs" className="w-1/2 border rounded px-2 py-1 text-sm" />
                <input name="defaultAltitude" type="number" min="3000" defaultValue="13500" placeholder="Alt ft" className="w-1/2 border rounded px-2 py-1 text-sm" />
              </div>
              {timerMode === "manual" && (
                <div>
                  <input name="departureMinutes" type="number" min="0" defaultValue="20" placeholder="Min to departure" className="w-full border rounded px-2 py-1 text-sm" />
                </div>
              )}
              {timerMode === "auto" && (
                <div className="text-[11px] text-blue-600 bg-blue-50 rounded px-2 py-1">
                  Departure auto-set: {cycleMinutes}min cycle
                </div>
              )}
              <div className="flex gap-1">
                <button type="submit" className="bg-blue-600 text-white text-xs px-3 py-1 rounded hover:bg-blue-700">Create</button>
                <button type="button" onClick={() => setShowCreate(false)} className="text-xs px-3 py-1 rounded border hover:bg-gray-50">Cancel</button>
              </div>
            </form>
          )}

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {loads.map((load) => (
              <button
                key={load.id}
                onClick={() => setSelectedLoadId(load.id)}
                onDragOver={(e) => onDragOverLoad(e, load.id)}
                onDragLeave={onDragLeaveLoad}
                onDrop={(e) => onDropOnLoad(e, load.id)}
                className={`w-full text-left rounded-lg border-2 p-3 transition text-sm ${
                  selectedLoadId === load.id
                    ? "border-blue-500 bg-blue-50 ring-1 ring-blue-300"
                    : dragOverLoad === load.id
                    ? "border-blue-400 bg-blue-50"
                    : STATUS_COLORS[load.status]
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold">Load #{load.loadNumber}</span>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                    load.status === "open" ? "bg-green-200 text-green-800" :
                    load.status === "boarding" ? "bg-yellow-200 text-yellow-800" :
                    load.status === "in_flight" ? "bg-blue-200 text-blue-800" :
                    "bg-gray-200 text-gray-700"
                  }`}>
                    {STATUS_LABELS[load.status]}
                  </span>
                </div>
                <div className="text-xs text-gray-600">{load.aircraft.tailNumber}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {load.slotsUsed}/{load.aircraft.slotCount} slots
                  {load.slotsAvailable === 0 && <span className="text-red-600 font-bold ml-1">FULL</span>}
                </div>
                <WeightGauge current={load.currentWeight} max={load.maxWeight} compact />
                {load.departureTime && <DepartureCountdown departureTime={load.departureTime} compact />}
              </button>
            ))}
            {loads.length === 0 && (
              <div className="text-center py-8 text-gray-400 text-xs">No loads yet</div>
            )}
          </div>
        </div>

        {/* MIDDLE COLUMN — Selected Load Manifest */}
        <div
          className="flex-1 flex flex-col overflow-hidden"
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
          onDrop={onDropOnMiddle}
        >
          {selectedLoad ? (
            <>
              {/* Load header */}
              <div className="p-4 border-b bg-white flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold">Load #{selectedLoad.loadNumber}</h1>
                  <p className="text-sm text-gray-600">
                    {selectedLoad.aircraft.tailNumber} {selectedLoad.aircraft.name && `- ${selectedLoad.aircraft.name}`}
                    &nbsp;&middot;&nbsp;{selectedLoad.slotsUsed}/{selectedLoad.aircraft.slotCount} slots
                    &nbsp;&middot;&nbsp;{selectedLoad.currentWeight.toLocaleString()}/{selectedLoad.maxWeight.toLocaleString()} lbs
                  </p>
                  {selectedLoad.departureTime && (
                    <DepartureCountdown departureTime={selectedLoad.departureTime} />
                  )}
                  {editable && (
                    <SetDepartureButton loadId={selectedLoad.id} onSet={() => fetchLoads()} hasExisting={!!selectedLoad.departureTime} />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    selectedLoad.status === "open" ? "bg-green-100 text-green-800" :
                    selectedLoad.status === "boarding" ? "bg-yellow-100 text-yellow-800" :
                    selectedLoad.status === "in_flight" ? "bg-blue-100 text-blue-800" :
                    "bg-gray-100 text-gray-700"
                  }`}>
                    {STATUS_LABELS[selectedLoad.status]}
                  </span>
                  {NEXT_STATUS[selectedLoad.status] && (
                    <button onClick={advanceStatus} className="bg-blue-600 text-white px-3 py-1.5 rounded text-xs hover:bg-blue-700">
                      {selectedLoad.status === "open" ? "Start Boarding" :
                       selectedLoad.status === "boarding" ? "Take Off" :
                       selectedLoad.status === "in_flight" ? "Landed" :
                       "Close"}
                    </button>
                  )}
                </div>
              </div>

              {/* Jump type selector */}
              {editable && (
                <div className="px-4 py-2 border-b bg-gray-50 flex items-center gap-3">
                  <span className="text-xs text-gray-600">Default jump type:</span>
                  <select value={jumpType} onChange={(e) => setJumpType(e.target.value)} className="border rounded px-2 py-1 text-sm">
                    {JUMP_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <span className="text-xs text-gray-400 ml-auto">Drag jumpers from the right panel or click + to add</span>
                </div>
              )}

              {/* Manifest table */}
              <div className="flex-1 overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b sticky top-0">
                    <tr>
                      <th className="text-center px-3 py-2 text-xs font-medium text-gray-600 w-10">#</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-600">Name</th>
                      <th className="text-center px-3 py-2 text-xs font-medium text-gray-600">Weight</th>
                      <th className="text-center px-3 py-2 text-xs font-medium text-gray-600">Type</th>
                      <th className="text-center px-3 py-2 text-xs font-medium text-gray-600">Alt</th>
                      <th className="text-center px-3 py-2 text-xs font-medium text-gray-600">Price</th>
                      {editable && <th className="w-14"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {[...selectedLoad.manifest].sort((a, b) => a.exitOrder - b.exitOrder).map((entry) => (
                      <tr key={entry.id} className="border-b hover:bg-gray-50">
                        <td className="text-center px-3 py-2 text-sm font-mono">{entry.exitOrder}</td>
                        <td className="px-3 py-2 text-sm font-medium">{entry.jumper.firstName} {entry.jumper.lastName}</td>
                        <td className="text-center px-3 py-2 text-sm text-gray-600">{entry.jumper.weight}</td>
                        <td className="text-center px-3 py-2 text-sm">
                          <span className="bg-gray-100 px-2 py-0.5 rounded text-xs">
                            {JUMP_TYPES.find((t) => t.value === entry.jumpType)?.label || entry.jumpType}
                          </span>
                        </td>
                        <td className="text-center px-3 py-2 text-sm text-gray-600">{(entry.altitude / 1000).toFixed(1)}k</td>
                        <td className="text-center px-3 py-2 text-sm text-gray-600">${(entry.ticketPrice / 100).toFixed(2)}</td>
                        {editable && (
                          <td className="text-center px-3 py-2">
                            <button onClick={() => removeJumper(entry.jumper.id)} className="text-red-500 hover:text-red-700 text-xs">&times;</button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {selectedLoad.manifest.length === 0 && (
                      <tr>
                        <td colSpan={editable ? 7 : 6} className="px-3 py-12 text-center text-gray-400 text-sm">
                          {editable ? "Drag jumpers here or check them in on the right" : "No jumpers on this load"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <p className="text-lg mb-1">No load selected</p>
                <p className="text-sm">Create a load or select one from the left</p>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN — Today's Jumpers */}
        <div className="w-72 border-l bg-gray-50 flex flex-col overflow-hidden">
          <div className="p-3 border-b">
            <h2 className="font-bold text-sm mb-2">Today&apos;s Jumpers</h2>
            <JumperSearch
              onSelect={(j) => { checkInJumper(j); }}
              placeholder="Check in jumper..."
            />
          </div>

          <div className="flex-1 overflow-y-auto">
            {checkedIn.map((j) => {
              const onLoad = manifestedJumperIds.has(j.id);
              return (
                <div
                  key={j.id}
                  draggable={j.canManifest && !onLoad}
                  onDragStart={(e) => { e.dataTransfer.setData("jumperId", String(j.id)); e.dataTransfer.effectAllowed = "move"; }}
                  className={`border-b px-3 py-2 flex items-center gap-2 text-sm select-none ${
                    onLoad
                      ? "bg-gray-100 opacity-50"
                      : j.canManifest
                      ? "bg-white hover:bg-blue-50 cursor-grab active:cursor-grabbing"
                      : "bg-white"
                  }`}
                >
                  <ComplianceBadge
                    hasWaiver={j.hasWaiver}
                    reserveExpired={j.reserveExpired}
                    reservePackDate={j.reserveExpired ? null : "valid"}
                    uspaStatus={j.uspaActive ? "Active" : null}
                    compact
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {j.firstName} {j.lastName}
                      {onLoad && <span className="text-[10px] text-gray-400 ml-1">(on load)</span>}
                    </div>
                    <div className="text-[11px] text-gray-500 flex gap-2">
                      <span>{j.weight} lbs</span>
                      <span>{j.licenseLevel}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <button
                      onClick={() => setBalanceModal(j)}
                      className="text-[10px] leading-tight"
                    >
                      {j.balance > 0 && <div className="text-green-700 font-medium">${(j.balance / 100).toFixed(2)}</div>}
                      {j.jumpBlockRemaining > 0 && <div className="text-blue-700 font-medium">{j.jumpBlockRemaining} blk</div>}
                      {j.balance === 0 && j.jumpBlockRemaining === 0 && <div className="text-gray-400">$0</div>}
                    </button>
                  </div>
                  {j.canManifest && !onLoad && selectedLoadId && editable && (
                    <button
                      onClick={(e) => { e.stopPropagation(); addJumperToLoad(j.id, selectedLoadId); }}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="text-blue-600 hover:text-blue-800 text-lg font-bold shrink-0 px-1"
                      title="Add to selected load"
                    >
                      +
                    </button>
                  )}
                </div>
              );
            })}
            {checkedIn.length === 0 && (
              <div className="text-center py-8 text-gray-400 text-xs px-4">
                No jumpers checked in today.<br />Search above to check someone in.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Balance Modal */}
      {balanceModal && (
        <BalanceModal
          jumper={balanceModal}
          onClose={() => setBalanceModal(null)}
          onAdd={addBalance}
        />
      )}
    </div>
  );
}

function DepartureCountdown({ departureTime, compact }: { departureTime: string; compact?: boolean }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const depMs = new Date(departureTime).getTime();
  const diffMs = depMs - now;
  const isPast = diffMs <= 0;

  const absDiff = Math.abs(diffMs);
  const mins = Math.floor(absDiff / 60000);
  const secs = Math.floor((absDiff % 60000) / 1000);

  const depDate = new Date(departureTime);
  const timeStr = depDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (compact) {
    return (
      <div className={`text-[10px] mt-1 font-mono ${isPast ? "text-red-600 font-bold" : mins <= 5 ? "text-orange-600 font-bold" : "text-gray-600"}`}>
        {isPast ? `LATE ${mins}:${secs.toString().padStart(2, "0")}` : `T-${mins}:${secs.toString().padStart(2, "0")}`} ({timeStr})
      </div>
    );
  }

  return (
    <div className={`mt-1 flex items-center gap-2 text-sm ${isPast ? "text-red-600" : mins <= 5 ? "text-orange-600" : "text-gray-700"}`}>
      <span className="font-mono font-bold text-lg">
        {isPast ? `+${mins}:${secs.toString().padStart(2, "0")}` : `${mins}:${secs.toString().padStart(2, "0")}`}
      </span>
      <span className="text-xs">
        {isPast ? "past departure" : "to departure"} &middot; {timeStr}
      </span>
    </div>
  );
}

function SetDepartureButton({ loadId, onSet, hasExisting }: { loadId: number; onSet: () => void; hasExisting?: boolean }) {
  const [mins, setMins] = useState("20");
  const [show, setShow] = useState(!hasExisting);

  async function set() {
    const m = Number(mins);
    if (!m || m <= 0) return;
    await fetch(`/api/loads/${loadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ departureMinutes: m }),
    });
    setShow(false);
    onSet();
  }

  if (!show) {
    return (
      <button onClick={() => setShow(true)} className="text-[10px] text-blue-600 hover:underline mt-0.5">
        Update departure
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1 mt-1">
      <input
        type="number"
        min="1"
        value={mins}
        onChange={(e) => setMins(e.target.value)}
        className="w-14 border rounded px-1 py-0.5 text-xs text-center"
        autoFocus
      />
      <span className="text-xs text-gray-500">min</span>
      <button onClick={set} className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-0.5 rounded">Set</button>
      {hasExisting && <button onClick={() => setShow(false)} className="text-xs text-gray-400 hover:text-gray-600">&times;</button>}
    </div>
  );
}

function BalanceModal({
  jumper,
  onClose,
  onAdd,
}: {
  jumper: CheckedInJumper;
  onClose: () => void;
  onAdd: (jumperId: number, type: string, amount: number, description?: string) => void;
}) {
  const [mode, setMode] = useState<"cash" | "blocks">("cash");
  const [amount, setAmount] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const val = Number(amount);
    if (!val || val <= 0) return;
    if (mode === "cash") {
      onAdd(jumper.id, "add_cash", val, `Cash deposit $${val.toFixed(2)}`);
    } else {
      onAdd(jumper.id, "add_blocks", val, `Added ${Math.round(val)} jump block(s)`);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-6 w-80" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-lg mb-1">{jumper.firstName} {jumper.lastName}</h3>
        <div className="flex gap-4 text-sm mb-4">
          <div>
            <span className="text-gray-500">Cash:</span>{" "}
            <span className="font-medium text-green-700">${(jumper.balance / 100).toFixed(2)}</span>
          </div>
          <div>
            <span className="text-gray-500">Blocks:</span>{" "}
            <span className="font-medium text-blue-700">{jumper.jumpBlockRemaining}</span>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div className="flex rounded-lg border overflow-hidden">
            <button
              type="button"
              onClick={() => setMode("cash")}
              className={`flex-1 py-2 text-sm font-medium ${mode === "cash" ? "bg-blue-600 text-white" : "bg-gray-50 text-gray-700"}`}
            >
              Add Cash
            </button>
            <button
              type="button"
              onClick={() => setMode("blocks")}
              className={`flex-1 py-2 text-sm font-medium ${mode === "blocks" ? "bg-blue-600 text-white" : "bg-gray-50 text-gray-700"}`}
            >
              Add Blocks
            </button>
          </div>
          <input
            type="number"
            min="0"
            step={mode === "cash" ? "0.01" : "1"}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={mode === "cash" ? "Amount in dollars" : "Number of blocks"}
            className="w-full border rounded-lg px-3 py-2"
            autoFocus
          />
          <div className="flex gap-2">
            <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 text-sm">
              {mode === "cash" ? `Add $${Number(amount || 0).toFixed(2)}` : `Add ${Math.round(Number(amount || 0))} Block(s)`}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border hover:bg-gray-50 text-sm">
              Close
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
