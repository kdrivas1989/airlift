"use client";

import { useState, useEffect, useRef } from "react";
import ComplianceBadge from "./ComplianceBadge";

interface Jumper {
  id: number;
  firstName: string;
  lastName: string;
  weight: number;
  uspaNumber: string | null;
  licenseLevel: string;
  reservePackDate: string | null;
  reserveExpired: boolean;
  hasWaiver: boolean;
  canManifest: boolean;
  uspaStatus: string | null;
  uspaVerifiedAt: string | null;
}

interface JumperSearchProps {
  onSelect: (jumper: Jumper) => void;
  placeholder?: string;
}

export default function JumperSearch({ onSelect, placeholder = "Search jumpers..." }: JumperSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Jumper[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const timeout = setTimeout(() => {
      fetch(`/api/jumpers?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((data) => { setResults(data.jumpers || []); setShowDropdown(true); });
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowDropdown(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
      {showDropdown && results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {results.map((j) => (
            <button
              key={j.id}
              onClick={() => { onSelect(j); setQuery(""); setShowDropdown(false); }}
              className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b last:border-b-0 flex items-center justify-between"
            >
              <div>
                <span className="font-medium">{j.firstName} {j.lastName}</span>
                <span className="text-gray-500 text-sm ml-2">{j.weight} lbs</span>
                {j.uspaNumber && <span className="text-gray-400 text-sm ml-2">#{j.uspaNumber}</span>}
                <span className="text-gray-400 text-sm ml-2">{j.licenseLevel}</span>
              </div>
              <ComplianceBadge hasWaiver={j.hasWaiver} reserveExpired={j.reserveExpired} reservePackDate={j.reservePackDate} uspaStatus={j.uspaStatus} uspaVerifiedAt={j.uspaVerifiedAt} compact />
            </button>
          ))}
        </div>
      )}
      {showDropdown && query.length >= 2 && results.length === 0 && (
        <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg p-4 text-gray-500 text-sm text-center">
          No jumpers found
        </div>
      )}
    </div>
  );
}
