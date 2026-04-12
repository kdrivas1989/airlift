"use client";

import { useState, useEffect } from "react";
import ComplianceBadge from "@/components/ComplianceBadge";

interface Jumper {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  weight: number;
  uspaNumber: string | null;
  licenseLevel: string;
  reservePackDate: string | null;
  reserveExpired: boolean;
  hasWaiver: boolean;
  canManifest: boolean;
  uspaStatus: string | null;
  uspaExpiry: string | null;
  uspaLicenses: string | null;
  uspaVerifiedAt: string | null;
  uspaActive: boolean;
}

export default function JumpersPage() {
  const [jumpers, setJumpers] = useState<Jumper[]>([]);
  const [search, setSearch] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [verifying, setVerifying] = useState<number | null>(null);
  const [bulkVerifying, setBulkVerifying] = useState(false);

  const fetchJumpers = (q = "") => {
    fetch(`/api/jumpers?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((data) => setJumpers(data.jumpers || []));
  };

  useEffect(() => { fetchJumpers(); }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchJumpers(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  async function updateJumper(id: number, field: string, value: string | number) {
    await fetch(`/api/jumpers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    fetchJumpers(search);
    setEditId(null);
  }

  async function verifyUSPA(jumper: Jumper) {
    if (!jumper.uspaNumber) return;
    setVerifying(jumper.id);
    try {
      const res = await fetch("/api/uspa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jumperId: jumper.id, uspaNumber: jumper.uspaNumber }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Verification failed");
      }
      fetchJumpers(search);
    } catch {
      alert("Network error during verification");
    }
    setVerifying(null);
  }

  async function bulkVerify() {
    setBulkVerifying(true);
    try {
      const res = await fetch("/api/uspa/bulk", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        alert(`Verified ${data.verified} of ${data.total} jumpers. ${data.notFound} not found.`);
      } else {
        alert(data.error || "Bulk verification failed");
      }
      fetchJumpers(search);
    } catch {
      alert("Network error during bulk verification");
    }
    setBulkVerifying(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Jumpers</h1>
        <button
          onClick={bulkVerify}
          disabled={bulkVerifying}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {bulkVerifying ? "Verifying..." : "Verify All USPA"}
        </button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name, email, or USPA #..."
        className="w-full border border-gray-300 rounded-lg px-4 py-2 mb-4 focus:ring-2 focus:ring-blue-500"
      />

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Name</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Email</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-gray-700">USPA #</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-gray-700">License</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-gray-700">Weight</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-gray-700">USPA Exp</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-gray-700">Status</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {jumpers.map((j) => (
              <tr key={j.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{j.firstName} {j.lastName}</td>
                <td className="px-4 py-3 text-gray-600 text-sm">{j.email}</td>
                <td className="px-4 py-3 text-center text-sm font-mono">{j.uspaNumber || "—"}</td>
                <td className="px-4 py-3 text-center text-sm">{j.licenseLevel}</td>
                <td className="px-4 py-3 text-center text-sm">
                  {editId === j.id ? (
                    <input
                      type="number"
                      defaultValue={j.weight}
                      className="w-16 border rounded px-1 py-0.5 text-center text-sm"
                      onBlur={(e) => updateJumper(j.id, "weight", Number(e.target.value))}
                      onKeyDown={(e) => { if (e.key === "Enter") updateJumper(j.id, "weight", Number((e.target as HTMLInputElement).value)); }}
                      autoFocus
                    />
                  ) : (
                    <span>{j.weight} lbs</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center text-sm">
                  {j.uspaExpiry || "—"}
                </td>
                <td className="px-4 py-3 text-center">
                  <ComplianceBadge
                    hasWaiver={j.hasWaiver}
                    reserveExpired={j.reserveExpired}
                    reservePackDate={j.reservePackDate}
                    uspaStatus={j.uspaStatus}
                    uspaVerifiedAt={j.uspaVerifiedAt}
                  />
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  {j.uspaNumber && (
                    <button
                      onClick={() => verifyUSPA(j)}
                      disabled={verifying === j.id}
                      className="text-blue-600 hover:underline text-sm disabled:opacity-50"
                    >
                      {verifying === j.id ? "..." : "Verify"}
                    </button>
                  )}
                  <button onClick={() => setEditId(j.id)} className="text-gray-600 hover:underline text-sm">Edit</button>
                </td>
              </tr>
            ))}
            {jumpers.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">No jumpers found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
