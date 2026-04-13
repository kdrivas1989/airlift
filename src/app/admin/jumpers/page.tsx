"use client";

import { useState, useEffect } from "react";
import ComplianceBadge from "@/components/ComplianceBadge";

interface Person {
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
  uspaVerifiedAt: string | null;
  uspaActive: boolean;
  balance: number;
  jumpBlockRemaining: number;
  personType: string; // comma-separated: customer,staff,ground
  staffRole: string | null;
  staffActive: number;
}

const TYPE_OPTIONS = ["customer", "staff", "ground"] as const;

export default function PeoplePage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [editPerson, setEditPerson] = useState<Person | null>(null);
  const [verifying, setVerifying] = useState<number | null>(null);
  const [bulkVerifying, setBulkVerifying] = useState(false);

  const fetchPeople = (q = "") => {
    fetch(`/api/jumpers?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((data) => setPeople(data.jumpers || []));
  };

  useEffect(() => { fetchPeople(); }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchPeople(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  async function verifyUSPA(p: Person) {
    if (!p.uspaNumber) return;
    setVerifying(p.id);
    try {
      const res = await fetch("/api/uspa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jumperId: p.id, uspaNumber: p.uspaNumber }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Verification failed");
      }
      fetchPeople(search);
    } catch { alert("Network error"); }
    setVerifying(null);
  }

  async function bulkVerify() {
    setBulkVerifying(true);
    try {
      const res = await fetch("/api/uspa/bulk", { method: "POST" });
      const data = await res.json();
      if (res.ok) alert(`Verified ${data.verified} of ${data.total}. ${data.notFound} not found.`);
      else alert(data.error || "Bulk verification failed");
      fetchPeople(search);
    } catch { alert("Network error"); }
    setBulkVerifying(false);
  }

  const filtered = filterType === "all"
    ? people
    : people.filter((p) => (p.personType || "customer").includes(filterType));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">People</h1>
        <button onClick={bulkVerify} disabled={bulkVerifying}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
          {bulkVerifying ? "Verifying..." : "Verify All USPA"}
        </button>
      </div>

      <div className="flex gap-3 mb-4">
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or USPA #..."
          className="flex-1 border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500" />
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm">
          <option value="all">All Types</option>
          <option value="customer">Customers</option>
          <option value="staff">Staff</option>
          <option value="ground">Ground</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Name</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Email</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-gray-700">Type</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-gray-700">USPA #</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-gray-700">License</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-gray-700">Weight</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-gray-700">Status</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const types = (p.personType || "customer").split(",");
              return (
                <tr key={p.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{p.firstName} {p.lastName}</td>
                  <td className="px-4 py-3 text-gray-600 text-sm">{p.email}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-1 flex-wrap">
                      {types.map((t) => (
                        <span key={t} className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          t === "staff" ? "bg-purple-100 text-purple-800" :
                          t === "ground" ? "bg-orange-100 text-orange-800" :
                          "bg-blue-100 text-blue-800"
                        }`}>{t}</span>
                      ))}
                      {types.includes("staff") && p.staffRole && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-700">{p.staffRole}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-sm font-mono">{p.uspaNumber || "—"}</td>
                  <td className="px-4 py-3 text-center text-sm">{p.licenseLevel}</td>
                  <td className="px-4 py-3 text-center text-sm">{p.weight} lbs</td>
                  <td className="px-4 py-3 text-center">
                    <ComplianceBadge hasWaiver={p.hasWaiver} reserveExpired={p.reserveExpired}
                      reservePackDate={p.reservePackDate} uspaStatus={p.uspaStatus} uspaVerifiedAt={p.uspaVerifiedAt} />
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {p.uspaNumber && (
                      <button onClick={() => verifyUSPA(p)} disabled={verifying === p.id}
                        className="text-blue-600 hover:underline text-sm disabled:opacity-50">
                        {verifying === p.id ? "..." : "Verify"}
                      </button>
                    )}
                    <button onClick={() => setEditPerson(p)} className="text-gray-600 hover:underline text-sm">Edit</button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">No people found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editPerson && (
        <EditPersonModal person={editPerson} onClose={() => setEditPerson(null)} onSave={() => { fetchPeople(search); setEditPerson(null); }} />
      )}
    </div>
  );
}

function EditPersonModal({ person, onClose, onSave }: { person: Person; onClose: () => void; onSave: () => void }) {
  const types = (person.personType || "customer").split(",");
  const [isCustomer, setIsCustomer] = useState(types.includes("customer"));
  const [isStaff, setIsStaff] = useState(types.includes("staff"));
  const [isGround, setIsGround] = useState(types.includes("ground"));
  const [staffRole, setStaffRole] = useState(person.staffRole || "operator");
  const [staffPassword, setStaffPassword] = useState("");
  const [weight, setWeight] = useState(String(person.weight));
  const [licenseLevel, setLicenseLevel] = useState(person.licenseLevel);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const newTypes = [
      ...(isCustomer ? ["customer"] : []),
      ...(isStaff ? ["staff"] : []),
      ...(isGround ? ["ground"] : []),
    ];
    if (newTypes.length === 0) newTypes.push("customer");

    const body: Record<string, unknown> = {
      personType: newTypes.join(","),
      weight: Number(weight),
      licenseLevel,
    };
    if (isStaff) {
      body.staffRole = staffRole;
      if (staffPassword) body.staffPassword = staffPassword;
    }

    await fetch(`/api/jumpers/${person.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    onSave();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-6 w-96 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-lg mb-1">{person.firstName} {person.lastName}</h3>
        <p className="text-sm text-gray-500 mb-4">{person.email}</p>

        {/* Type checkboxes */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Person Type</label>
          <div className="flex gap-4">
            {TYPE_OPTIONS.map((t) => {
              const checked = t === "customer" ? isCustomer : t === "staff" ? isStaff : isGround;
              const setter = t === "customer" ? setIsCustomer : t === "staff" ? setIsStaff : setIsGround;
              return (
                <label key={t} className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" checked={checked} onChange={(e) => setter(e.target.checked)}
                    className="rounded border-gray-300" />
                  <span className="capitalize">{t}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Staff options */}
        {isStaff && (
          <div className="mb-4 p-3 bg-purple-50 rounded-lg space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Staff Role</label>
              <select value={staffRole} onChange={(e) => setStaffRole(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="operator">Operator</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Login Password {person.staffRole ? "(leave blank to keep current)" : "*"}
              </label>
              <input type="password" value={staffPassword} onChange={(e) => setStaffPassword(e.target.value)}
                placeholder={person.staffRole ? "Unchanged" : "Set password"}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
        )}

        {/* Profile fields */}
        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Weight (lbs)</label>
            <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">License Level</label>
            <select value={licenseLevel} onChange={(e) => setLicenseLevel(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="unknown">Unknown</option>
              <option value="student">Student</option>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
              <option value="D">D</option>
            </select>
          </div>
        </div>

        {/* Balance info */}
        <div className="mb-4 text-sm text-gray-600 flex gap-4">
          <span>Cash: <span className="font-medium text-green-700">${(person.balance / 100).toFixed(2)}</span></span>
          <span>Blocks: <span className="font-medium text-blue-700">{person.jumpBlockRemaining}</span></span>
        </div>

        <div className="flex gap-2">
          <button onClick={save} disabled={saving}
            className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50">
            {saving ? "Saving..." : "Save"}
          </button>
          <button onClick={onClose} className="px-4 py-2 rounded-lg border hover:bg-gray-50 text-sm">Cancel</button>
        </div>
      </div>
    </div>
  );
}
