"use client";

import { useState, useEffect } from "react";

interface Aircraft {
  id: number;
  tail_number: string;
  name: string | null;
  slot_count: number;
  empty_weight: number;
  max_gross_weight: number;
  active: number;
}

export default function AircraftPage() {
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const loadAircraft = () => {
    fetch("/api/aircraft?active=false")
      .then((r) => r.json())
      .then((data) => setAircraft(data.aircraft || []))
      .catch(() => setError("Failed to load aircraft"));
  };

  useEffect(() => { loadAircraft(); }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);
    const body = {
      tailNumber: form.get("tailNumber"),
      name: form.get("name") || null,
      slotCount: Number(form.get("slotCount")),
      emptyWeight: Number(form.get("emptyWeight")),
      maxGrossWeight: Number(form.get("maxGrossWeight")),
    };

    const res = editId
      ? await fetch(`/api/aircraft/${editId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      : await fetch("/api/aircraft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }

    setShowForm(false);
    setEditId(null);
    loadAircraft();
  }

  async function toggleActive(ac: Aircraft) {
    await fetch(`/api/aircraft/${ac.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !ac.active }),
    });
    loadAircraft();
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Aircraft Management</h1>
        <button onClick={() => { setShowForm(true); setEditId(null); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          Add Aircraft
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border p-6 mb-6 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tail Number *</label>
            <input name="tailNumber" required defaultValue={editId ? aircraft.find((a) => a.id === editId)?.tail_number : ""} className="w-full border rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input name="name" defaultValue={editId ? aircraft.find((a) => a.id === editId)?.name || "" : ""} className="w-full border rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Slots *</label>
            <input name="slotCount" type="number" min="1" required defaultValue={editId ? aircraft.find((a) => a.id === editId)?.slot_count : ""} className="w-full border rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Empty Weight (lbs) *</label>
            <input name="emptyWeight" type="number" min="1" required defaultValue={editId ? aircraft.find((a) => a.id === editId)?.empty_weight : ""} className="w-full border rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Gross Weight (lbs) *</label>
            <input name="maxGrossWeight" type="number" min="1" required defaultValue={editId ? aircraft.find((a) => a.id === editId)?.max_gross_weight : ""} className="w-full border rounded-lg px-3 py-2" />
          </div>
          <div className="flex items-end gap-2">
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">{editId ? "Update" : "Add"}</button>
            <button type="button" onClick={() => { setShowForm(false); setEditId(null); }} className="px-4 py-2 rounded-lg border hover:bg-gray-50">Cancel</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Tail #</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Name</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-gray-700">Slots</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-gray-700">Empty Wt</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-gray-700">Max Gross</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-gray-700">Status</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {aircraft.map((ac) => (
              <tr key={ac.id} className={`border-b ${!ac.active ? "opacity-50" : ""}`}>
                <td className="px-4 py-3 font-mono font-semibold">{ac.tail_number}</td>
                <td className="px-4 py-3 text-gray-600">{ac.name || "—"}</td>
                <td className="px-4 py-3 text-center">{ac.slot_count}</td>
                <td className="px-4 py-3 text-center">{ac.empty_weight.toLocaleString()} lbs</td>
                <td className="px-4 py-3 text-center">{ac.max_gross_weight.toLocaleString()} lbs</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${ac.active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                    {ac.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button onClick={() => { setEditId(ac.id); setShowForm(true); }} className="text-blue-600 hover:underline text-sm">Edit</button>
                  <button onClick={() => toggleActive(ac)} className="text-sm hover:underline" style={{ color: ac.active ? "#dc2626" : "#16a34a" }}>
                    {ac.active ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
            {aircraft.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No aircraft registered</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
