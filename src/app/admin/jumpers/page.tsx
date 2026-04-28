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

const TYPE_OPTIONS = ["customer", "staff", "ground", "organizer", "student", "videographer"] as const;

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
                <tr key={p.id} className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => setEditPerson(p)}>
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
  const [firstName, setFirstName] = useState(person.firstName);
  const [lastName, setLastName] = useState(person.lastName);
  const [staffRole, setStaffRole] = useState(person.staffRole || "operator");
  const [staffPassword, setStaffPassword] = useState("");
  const [weight, setWeight] = useState(String(person.weight));
  const [licenseLevel, setLicenseLevel] = useState(person.licenseLevel);
  const [uspaNumber, setUspaNumber] = useState(person.uspaNumber || "");
  const [uspaStatus, setUspaStatus] = useState(person.uspaStatus || "");
  const [uspaExpiry, setUspaExpiry] = useState(person.uspaExpiry || "");
  const [phone, setPhone] = useState(person.phone || "");
  const [reservePackDate, setReservePackDate] = useState(person.reservePackDate || "");
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"profile" | "balance" | "ledger">("profile");

  // Balance state
  const [cashBalance, setCashBalance] = useState(person.balance);
  const [blockBalance, setBlockBalance] = useState(person.jumpBlockRemaining);
  const [payAmount, setPayAmount] = useState("");
  const [blockAmount, setBlockAmount] = useState("");
  const [balanceMsg, setBalanceMsg] = useState("");

  // Ledger state
  interface LedgerEntry {
    date: string;
    type: string;
    description: string;
    amount: number | null;
    blocks: number | null;
    loadNumber: number | null;
    paymentMethod: string | null;
    studentName: string | null;
    instructorEarnings: number | null;
  }
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [totalJumps, setTotalJumps] = useState(0);
  const [totalTandems, setTotalTandems] = useState(0);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [isStaffLedger, setIsStaffLedger] = useState(false);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [paycheckMsg, setPaycheckMsg] = useState("");

  async function save() {
    setSaving(true);
    const newTypes = [
      ...(isCustomer ? ["customer"] : []),
      ...(isStaff ? ["staff"] : []),
      ...(isGround ? ["ground"] : []),
    ];
    if (newTypes.length === 0) newTypes.push("customer");

    const body: Record<string, unknown> = {
      firstName,
      lastName,
      personType: newTypes.join(","),
      weight: Number(weight),
      licenseLevel,
      uspaNumber: uspaNumber || null,
      uspaStatus: uspaStatus || null,
      uspaExpiry: uspaExpiry || null,
      uspaVerified: !!uspaStatus,
      phone: phone || null,
      reservePackDate: reservePackDate || null,
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

  async function addCash() {
    const val = Number(payAmount);
    if (!val || val <= 0) return;
    const res = await fetch(`/api/jumpers/${person.id}/balance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "add_cash", amount: val }),
    });
    if (res.ok) {
      const data = await res.json();
      setCashBalance(data.balance);
      setBlockBalance(data.jumpBlockRemaining);
      setPayAmount("");
      setBalanceMsg(`Added $${val.toFixed(2)}`);
    }
  }

  async function addBlocks() {
    const val = Number(blockAmount);
    if (!val || val <= 0) return;
    const res = await fetch(`/api/jumpers/${person.id}/balance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "add_blocks", amount: val }),
    });
    if (res.ok) {
      const data = await res.json();
      setCashBalance(data.balance);
      setBlockBalance(data.jumpBlockRemaining);
      setBlockAmount("");
      setBalanceMsg(`Added ${Math.round(val)} block(s)`);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-[480px] max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 border-b">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-bold text-lg">{person.firstName} {person.lastName}</h3>
              <p className="text-sm text-gray-500">{person.email}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
          </div>
          {/* Balance summary */}
          <div className="flex gap-4 mt-3">
            <div className="bg-green-50 rounded-lg px-3 py-2 flex-1">
              <div className="text-[10px] text-green-600 uppercase font-medium">Cash</div>
              <div className="text-lg font-bold text-green-700">${(cashBalance / 100).toFixed(2)}</div>
            </div>
            <div className="bg-blue-50 rounded-lg px-3 py-2 flex-1">
              <div className="text-[10px] text-blue-600 uppercase font-medium">Jump Blocks</div>
              <div className="text-lg font-bold text-blue-700">{blockBalance}</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button onClick={() => setTab("profile")}
            className={`flex-1 py-2 text-sm font-medium ${tab === "profile" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500"}`}>
            Profile
          </button>
          <button onClick={() => setTab("balance")}
            className={`flex-1 py-2 text-sm font-medium ${tab === "balance" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500"}`}>
            Payments
          </button>
          <button onClick={() => {
            setTab("ledger");
            if (ledger.length === 0) {
              setLedgerLoading(true);
              fetch(`/api/jumpers/${person.id}/ledger`).then(r => r.json()).then(d => {
                setLedger(d.ledger || []);
                setTotalJumps(d.totalJumps || 0);
                setTotalTandems(d.totalTandems || 0);
                setTotalEarnings(d.totalEarnings || 0);
                setIsStaffLedger(d.isStaff || false);
                if (d.jumper) { setCashBalance(d.jumper.balance); setBlockBalance(d.jumper.jumpBlockRemaining); }
                setLedgerLoading(false);
              }).catch(() => setLedgerLoading(false));
            }
          }}
            className={`flex-1 py-2 text-sm font-medium ${tab === "ledger" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500"}`}>
            Ledger
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === "profile" ? (
            <div className="space-y-4">
              {/* Name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>

              {/* Type checkboxes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
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
                <div className="p-3 bg-purple-50 rounded-lg space-y-3">
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
                      Password {person.staffRole ? "(blank = keep current)" : ""}
                    </label>
                    <input type="password" value={staffPassword} onChange={(e) => setStaffPassword(e.target.value)}
                      placeholder={person.staffRole ? "Unchanged" : "Set password"}
                      className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>
              )}

              {/* Profile fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Weight (lbs)</label>
                  <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">License</label>
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">USPA #</label>
                <input value={uspaNumber} onChange={(e) => setUspaNumber(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">USPA Status</label>
                  <select value={uspaStatus} onChange={(e) => setUspaStatus(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="">Not verified</option>
                    <option value="Active">Active</option>
                    <option value="Expired">Expired</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">USPA Expiry</label>
                  <input type="date" value={uspaExpiry} onChange={(e) => setUspaExpiry(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reserve Pack Date</label>
                <input type="date" value={reservePackDate} onChange={(e) => setReservePackDate(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
                {reservePackDate && (() => {
                  const packDate = new Date(reservePackDate);
                  const expires = new Date(packDate.getTime() + 180 * 24 * 60 * 60 * 1000);
                  const daysLeft = Math.ceil((expires.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
                  const expired = daysLeft <= 0;
                  return (
                    <p className={`text-xs mt-1 ${expired ? "text-red-600 font-medium" : daysLeft <= 30 ? "text-orange-600" : "text-green-600"}`}>
                      {expired ? `EXPIRED ${Math.abs(daysLeft)} days ago` : `Expires in ${daysLeft} days (${expires.toLocaleDateString()})`}
                    </p>
                  );
                })()}
                {!reservePackDate && <p className="text-xs text-red-500 mt-1">Required to manifest — must be set by staff</p>}
              </div>

              {/* Compliance */}
              <div className="pt-2 border-t">
                <ComplianceBadge hasWaiver={person.hasWaiver} reserveExpired={person.reserveExpired}
                  reservePackDate={person.reservePackDate} uspaStatus={person.uspaStatus} uspaVerifiedAt={person.uspaVerifiedAt} />
              </div>

              <button onClick={save} disabled={saving}
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50">
                {saving ? "Saving..." : "Save Profile"}
              </button>
            </div>
          ) : tab === "balance" ? (
            <div className="space-y-4">
              {/* Add Cash */}
              <div className="p-4 border rounded-lg">
                <h4 className="text-sm font-medium mb-2">Add Cash Payment</h4>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-2 text-gray-400">$</span>
                    <input type="number" min="0" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)}
                      placeholder="0.00" className="w-full border rounded-lg pl-7 pr-3 py-2 text-sm" />
                  </div>
                  <button onClick={addCash} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700">
                    Add Cash
                  </button>
                </div>
              </div>

              {/* Add Jump Blocks */}
              <div className="p-4 border rounded-lg">
                <h4 className="text-sm font-medium mb-2">Add Jump Blocks</h4>
                <div className="flex gap-2 mb-2">
                  <input type="number" min="1" step="1" value={blockAmount} onChange={(e) => setBlockAmount(e.target.value)}
                    placeholder="# of blocks" className="flex-1 border rounded-lg px-3 py-2 text-sm" />
                  <button onClick={addBlocks} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
                    Add Blocks
                  </button>
                </div>
                {/* Quick-add buttons */}
                <div className="flex gap-2">
                  {[5, 10, 20].map((n) => (
                    <button key={n} onClick={() => { setBlockAmount(String(n)); }}
                      className="flex-1 border rounded-lg py-1.5 text-xs hover:bg-gray-50 font-medium">
                      {n} blocks
                    </button>
                  ))}
                </div>
              </div>

              {balanceMsg && (
                <div className="bg-green-50 text-green-700 text-sm px-3 py-2 rounded-lg">{balanceMsg}</div>
              )}
            </div>
          ) : tab === "ledger" ? (
            <div>
              {ledgerLoading ? (
                <div className="text-center py-8 text-gray-400 text-sm">Loading...</div>
              ) : (
                <>
                  <div className="flex gap-3 mb-3 text-sm flex-wrap">
                    <span className="text-gray-500">Total jumps: <span className="font-bold text-gray-800">{totalJumps}</span></span>
                    {isStaffLedger && totalTandems > 0 && (
                      <>
                        <span className="text-gray-500">Tandems: <span className="font-bold text-purple-700">{totalTandems}</span></span>
                        <span className="text-gray-500">Earnings: <span className="font-bold text-green-700">${(totalEarnings / 100).toFixed(2)}</span></span>
                      </>
                    )}
                  </div>
                  {isStaffLedger && totalEarnings > 0 && (
                    <div className="mb-3">
                      <button
                        onClick={async () => {
                          if (!confirm(`Issue paycheck for $${(totalEarnings / 100).toFixed(2)}?`)) return;
                          const res = await fetch(`/api/jumpers/${person.id}/paycheck`, { method: "POST" });
                          const data = await res.json();
                          if (res.ok) {
                            setPaycheckMsg(`Paycheck issued: ${data.tandems} tandem(s) = $${(data.totalEarnings / 100).toFixed(2)}`);
                            setTotalEarnings(0);
                            // Refresh ledger
                            const lr = await fetch(`/api/jumpers/${person.id}/ledger`);
                            const ld = await lr.json();
                            setLedger(ld.ledger || []);
                            setTotalTandems(ld.totalTandems || 0);
                            setTotalEarnings(ld.totalEarnings || 0);
                          } else {
                            setPaycheckMsg(data.error || "Failed");
                          }
                        }}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700"
                      >
                        Issue Paycheck — ${(totalEarnings / 100).toFixed(2)}
                      </button>
                      {paycheckMsg && <span className="ml-3 text-sm text-green-700">{paycheckMsg}</span>}
                    </div>
                  )}
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium text-gray-600">Date</th>
                          <th className="text-left px-3 py-2 font-medium text-gray-600">Description</th>
                          {isStaffLedger && <th className="text-left px-3 py-2 font-medium text-gray-600">Student</th>}
                          <th className="text-right px-3 py-2 font-medium text-gray-600">Cash</th>
                          <th className="text-right px-3 py-2 font-medium text-gray-600">Blocks</th>
                          {isStaffLedger && <th className="text-right px-3 py-2 font-medium text-gray-600">Earned</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {ledger.map((entry, i) => (
                          <tr key={i} className="border-b hover:bg-gray-50">
                            <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">
                              {new Date(entry.date).toLocaleDateString()} {new Date(entry.date).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}
                            </td>
                            <td className="px-3 py-1.5">
                              <div className="flex items-center gap-1">
                                {entry.type === "jump" && <span className="text-blue-600">&#9992;</span>}
                                {entry.type === "credit" && <span className="text-green-600">+</span>}
                                {entry.type === "debit" && <span className="text-red-600">-</span>}
                                {entry.type === "block_credit" && <span className="text-blue-600">+</span>}
                                {entry.type === "block_debit" && <span className="text-red-600">-</span>}
                                {entry.type === "instructor_earning" && <span className="text-purple-600">$</span>}
                                {entry.type === "paycheck" && <span className="text-green-600">&#10003;</span>}
                                {entry.type === "cc_fee" && <span className="text-gray-400">%</span>}
                                <span>{entry.description}</span>
                                {entry.paymentMethod && (
                                  <span className={`px-1 py-0.5 rounded text-[9px] font-medium ${
                                    entry.paymentMethod === "cash" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                                  }`}>{entry.paymentMethod}</span>
                                )}
                              </div>
                            </td>
                            {isStaffLedger && (
                              <td className="px-3 py-1.5 text-purple-700 text-xs">
                                {entry.studentName || ""}
                              </td>
                            )}
                            <td className={`px-3 py-1.5 text-right font-mono ${
                              entry.amount && entry.amount > 0 ? "text-green-700" : entry.amount && entry.amount < 0 ? "text-red-600" : "text-gray-300"
                            }`}>
                              {entry.amount && entry.type !== "instructor_earning" ? `${entry.amount > 0 ? "+" : ""}$${(Math.abs(entry.amount) / 100).toFixed(2)}` : "—"}
                            </td>
                            <td className={`px-3 py-1.5 text-right font-mono ${
                              entry.blocks && entry.blocks > 0 ? "text-blue-700" : entry.blocks && entry.blocks < 0 ? "text-red-600" : "text-gray-300"
                            }`}>
                              {entry.blocks ? `${entry.blocks > 0 ? "+" : ""}${entry.blocks}` : "—"}
                            </td>
                            {isStaffLedger && (
                              <td className="px-3 py-1.5 text-right font-mono text-green-700">
                                {entry.instructorEarnings ? `$${(entry.instructorEarnings / 100).toFixed(2)}` : ""}
                              </td>
                            )}
                          </tr>
                        ))}
                        {ledger.length === 0 && (
                          <tr><td colSpan={isStaffLedger ? 6 : 4} className="px-3 py-8 text-center text-gray-400">No activity yet</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
