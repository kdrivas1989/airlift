"use client";

import { useState, useEffect } from "react";

interface USPAStatus {
  configured: boolean;
  hasSession: boolean;
  updatedAt: string | null;
  email: string | null;
}

export default function SettingsPage() {
  const [status, setStatus] = useState<USPAStatus | null>(null);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");
  const [bookmarklet, setBookmarklet] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetch("/api/uspa").then((r) => r.json()).then(setStatus);
  }, []);

  // Poll for cookie updates after generating bookmarklet
  const [polling, setPolling] = useState(false);
  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(async () => {
      const res = await fetch("/api/uspa");
      const s = await res.json();
      if (s.hasSession && (!status?.hasSession || s.updatedAt !== status?.updatedAt)) {
        setStatus(s);
        setPolling(false);
        setMessage("Cookies received! Testing connection...");
        // Auto-test
        const testRes = await fetch("/api/uspa", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uspaNumber: "232363" }),
        });
        const data = await testRes.json();
        if (testRes.ok && data.member) {
          setMessage(`Connected! Verified: ${data.member.firstName} ${data.member.lastName} — ${data.member.status}, exp ${data.member.expDate}`);
        } else {
          setMessage("Cookies saved but verification failed. They may not include auth tokens — make sure you're logged into uspa.org first.");
        }
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [polling, status]);

  async function generateBookmarklet() {
    setGenerating(true);
    setMessage("");
    try {
      const res = await fetch("/api/uspa/cookies");
      const data = await res.json();
      const origin = window.location.origin;
      const js = `javascript:void(fetch('${origin}/api/uspa/cookies',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cookies:document.cookie,token:'${data.token}'})}).then(r=>r.json()).then(d=>alert(d.success?'Cookies sent to AirLIFT!':'Error: '+(d.error||'unknown'))).catch(e=>alert('Failed: '+e.message)))`;
      setBookmarklet(js);
      setPolling(true);
    } catch {
      setMessage("Failed to generate bookmarklet");
    }
    setGenerating(false);
  }

  async function testConnection() {
    setTesting(true);
    setMessage("");
    try {
      const res = await fetch("/api/uspa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uspaNumber: "232363" }),
      });
      const data = await res.json();
      if (res.ok && data.member) {
        setMessage(`Connection OK: ${data.member.firstName} ${data.member.lastName} — ${data.member.status}, exp ${data.member.expDate}`);
      } else {
        setMessage(data.error || "Session expired — sync cookies again.");
      }
    } catch {
      setMessage("Connection test failed");
    }
    setTesting(false);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="bg-white rounded-xl border p-6 max-w-2xl">
        <h2 className="text-lg font-semibold mb-2">USPA Integration</h2>
        <p className="text-gray-600 text-sm mb-4">
          Automatically verify member status, licenses, and expiration dates.
        </p>

        {/* Status */}
        <div className="mb-4 flex items-center gap-3">
          <span className={`w-2.5 h-2.5 rounded-full ${status?.hasSession ? "bg-green-500" : "bg-gray-400"}`} />
          <span className="text-sm font-medium">
            {status?.hasSession ? "Connected" : "Not connected"}
          </span>
          {status?.updatedAt && (
            <span className="text-xs text-gray-500">
              Last synced: {new Date(status.updatedAt + "Z").toLocaleString()}
            </span>
          )}
          {status?.hasSession && (
            <button onClick={testConnection} disabled={testing}
              className="text-sm text-blue-600 hover:underline disabled:opacity-50 ml-auto">
              {testing ? "Testing..." : "Test connection"}
            </button>
          )}
        </div>

        {/* Bookmarklet sync */}
        <div className="border-t pt-4 space-y-4">
          <h3 className="text-sm font-medium text-gray-700">
            {status?.hasSession ? "Re-sync Session" : "Connect to USPA"}
          </h3>

          <div className="bg-blue-50 rounded-lg p-4 space-y-3">
            <p className="text-sm text-blue-900 font-medium">One-click sync:</p>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>Click the button below to generate a sync link</li>
              <li>Drag the link to your bookmarks bar</li>
              <li>Log into <a href="https://www.uspa.org/Login" target="_blank" rel="noopener" className="underline font-medium">uspa.org</a> in another tab</li>
              <li>Click the bookmark while on uspa.org — done!</li>
            </ol>

            {!bookmarklet ? (
              <button
                onClick={generateBookmarklet}
                disabled={generating}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {generating ? "Generating..." : "Generate Sync Link"}
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-blue-700 font-medium">Drag this to your bookmarks bar:</p>
                <a
                  href={bookmarklet}
                  onClick={(e) => { e.preventDefault(); alert("Drag this to your bookmarks bar, then click it while on uspa.org"); }}
                  className="inline-block bg-white border-2 border-blue-400 text-blue-700 px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:shadow cursor-grab"
                >
                  Sync USPA to AirLIFT
                </a>
                {polling && (
                  <p className="text-xs text-blue-600 animate-pulse">
                    Waiting for cookies from uspa.org...
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {message && (
          <div className={`mt-4 text-sm px-3 py-2 rounded ${message.includes("OK") || message.includes("Connected") || message.includes("Verified") ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"}`}>
            {message}
          </div>
        )}
      </div>

      {/* Instructor Pay Rate */}
      <InstructorRateSettings />
    </div>
  );
}

function InstructorRateSettings() {
  const [rate, setRate] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings").then(r => r.json()).then(d => {
      if (d.instructor_tandem_rate) setRate(String(Number(d.instructor_tandem_rate) / 100));
    });
  }, []);

  async function save() {
    const cents = Math.round(Number(rate) * 100);
    if (!cents || cents < 0) return;
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instructor_tandem_rate: String(cents) }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="bg-white rounded-xl border p-6 max-w-2xl mt-6">
      <h2 className="text-lg font-semibold mb-2">Instructor Pay</h2>
      <p className="text-gray-600 text-sm mb-4">Rate per tandem jump for instructor paycheck calculations.</p>
      <div className="flex gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Per Tandem ($)</label>
          <div className="relative">
            <span className="absolute left-3 top-2 text-gray-400">$</span>
            <input type="number" min="0" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)}
              className="border rounded-lg pl-7 pr-3 py-2 w-32 text-sm" />
          </div>
        </div>
        <button onClick={save} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
          Save
        </button>
        {saved && <span className="text-sm text-green-600">Saved!</span>}
      </div>
    </div>
  );
}
