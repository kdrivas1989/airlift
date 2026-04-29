"use client";

import { useState, useEffect, useCallback } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import WeightGauge from "@/components/WeightGauge";
import JumperSearch from "@/components/JumperSearch";
import ComplianceBadge from "@/components/ComplianceBadge";

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

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
  pairedWith: { id: number; firstName: string; lastName: string } | null;
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
  reservedOrganizerSlots: number;
  openSlots: number;
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
  checkinType: string;
  paperworkComplete: boolean;
  personType: string;
}

interface JumpGroup {
  id: number;
  name: string;
  members: Array<{ id: number; firstName: string; lastName: string; weight: number }>;
}

const STATUS_COLORS: Record<string, string> = {
  open: "border-green-400 bg-green-50",
  in_flight: "border-blue-400 bg-blue-50",
  landed: "border-gray-300 bg-gray-50",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_flight: "In Flight",
  landed: "Landed",
};

const JUMP_TYPES = [
  { value: "solo", label: "Solo" },
  { value: "tandem", label: "Tandem" },
  { value: "aff", label: "AFF" },
  { value: "hop_n_pop", label: "Hop-n-Pop" },
  { value: "high_altitude", label: "High Alt" },
  { value: "coach", label: "Coach" },
  { value: "video", label: "Video" },
  { value: "organizer", label: "Organizer" },
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

  const [groups, setGroups] = useState<JumpGroup[]>([]);
  const [showGroupCreate, setShowGroupCreate] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [rightTab, setRightTab] = useState<"jumpers" | "tandems" | "area">("jumpers");
  const [dzLat, setDzLat] = useState<string>("");
  const [dzLng, setDzLng] = useState<string>("");
  const [dzName, setDzName] = useState<string>("");
  const [editingLocation, setEditingLocation] = useState(false);
  const [tandemStandby, setTandemStandby] = useState<CheckedInJumper[]>([]);

  // Auto-timer state
  const [timerMode, setTimerMode] = useState<"auto" | "manual">("auto");
  const [flightTime, setFlightTime] = useState("25");
  const [taxiTime, setTaxiTime] = useState("3");
  const cycleMinutes = Number(flightTime || 0) + Number(taxiTime || 0);

  const fetchLoads = useCallback(() => {
    fetch("/api/loads?status=open,in_flight,landed")
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

  const fetchGroups = useCallback(() => {
    fetch("/api/groups").then((r) => r.json()).then((data) => setGroups(data.groups || [])).catch(() => {});
  }, []);

  useEffect(() => {
    fetchLoads();
    fetchCheckedIn();
    fetchGroups();
    fetch("/api/aircraft").then((r) => r.json()).then((data) => setAircraft(data.aircraft || []));
    fetch("/api/settings").then((r) => r.json()).then((data) => {
      if (data.dz_lat) setDzLat(data.dz_lat);
      if (data.dz_lng) setDzLng(data.dz_lng);
      if (data.dz_name) setDzName(data.dz_name);
    });
    const interval = setInterval(() => { fetchLoads(); fetchCheckedIn(); }, 5000);
    return () => clearInterval(interval);
  }, [fetchLoads, fetchCheckedIn]);

  // Auto-select first open load
  useEffect(() => {
    if (selectedLoadId === null && loads.length > 0) {
      const open = loads.find((l) => l.status === "open");
      if (open) setSelectedLoadId(open.id);
      else setSelectedLoadId(loads[0].id);
    }
  }, [loads, selectedLoadId]);

  const selectedLoad = loads.find((l) => l.id === selectedLoadId) || null;
  const editable = selectedLoad?.status === "open";

  // Check which jumpers are already on any active load
  const manifestedJumperIds = new Set(
    loads.flatMap((l) =>
      l.status === "open" ? l.manifest.map((m) => m.jumper.id) : []
    )
  );

  async function createLoad(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);

    let departureMinutes = 0;
    if (timerMode === "auto") {
      // Find the last load's departure time and add cycleMinutes
      const openLoads = loads.filter((l) => l.status === "open");
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

  async function addGroupToLoad(group: JumpGroup, loadId: number) {
    setError("");
    const errors: string[] = [];
    for (const m of group.members) {
      if (manifestedJumperIds.has(m.id)) continue; // skip already on a load
      const res = await fetch(`/api/loads/${loadId}/manifest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jumperId: m.id, jumpType }),
      });
      if (!res.ok) {
        const data = await res.json();
        errors.push(`${m.firstName}: ${data.error}`);
      }
    }
    if (errors.length > 0) setError(errors.join(", "));
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

  async function changeStatus(newStatus: string) {
    if (!selectedLoad) return;
    if (newStatus === selectedLoad.status) return;
    if (newStatus === "in_flight" && !confirm("Set to In Flight? Manifest will be locked.")) return;

    // Auto-advance earlier loads if needed
    const statusOrder = ["open", "in_flight", "landed"];
    const newIdx = statusOrder.indexOf(newStatus);
    const sortedLoads = [...loads].sort((a, b) => a.loadNumber - b.loadNumber);

    // All loads with lower load numbers should be at least at this status or higher
    for (const l of sortedLoads) {
      if (l.loadNumber >= selectedLoad.loadNumber) break;
      const lIdx = statusOrder.indexOf(l.status);
      if (lIdx < newIdx) {
        // Auto-advance this earlier load
        await fetch(`/api/loads/${l.id}/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });
      }
    }

    // Now set the selected load's status — may need to step through transitions
    const currentIdx = statusOrder.indexOf(selectedLoad.status);
    if (newIdx > currentIdx) {
      // Step forward through each status
      for (let i = currentIdx + 1; i <= newIdx; i++) {
        const res = await fetch(`/api/loads/${selectedLoad.id}/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: statusOrder[i] }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error); return; }
      }
    }
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
    <div className="flex flex-col h-full">
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
                <div className="w-1/2">
                  <label className="text-[10px] text-gray-500">Fuel (lbs)</label>
                  <input name="fuelWeight" type="number" min="0" defaultValue="500" className="w-full border rounded px-2 py-1 text-sm" />
                </div>
                <div className="w-1/2">
                  <label className="text-[10px] text-gray-500">Altitude (ft)</label>
                  <input name="defaultAltitude" type="number" min="3000" defaultValue="13500" className="w-full border rounded px-2 py-1 text-sm" />
                </div>
              </div>
              {timerMode === "manual" && (
                <div>
                  <label className="text-[10px] text-gray-500">Minutes to departure</label>
                  <input name="departureMinutes" type="number" min="0" defaultValue="20" className="w-full border rounded px-2 py-1 text-sm" />
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
                className={`w-full text-left rounded-xl border p-3 transition-all text-sm shadow-sm hover:shadow ${
                  selectedLoadId === load.id
                    ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200 shadow-md"
                    : dragOverLoad === load.id
                    ? "border-blue-400 bg-blue-50 shadow-md"
                    : load.status === "open" ? "border-green-200 bg-white hover:border-green-300"
                    : load.status === "in_flight" ? "border-blue-200 bg-blue-50/50 hover:border-blue-300"
                    : "border-gray-200 bg-gray-50 hover:border-gray-300"
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="font-bold text-sm">Load #{load.loadNumber}</span>
                    <span className="text-gray-500">{load.aircraft.tailNumber}</span>
                    <span className="text-blue-700 font-medium">P:{Math.max(0, load.openSlots)}</span>
                    {load.reservedOrganizerSlots > 0 && (
                      <span className="text-emerald-700 font-medium">R:{load.reservedOrganizerSlots - load.manifest.filter(m => m.jumpType === "organizer").length}</span>
                    )}
                    {load.slotsAvailable === 0 && <span className="text-red-600 font-bold">FULL</span>}
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    load.status === "open" ? "bg-green-100 text-green-700 ring-1 ring-green-200" :
                    load.status === "in_flight" ? "bg-blue-100 text-blue-700 ring-1 ring-blue-200" :
                    "bg-gray-100 text-gray-600 ring-1 ring-gray-200"
                  }`}>
                    {STATUS_LABELS[load.status]}
                  </span>
                </div>
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
              <div className="p-4 border-b bg-gradient-to-r from-white to-gray-50 flex items-center justify-between shadow-sm">
                <div>
                  <h1 className="text-xl font-bold">
                    Load #{selectedLoad.loadNumber}
                    <span className="text-sm font-normal text-gray-500 ml-2">
                      {selectedLoad.aircraft.tailNumber} {selectedLoad.aircraft.name && `- ${selectedLoad.aircraft.name}`}
                      &nbsp;&middot;&nbsp;{selectedLoad.currentWeight.toLocaleString()}/{selectedLoad.maxWeight.toLocaleString()} lbs
                    </span>
                  </h1>
                  <div className="flex gap-3 mt-1">
                    <div className={`px-3 py-1 rounded-lg text-xs font-bold ${
                      selectedLoad.openSlots > 0 ? "bg-blue-100 text-blue-800" : "bg-red-100 text-red-800"
                    }`}>
                      Public: {Math.max(0, selectedLoad.openSlots)}
                    </div>
                    {selectedLoad.reservedOrganizerSlots > 0 && (
                      <div className={`px-3 py-1 rounded-lg text-xs font-bold ${
                        (selectedLoad.reservedOrganizerSlots - selectedLoad.manifest.filter(m => m.jumpType === "organizer").length) > 0
                          ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"
                      }`}>
                        Reserved: {selectedLoad.reservedOrganizerSlots - selectedLoad.manifest.filter(m => m.jumpType === "organizer").length}
                      </div>
                    )}
                  </div>
                  {selectedLoad.departureTime && (
                    <DepartureCountdown departureTime={selectedLoad.departureTime} />
                  )}
                  {editable && (
                    <SetDepartureButton loadId={selectedLoad.id} loadNumber={selectedLoad.loadNumber} loads={loads} cycleMinutes={cycleMinutes} onSet={() => fetchLoads()} hasExisting={!!selectedLoad.departureTime} />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedLoad.status}
                    onChange={(e) => changeStatus(e.target.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border-2 cursor-pointer ${
                      selectedLoad.status === "open" ? "bg-green-50 border-green-300 text-green-800" :
                      selectedLoad.status === "in_flight" ? "bg-blue-50 border-blue-300 text-blue-800" :
                      "bg-gray-100 border-gray-300 text-gray-700"
                    }`}
                  >
                    <option value="open">Open</option>
                    <option value="in_flight">In Flight</option>
                    <option value="landed">Landed</option>
                  </select>
                  <button
                    onClick={async () => {
                      if (!confirm(`Delete Load #${selectedLoad.loadNumber}? This will remove all manifest entries.`)) return;
                      const res = await fetch(`/api/loads/${selectedLoad.id}`, { method: "DELETE" });
                      if (res.ok) {
                        setSelectedLoadId(null);
                        fetchLoads();
                      } else {
                        const data = await res.json();
                        setError(data.error || "Failed to delete load");
                      }
                    }}
                    className="px-2 py-1.5 rounded-lg text-xs font-medium border-2 border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                    title="Delete load"
                  >
                    Delete
                  </button>
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
                  <thead className="bg-gray-100/80 border-b sticky top-0 backdrop-blur-sm">
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
                        <td className="px-3 py-2 text-sm font-medium">
                          <div>{entry.jumper.firstName} {entry.jumper.lastName}</div>
                          {(entry.jumpType === "tandem" || entry.jumpType === "coach") && editable ? (
                            <select
                              value={entry.pairedWith?.id || ""}
                              onChange={async (e) => {
                                const val = e.target.value ? Number(e.target.value) : null;
                                await fetch(`/api/loads/${selectedLoad.id}/manifest`, {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ entryId: entry.id, pairedWith: val }),
                                });
                                fetchLoads();
                              }}
                              className={`mt-0.5 text-[10px] border rounded px-1 py-0.5 w-full ${entry.pairedWith ? "border-purple-300 text-purple-700" : "border-red-300 text-red-600"}`}
                            >
                              <option value="">-- assign instructor --</option>
                              {checkedIn.filter(j => (j.personType || "").includes("staff")).map((s) => (
                                <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
                              ))}
                            </select>
                          ) : entry.pairedWith ? (
                            <span className="text-[10px] text-purple-600">w/ {entry.pairedWith.firstName} {entry.pairedWith.lastName[0]}.</span>
                          ) : (entry.jumpType === "tandem" || entry.jumpType === "coach") ? (
                            <span className="text-[10px] text-red-500">no instructor</span>
                          ) : null}
                        </td>
                        <td className="text-center px-3 py-2 text-sm text-gray-600">{entry.jumper.weight}</td>
                        <td className="text-center px-3 py-2 text-sm">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            entry.jumpType === "tandem" ? "bg-purple-100 text-purple-700" :
                            entry.jumpType === "aff" ? "bg-amber-100 text-amber-700" :
                            entry.jumpType === "coach" ? "bg-teal-100 text-teal-700" :
                            entry.jumpType === "hop_n_pop" ? "bg-orange-100 text-orange-700" :
                            entry.jumpType === "organizer" ? "bg-emerald-100 text-emerald-700" :
                            "bg-gray-100 text-gray-700"
                          }`}>
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

        {/* RIGHT COLUMN — Groups + Today's Jumpers */}
        <div className="w-96 border-l bg-gray-50 flex flex-col overflow-hidden">
          {/* Right panel tabs */}
          <div className="flex border-b">
            <button onClick={() => setRightTab("jumpers")}
              className={`flex-1 py-2 text-xs font-medium ${rightTab === "jumpers" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500"}`}>
              Jumpers
            </button>
            <button onClick={() => setRightTab("tandems")}
              className={`flex-1 py-2 text-xs font-medium relative ${rightTab === "tandems" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500"}`}>
              Tandems
              {checkedIn.filter(j => j.checkinType === "tandem" && !manifestedJumperIds.has(j.id)).length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center">
                  {checkedIn.filter(j => j.checkinType === "tandem" && !manifestedJumperIds.has(j.id)).length}
                </span>
              )}
            </button>
            <button onClick={() => setRightTab("area")}
              className={`flex-1 py-2 text-xs font-medium ${rightTab === "area" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500"}`}>
              Area
            </button>
          </div>

          {rightTab === "jumpers" && (
            <>
          {/* Groups */}
          <div className="border-b">
            <div className="p-2 flex items-center justify-between">
              <h2 className="font-bold text-xs text-gray-600 uppercase">Groups</h2>
              <button onClick={() => setShowGroupCreate(!showGroupCreate)} className="text-blue-600 text-xs hover:underline">
                {showGroupCreate ? "Cancel" : "+ New"}
              </button>
            </div>
            {showGroupCreate && (
              <GroupCreateForm
                checkedIn={checkedIn}
                onCreated={() => { fetchGroups(); setShowGroupCreate(false); }}
              />
            )}
            {groups.length > 0 && (
              <div className="max-h-40 overflow-y-auto">
                {groups.map((g) => (
                  <div key={g.id} className="px-3 py-2 border-t text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{g.name} ({g.members.length})</span>
                      <div className="flex gap-1">
                        {selectedLoadId && editable && (
                          <button
                            onClick={() => addGroupToLoad(g, selectedLoadId)}
                            className="text-blue-600 hover:underline text-[10px]"
                          >
                            Add to load
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {g.members.map((m) => {
                        const onLoad = manifestedJumperIds.has(m.id);
                        return (
                          <span key={m.id} className={`px-1.5 py-0.5 rounded text-[10px] ${onLoad ? "bg-gray-200 text-gray-500 line-through" : "bg-blue-100 text-blue-800"}`}>
                            {m.firstName} {m.lastName[0]}.
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Today's jumpers */}
          <div className="p-3 border-b">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-sm">Jumpers</h2>
              <button onClick={() => setShowQuickAdd(!showQuickAdd)} className="text-blue-600 text-xs hover:underline">
                {showQuickAdd ? "Cancel" : "+ New"}
              </button>
            </div>
            {showQuickAdd && (
              <QuickAddJumper onCreated={(id) => {
                setShowQuickAdd(false);
                checkInJumper({ id } as { id: number });
                fetchCheckedIn();
              }} />
            )}
            {!showQuickAdd && (
              <JumperSearch
                onSelect={(j) => { checkInJumper(j); }}
                placeholder="Check in jumper..."
              />
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {[...checkedIn].filter(j => j.checkinType !== "tandem" && !((j as Record<string, unknown>).ratings as string || "").includes("tandem")).sort((a, b) => `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`)).map((j) => {
              const onLoad = manifestedJumperIds.has(j.id);
              return (
                <div
                  key={j.id}
                  draggable={j.canManifest && !onLoad}
                  onDragStart={(e) => { e.dataTransfer.setData("jumperId", String(j.id)); e.dataTransfer.effectAllowed = "move"; }}
                  className={`border-b px-3 py-2 flex items-center gap-2 text-sm ${
                    onLoad
                      ? "bg-gray-100 opacity-50"
                      : j.canManifest
                      ? "bg-white hover:bg-blue-50 cursor-grab active:cursor-grabbing"
                      : "bg-white"
                  }`}
                >
                  {/* Drag handle */}
                  {j.canManifest && !onLoad && (
                    <span className="text-gray-300 shrink-0 cursor-grab" title="Drag to load">&#x2630;</span>
                  )}
                  <ComplianceBadge
                    hasWaiver={j.hasWaiver}
                    reserveExpired={j.reserveExpired}
                    reservePackDate={j.reserveExpired ? null : "valid"}
                    uspaStatus={j.uspaActive ? "Active" : null}
                    compact
                  />
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onDoubleClick={(e) => { e.stopPropagation(); setBalanceModal(j); }}
                    draggable={false}
                  >
                    <div className="font-medium truncate pointer-events-none">
                      {j.firstName} {j.lastName}
                      {onLoad && <span className="text-[10px] text-gray-400 ml-1">(on load)</span>}
                    </div>
                    <div className="text-[11px] text-gray-500 flex gap-2 pointer-events-none">
                      <span>{j.weight} lbs</span>
                      <span>{j.licenseLevel}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0" draggable={false}>
                    <button
                      onClick={() => setBalanceModal(j)}
                      className="text-[10px] leading-tight"
                      draggable={false}
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
                      draggable={false}
                      className="text-blue-600 hover:text-blue-800 text-lg font-bold shrink-0 px-1"
                      title="Add to selected load"
                    >
                      +
                    </button>
                  )}
                </div>
              );
            })}
            {checkedIn.filter(j => j.checkinType !== "tandem" && !((j as Record<string, unknown>).ratings as string || "").includes("tandem")).length === 0 && (
              <div className="text-center py-8 text-gray-400 text-xs px-4">
                No jumpers checked in today.<br />Search above to check someone in.
              </div>
            )}
          </div>
            </>
          )}

          {rightTab === "tandems" && (
            <>
              <div className="p-3 border-b">
                <h2 className="font-bold text-sm mb-2">Tandem Check-In</h2>
                <JumperSearch
                  onSelect={(j) => {
                    fetch("/api/checkin", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ jumperId: j.id, checkinType: "tandem" }),
                    }).then(() => fetchCheckedIn());
                  }}
                  placeholder="Search tandem customer..."
                />
              </div>
              <div className="flex-1 overflow-y-auto">
                {/* Standby — paperwork complete, waiting for instructor */}
                {checkedIn.filter(j => j.checkinType === "tandem").length > 0 ? (
                  [...checkedIn]
                    .filter(j => j.checkinType === "tandem")
                    .sort((a, b) => `${a.lastName}`.localeCompare(`${b.lastName}`))
                    .map((j) => {
                      const onLoad = manifestedJumperIds.has(j.id);
                      return (
                        <div key={j.id} className={`border-b px-3 py-2 text-sm ${onLoad ? "bg-gray-100 opacity-50" : "bg-white"}`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-medium">{j.firstName} {j.lastName}</span>
                              <span className="text-xs text-gray-500 ml-2">{j.weight} lbs</span>
                              {onLoad && <span className="text-[10px] text-gray-400 ml-1">(on load)</span>}
                            </div>
                            <div className="flex items-center gap-2">
                              {!j.paperworkComplete && !onLoad && (
                                <button
                                  onClick={() => {
                                    fetch("/api/checkin", {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ jumperId: j.id, checkinType: "tandem", paperworkComplete: true }),
                                    }).then(() => fetchCheckedIn());
                                  }}
                                  className="text-[10px] bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded hover:bg-yellow-200"
                                >
                                  Confirm Paperwork
                                </button>
                              )}
                              {j.paperworkComplete && !onLoad && (
                                <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded">Ready</span>
                              )}
                              {j.paperworkComplete && !onLoad && editable && selectedLoadId && (
                                <button
                                  onClick={() => addJumperToLoad(j.id, selectedLoadId)}
                                  className="text-blue-600 hover:text-blue-800 text-lg font-bold"
                                >+</button>
                              )}
                            </div>
                          </div>
                          {j.paperworkComplete && !onLoad && (
                            <select
                              defaultValue=""
                              onChange={async (e) => {
                                if (!e.target.value || !selectedLoadId || !editable) return;
                                const tiId = Number(e.target.value);
                                await addJumperToLoad(j.id, selectedLoadId);
                                // Patch the manifest entry to set paired_with
                                const loadData = loads.find(l => l.id === selectedLoadId);
                                if (loadData) {
                                  const entry = loadData.manifest.find(m => m.jumper.id === j.id);
                                  if (entry) {
                                    await fetch(`/api/loads/${selectedLoadId}/manifest`, {
                                      method: "PATCH",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ entryId: entry.id, pairedWith: tiId }),
                                    });
                                  }
                                }
                                fetchLoads();
                                fetchCheckedIn();
                              }}
                              className="mt-1 w-full text-[11px] border border-orange-300 text-orange-700 rounded px-1 py-0.5"
                            >
                              <option value="">Assign instructor...</option>
                              {checkedIn.filter(s => (s.personType || "").includes("staff") && !manifestedJumperIds.has(s.id)).map(s => (
                                <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      );
                    })
                ) : (
                  <div className="text-center py-8 text-gray-400 text-xs px-4">
                    No tandem customers checked in.<br />Search above to check in a tandem.
                  </div>
                )}
              </div>
            </>
          )}

          {rightTab === "area" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {dzLat && dzLng && !editingLocation ? (
                <>
                  <div className="p-2 border-b flex items-center justify-between">
                    <span className="text-xs text-gray-600 truncate">{dzName || "Dropzone"}</span>
                    <button onClick={() => setEditingLocation(true)} className="text-[10px] text-blue-600 hover:underline">Edit</button>
                  </div>
                  <div className="flex-1">
                    <iframe
                      width="100%"
                      height="100%"
                      style={{ border: 0 }}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      src={`https://www.google.com/maps/embed/v1/view?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || ""}&center=${dzLat},${dzLng}&zoom=17&maptype=satellite`}
                    />
                  </div>
                </>
              ) : (
                <div className="p-4 space-y-3">
                  <p className="text-xs text-gray-600">Set your dropzone location for the satellite area view.</p>
                  <div>
                    <label className="text-[10px] text-gray-500">DZ Name</label>
                    <input type="text" value={dzName} onChange={(e) => setDzName(e.target.value)}
                      placeholder="e.g. Skydive Orange" className="w-full border rounded px-2 py-1 text-sm" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500">Latitude</label>
                    <input type="text" value={dzLat} onChange={(e) => setDzLat(e.target.value)}
                      placeholder="e.g. 38.2466" className="w-full border rounded px-2 py-1 text-sm" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500">Longitude</label>
                    <input type="text" value={dzLng} onChange={(e) => setDzLng(e.target.value)}
                      placeholder="e.g. -78.0577" className="w-full border rounded px-2 py-1 text-sm" />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (!dzLat || !dzLng) return;
                        fetch("/api/settings", {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ dz_lat: dzLat, dz_lng: dzLng, dz_name: dzName }),
                        }).then(() => setEditingLocation(false));
                      }}
                      className="bg-blue-600 text-white text-xs px-3 py-1 rounded hover:bg-blue-700"
                    >Save</button>
                    {dzLat && dzLng && (
                      <button onClick={() => setEditingLocation(false)} className="text-xs px-3 py-1 rounded border hover:bg-gray-50">Cancel</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
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

function SetDepartureButton({ loadId, loadNumber, loads, cycleMinutes, onSet, hasExisting }: {
  loadId: number; loadNumber: number; loads: LoadData[]; cycleMinutes: number;
  onSet: () => void; hasExisting?: boolean;
}) {
  const [mins, setMins] = useState("20");
  const [show, setShow] = useState(!hasExisting);

  async function set() {
    const m = Number(mins);
    if (!m || m <= 0) return;

    // Set this load's departure
    const newDepTime = new Date(Date.now() + m * 60 * 1000);
    await fetch(`/api/loads/${loadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ departureMinutes: m }),
    });

    // Cascade to all later loads
    if (cycleMinutes > 0) {
      const laterLoads = loads
        .filter((l) => l.loadNumber > loadNumber && l.status === "open")
        .sort((a, b) => a.loadNumber - b.loadNumber);

      let prevDep = newDepTime.getTime();
      for (const l of laterLoads) {
        const nextDep = prevDep + cycleMinutes * 60 * 1000;
        const minsFromNow = Math.max(1, Math.round((nextDep - Date.now()) / 60000));
        await fetch(`/api/loads/${l.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ departureMinutes: minsFromNow }),
        });
        prevDep = nextDep;
      }
    }

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

function GroupCreateForm({ checkedIn, onCreated }: { checkedIn: CheckedInJumper[]; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");

  const filtered = search.length >= 1
    ? checkedIn.filter((j) => `${j.firstName} ${j.lastName}`.toLowerCase().includes(search.toLowerCase()))
    : checkedIn;

  async function create() {
    if (!name.trim() || selected.size === 0) return;
    await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), memberIds: Array.from(selected) }),
    });
    onCreated();
  }

  return (
    <div className="px-3 pb-3 space-y-2">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name..."
        className="w-full border rounded px-2 py-1 text-xs" autoFocus />
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search jumpers..."
        className="w-full border rounded px-2 py-1 text-xs" />
      <div className="max-h-32 overflow-y-auto border rounded">
        {filtered.map((j) => (
          <label key={j.id} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 text-xs cursor-pointer">
            <input type="checkbox" checked={selected.has(j.id)}
              onChange={(e) => { const s = new Set(selected); e.target.checked ? s.add(j.id) : s.delete(j.id); setSelected(s); }}
              className="rounded border-gray-300" />
            {j.firstName} {j.lastName}
          </label>
        ))}
        {filtered.length === 0 && <div className="px-2 py-2 text-xs text-gray-400">Check in jumpers first</div>}
      </div>
      <button onClick={create} disabled={!name.trim() || selected.size === 0}
        className="w-full bg-blue-600 text-white text-xs py-1 rounded hover:bg-blue-700 disabled:opacity-50">
        Create Group ({selected.size})
      </button>
    </div>
  );
}

function QuickAddJumper({ onCreated }: { onCreated: (id: number) => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: form.get("firstName"),
        lastName: form.get("lastName"),
        email: form.get("email"),
        password: form.get("password") || "temp1234",
        dateOfBirth: "1990-01-01",
        weight: Number(form.get("weight")) || 180,
        licenseLevel: "unknown",
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error); return; }
    onCreated(data.jumperId);
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      {error && <div className="text-red-600 text-xs">{error}</div>}
      <div className="flex gap-2">
        <input name="firstName" required placeholder="First" className="flex-1 border rounded px-2 py-1 text-xs" />
        <input name="lastName" required placeholder="Last" className="flex-1 border rounded px-2 py-1 text-xs" />
      </div>
      <input name="email" type="email" required placeholder="Email" className="w-full border rounded px-2 py-1 text-xs" />
      <div className="flex gap-2">
        <input name="weight" type="number" placeholder="Weight lbs" defaultValue="180" className="flex-1 border rounded px-2 py-1 text-xs" />
        <input name="password" type="password" placeholder="Password (opt)" className="flex-1 border rounded px-2 py-1 text-xs" />
      </div>
      <button type="submit" disabled={saving}
        className="w-full bg-blue-600 text-white text-xs py-1.5 rounded hover:bg-blue-700 disabled:opacity-50">
        {saving ? "Adding..." : "Add & Check In"}
      </button>
    </form>
  );
}

const JUMP_PACKAGES = [
  { blocks: 1, price: 28, label: "1 Jump" },
  { blocks: 5, price: 130, label: "5 Pack" },
  { blocks: 10, price: 250, label: "10 Pack" },
  { blocks: 20, price: 480, label: "20 Pack" },
];

function BalanceModal({
  jumper,
  onClose,
  onAdd,
}: {
  jumper: CheckedInJumper;
  onClose: () => void;
  onAdd: (jumperId: number, type: string, amount: number, description?: string) => void;
}) {
  const [tab, setTab] = useState<"packages" | "card" | "cash" | "blocks">("packages");
  const [amount, setAmount] = useState("");
  const [msg, setMsg] = useState("");
  const [cardAmount, setCardAmount] = useState("");
  const [cardDesc, setCardDesc] = useState("Account deposit");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [creatingIntent, setCreatingIntent] = useState(false);

  function addCash(e: React.FormEvent) {
    e.preventDefault();
    const val = Number(amount);
    if (!val || val <= 0) return;
    onAdd(jumper.id, "add_cash", val, `Cash deposit $${val.toFixed(2)}`);
    setMsg(`Added $${val.toFixed(2)}`);
    setAmount("");
  }

  function addBlocks(e: React.FormEvent) {
    e.preventDefault();
    const val = Number(amount);
    if (!val || val <= 0) return;
    onAdd(jumper.id, "add_blocks", val, `Added ${Math.round(val)} jump block(s)`);
    setMsg(`Added ${Math.round(val)} block(s)`);
    setAmount("");
  }

  function buyPackage(pkg: typeof JUMP_PACKAGES[0]) {
    onAdd(jumper.id, "add_blocks", pkg.blocks, `${pkg.label} ($${pkg.price})`);
    setMsg(`${pkg.label} added — ${pkg.blocks} jump(s)`);
  }

  async function startCardPayment() {
    const base = Number(cardAmount);
    const fee = Math.ceil(base * 3) / 100;
    const total = base + fee;
    const cents = Math.round(total * 100);
    if (!cents || cents < 50) return;
    setCreatingIntent(true);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: cents, jumperId: jumper.id, description: cardDesc }),
      });
      const data = await res.json();
      if (data.clientSecret) {
        setClientSecret(data.clientSecret);
      } else {
        setMsg(data.error || "Failed to create payment");
      }
    } catch {
      setMsg("Payment setup failed");
    }
    setCreatingIntent(false);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-5 w-96" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-lg">{jumper.firstName} {jumper.lastName}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
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

        {/* Tabs */}
        <div className="flex rounded-lg border overflow-hidden mb-4">
          <button onClick={() => { setTab("packages"); setClientSecret(null); }}
            className={`flex-1 py-1.5 text-xs font-medium ${tab === "packages" ? "bg-blue-600 text-white" : "bg-gray-50 text-gray-700"}`}>
            Packages
          </button>
          <button onClick={() => { setTab("card"); setClientSecret(null); }}
            className={`flex-1 py-1.5 text-xs font-medium ${tab === "card" ? "bg-blue-600 text-white" : "bg-gray-50 text-gray-700"}`}>
            Card
          </button>
          <button onClick={() => { setTab("cash"); setClientSecret(null); }}
            className={`flex-1 py-1.5 text-xs font-medium ${tab === "cash" ? "bg-blue-600 text-white" : "bg-gray-50 text-gray-700"}`}>
            Cash
          </button>
          <button onClick={() => { setTab("blocks"); setClientSecret(null); }}
            className={`flex-1 py-1.5 text-xs font-medium ${tab === "blocks" ? "bg-blue-600 text-white" : "bg-gray-50 text-gray-700"}`}>
            Blocks
          </button>
        </div>

        {tab === "packages" && (
          <div className="grid grid-cols-2 gap-2">
            {JUMP_PACKAGES.map((pkg) => (
              <button
                key={pkg.blocks}
                onClick={() => buyPackage(pkg)}
                className="border-2 border-blue-200 rounded-lg p-3 text-left hover:border-blue-500 hover:bg-blue-50 transition"
              >
                <div className="font-bold text-blue-800">{pkg.label}</div>
                <div className="text-xs text-gray-600">${pkg.price} &middot; {pkg.blocks} jump{pkg.blocks > 1 ? "s" : ""}</div>
                {pkg.blocks > 1 && <div className="text-[10px] text-green-600 font-medium">${(pkg.price / pkg.blocks).toFixed(2)}/jump</div>}
              </button>
            ))}
          </div>
        )}

        {tab === "card" && !clientSecret && (() => {
          const base = Number(cardAmount || 0);
          const fee = Math.ceil(base * 3) / 100;
          const total = base + fee;
          return (
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Amount (before CC fee)</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-400">$</span>
                <input type="number" min="0.50" step="0.01" value={cardAmount} onChange={(e) => setCardAmount(e.target.value)}
                  placeholder="0.00" className="w-full border rounded-lg pl-7 pr-3 py-2" autoFocus />
              </div>
            </div>
            {base > 0 && (
              <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs space-y-1">
                <div className="flex justify-between"><span className="text-gray-500">Amount</span><span>${base.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">3% CC fee</span><span>${fee.toFixed(2)}</span></div>
                <div className="flex justify-between font-bold border-t pt-1"><span>Card total</span><span>${total.toFixed(2)}</span></div>
                <div className="flex justify-between text-green-700"><span>Credits to account</span><span>${base.toFixed(2)}</span></div>
              </div>
            )}
            <input type="text" value={cardDesc} onChange={(e) => setCardDesc(e.target.value)}
              placeholder="Description" className="w-full border rounded-lg px-3 py-2 text-sm" />
            <button
              onClick={startCardPayment}
              disabled={creatingIntent || !cardAmount || Number(cardAmount) < 0.5}
              className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 text-sm disabled:opacity-50"
            >
              {creatingIntent ? "Setting up..." : `Charge $${total.toFixed(2)}`}
            </button>
          </div>
          );
        })()}

        {tab === "card" && clientSecret && stripePromise && (
          <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "stripe" } }}>
            <CardPaymentForm
              amountCents={Math.round((Number(cardAmount) + Math.ceil(Number(cardAmount) * 3) / 100) * 100)}
              baseCents={Math.round(Number(cardAmount) * 100)}
              jumperId={jumper.id}
              description={cardDesc}
              onSuccess={(baseCents) => {
                onAdd(jumper.id, "add_cash", baseCents / 100, `Card payment $${(baseCents / 100).toFixed(2)}`);
                setMsg(`Charged card — $${(baseCents / 100).toFixed(2)} credited to account`);
                setClientSecret(null);
                setCardAmount("");
              }}
              onError={(err) => setMsg(err)}
            />
          </Elements>
        )}

        {tab === "cash" && (
          <form onSubmit={addCash} className="space-y-3">
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-400">$</span>
              <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00" className="w-full border rounded-lg pl-7 pr-3 py-2" autoFocus />
            </div>
            <button type="submit" className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 text-sm">
              Add ${Number(amount || 0).toFixed(2)}
            </button>
          </form>
        )}

        {tab === "blocks" && (
          <form onSubmit={addBlocks} className="space-y-3">
            <input type="number" min="1" step="1" value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder="Number of blocks" className="w-full border rounded-lg px-3 py-2" autoFocus />
            <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 text-sm">
              Add {Math.round(Number(amount || 0))} Block(s)
            </button>
          </form>
        )}

        {msg && <div className="mt-3 text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">{msg}</div>}
      </div>
    </div>
  );
}

function CardPaymentForm({
  amountCents,
  baseCents,
  jumperId,
  description,
  onSuccess,
  onError,
}: {
  amountCents: number;
  baseCents: number;
  jumperId: number;
  description: string;
  onSuccess: (baseCents: number) => void;
  onError: (msg: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);

    const result = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (result.error) {
      onError(result.error.message || "Payment failed");
    } else if (result.paymentIntent?.status === "succeeded") {
      // Log the CC fee as a separate transaction
      const feeCents = amountCents - baseCents;
      if (feeCents > 0) {
        await fetch(`/api/jumpers/${jumperId}/balance`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "cc_fee", amount: feeCents / 100, description: `3% CC fee on $${(baseCents / 100).toFixed(2)}` }),
        });
      }
      onSuccess(baseCents);
    }
    setProcessing(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <PaymentElement />
      <button
        type="submit"
        disabled={!stripe || processing}
        className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 text-sm disabled:opacity-50"
      >
        {processing ? "Processing..." : `Pay $${(amountCents / 100).toFixed(2)}`}
      </button>
    </form>
  );
}
