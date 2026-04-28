"use client";

import { useState, useEffect, useCallback } from "react";

interface ReceptionEntry {
  id: number;
  jumper_id: number;
  status: string;
  source: string;
  booking_ref: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  weight: number;
  has_waiver: number;
  emergency_contact_name: string | null;
  photo_package: number;
  video_package: number;
  handcam_package: number;
  payment_status: string;
  instructor_id: number | null;
  instructor_first_name: string | null;
  instructor_last_name: string | null;
  videographer_id: number | null;
  videographer_first_name: string | null;
  videographer_last_name: string | null;
  load_id: number | null;
  load_number: number | null;
  notes: string | null;
  created_at: string;
}

interface LoadOption { id: number; loadNumber: number; aircraft: string; slotsAvailable: number; }
interface InstructorOption { id: number; firstName: string; lastName: string; }

const STATUS_CFG: Record<string, { label: string; bg: string; text: string }> = {
  booked: { label: "Booked", bg: "bg-blue-100", text: "text-blue-800" },
  checked_in: { label: "Checked In", bg: "bg-yellow-100", text: "text-yellow-800" },
  standby: { label: "Standby", bg: "bg-orange-100", text: "text-orange-800" },
  paired: { label: "Paired", bg: "bg-purple-100", text: "text-purple-800" },
  manifested: { label: "On Load", bg: "bg-green-100", text: "text-green-800" },
};
const COLUMNS = ["booked", "checked_in", "standby", "paired", "manifested"] as const;

export default function ReceptionPage() {
  const [entries, setEntries] = useState<ReceptionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWalkIn, setShowWalkIn] = useState(false);
  const [wf, setWf] = useState({ firstName: "", lastName: "", email: "", phone: "", dateOfBirth: "", weight: "", emergencyContactName: "", emergencyContactPhone: "", photoPackage: false, videoPackage: false, handcamPackage: false, paymentStatus: "unpaid", notes: "" });
  const [walkInError, setWalkInError] = useState("");
  const [pairModal, setPairModal] = useState<number | null>(null);
  const [instructors, setInstructors] = useState<InstructorOption[]>([]);
  const [manifestModal, setManifestModal] = useState<number | null>(null);
  const [loads, setLoads] = useState<LoadOption[]>([]);
  const [videoModal, setVideoModal] = useState<number | null>(null);
  const [videographers, setVideographers] = useState<InstructorOption[]>([]);
  const [err, setErr] = useState("");

  const refresh = useCallback(async () => {
    const r = await fetch("/api/reception"); if (r.ok) { const d = await r.json(); setEntries(d.entries); }
    setLoading(false);
  }, []);
  useEffect(() => { refresh(); const i = setInterval(refresh, 5000); return () => clearInterval(i); }, [refresh]);

  async function handleWalkIn(e: React.FormEvent) {
    e.preventDefault(); setWalkInError("");
    const r = await fetch("/api/reception", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(wf) });
    if (r.ok) { setShowWalkIn(false); setWf({ firstName: "", lastName: "", email: "", phone: "", dateOfBirth: "", weight: "", emergencyContactName: "", emergencyContactPhone: "", photoPackage: false, videoPackage: false, handcamPackage: false, paymentStatus: "unpaid", notes: "" }); refresh(); }
    else { const d = await r.json(); setWalkInError(d.error || "Failed"); }
  }
  async function updateStatus(id: number, status: string) { setErr(""); const r = await fetch(`/api/reception/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }); if (r.ok) refresh(); else { const d = await r.json(); setErr(d.error || "Failed"); } }
  async function openPair(id: number) { setErr(""); const r = await fetch("/api/checkin?date=" + new Date().toISOString().split("T")[0]); if (r.ok) { const d = await r.json(); const used = new Set(entries.filter(x => x.instructor_id && !["cancelled","manifested"].includes(x.status)).map(x => x.instructor_id)); setInstructors((d.jumpers||[]).filter((j: Record<string,unknown>) => ((j.personType as string)||"").includes("staff") && !used.has(j.id as number)).map((j: Record<string,unknown>) => ({id: j.id as number, firstName: j.firstName as string, lastName: j.lastName as string}))); } setPairModal(id); }
  async function handlePair(eid: number, tid: number) { setErr(""); const r = await fetch(`/api/reception/${eid}/pair`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ instructorId: tid }) }); if (r.ok) { setPairModal(null); refresh(); } else { const d = await r.json(); setErr(d.error||"Failed"); } }
  async function openManifest(id: number) { setErr(""); const r = await fetch("/api/loads?status=open"); if (r.ok) { const d = await r.json(); setLoads((d.loads||[]).map((l: Record<string,unknown>) => ({id: l.id, loadNumber: l.loadNumber, aircraft: (l.aircraft as Record<string,unknown>)?.tailNumber||"?", slotsAvailable: l.slotsAvailable}))); } setManifestModal(id); }
  async function handleManifest(eid: number, lid: number) { setErr(""); const r = await fetch(`/api/reception/${eid}/manifest`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ loadId: lid }) }); if (r.ok) { setManifestModal(null); refresh(); } else { const d = await r.json(); setErr(d.error||"Failed"); } }
  async function handleCancel(id: number) { if (!confirm("Cancel this tandem?")) return; await fetch(`/api/reception/${id}`, { method: "DELETE" }); refresh(); }
  async function openVideoAssign(id: number) {
    setErr("");
    const r = await fetch("/api/checkin?date=" + new Date().toISOString().split("T")[0]);
    if (r.ok) {
      const d = await r.json();
      setVideographers((d.jumpers||[]).filter((j: Record<string,unknown>) => {
        const pt = (j.personType as string) || "";
        return pt.includes("staff") || pt.includes("videographer");
      }).map((j: Record<string,unknown>) => ({id: j.id as number, firstName: j.firstName as string, lastName: j.lastName as string})));
    }
    setVideoModal(id);
  }
  async function handleVideoAssign(eid: number, vidId: number) {
    setErr("");
    const r = await fetch(`/api/reception/${eid}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ videographerId: vidId }) });
    if (r.ok) { setVideoModal(null); refresh(); } else { const d = await r.json(); setErr(d.error||"Failed"); }
  }

  if (loading) return <div className="text-gray-500 text-center py-12">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Tandem Reception</h1><p className="text-sm text-gray-500">{entries.length} today</p></div>
        <button onClick={() => setShowWalkIn(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">+ Walk-In</button>
      </div>
      {err && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{err} <button onClick={() => setErr("")} className="ml-2 font-bold">&times;</button></div>}

      <div className="grid grid-cols-5 gap-3 min-h-[60vh]">
        {COLUMNS.map(col => { const items = entries.filter(e => e.status === col); const c = STATUS_CFG[col]; return (
          <div key={col} className="bg-gray-100 rounded-xl p-3">
            <div className="flex items-center justify-between mb-3"><span className={`px-2 py-1 rounded-full text-xs font-bold ${c.bg} ${c.text}`}>{c.label}</span><span className="text-xs text-gray-400">{items.length}</span></div>
            <div className="space-y-2">
              {items.map(e => (
                <div key={e.id} className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
                  <div className="flex items-start justify-between mb-1">
                    <p className="font-semibold text-gray-900 text-sm">{e.first_name} {e.last_name}</p>
                    <div className="flex gap-0.5">
                      {e.has_waiver ? <span className="w-4 h-4 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-[10px]" title="Waiver">W</span> : <span className="w-4 h-4 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-[10px]" title="No waiver">!</span>}
                      {e.source==="booking" && <span className="w-4 h-4 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-[10px]" title={`Ref: ${e.booking_ref}`}>B</span>}
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-500 mb-1">{e.weight} lbs</p>
                  {(e.photo_package||e.video_package||e.handcam_package) && <div className="flex gap-1 mb-1">{e.photo_package?<span className="px-1 py-0.5 bg-pink-100 text-pink-700 rounded text-[9px] font-medium">Photo</span>:null}{e.video_package?<span className="px-1 py-0.5 bg-violet-100 text-violet-700 rounded text-[9px] font-medium">Video</span>:null}{e.handcam_package?<span className="px-1 py-0.5 bg-cyan-100 text-cyan-700 rounded text-[9px] font-medium">Handcam</span>:null}</div>}
                  <span className={`px-1 py-0.5 rounded text-[9px] font-medium ${e.payment_status==="paid"?"bg-green-100 text-green-700":e.payment_status==="deposit"?"bg-yellow-100 text-yellow-700":"bg-red-100 text-red-700"}`}>{e.payment_status}</span>
                  {e.instructor_first_name && <p className="text-[11px] text-purple-600 mt-1">TI: {e.instructor_first_name} {e.instructor_last_name}</p>}
                  {e.videographer_first_name && <p className="text-[11px] text-pink-600 mt-0.5">Video: {e.videographer_first_name} {e.videographer_last_name}</p>}
                  {e.video_package && !e.videographer_id && e.status !== "booked" && (
                    <button onClick={() => openVideoAssign(e.id)} className="text-[10px] text-pink-600 hover:underline mt-0.5">+ Assign Videographer</button>
                  )}
                  {e.load_number!=null && <p className="text-[11px] text-green-600 mt-0.5">Load #{e.load_number}</p>}
                  <div className="flex gap-1 flex-wrap mt-2">
                    {col==="booked" && <button onClick={() => updateStatus(e.id,"checked_in")} className="px-2 py-1 bg-yellow-500 text-white rounded text-[11px] font-medium">Check In</button>}
                    {col==="checked_in" && <button onClick={() => updateStatus(e.id,"standby")} className="px-2 py-1 bg-orange-500 text-white rounded text-[11px] font-medium">Ready</button>}
                    {col==="standby" && <button onClick={() => openPair(e.id)} className="px-2 py-1 bg-purple-500 text-white rounded text-[11px] font-medium">Pair TI</button>}
                    {col==="paired" && <button onClick={() => openManifest(e.id)} className="px-2 py-1 bg-green-600 text-white rounded text-[11px] font-medium">Add to Load</button>}
                    {col!=="manifested" && <button onClick={() => handleCancel(e.id)} className="px-1.5 py-1 text-red-500 text-[11px]">Cancel</button>}
                  </div>
                </div>
              ))}
              {items.length===0 && <p className="text-xs text-gray-400 text-center py-4">Empty</p>}
            </div>
          </div>
        ); })}
      </div>

      {showWalkIn && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"><div className="bg-white rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Walk-In Tandem</h2>
        {walkInError && <p className="text-red-600 text-sm mb-3">{walkInError}</p>}
        <form onSubmit={handleWalkIn} className="space-y-3">
          <div className="grid grid-cols-2 gap-3"><div><label className="block text-xs font-medium text-gray-600 mb-1">First Name *</label><input type="text" value={wf.firstName} onChange={e=>setWf({...wf,firstName:e.target.value})} required className="w-full border border-gray-300 rounded px-3 py-2 text-sm" /></div><div><label className="block text-xs font-medium text-gray-600 mb-1">Last Name *</label><input type="text" value={wf.lastName} onChange={e=>setWf({...wf,lastName:e.target.value})} required className="w-full border border-gray-300 rounded px-3 py-2 text-sm" /></div></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="block text-xs font-medium text-gray-600 mb-1">Email</label><input type="email" value={wf.email} onChange={e=>setWf({...wf,email:e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" /></div><div><label className="block text-xs font-medium text-gray-600 mb-1">Phone</label><input type="tel" value={wf.phone} onChange={e=>setWf({...wf,phone:e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" /></div></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="block text-xs font-medium text-gray-600 mb-1">DOB *</label><input type="date" value={wf.dateOfBirth} onChange={e=>setWf({...wf,dateOfBirth:e.target.value})} required className="w-full border border-gray-300 rounded px-3 py-2 text-sm" /></div><div><label className="block text-xs font-medium text-gray-600 mb-1">Weight (lbs) *</label><input type="number" value={wf.weight} onChange={e=>setWf({...wf,weight:e.target.value})} required className="w-full border border-gray-300 rounded px-3 py-2 text-sm" /></div></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="block text-xs font-medium text-gray-600 mb-1">Emergency Name</label><input type="text" value={wf.emergencyContactName} onChange={e=>setWf({...wf,emergencyContactName:e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" /></div><div><label className="block text-xs font-medium text-gray-600 mb-1">Emergency Phone</label><input type="tel" value={wf.emergencyContactPhone} onChange={e=>setWf({...wf,emergencyContactPhone:e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" /></div></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-2">Add-Ons</label><div className="flex gap-4"><label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={wf.photoPackage} onChange={e=>setWf({...wf,photoPackage:e.target.checked})} className="rounded" /> Photo</label><label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={wf.videoPackage} onChange={e=>setWf({...wf,videoPackage:e.target.checked})} className="rounded" /> Video</label><label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={wf.handcamPackage} onChange={e=>setWf({...wf,handcamPackage:e.target.checked})} className="rounded" /> Handcam</label></div></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Payment</label><select value={wf.paymentStatus} onChange={e=>setWf({...wf,paymentStatus:e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2 text-sm"><option value="unpaid">Unpaid</option><option value="deposit">Deposit</option><option value="paid">Paid</option></select></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Notes</label><textarea value={wf.notes} onChange={e=>setWf({...wf,notes:e.target.value})} rows={2} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" /></div>
          <div className="flex gap-3 pt-2"><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 text-sm">Register</button><button type="button" onClick={()=>setShowWalkIn(false)} className="px-4 py-2 text-gray-600 text-sm">Cancel</button></div>
        </form>
      </div></div>}

      {pairModal && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"><div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Pair with TI</h2>
        {instructors.length===0 ? <p className="text-gray-500 text-sm mb-4">No available TIs.</p> : <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">{instructors.map(ti=><button key={ti.id} onClick={()=>handlePair(pairModal,ti.id)} className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:border-purple-400 hover:bg-purple-50"><p className="font-medium text-gray-900 text-sm">{ti.firstName} {ti.lastName}</p></button>)}</div>}
        <button onClick={()=>setPairModal(null)} className="text-sm text-gray-500">Cancel</button>
      </div></div>}

      {manifestModal && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"><div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Add to Load</h2>
        {loads.length===0 ? <p className="text-gray-500 text-sm mb-4">No open loads.</p> : <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">{loads.filter(l=>l.slotsAvailable>=2).map(l=><button key={l.id} onClick={()=>handleManifest(manifestModal,l.id)} className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:border-green-400 hover:bg-green-50"><p className="font-medium text-gray-900 text-sm">Load #{l.loadNumber} ({l.aircraft})</p><p className="text-xs text-gray-500">{l.slotsAvailable} slots</p></button>)}</div>}
        <button onClick={()=>setManifestModal(null)} className="text-sm text-gray-500">Cancel</button>
      </div></div>}

      {videoModal && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"><div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Assign Videographer</h2>
        {videographers.length===0 ? <p className="text-gray-500 text-sm mb-4">No videographers checked in.</p> : <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">{videographers.map(v=><button key={v.id} onClick={()=>handleVideoAssign(videoModal,v.id)} className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:border-pink-400 hover:bg-pink-50"><p className="font-medium text-gray-900 text-sm">{v.firstName} {v.lastName}</p></button>)}</div>}
        <button onClick={()=>setVideoModal(null)} className="text-sm text-gray-500">Cancel</button>
      </div></div>}
    </div>
  );
}
