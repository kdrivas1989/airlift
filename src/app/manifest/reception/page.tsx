"use client";

import { useState, useEffect, useCallback } from "react";
import JumperSearch from "@/components/JumperSearch";

interface TandemCustomer {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  weight: number;
  checkedInAt: string;
  paperworkComplete: boolean;
}

export default function ReceptionPage() {
  const [customers, setCustomers] = useState<TandemCustomer[]>([]);
  const [showAdd, setShowAdd] = useState(false);

  const fetchCustomers = useCallback(() => {
    fetch("/api/checkin")
      .then((r) => r.json())
      .then((data) => {
        const tandems = (data.jumpers || []).filter((j: Record<string, unknown>) => j.checkinType === "tandem");
        setCustomers(tandems);
      });
  }, []);

  useEffect(() => {
    fetchCustomers();
    const interval = setInterval(fetchCustomers, 5000);
    return () => clearInterval(interval);
  }, [fetchCustomers]);

  async function checkInTandem(jumper: { id: number }) {
    await fetch("/api/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jumperId: jumper.id, checkinType: "tandem" }),
    });
    fetchCustomers();
    setShowAdd(false);
  }

  async function confirmPaperwork(jumperId: number) {
    await fetch("/api/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jumperId, checkinType: "tandem", paperworkComplete: true }),
    });
    fetchCustomers();
  }

  async function sendToManifest(jumperId: number) {
    // Paperwork already confirmed — they show up in manifest's tandem standby
    confirmPaperwork(jumperId);
  }

  const waiting = customers.filter((c) => !c.paperworkComplete);
  const ready = customers.filter((c) => c.paperworkComplete);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Reception</h1>
          <p className="text-sm text-gray-500">Tandem customer check-in and paperwork</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
          {showAdd ? "Cancel" : "+ Check In Customer"}
        </button>
      </div>

      {showAdd && (
        <div className="bg-white rounded-xl border p-4 mb-6">
          <h3 className="text-sm font-medium mb-2">Search existing customer or create new</h3>
          <JumperSearch onSelect={checkInTandem} placeholder="Search by name or email..." />
          <div className="mt-3 border-t pt-3">
            <QuickTandemAdd onCreated={(id) => { checkInTandem({ id }); }} />
          </div>
        </div>
      )}

      {/* Waiting for paperwork */}
      <div className="bg-white rounded-xl border overflow-hidden mb-6">
        <div className="px-5 py-3 border-b bg-yellow-50">
          <h2 className="font-semibold text-yellow-800">Waiting for Paperwork ({waiting.length})</h2>
        </div>
        {waiting.length > 0 ? (
          <div className="divide-y">
            {waiting.map((c) => (
              <div key={c.id} className="px-5 py-4 flex items-center justify-between">
                <div>
                  <div className="font-medium">{c.firstName} {c.lastName}</div>
                  <div className="text-sm text-gray-500">
                    {c.weight} lbs &middot; Arrived {new Date(c.checkedInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    {c.phone && <span> &middot; {c.phone}</span>}
                  </div>
                </div>
                <button onClick={() => confirmPaperwork(c.id)}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700">
                  Paperwork Complete
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-5 py-8 text-center text-gray-400 text-sm">No customers waiting</div>
        )}
      </div>

      {/* Ready for manifest */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-5 py-3 border-b bg-green-50">
          <h2 className="font-semibold text-green-800">Ready for Manifest ({ready.length})</h2>
        </div>
        {ready.length > 0 ? (
          <div className="divide-y">
            {ready.map((c) => (
              <div key={c.id} className="px-5 py-4 flex items-center justify-between">
                <div>
                  <div className="font-medium">{c.firstName} {c.lastName}</div>
                  <div className="text-sm text-gray-500">
                    {c.weight} lbs &middot; Arrived {new Date(c.checkedInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-green-100 text-green-700 px-3 py-1 rounded text-xs font-medium">Ready</span>
                  <button onClick={() => sendToManifest(c.id)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
                    Send to Manifest
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-5 py-8 text-center text-gray-400 text-sm">No customers ready yet</div>
        )}
      </div>
    </div>
  );
}

function QuickTandemAdd({ onCreated }: { onCreated: (id: number) => void }) {
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
        email: form.get("email") || `tandem-${Date.now()}@walk-in.local`,
        password: "tandem123",
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
      <p className="text-xs text-gray-500 font-medium">Or add new walk-in customer:</p>
      {error && <div className="text-red-600 text-xs">{error}</div>}
      <div className="flex gap-2">
        <input name="firstName" required placeholder="First name" className="flex-1 border rounded px-3 py-2 text-sm" />
        <input name="lastName" required placeholder="Last name" className="flex-1 border rounded px-3 py-2 text-sm" />
      </div>
      <div className="flex gap-2">
        <input name="email" type="email" placeholder="Email (optional)" className="flex-1 border rounded px-3 py-2 text-sm" />
        <input name="weight" type="number" placeholder="Weight lbs" defaultValue="180" className="w-28 border rounded px-3 py-2 text-sm" />
      </div>
      <button type="submit" disabled={saving}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
        {saving ? "Adding..." : "Add & Check In"}
      </button>
    </form>
  );
}
