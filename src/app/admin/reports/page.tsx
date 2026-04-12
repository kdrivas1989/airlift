"use client";

import { useState, useEffect } from "react";

type ReportTab = "revenue" | "loads" | "jumpers";

export default function ReportsPage() {
  const [tab, setTab] = useState<ReportTab>("revenue");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({ type: tab });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    fetch(`/api/reports?${params}`).then((r) => r.json()).then(setData);
  }, [tab, from, to]);

  function exportCSV() {
    const params = new URLSearchParams({ type: tab, format: "csv" });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    window.location.href = `/api/reports?${params}`;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Reports</h1>
        <button onClick={exportCSV} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm">
          Export CSV
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        {(["revenue", "loads", "jumpers"] as ReportTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              tab === t ? "bg-white shadow text-gray-900" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Date Range */}
      <div className="flex gap-4 mb-6">
        <div>
          <label className="block text-sm text-gray-600 mb-1">From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>

      {/* Revenue Tab */}
      {tab === "revenue" && data && (
        <div className="space-y-4">
          {(data as { summary?: { total: number; byJumpType: Record<string, number> } }).summary && (
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-white rounded-xl border p-4">
                <div className="text-sm text-gray-600">Total Revenue</div>
                <div className="text-3xl font-bold">
                  ${(((data as { summary: { total: number } }).summary.total) / 100).toFixed(2)}
                </div>
              </div>
              <div className="bg-white rounded-xl border p-4">
                <div className="text-sm text-gray-600 mb-2">By Jump Type</div>
                {Object.entries((data as { summary: { byJumpType: Record<string, number> } }).summary.byJumpType).map(([type, total]) => (
                  <div key={type} className="flex justify-between text-sm">
                    <span className="text-gray-600">{type}</span>
                    <span className="font-medium">${((total as number) / 100).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Date</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-gray-700">Loads</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {((data as { daily?: Array<{ date: string; load_count: number; total: number }> }).daily || []).map((d) => (
                  <tr key={d.date} className="border-b">
                    <td className="px-4 py-3">{d.date}</td>
                    <td className="px-4 py-3 text-center">{d.load_count}</td>
                    <td className="px-4 py-3 text-right font-medium">${(d.total / 100).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Loads Tab */}
      {tab === "loads" && data && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Load #</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Aircraft</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-700">Jumpers</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-700">Status</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">Revenue</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">Date</th>
              </tr>
            </thead>
            <tbody>
              {((data as { loads?: Array<Record<string, unknown>> }).loads || []).map((l) => (
                <tr key={l.id as number} className="border-b">
                  <td className="px-4 py-3">#{l.load_number as number}</td>
                  <td className="px-4 py-3 font-mono text-sm">{l.tail_number as string}</td>
                  <td className="px-4 py-3 text-center">{l.jumper_count as number}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="bg-gray-100 px-2 py-0.5 rounded text-xs">{l.status as string}</span>
                  </td>
                  <td className="px-4 py-3 text-right">${(((l.revenue as number) || 0) / 100).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-600">{(l.created_at as string).split("T")[0]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Jumpers Tab */}
      {tab === "jumpers" && data && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Name</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Email</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-700">License</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-700">Total Jumps</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-700">Waivers</th>
              </tr>
            </thead>
            <tbody>
              {((data as { jumpers?: Array<Record<string, unknown>> }).jumpers || []).map((j) => (
                <tr key={j.id as number} className="border-b">
                  <td className="px-4 py-3 font-medium">{j.first_name as string} {j.last_name as string}</td>
                  <td className="px-4 py-3 text-gray-600 text-sm">{j.email as string}</td>
                  <td className="px-4 py-3 text-center">{j.license_level as string}</td>
                  <td className="px-4 py-3 text-center font-medium">{j.total_jumps as number}</td>
                  <td className="px-4 py-3 text-center">{j.waiver_count as number}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
