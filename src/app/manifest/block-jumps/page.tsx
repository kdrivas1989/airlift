"use client";

import { useState, useEffect } from "react";

interface BlockJumper {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  jumpBlockRemaining: number;
  balance: number;
  personType: string;
}

export default function BlockJumpsPage() {
  const [jumpers, setJumpers] = useState<BlockJumper[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/jumpers?q=")
      .then((r) => r.json())
      .then((data) => {
        const withBlocks = (data.jumpers || [])
          .filter((j: BlockJumper) => j.jumpBlockRemaining > 0)
          .sort((a: BlockJumper, b: BlockJumper) => b.jumpBlockRemaining - a.jumpBlockRemaining);
        setJumpers(withBlocks);
        setLoading(false);
      });
  }, []);

  const totalTickets = jumpers.reduce((sum, j) => sum + j.jumpBlockRemaining, 0);

  if (loading) return <div className="text-gray-500 text-center py-12">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Block Jumps</h1>
          <p className="text-sm text-gray-500">{jumpers.length} jumpers with tickets &middot; {totalTickets} total tickets remaining</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Name</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Email</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-gray-700">Tickets Remaining</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-gray-700">Cash Balance</th>
            </tr>
          </thead>
          <tbody>
            {jumpers.map((j) => (
              <tr key={j.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{j.firstName} {j.lastName}</td>
                <td className="px-4 py-3 text-gray-600 text-sm">{j.email}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                    j.jumpBlockRemaining >= 10 ? "bg-blue-100 text-blue-800" :
                    j.jumpBlockRemaining >= 5 ? "bg-blue-50 text-blue-700" :
                    j.jumpBlockRemaining <= 1 ? "bg-red-100 text-red-700" :
                    "bg-gray-100 text-gray-700"
                  }`}>
                    {j.jumpBlockRemaining}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-sm text-gray-600">
                  {j.balance > 0 ? `$${(j.balance / 100).toFixed(2)}` : "—"}
                </td>
              </tr>
            ))}
            {jumpers.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No jumpers with tickets</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
