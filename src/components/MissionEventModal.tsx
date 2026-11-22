import React from 'react';
import { MissionEvent, MissionEventOption } from '../data/missionEvents';
import { AlertTriangle, Radio } from 'lucide-react';

interface MissionEventModalProps {
  event: MissionEvent | null;
  onSelectOption: (option: MissionEventOption) => void;
}

export const MissionEventModal: React.FC<MissionEventModalProps> = ({
  event,
  onSelectOption,
}) => {
  if (!event) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/75">
      <div className="aero-panel w-full max-w-xl bg-[#0d1322] border-amber-500/60 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800/80 bg-[#131b2e]">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <div className="text-[10px] font-mono-tabular uppercase tracking-wider text-amber-400">
                MISSION CONTROL PRIORITY ADVISORY · {event.caller}
              </div>
              <h2 className="font-display text-sm text-white">
                {event.title}
              </h2>
            </div>
          </div>
          <Radio className="w-4 h-4 text-cyan-400 shrink-0" />
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <p className="text-xs md:text-sm text-slate-200 leading-relaxed">
            {event.description}
          </p>

          <div className="aero-slot px-3 py-2 bg-[#090d18] font-mono-tabular text-xs text-cyan-300">
            TELEMETRY: {event.telemetryHint}
          </div>

          <div className="space-y-2.5">
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-300">
              Select Flight Director Decision
            </div>
            {event.options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onSelectOption(opt)}
                className="aero-btn w-full text-left p-3.5 bg-[#161f33] hover:bg-[#1f2b45] border border-slate-700/70 hover:border-amber-400 transition-colors cursor-pointer"
              >
                <div className="text-xs md:text-sm font-semibold text-slate-100">
                  {opt.label}
                </div>
                <p className="text-xs text-slate-300 mt-1">{opt.summary}</p>
                <div className="text-[11px] font-mono-tabular text-amber-300 mt-1.5">
                  Trade-Off: {opt.consequenceText}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
