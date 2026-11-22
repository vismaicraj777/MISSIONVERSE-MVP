import React from 'react';
import { Keyboard, X } from 'lucide-react';

interface ControlsHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CONTROL_GROUPS = [
  {
    title: 'Spacecraft Attitude, Gates & RCS',
    rows: [
      ['W / S or Up / Down', 'Pitch Nose Up / Down (Cruise: Steer Through Booster Gates)'],
      ['A / D or Left / Right', 'Yaw Left / Right (Descent: Lateral Roll Tilt)'],
      ['Q / E', 'Roll Counter-Clockwise / Clockwise'],
      ['R / F or Shift / Ctrl', 'Throttle Up / Throttle Down'],
    ],
  },
  {
    title: 'Landing, Surface Rover & Views',
    rows: [
      ['G', 'Deploy / Stow Lunar Lander Landing Gear'],
      ['W A S D / Arrows', 'Drive Surface Rover to Lunar Discovery Landmarks'],
      ['Space (Surface Ops)', 'Low-Gravity Lunar Rover Jump'],
      ['Shift / B (Surface Ops)', 'Rover Turbo Boost Thruster'],
      ['C', 'Cycle Camera Views (Cinematic, Chase, Cockpit, Orbital, Stage, Lander, Free)'],
      ['Mouse Drag / Wheel', 'Free Orbit Inspect & Zoom Around Spacecraft'],
    ],
  },
  {
    title: 'Mission Control & Sim',
    rows: [
      ['Space', 'Start Launch Countdown on Pad / Jump on Moon / Pause In Flight'],
      ['P', 'Toggle Simulation Pause'],
      ['M', 'Open / Close Cislunar Navigation & Maneuver Map'],
      ['H', 'Open / Close Controls & Flight Guide'],
    ],
  },
];

export const ControlsHelpModal: React.FC<ControlsHelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-35 flex items-center justify-center p-4 bg-black/75">
      <div className="aero-panel w-full max-w-xl bg-[#0d1322] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800/80 bg-[#131b2e]">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-amber-400" />
            <h2 className="font-display text-sm text-amber-300">
              Flight Controls & Operations Guide
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close controls guide"
            className="aero-btn p-1.5 text-slate-200 hover:text-white bg-[#1e273d] hover:bg-[#2a3654] border border-slate-700/70 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto aero-scroll">
          {CONTROL_GROUPS.map((grp) => (
            <div key={grp.title} className="space-y-1.5">
              <div className="text-[11px] font-medium uppercase tracking-wider text-cyan-400">
                {grp.title}
              </div>
              <div className="aero-slot bg-[#090d18] divide-y divide-slate-800/80">
                {grp.rows.map(([keys, desc]) => (
                  <div
                    key={keys}
                    className="flex items-center justify-between gap-4 px-3 py-2 text-xs"
                  >
                    <span className="font-mono-tabular text-amber-300 whitespace-nowrap shrink-0">
                      {keys}
                    </span>
                    <span className="text-slate-200 text-right">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="aero-slot p-3 bg-[#090d18] text-[11px] text-slate-300 leading-relaxed">
            Touch & mouse users can also operate the on-screen Attitude/RCS pad, Throttle slider,
            Gear toggle, and Rover Drive / Jump / Boost controls directly from the flight HUD.
          </div>
        </div>
      </div>
    </div>
  );
};
