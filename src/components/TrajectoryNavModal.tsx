import React from 'react';
import { MissionConfig } from '../data/missions';
import { ManeuverPlan, TelemetrySnapshot } from '../engine/SpaceSimulation';
import { Compass, Flame, Navigation, X } from 'lucide-react';

interface TrajectoryNavModalProps {
  isOpen: boolean;
  onClose: () => void;
  mission: MissionConfig;
  telemetry: TelemetrySnapshot;
  onExecuteManeuver: (type: ManeuverPlan['type']) => void;
}

export const TrajectoryNavModal: React.FC<TrajectoryNavModalProps> = ({
  isOpen,
  onClose,
  mission,
  telemetry,
  onExecuteManeuver,
}) => {
  if (!isOpen) return null;

  const targetDistKm = mission.targetDistanceKm ?? 384400;
  const progress = Math.min(1, Math.max(0, telemetry.earthDistanceKm / targetDistKm));
  const craftX = 56 + progress * 388;
  const plannedY = 115 - Math.sin(progress * Math.PI) * 52;
  const errorOffset = Math.min(44, telemetry.trajectoryErrorDeg * 14);
  const actualY = plannedY + Math.sin(progress * Math.PI) * errorOffset;

  const returnProgress =
    telemetry.phase === 'RETURN_JOURNEY' || telemetry.phase === 'EARTH_REENTRY'
      ? Math.max(0, Math.min(1, 1 - telemetry.earthDistanceKm / 384400))
      : 0;

  const maneuver = telemetry.maneuverPending;
  const errColor =
    telemetry.trajectoryErrorDeg <= 0.75
      ? 'text-emerald-400'
      : telemetry.trajectoryErrorDeg <= 1.8
        ? 'text-amber-400'
        : 'text-rose-400';

  return (
    <div className="fixed inset-0 z-35 flex items-center justify-center p-4 bg-black/75">
      <div className="aero-panel w-full max-w-2xl bg-[#0d1322] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800/80 bg-[#131b2e]">
          <div className="flex items-center gap-2.5">
            <Compass className="w-4 h-4 text-cyan-400" />
            <div>
              <h2 className="font-display text-sm text-amber-300">
                Cislunar Nav & Maneuver Map
              </h2>
              <p className="text-[11px] text-slate-300">
                {mission.name} · {telemetry.phaseLabel} · Simulated Guidance Corridor
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation planner"
            className="aero-btn p-1.5 text-slate-200 hover:text-white bg-[#1e273d] hover:bg-[#2a3654] border border-slate-700/70 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* SVG Earth-Moon Trajectory Map */}
        <div className="p-5 space-y-4">
          <div className="aero-slot bg-[#090d18] p-3">
            <div className="flex items-center justify-between text-[11px] font-mono-tabular text-slate-400 mb-2">
              <span>
                {mission.isDeepSpaceL2
                  ? 'SUN-EARTH L2 CORRIDOR (1,500,000 KM)'
                  : 'CISLUNAR CORRIDOR (384,400 KM)'}
              </span>
              <span className={errColor}>
                CORRIDOR ERROR: {telemetry.trajectoryErrorDeg.toFixed(2)}°
              </span>
            </div>

            <svg
              viewBox="0 0 500 185"
              className="w-full h-44 block"
              role="img"
              aria-label="Earth to Moon trajectory corridor"
            >
              <defs>
                <radialGradient id="earthSphere" cx="35%" cy="35%" r="65%">
                  <stop offset="0%" stopColor="#60a5fa" />
                  <stop offset="55%" stopColor="#1d4ed8" />
                  <stop offset="100%" stopColor="#0f172a" />
                </radialGradient>
                <radialGradient id="moonSphere" cx="35%" cy="35%" r="65%">
                  <stop offset="0%" stopColor="#e2e8f0" />
                  <stop offset="60%" stopColor="#94a3b8" />
                  <stop offset="100%" stopColor="#334155" />
                </radialGradient>
              </defs>

              {/* Grid lines */}
              <line x1="20" y1="115" x2="480" y2="115" stroke="#1e293b" strokeDasharray="4 4" strokeWidth="1.5" />
              <line x1="153" y1="24" x2="153" y2="165" stroke="#131a29" strokeWidth="1" />
              <line x1="250" y1="24" x2="250" y2="165" stroke="#131a29" strokeWidth="1" />
              <line x1="347" y1="24" x2="347" y2="165" stroke="#131a29" strokeWidth="1" />

              {/* Planned Free-Return / TLI Arc */}
              <path
                d="M 56 115 Q 250 12 444 115"
                fill="none"
                stroke="#06b6d4"
                strokeWidth="2"
                strokeDasharray="6 4"
              />

              {/* Live Trajectory Arc with Error Dispersion */}
              <path
                d={`M 56 115 Q 250 ${12 + errorOffset * 1.9} 444 115`}
                fill="none"
                stroke={telemetry.trajectoryErrorDeg <= 0.75 ? '#10b981' : '#f59e0b'}
                strokeWidth="2.5"
              />

              {/* Return Trajectory Arc when applicable */}
              {mission.hasReturnJourney && (
                <path
                  d="M 444 115 Q 250 172 56 115"
                  fill="none"
                  stroke={returnProgress > 0 ? '#a78bfa' : '#334155'}
                  strokeWidth={returnProgress > 0 ? '2' : '1.5'}
                  strokeDasharray="4 4"
                />
              )}

              {/* Spherical Earth */}
              <circle cx="56" cy="115" r="27" fill="none" stroke="#38bdf8" strokeOpacity="0.35" strokeWidth="2" />
              <circle cx="56" cy="115" r="21" fill="url(#earthSphere)" stroke="#60a5fa" strokeWidth="1.2" />
              <path d="M 44 108 Q 52 103 56 111 Q 50 118 43 114 Z" fill="#22c55e" fillOpacity="0.75" />
              <path d="M 59 114 Q 68 112 69 122 Q 61 126 57 120 Z" fill="#4ade80" fillOpacity="0.75" />
              <text x="56" y="156" textAnchor="middle" fill="#94a3b8" fontSize="10" fontFamily="monospace">
                EARTH
              </text>

              {/* Target Node: Moon or Sun-Earth L2 Halo */}
              <circle cx="444" cy="115" r="20" fill="none" stroke={mission.isDeepSpaceL2 ? '#fbbf24' : '#64748b'} strokeDasharray="3 3" strokeWidth="1.2" />
              {mission.isDeepSpaceL2 ? (
                <polygon points="444,104 454,115 444,126 434,115" fill="#f59e0b" fillOpacity="0.85" stroke="#fde68a" strokeWidth="1" />
              ) : (
                <>
                  <circle cx="444" cy="115" r="13" fill="url(#moonSphere)" stroke="#cbd5e1" strokeWidth="1" />
                  <circle cx="440" cy="111" r="2.6" fill="#64748b" fillOpacity="0.65" />
                  <circle cx="448" cy="118" r="3.2" fill="#475569" fillOpacity="0.55" />
                </>
              )}
              <text x="444" y="156" textAnchor="middle" fill="#94a3b8" fontSize="10" fontFamily="monospace">
                {mission.isDeepSpaceL2 ? 'L2 HALO' : 'MOON'}
              </text>

              {/* Live Spacecraft Marker */}
              <g transform={`translate(${craftX}, ${actualY})`}>
                <circle r="8" fill="#f59e0b" fillOpacity="0.25" />
                <circle r="4.5" fill="#fbbf24" stroke="#fffbeb" strokeWidth="1.5" />
              </g>
            </svg>

            <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono-tabular text-slate-400 mt-1">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-1 bg-cyan-400 inline-block" />{' '}
                {mission.isDeepSpaceL2 ? 'Planned L2 Injection' : 'Planned TLI/LOI'}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-1 bg-amber-400 inline-block" /> Live Vector
              </span>
              {mission.hasReturnJourney && (
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-1 bg-violet-400 inline-block" /> TEI Return
                </span>
              )}
            </div>
          </div>

          {/* Numeric Cislunar Readout */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="aero-slot p-2.5 bg-[#090d18]">
              <div className="text-[10px] text-slate-400 uppercase">Earth Range</div>
              <div className="font-mono-tabular text-sm font-semibold text-slate-100 mt-0.5">
                {Math.round(telemetry.earthDistanceKm).toLocaleString()} km
              </div>
            </div>
            <div className="aero-slot p-2.5 bg-[#090d18]">
              <div className="text-[10px] text-slate-400 uppercase">Moon Range</div>
              <div className="font-mono-tabular text-sm font-semibold text-cyan-300 mt-0.5">
                {Math.round(telemetry.moonDistanceKm).toLocaleString()} km
              </div>
            </div>
            <div className="aero-slot p-2.5 bg-[#090d18]">
              <div className="text-[10px] text-slate-400 uppercase">Delta-V Reserve</div>
              <div className="font-mono-tabular text-sm font-semibold text-amber-400 mt-0.5">
                {Math.round(telemetry.deltaVRemainingMs)} m/s
              </div>
            </div>
            <div className="aero-slot p-2.5 bg-[#090d18]">
              <div className="text-[10px] text-slate-400 uppercase">Navigation Score</div>
              <div className="font-mono-tabular text-sm font-semibold text-emerald-400 mt-0.5">
                {telemetry.navScore} / 100
              </div>
            </div>
          </div>

          {/* Pending Maneuver Burn Execution */}
          {maneuver && !maneuver.executed ? (
            <div className="aero-slot p-4 bg-amber-950/35 border border-amber-500/70">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-amber-400" />
                  <span className="font-display text-xs text-amber-200">
                    {maneuver.title}
                  </span>
                </div>
                <span className="font-mono-tabular text-xs text-amber-300">
                  Δv {maneuver.requiredDeltaVMs} m/s · Fuel Cost {maneuver.fuelCostPct}%
                </span>
              </div>
              <p className="text-xs text-slate-200 mt-1.5 leading-relaxed">
                {maneuver.predictedOutcome}
              </p>
              <div className="flex items-center justify-between gap-3 mt-3">
                <span
                  className={`font-mono-tabular text-xs ${
                    maneuver.feasible ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {maneuver.feasible
                    ? `BURN GO · Propellant Remaining: ${telemetry.stageFuelPct.toFixed(0)}%`
                    : `MARGIN LOW · Propellant: ${telemetry.stageFuelPct.toFixed(0)}%`}
                </span>
                <button
                  type="button"
                  onClick={() => onExecuteManeuver(maneuver.type)}
                  className="aero-btn px-4 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-300/60 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>Execute {maneuver.type} Burn</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="aero-slot p-3.5 bg-[#090d18] text-xs text-slate-300 flex items-center justify-between">
              <span>No immediate burn queued. Monitor attitude, power bus, and trajectory error.</span>
              <span className="font-mono-tabular text-slate-400">Press M to toggle</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
