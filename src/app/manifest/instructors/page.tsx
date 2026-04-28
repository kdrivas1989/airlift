"use client";

import { useState, useEffect, useCallback } from "react";

interface Instructor {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  ratings: string | null;
  licenseLevel: string;
  uspaNumber: string | null;
  uspaStatus: string | null;
  weight: number;
  checkedIn: boolean;
  pairedToday: boolean;
  jumpsToday: number;
}

const RATING_OPTIONS = [
  { value: "tandem", label: "Tandem" },
  { value: "aff", label: "AFF" },
  { value: "iad", label: "IAD" },
  { value: "sl", label: "Static Line" },
  { value: "coach", label: "Coach" },
  { value: "video", label: "Video" },
];

export default function InstructorsPage() {
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<number | null>(null);
  const [editRatings, setEditRatings] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    const today = new Date().toISOString().split("T")[0];
    const [jumpersRes, checkinRes, receptionRes] = await Promise.all([
      fetch("/api/jumpers?q="),
      fetch(`/api/checkin?date=${today}`),
      fetch("/api/reception"),
    ]);

    const jumpersData = await jumpersRes.json();
    const checkinData = await checkinRes.json();
    const receptionData = await receptionRes.json();

    const checkedInIds = new Set((checkinData.jumpers || []).map((j: Record<string, unknown>) => j.id));
    const pairedIds = new Set(
      (receptionData.entries || [])
        .filter((e: Record<string, unknown>) => e.instructor_id && !["cancelled"].includes(e.status as string))
        .map((e: Record<string, unknown>) => e.instructor_id)
    );

    // Count jumps today per instructor from manifested loads
    const jumpCounts = new Map<number, number>();
    for (const e of receptionData.entries || []) {
      if (e.instructor_id && e.status === "manifested") {
        jumpCounts.set(e.instructor_id as number, (jumpCounts.get(e.instructor_id as number) || 0) + 1);
      }
    }

    const staff = (jumpersData.jumpers || [])
      .filter((j: Record<string, unknown>) => {
        const pt = (j.personType as string) || "";
        const ratings = (j.ratings as string) || "";
        return pt.includes("staff") || ratings.length > 0;
      })
      .map((j: Record<string, unknown>) => ({
        id: j.id as number,
        firstName: j.firstName as string,
        lastName: j.lastName as string,
        email: j.email as string,
        ratings: (j.ratings as string) || null,
        licenseLevel: j.licenseLevel as string,
        uspaNumber: j.uspaNumber as string | null,
        uspaStatus: j.uspaStatus as string | null,
        weight: j.weight as number,
        checkedIn: checkedInIds.has(j.id),
        pairedToday: pairedIds.has(j.id),
        jumpsToday: jumpCounts.get(j.id as number) || 0,
      }));

    setInstructors(staff);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const i = setInterval(refresh, 10000);
    return () => clearInterval(i);
  }, [refresh]);

  async function checkIn(id: number) {
    await fetch("/api/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jumperId: id }),
    });
    refresh();
  }

  async function saveRatings(id: number) {
    setSaving(true);
    await fetch(`/api/jumpers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ratings: Array.from(editRatings).join(",") }),
    });
    setSaving(false);
    setEditId(null);
    refresh();
  }

  function openEditRatings(inst: Instructor) {
    setEditId(inst.id);
    setEditRatings(new Set(inst.ratings ? inst.ratings.split(",").filter(Boolean) : []));
  }

  const tandemRated = instructors.filter(i => i.ratings?.includes("tandem"));
  const otherRated = instructors.filter(i => i.ratings && !i.ratings.includes("tandem"));
  const unrated = instructors.filter(i => !i.ratings);

  if (loading) return <div className="text-gray-500 text-center py-12">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Instructors</h1>
          <p className="text-sm text-gray-500">
            {instructors.filter(i => i.checkedIn).length} checked in today
          </p>
        </div>
      </div>

      {/* Tandem Instructors */}
      <div className="mb-6">
        <h2 className="text-sm font-bold text-purple-800 uppercase tracking-wide mb-3">
          Tandem Instructors ({tandemRated.length})
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {tandemRated.map(inst => (
            <InstructorCard key={inst.id} inst={inst} onCheckIn={checkIn} onEditRatings={openEditRatings} />
          ))}
          {tandemRated.length === 0 && <p className="text-sm text-gray-400 col-span-full">No tandem-rated instructors. Edit ratings below.</p>}
        </div>
      </div>

      {/* Other Rated Instructors */}
      {otherRated.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-bold text-blue-800 uppercase tracking-wide mb-3">
            Other Rated ({otherRated.length})
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {otherRated.map(inst => (
              <InstructorCard key={inst.id} inst={inst} onCheckIn={checkIn} onEditRatings={openEditRatings} />
            ))}
          </div>
        </div>
      )}

      {/* Staff Without Ratings */}
      {unrated.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">
            Staff — No Ratings ({unrated.length})
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {unrated.map(inst => (
              <InstructorCard key={inst.id} inst={inst} onCheckIn={checkIn} onEditRatings={openEditRatings} />
            ))}
          </div>
        </div>
      )}

      {/* Edit Ratings Modal */}
      {editId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setEditId(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-80" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-4">Edit Ratings</h3>
            <div className="space-y-2 mb-4">
              {RATING_OPTIONS.map(r => (
                <label key={r.value} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editRatings.has(r.value)}
                    onChange={e => {
                      const s = new Set(editRatings);
                      e.target.checked ? s.add(r.value) : s.delete(r.value);
                      setEditRatings(s);
                    }}
                    className="rounded border-gray-300"
                  />
                  {r.label}
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => saveRatings(editId)}
                disabled={saving}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button onClick={() => setEditId(null)} className="px-4 py-2 rounded-lg border text-sm hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InstructorCard({
  inst,
  onCheckIn,
  onEditRatings,
}: {
  inst: Instructor;
  onCheckIn: (id: number) => void;
  onEditRatings: (inst: Instructor) => void;
}) {
  const ratings = inst.ratings ? inst.ratings.split(",") : [];

  return (
    <div className={`rounded-xl border p-4 ${inst.checkedIn ? "bg-green-50 border-green-200" : "bg-white border-gray-200"}`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="font-semibold text-gray-900">{inst.firstName} {inst.lastName}</p>
          <p className="text-xs text-gray-500">{inst.licenseLevel} license &middot; {inst.weight} lbs</p>
        </div>
        {inst.checkedIn ? (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-200 text-green-800">IN</span>
        ) : (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-200 text-gray-600">OUT</span>
        )}
      </div>

      {/* Ratings */}
      <div className="flex gap-1 flex-wrap mb-2">
        {ratings.length > 0 ? ratings.map(r => (
          <span key={r} className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
            r === "tandem" ? "bg-purple-100 text-purple-700" :
            r === "aff" ? "bg-amber-100 text-amber-700" :
            r === "coach" ? "bg-teal-100 text-teal-700" :
            r === "video" ? "bg-pink-100 text-pink-700" :
            "bg-gray-100 text-gray-700"
          }`}>
            {r.toUpperCase()}
          </span>
        )) : (
          <span className="text-[10px] text-gray-400 italic">No ratings</span>
        )}
      </div>

      {/* Today stats */}
      {inst.checkedIn && (
        <div className="text-[11px] text-gray-500 mb-2">
          {inst.jumpsToday > 0 && <span>{inst.jumpsToday} jump{inst.jumpsToday !== 1 ? "s" : ""} today</span>}
          {inst.pairedToday && <span className="text-purple-600 ml-1">&middot; Paired</span>}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-1">
        {!inst.checkedIn && (
          <button
            onClick={() => onCheckIn(inst.id)}
            className="flex-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700"
          >
            Check In
          </button>
        )}
        <button
          onClick={() => onEditRatings(inst)}
          className="px-3 py-1.5 border rounded-lg text-xs text-gray-600 hover:bg-gray-50"
        >
          Ratings
        </button>
      </div>
    </div>
  );
}
