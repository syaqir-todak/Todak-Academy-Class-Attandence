import { Flag } from 'lucide-react';

interface CuEligibilityFlagProps {
  isEligible: boolean;
  requiredPercentage?: number;
  daysNeededFor80?: number;
  compact?: boolean;
}

export function CuEligibilityFlag({
  isEligible,
  requiredPercentage = 80,
  daysNeededFor80 = 0,
  compact = false,
}: CuEligibilityFlagProps) {
  if (isEligible) {
    return (
      <span
        title={`Attendance meets or exceeds the ${requiredPercentage}% exam eligibility threshold`}
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-[#86EFAC] bg-[#F0FDF4] text-[#15803D] text-[11px] font-semibold whitespace-nowrap shrink-0"
      >
        <Flag className="w-3 h-3 fill-[#16A34A] text-[#16A34A] shrink-0" />
        <span>Eligible (&ge;{requiredPercentage}%)</span>
      </span>
    );
  }

  return (
    <span
      title={
        daysNeededFor80 > 0
          ? `Below ${requiredPercentage}% exam threshold — ${daysNeededFor80} more day(s) needed`
          : `Below ${requiredPercentage}% exam threshold`
      }
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-[#FCA5A5] bg-[#FEF2F2] text-[#DC2626] text-[11px] font-semibold whitespace-nowrap shrink-0"
    >
      <Flag className="w-3 h-3 fill-[#DC2626] text-[#DC2626] shrink-0" />
      <span>
        {compact || daysNeededFor80 <= 0
          ? `Below ${requiredPercentage}%`
          : `Below ${requiredPercentage}% · Need ${daysNeededFor80}d`}
      </span>
    </span>
  );
}

interface CuProgressMeterProps {
  percentage: number;
  percentageLabel: string;
  isEligible: boolean;
  requiredPercentage?: number;
  showPercentageLabel?: boolean;
}

export function CuProgressMeter({
  percentage,
  percentageLabel,
  isEligible,
  requiredPercentage = 80,
  showPercentageLabel = true,
}: CuProgressMeterProps) {
  const clampedWidth = Math.max(0, Math.min(100, percentage));
  const clampedMarker = Math.max(1, Math.min(100, requiredPercentage));

  return (
    <div className="flex items-center gap-2.5">
      <div className="relative flex-1 h-2 bg-[#E2E8F0] rounded-full overflow-hidden min-w-[72px]">
        <div
          className={`h-full rounded-full transition-all ${
            isEligible ? 'bg-[#16A34A]' : 'bg-[#DC2626]'
          }`}
          style={{ width: `${clampedWidth}%` }}
        />
        <div
          aria-hidden="true"
          title={`${clampedMarker}% Exam Eligibility Threshold`}
          style={{ left: `${clampedMarker}%` }}
          className="absolute top-0 bottom-0 w-0.5 bg-[#0F172A]/45"
        />
      </div>
      {showPercentageLabel && (
        <span
          className={`font-mono tabular-nums font-bold text-xs w-11 text-right shrink-0 ${
            isEligible ? 'text-[#15803D]' : 'text-[#DC2626]'
          }`}
        >
          {percentageLabel}
        </span>
      )}
    </div>
  );
}
