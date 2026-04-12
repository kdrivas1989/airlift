"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import SignaturePad from "@/components/SignaturePad";

const WAIVER_SECTIONS = [
  { id: "representations", title: "REPRESENTATIONS", text: "I represent that I am physically and mentally capable of participating in skydiving activities. I understand that skydiving involves inherent risks including but not limited to serious injury or death." },
  { id: "release", title: "RELEASE OF LIABILITY", text: "I hereby release, discharge, and covenant not to sue the dropzone, its owners, operators, employees, agents, and affiliated parties from any and all liability, claims, demands, actions, or causes of action arising out of or related to any loss, damage, or injury that may be sustained by me during skydiving activities." },
  { id: "covenant", title: "COVENANT NOT TO SUE", text: "I agree that I will not sue or bring any claim against the released parties for any injury, loss, or damage arising from my participation in skydiving activities." },
  { id: "indemnity", title: "INDEMNITY", text: "I agree to indemnify, defend, and hold harmless the released parties from any claims, demands, or causes of action brought by third parties as a result of my participation in skydiving activities." },
  { id: "validity", title: "VALIDITY", text: "I acknowledge that this waiver and release shall remain in effect for the duration of my participation in all skydiving activities at this dropzone." },
  { id: "medical", title: "MEDICAL REPRESENTATIONS", text: "I represent that I have no medical conditions that would prevent my safe participation in skydiving. I understand that I should consult my physician if I have any doubts about my fitness to skydive." },
  { id: "applicable_law", title: "APPLICABLE LAW", text: "This agreement shall be governed by and construed in accordance with the laws of the state in which the dropzone is located." },
  { id: "severability", title: "SEVERABILITY", text: "If any provision of this agreement is held to be invalid or unenforceable, the remaining provisions shall continue in full force and effect." },
  { id: "continuation", title: "CONTINUATION", text: "I understand that this agreement shall be binding upon my heirs, executors, administrators, and assigns." },
  { id: "accuracy", title: "INFORMATION ACCURACY", text: "I certify that all information provided in my registration is true and accurate to the best of my knowledge." },
];

export default function WaiverPage({ params }: { params: Promise<{ jumperId: string }> }) {
  const { jumperId } = use(params);
  const router = useRouter();
  const [jumper, setJumper] = useState<{ first_name: string; last_name: string; date_of_birth: string } | null>(null);
  const [acknowledged, setAcknowledged] = useState<Record<string, boolean>>({});
  const [initials, setInitials] = useState("");
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [guardianName, setGuardianName] = useState("");
  const [guardianSignature, setGuardianSignature] = useState<string | null>(null);
  const [esignatureConsent, setEsignatureConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const isMinor = jumper ? calculateAge(jumper.date_of_birth) < 18 : false;
  const allAcknowledged = WAIVER_SECTIONS.every((s) => acknowledged[s.id]);

  useEffect(() => {
    fetch(`/api/jumpers/${jumperId}`)
      .then((r) => r.json())
      .then((data) => setJumper(data.jumper))
      .catch(() => setError("Failed to load jumper info"));
  }, [jumperId]);

  function calculateAge(dob: string): number {
    const birth = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!allAcknowledged) { setError("Please acknowledge all sections"); return; }
    if (!initials) { setError("Please enter your initials"); return; }
    if (!signatureData) { setError("Please sign the waiver"); return; }
    if (!esignatureConsent) { setError("eSignature consent is required"); return; }
    if (isMinor && (!guardianName || !guardianSignature)) { setError("Guardian name and signature required for minors"); return; }

    setLoading(true);

    try {
      const res = await fetch("/api/waiver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jumperId: Number(jumperId),
          signatureData,
          initials,
          isMinor,
          guardianName: isMinor ? guardianName : null,
          guardianSignatureData: isMinor ? guardianSignature : null,
          esignatureConsent,
          marketingConsent,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Waiver submission failed");
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-xl shadow-sm border p-8 text-center max-w-md">
          <div className="text-green-600 text-5xl mb-4">&#10003;</div>
          <h2 className="text-2xl font-bold mb-2">Waiver Signed!</h2>
          <p className="text-gray-600 mb-4">You&apos;re all set. Head to the manifest desk to get on a load.</p>
          <a href="/register" className="text-blue-600 hover:underline">Register another jumper</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-2">Liability Waiver</h1>
        {jumper && (
          <p className="text-gray-600 text-center mb-6">
            For: {jumper.first_name} {jumper.last_name}
            {isMinor && <span className="ml-2 bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded">MINOR</span>}
          </p>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Legal Sections */}
          <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
            <h2 className="text-lg font-semibold">Please read and acknowledge each section</h2>
            {WAIVER_SECTIONS.map((section) => (
              <div key={section.id} className="border rounded-lg p-4">
                <h3 className="font-semibold text-sm mb-2">{section.title}</h3>
                <p className="text-sm text-gray-700 mb-3">{section.text}</p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acknowledged[section.id] || false}
                    onChange={(e) => setAcknowledged((prev) => ({ ...prev, [section.id]: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm">I have read and understand the above</span>
                </label>
              </div>
            ))}
          </div>

          {/* Initials + Signature */}
          <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Initials *</label>
              <input
                value={initials}
                onChange={(e) => setInitials(e.target.value.toUpperCase())}
                maxLength={4}
                placeholder="e.g. KD"
                className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-center uppercase focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <SignaturePad onSignature={setSignatureData} label="Your Signature *" />
          </div>

          {/* Guardian Section (minors only) */}
          {isMinor && (
            <div className="bg-yellow-50 rounded-xl shadow-sm border border-yellow-200 p-6 space-y-4">
              <h2 className="text-lg font-semibold text-yellow-800">Guardian/Parent Information Required</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Guardian Full Name *</label>
                <input
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <SignaturePad onSignature={setGuardianSignature} label="Guardian Signature *" />
            </div>
          )}

          {/* Consent */}
          <div className="bg-white rounded-xl shadow-sm border p-6 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={esignatureConsent}
                onChange={(e) => setEsignatureConsent(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm">I consent to use my electronic signature as a legally binding signature *</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={marketingConsent}
                onChange={(e) => setMarketingConsent(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600">I agree to receive marketing communications (optional)</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading || !allAcknowledged || !signatureData || !initials || !esignatureConsent}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? "Submitting..." : "Sign Waiver"}
          </button>
        </form>
      </div>
    </div>
  );
}
