"use client";

import { useState, useEffect } from "react";

interface Staff {
  id: number;
  email: string;
  name: string;
  role: string;
  active: number;
}

export default function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  const loadStaff = () => {
    fetch("/api/staff").then((r) => r.json()).then((data) => setStaff(data.staff || []));
  };

  useEffect(() => { loadStaff(); }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
        name: form.get("name"),
        role: form.get("role"),
      }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    setShowForm(false);
    loadStaff();
  }

  async function toggleActive(s: Staff) {
    await fetch(`/api/staff/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !s.active }),
    });
    loadStaff();
  }

  async function changeRole(s: Staff) {
    const newRole = s.role === "admin" ? "operator" : "admin";
    await fetch(`/api/staff/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    loadStaff();
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Staff Management</h1>
        <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Add Staff</button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border p-6 mb-6 grid grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium mb-1">Name *</label><input name="name" required className="w-full border rounded-lg px-3 py-2" /></div>
          <div><label className="block text-sm font-medium mb-1">Email *</label><input name="email" type="email" required className="w-full border rounded-lg px-3 py-2" /></div>
          <div><label className="block text-sm font-medium mb-1">Password *</label><input name="password" type="password" required minLength={6} className="w-full border rounded-lg px-3 py-2" /></div>
          <div><label className="block text-sm font-medium mb-1">Role *</label>
            <select name="role" required className="w-full border rounded-lg px-3 py-2">
              <option value="operator">Operator</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="col-span-2 flex gap-2">
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg">Add</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border">Cancel</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Name</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Email</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-gray-700">Role</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-gray-700">Status</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id} className={`border-b ${!s.active ? "opacity-50" : ""}`}>
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3 text-gray-600">{s.email}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${s.role === "admin" ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800"}`}>
                    {s.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-0.5 rounded text-xs ${s.active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                    {s.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button onClick={() => changeRole(s)} className="text-blue-600 hover:underline text-sm">Toggle Role</button>
                  <button onClick={() => toggleActive(s)} className="text-sm hover:underline" style={{ color: s.active ? "#dc2626" : "#16a34a" }}>
                    {s.active ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
