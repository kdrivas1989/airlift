interface ComplianceBadgeProps {
  hasWaiver: boolean;
  reserveExpired: boolean;
  reservePackDate: string | null;
  uspaStatus?: string | null;
  uspaVerifiedAt?: string | null;
  compact?: boolean;
}

export default function ComplianceBadge({
  hasWaiver,
  reserveExpired,
  reservePackDate,
  uspaStatus,
  uspaVerifiedAt,
  compact = false,
}: ComplianceBadgeProps) {
  const uspaActive = uspaStatus === "Active";
  const canManifest = hasWaiver && !reserveExpired && !!reservePackDate && uspaActive;

  if (compact) {
    return (
      <span
        className={`inline-block w-3 h-3 rounded-full ${
          canManifest ? "bg-green-500" : "bg-red-500"
        }`}
        title={canManifest ? "Ready to manifest" : "Cannot manifest"}
      />
    );
  }

  return (
    <div className="flex gap-2 flex-wrap">
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
          hasWaiver
            ? "bg-green-100 text-green-800"
            : "bg-red-100 text-red-800"
        }`}
      >
        {hasWaiver ? "Waiver \u2713" : "No Waiver"}
      </span>
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
          !reservePackDate
            ? "bg-gray-100 text-gray-800"
            : reserveExpired
            ? "bg-red-100 text-red-800"
            : "bg-green-100 text-green-800"
        }`}
      >
        {!reservePackDate
          ? "No Reserve Info"
          : reserveExpired
          ? "RESERVE EXPIRED"
          : "Reserve OK"}
      </span>
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
          !uspaVerifiedAt
            ? "bg-gray-100 text-gray-800"
            : uspaActive
            ? "bg-green-100 text-green-800"
            : "bg-red-100 text-red-800"
        }`}
      >
        {!uspaVerifiedAt
          ? "USPA ?"
          : uspaActive
          ? "USPA \u2713"
          : "USPA Expired"}
      </span>
    </div>
  );
}
