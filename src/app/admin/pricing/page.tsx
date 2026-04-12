"use client";

import { useState, useEffect } from "react";

interface Pricing {
  id: number;
  jump_type: string;
  price: number;
  label: string;
  active: number;
}

export default function PricingPage() {
  const [pricing, setPricing] = useState<Pricing[]>([]);
  const [editType, setEditType] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadPricing = () => {
    fetch("/api/pricing").then((r) => r.json()).then((data) => setPricing(data.pricing || []));
  };

  useEffect(() => { loadPricing(); }, []);

  async function updatePrice(jumpType: string, price: number, label: string) {
    setError("");
    const res = await fetch("/api/pricing", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jumpType, price, label }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error);
      return;
    }
    setEditType(null);
    loadPricing();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Jump Type Pricing</h1>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>}

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Type</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Label</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">Price</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pricing.map((p) => (
              <tr key={p.id} className="border-b">
                <td className="px-4 py-3 font-mono text-sm">{p.jump_type}</td>
                <td className="px-4 py-3">
                  {editType === p.jump_type ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const form = new FormData(e.currentTarget);
                        updatePrice(p.jump_type, Math.round(Number(form.get("price")) * 100), form.get("label") as string);
                      }}
                      className="flex gap-2 items-center"
                    >
                      <input name="label" defaultValue={p.label} className="border rounded px-2 py-1 text-sm w-40" />
                      <input name="price" type="number" step="0.01" defaultValue={(p.price / 100).toFixed(2)} className="border rounded px-2 py-1 text-sm w-24 text-right" />
                      <button type="submit" className="text-blue-600 text-sm">Save</button>
                      <button type="button" onClick={() => setEditType(null)} className="text-gray-500 text-sm">Cancel</button>
                    </form>
                  ) : (
                    p.label
                  )}
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  ${(p.price / 100).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right">
                  {editType !== p.jump_type && (
                    <button onClick={() => setEditType(p.jump_type)} className="text-blue-600 hover:underline text-sm">Edit</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
