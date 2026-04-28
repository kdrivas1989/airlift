"use client";

import { useState, useEffect, useCallback } from "react";

interface LoadData {
  id: number;
  loadNumber: number;
  aircraft: { tailNumber: string; name: string; slotCount: number };
  slotsUsed: number;
  slotsAvailable: number;
  openSlots: number;
  status: string;
  departureTime: string | null;
  defaultAltitude: number;
  manifest: Array<{ jumper: { id: number; firstName: string; lastName: string } }>;
}

interface MeData {
  id: number;
  name: string;
  balance: number;
  jumpBlockRemaining: number;
  canManifest: boolean;
  isStudent: boolean;
  reason?: string;
}

const JUMP_TYPES = [
  { value: "solo", label: "Solo" },
  { value: "hop_n_pop", label: "Hop-n-Pop" },
  { value: "high_altitude", label: "High Alt" },
  { value: "coach", label: "Coach" },
  { value: "video", label: "Video" },
];

export default function JumpPage() {
  const [loads, setLoads] = useState<LoadData[]>([]);
  const [me, setMe] = useState<MeData | null>(null);
  const [jumpType, setJumpType] = useState("solo");
  const [joining, setJoining] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const refresh = useCallback(async () => {
    const [loadsRes, meRes] = await Promise.all([
      fetch("/api/loads?status=open"),
      fetch("/api/jump/me"),
    ]);
    if (loadsRes.ok) { const d = await loadsRes.json(); setLoads(d.loads || []); }
    if (meRes.ok) { const d = await meRes.json(); setMe(d); }
  }, []);

  useEffect(() => {
    refresh();
    const i = setInterval(refresh, 5000);
    return () => clearInterval(i);
  }, [refresh]);

  async function joinLoad(loadId: number) {
    setJoining(loadId);
    setErr("");
    setMsg("");
    const res = await fetch("/api/jump/manifest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loadId, jumpType }),
    });
    const data = await res.json();
    if (res.ok) {
      setMsg(`You're on Load #${loads.find(l => l.id === loadId)?.loadNumber}!`);
      refresh();
    } else {
      setErr(data.error || "Failed to join load");
    }
    setJoining(null);
  }

  async function leaveLoad(loadId: number) {
    setErr("");
    setMsg("");
    const res = await fetch("/api/jump/manifest", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loadId }),
    });
    if (res.ok) {
      setMsg("Removed from load");
      refresh();
    } else {
      const data = await res.json();
      setErr(data.error || "Failed to leave load");
    }
  }

  const myLoadIds = new Set(
    loads.filter(l => l.manifest.some(m => m.jumper.id === me?.id)).map(l => l.id)
  );

  return (
    <div>
      {/* Account summary */}
      {me && (
        <div className="bg-white rounded-xl border p-4 mb-4">
          <div className="flex items-center justify-between">
            <h1 className="font-bold text-lg">{me.name}</h1>
            <div className="flex gap-3 text-sm">
              {me.balance > 0 && <span className="text-green-700 font-medium">${(me.balance / 100).toFixed(2)}</span>}
              <span className="text-blue-700 font-medium">{me.jumpBlockRemaining} block{me.jumpBlockRemaining !== 1 ? "s" : ""}</span>
            </div>
          </div>
          {me.isStudent && (
            <div className="mt-2 text-sm text-blue-700 bg-blue-50 px-3 py-2 rounded-lg">
              Students are manifested by staff — check in at the manifest desk to get on a load with your instructor.
            </div>
          )}
          {!me.canManifest && !me.isStudent && me.reason && (
            <div className="mt-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{me.reason}</div>
          )}
        </div>
      )}

      {/* Jump type selector */}
      <div className="bg-white rounded-xl border p-4 mb-4">
        <label className="block text-xs text-gray-500 mb-2">Jump Type</label>
        <div className="flex gap-2 flex-wrap">
          {JUMP_TYPES.map(t => (
            <button
              key={t.value}
              onClick={() => setJumpType(t.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition ${
                jumpType === t.value
                  ? "border-blue-500 bg-blue-50 text-blue-800"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      {msg && <div className="mb-4 text-sm text-green-700 bg-green-50 px-4 py-3 rounded-xl">{msg}</div>}
      {err && <div className="mb-4 text-sm text-red-700 bg-red-50 px-4 py-3 rounded-xl">{err}</div>}

      {/* Open loads */}
      <h2 className="font-bold text-sm text-gray-500 uppercase tracking-wide mb-3">Open Loads</h2>
      <div className="space-y-3">
        {loads.filter(l => l.status === "open").map(load => {
          const onThis = myLoadIds.has(load.id);
          const full = load.openSlots <= 0;
          return (
            <div key={load.id} className={`bg-white rounded-xl border p-4 ${onThis ? "border-blue-400 ring-2 ring-blue-100" : ""}`}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="font-bold text-lg">Load #{load.loadNumber}</span>
                  <span className="text-sm text-gray-500 ml-2">{load.aircraft.tailNumber} {load.aircraft.name && `- ${load.aircraft.name}`}</span>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-medium ${load.openSlots <= 0 ? "text-red-600" : load.openSlots <= 3 ? "text-orange-600" : ""}`}>
                    {Math.max(0, load.openSlots)} open
                  </div>
                  <div className="text-[10px] text-gray-500">slots</div>
                </div>
              </div>

              {load.departureTime && <DepartureCountdown departureTime={load.departureTime} />}

              {/* Who's on it */}
              {load.manifest.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2 mb-3">
                  {load.manifest.map(m => (
                    <span key={m.jumper.id} className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                      m.jumper.id === me?.id ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-700"
                    }`}>
                      {m.jumper.firstName} {m.jumper.lastName[0]}.
                    </span>
                  ))}
                </div>
              )}

              {/* Action */}
              {onThis ? (
                <button
                  onClick={() => leaveLoad(load.id)}
                  className="w-full py-2.5 rounded-lg border-2 border-red-200 text-red-700 font-medium text-sm hover:bg-red-50"
                >
                  Leave Load
                </button>
              ) : (
                <button
                  onClick={() => joinLoad(load.id)}
                  disabled={!me?.canManifest || full || joining === load.id}
                  className="w-full py-2.5 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {joining === load.id ? "Joining..." : full ? "Full" : "Join Load"}
                </button>
              )}
            </div>
          );
        })}
        {loads.filter(l => l.status === "open").length === 0 && (
          <div className="text-center py-12 text-gray-400">No open loads right now</div>
        )}
      </div>
    </div>
  );
}

function DepartureCountdown({ departureTime }: { departureTime: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  const diff = new Date(departureTime).getTime() - now;
  const isPast = diff <= 0;
  const abs = Math.abs(diff);
  const mins = Math.floor(abs / 60000);
  const secs = Math.floor((abs % 60000) / 1000);
  const timeStr = new Date(departureTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className={`text-sm font-mono ${isPast ? "text-red-600" : mins <= 5 ? "text-orange-600" : "text-gray-600"}`}>
      {isPast ? `+${mins}:${secs.toString().padStart(2, "0")} past` : `T-${mins}:${secs.toString().padStart(2, "0")}`}
      <span className="text-xs text-gray-500 ml-2">({timeStr})</span>
    </div>
  );
}
