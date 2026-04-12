"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface UserInfo {
  staffId: number;
  email: string;
  name: string;
  role: string;
  isStaff: boolean;
}

interface LoadEntry {
  loadId: number;
  loadNumber: number;
  jumpType: string;
  altitude: number;
  status: string;
  date: string;
  departureTime: string | null;
  aircraftName: string;
}

interface BalanceInfo {
  balance: number;
  jumpBlockRemaining: number;
}

export default function MyPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [currentLoads, setCurrentLoads] = useState<LoadEntry[]>([]);
  const [jumpHistory, setJumpHistory] = useState<LoadEntry[]>([]);
  const [balanceInfo, setBalanceInfo] = useState<BalanceInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => {
        if (r.status === 401) { router.push("/login"); return null; }
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        setUser(data);
        // Fetch my loads and balance
        fetch(`/api/my`).then((r) => r.json()).then((d) => {
          setCurrentLoads(d.currentLoads || []);
          setJumpHistory(d.jumpHistory || []);
          setBalanceInfo(d.balance || null);
          setLoading(false);
        });
      })
      .catch(() => router.push("/login"));
  }, [router]);

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-gray-900 text-white">
        <div className="max-w-3xl mx-auto px-4 flex items-center justify-between h-14">
          <span className="font-bold text-lg">AirLIFT</span>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">{user.name}</span>
            {user.isStaff && (
              <button onClick={() => router.push("/manifest")} className="text-xs text-blue-400 hover:text-white">Staff View</button>
            )}
            <button onClick={async () => { await fetch("/api/auth", { method: "DELETE" }); router.push("/login"); }}
              className="text-sm text-gray-400 hover:text-white">Logout</button>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Balance */}
        {balanceInfo && (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border p-5">
              <div className="text-sm text-gray-500 mb-1">Cash Balance</div>
              <div className="text-3xl font-bold text-green-700">${(balanceInfo.balance / 100).toFixed(2)}</div>
            </div>
            <div className="bg-white rounded-xl border p-5">
              <div className="text-sm text-gray-500 mb-1">Jump Blocks</div>
              <div className="text-3xl font-bold text-blue-700">{balanceInfo.jumpBlockRemaining}</div>
            </div>
          </div>
        )}

        {/* Current Loads */}
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-5 py-3 border-b bg-gray-50">
            <h2 className="font-semibold">My Current Loads</h2>
          </div>
          {currentLoads.length > 0 ? (
            <div className="divide-y">
              {currentLoads.map((l) => (
                <div key={l.loadId} className="px-5 py-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium">Load #{l.loadNumber}</div>
                    <div className="text-sm text-gray-500">{l.aircraftName} &middot; {l.jumpType} &middot; {(l.altitude / 1000).toFixed(1)}k ft</div>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      l.status === "open" ? "bg-green-100 text-green-800" :
                      l.status === "boarding" ? "bg-yellow-100 text-yellow-800" :
                      l.status === "in_flight" ? "bg-blue-100 text-blue-800" :
                      "bg-gray-100 text-gray-700"
                    }`}>{l.status.replace("_", " ")}</span>
                    {l.departureTime && (
                      <div className="text-xs text-gray-500 mt-1">
                        Departs {new Date(l.departureTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 py-8 text-center text-gray-400 text-sm">You&apos;re not on any active loads</div>
          )}
        </div>

        {/* Jump History */}
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-5 py-3 border-b bg-gray-50">
            <h2 className="font-semibold">Jump History</h2>
          </div>
          {jumpHistory.length > 0 ? (
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-5 py-2 text-xs font-medium text-gray-600">Date</th>
                  <th className="text-left px-5 py-2 text-xs font-medium text-gray-600">Load</th>
                  <th className="text-center px-5 py-2 text-xs font-medium text-gray-600">Type</th>
                  <th className="text-center px-5 py-2 text-xs font-medium text-gray-600">Altitude</th>
                </tr>
              </thead>
              <tbody>
                {jumpHistory.map((j, i) => (
                  <tr key={i} className="border-b">
                    <td className="px-5 py-2 text-sm">{new Date(j.date).toLocaleDateString()}</td>
                    <td className="px-5 py-2 text-sm">#{j.loadNumber}</td>
                    <td className="px-5 py-2 text-center text-sm">{j.jumpType}</td>
                    <td className="px-5 py-2 text-center text-sm">{(j.altitude / 1000).toFixed(1)}k</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="px-5 py-8 text-center text-gray-400 text-sm">No jumps yet</div>
          )}
        </div>
      </div>
    </div>
  );
}
