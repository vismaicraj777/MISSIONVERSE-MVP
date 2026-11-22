import React, { useState } from 'react';
import {
  COMMS_SYSTEMS,
  ComputedMissionMetrics,
  ENGINE_PACKAGES,
  MissionConfig,
  MissionDesignState,
  POWER_SOURCES,
  TRAJECTORY_PROFILES,
} from '../data/missions';
import {
  CameraPreset,
  FlightPhase,
  ManeuverPlan,
  SystemHealth,
  TelemetrySnapshot,
} from '../engine/SpaceSimulation';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Award,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Compass,
  Download,
  FastForward,
  Flame,
  HelpCircle,
  MessageSquare,
  Navigation,
  Pause,
  Play,
  Radio,
  Rocket,
  RotateCcw,
  SatelliteDish,
  SlidersHorizontal,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';

export interface CommLogEntry {
  id: string;
  timeLabel: string;
  speaker: string;
  message: string;
  tone?: 'info' | 'warn' | 'success';
}

export interface DecisionRecord {
  eventTitle: string;
  chosenLabel: string;
  consequence: string;
}

interface FlightHUDProps {
  mission: MissionConfig;
  design: MissionDesignState;
  metrics: ComputedMissionMetrics;
  telemetry: TelemetrySnapshot;
  cameraPreset: CameraPreset;
  timeWarp: number;
  isMuted: boolean;
  volume: number;
  speechEnabled: boolean;
  isDockCollapsed: boolean;
  commLog: CommLogEntry[];
  decisionsLog: DecisionRecord[];
  onToggleDock: () => void;
  onOpenDesigner: () => void;
  onOpenNav: () => void;
  onOpenHelp: () => void;
  onStartCountdown: () => void;
  onSkipToMoon: () => void;
  onResetPad: () => void;
  onTogglePause: () => void;
  onProceedSurface: () => void;
  onDeploySurface: () => void;
  onCompleteSurfaceTask: (idx: number) => void;
  onCompleteOrbitTask: (idx: number) => void;
  onFinishOrbitSurvey: () => void;
  onExecuteManeuver: (type: ManeuverPlan['type']) => void;
  onSelectCamera: (preset: CameraPreset) => void;
  onSelectWarp: (warp: number) => void;
  onToggleMute: () => void;
  onChangeVolume: (vol: number) => void;
  onToggleSpeech: () => void;
  onToggleAutopilot: () => void;
  onToggleGear: () => void;
  onSetThrottle: (val: number) => void;
  onVirtualInput: (code: string, pressed: boolean) => void;
  onEvaHop: () => void;
  onDismissDiscovery: () => void;
}

function formatMissionClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return `T+${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

function sysColor(state: SystemHealth): string {
  if (state === 'GO') return 'text-emerald-300 border-emerald-700/80 bg-emerald-950/60';
  if (state === 'AMBER') return 'text-amber-300 border-amber-700/80 bg-amber-950/60';
  return 'text-rose-300 border-rose-700/80 bg-rose-950/60';
}

function phaseStageIndex(phase: FlightPhase): number {
  switch (phase) {
    case 'PRELAUNCH':
    case 'COUNTDOWN':
      return 0;
    case 'IGNITION':
    case 'LIFTOFF':
    case 'STAGE_1_SEP':
    case 'STAGE_2_ASCENT':
    case 'STAGE_2_SEP':
    case 'EARTH_DEPARTURE':
      return 1;
    case 'TRANSLUNAR_CRUISE':
      return 2;
    case 'LUNAR_APPROACH':
    case 'LUNAR_ORBIT':
      return 3;
    case 'LUNAR_ORBIT_SURVEY':
    case 'LUNAR_DESCENT':
    case 'SURFACE_OPS':
      return 4;
    case 'LUNAR_ASCENT':
    case 'LUNAR_RENDEZVOUS':
    case 'RETURN_JOURNEY':
    case 'EARTH_REENTRY':
    case 'MISSION_COMPLETE':
    case 'MISSION_FAILED':
      return 5;
  }
}

function getOrbitSurveyConfig(mission: MissionConfig): {
  title: string;
  desc: string;
  tasks: [string, string, string];
} {
  if (mission.isDeepSpaceL2) {
    return {
      title: 'JWST L2 Observatory',
      desc: 'Sun-Earth L2 Halo Orbit (1,500,000 km). Deploy sunshield & calibrate 18 gold mirrors.',
      tasks: [
        'Unfold 5-Layer Kapton Sunshield',
        'Phase 18 Gold Primary Mirror Segments',
        'Capture Deep-Field Infrared Spectrum',
      ],
    };
  }
  if (mission.id === 'lunar-orbiter-1') {
    return {
      title: 'Lunar Orbiter 1 Mapping',
      desc: 'Equatorial lunar orbit photographic reconnaissance & DSN telemetry downlink (no landing).',
      tasks: [
        'Photograph Apollo Candidate Site A',
        'Capture First Earth-from-Moon Wide Frame',
        'Record orbital tracking for lunar gravity studies',
      ],
    };
  }
  return {
    title: `${mission.csmName ?? 'CSM-103'} Survey`,
    desc: '112 km lunar orbit reconnaissance & Earthrise observation. Orbital reconnaissance only (no lunar landing).',
    tasks: [
      'Capture Earthrise Horizon Observation',
      'Survey Mare Tranquillitatis Landing Zone',
      'Log Lunar Horizon Optical Sextant Fix',
    ],
  };
}

export const FlightHUD: React.FC<FlightHUDProps> = ({
  mission,
  design,
  metrics,
  telemetry,
  cameraPreset,
  timeWarp,
  isMuted,
  volume,
  speechEnabled,
  isDockCollapsed,
  commLog,
  decisionsLog,
  onToggleDock,
  onOpenDesigner,
  onOpenNav,
  onOpenHelp,
  onStartCountdown,
  onSkipToMoon,
  onResetPad,
  onTogglePause,
  onProceedSurface,
  onDeploySurface,
  onCompleteSurfaceTask,
  onCompleteOrbitTask,
  onFinishOrbitSurvey,
  onExecuteManeuver,
  onSelectCamera,
  onSelectWarp,
  onToggleMute,
  onChangeVolume,
  onToggleSpeech,
  onToggleAutopilot,
  onToggleGear,
  onSetThrottle,
  onVirtualInput,
  onEvaHop,
  onDismissDiscovery,
}) => {
  const [isCommsOpen, setIsCommsOpen] = useState(false);
  const [isAttitudeOpen, setIsAttitudeOpen] = useState(false);

  const isPrelaunch = telemetry.phase === 'PRELAUNCH';
  const isCountdown = telemetry.phase === 'COUNTDOWN';
  const isDescent = telemetry.phase === 'LUNAR_DESCENT';
  const isSurfaceOps = telemetry.phase === 'SURFACE_OPS';
  const isOrbitSurvey = telemetry.phase === 'LUNAR_ORBIT_SURVEY';
  const isLunarAscent = telemetry.phase === 'LUNAR_ASCENT';
  const isTranslunarCruise =
    telemetry.phase === 'TRANSLUNAR_CRUISE' || telemetry.phase === 'EARTH_DEPARTURE';
  const isFinished =
    telemetry.phase === 'MISSION_COMPLETE' || telemetry.phase === 'MISSION_FAILED';
  const isInFlight = !isPrelaunch && !isCountdown && !isFinished;

  const canPause = isInFlight;
  const canJumpToMoon =
    isPrelaunch ||
    telemetry.phase === 'IGNITION' ||
    telemetry.phase === 'LIFTOFF' ||
    telemetry.phase === 'STAGE_1_SEP' ||
    telemetry.phase === 'STAGE_2_ASCENT' ||
    telemetry.phase === 'STAGE_2_SEP' ||
    telemetry.phase === 'EARTH_DEPARTURE' ||
    telemetry.phase === 'TRANSLUNAR_CRUISE';

  const useLanderFuel = isDescent || isSurfaceOps || isLunarAscent;
  const activeFuelPct = useLanderFuel ? telemetry.landerFuelPct : telemetry.stageFuelPct;

  const altLabel = telemetry.altitudeReference === 'MOON' ? 'L-ALT' : 'E-ALT';
  const altValue =
    isDescent || isSurfaceOps
      ? `${telemetry.lunarAltitudeM.toFixed(1)} m`
      : `${telemetry.altitudeKm.toFixed(1)} km`;

  const showMach = telemetry.machNumber >= 0.4 && telemetry.altitudeReference === 'EARTH';

  const hasRoverCapability =
    Boolean(mission.hasRoverOps) && design.selectedPayloadIds.includes('lrv-rover');
  const hasEvaTraversal = mission.category === 'crewed' && mission.hasLunarLanding && !hasRoverCapability;
  const isSurveyorOps = mission.id === 'surveyor-3';
  const surveyorSurfaceTasks = [
    'Pan the TV camera across the landing site',
    'Command the soil sampler to dig a trench',
    'Record regolith response and downlink results',
  ];
  const surveyorTasksComplete = telemetry.surfaceTasksDone.every(Boolean);

  const completionHeaderTitle =
    mission.id === 'apollo-8'
      ? `${mission.name} — ${mission.csmName ?? 'CSM-103'}`
      : mission.category === 'crewed' && mission.csmName
        ? `${mission.name} — ${mission.csmName} & ${mission.landerName}`
        : `${mission.name} — ${mission.landerName}`;

  const completionGradeLabel =
    telemetry.landingGrade === 'CRASH'
      ? 'LOSS OF VEHICLE'
      : telemetry.landingGrade === 'ORBITAL_RETURN'
        ? 'ORBITAL RETURN COMPLETE · NO LUNAR LANDING'
        : mission.isDeepSpaceL2
          ? 'L2 HALO OBSERVATORY COMPLETE'
          : !mission.hasLunarLanding
            ? 'ORBITAL MAPPING MISSION COMPLETE'
            : `${telemetry.landingGrade ?? 'NOMINAL'} MISSION COMPLETE`;

  const orbitSurveyCfg = getOrbitSurveyConfig(mission);

  const holdKeyProps = (code: string) => ({
    onPointerDown: () => onVirtualInput(code, true),
    onPointerUp: () => onVirtualInput(code, false),
    onPointerLeave: () => onVirtualInput(code, false),
    onPointerCancel: () => onVirtualInput(code, false),
  });

  const pendingManeuver =
    telemetry.maneuverPending && !telemetry.maneuverPending.executed
      ? telemetry.maneuverPending
      : null;

  const currentStageIdx = phaseStageIndex(telemetry.phase);
  const timelineSteps = [
    mission.isDeepSpaceL2 ? 'Kourou' : 'Launch',
    'Ascent',
    'Cruise',
    mission.isDeepSpaceL2 ? 'L2 Halo' : 'Orbit',
    mission.isDeepSpaceL2 ? 'Optics' : mission.hasLunarLanding ? 'Surface' : 'Survey',
    mission.hasReturnJourney ? 'Return' : 'Downlink',
  ];

  const handleExportReport = () => {
    const report = {
      mission: mission.name,
      designation: mission.designation,
      launchVehicle: mission.launchVehicle,
      targetSite: mission.targetSite,
      difficulty: design.difficulty,
      configuration: {
        powerSource: POWER_SOURCES[design.powerSource ?? 'solar'].name,
        launchPropulsionPackage: ENGINE_PACKAGES[design.enginePackage ?? 'heritage'].name,
        hypotheticalEngineStudy: ENGINE_PACKAGES[design.enginePackage ?? 'heritage'].isHypothetical,
        commsSystem: COMMS_SYSTEMS[design.commsSystem ?? 'omni-sband'].name,
        trajectoryProfile: TRAJECTORY_PROFILES[design.trajectoryType ?? 'free-return'].name,
        guidance: design.guidanceLevel,
        fuelLoadPct: Math.round(design.fuelFillRatio * 100),
        payloadIds: design.selectedPayloadIds,
        deltaVMarginMs: metrics.deltaVMargin,
        totalCostM: metrics.totalCostM,
        budgetCapM: metrics.budgetCapM,
        costUnit: 'MissionVerse M-credits (game estimate)',
      },
      flightPerformance: {
        awardRank: telemetry.missionAwardRank,
        overallScore: telemetry.overallScore,
        fuelScore: telemetry.fuelScore,
        navScore: telemetry.navScore,
        landingScore: telemetry.landingScore,
        safetyScore: telemetry.safetyScore,
        scienceTotalScore: telemetry.scienceTotalScore,
        gatesPassed: `${telemetry.gatesPassed}/${telemetry.gatesTotal}`,
        discoveriesScanned: `${telemetry.surfaceSamplesCollected}/${telemetry.surfaceSamplesTotal}`,
        roverDistanceDrivenM: telemetry.roverDistanceM,
        dataTransmittedMb: telemetry.dataTransmittedMb,
        decisionsRecorded: decisionsLog,
        outcomeMessage: telemetry.outcomeMessage,
      },
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${mission.id}-mission-report.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {/* Top Aerospace Telemetry Ribbon (Zero backdrop-blur for smooth WebGL) */}
      <header className="fixed top-0 left-0 right-0 z-20 flex items-center justify-between gap-3 px-4 md:px-5 h-12 bg-[#0d1322]/95 border-b border-slate-800/90 shadow-lg">
        {/* Zone 1: Brand / Mission Name & Active Stage */}
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="font-display text-xs md:text-sm tracking-tight text-amber-300 whitespace-nowrap shrink-0">
            {mission.name}
          </span>
          <span className="hidden sm:inline text-xs text-slate-300 truncate font-mono-tabular">
            {telemetry.activeStageName} · {telemetry.phaseLabel}
          </span>
          {telemetry.isPaused && (
            <span className="text-[11px] font-mono-tabular font-semibold text-amber-400 shrink-0">
              [PAUSED]
            </span>
          )}
        </div>

        {/* Zone 2: Live Coherent Tabular Telemetry */}
        <div className="hidden lg:flex items-center gap-3.5 font-mono-tabular text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">MET</span>
            <span className="text-slate-100">{formatMissionClock(telemetry.missionTimeSec)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">{altLabel}</span>
            <span className="text-cyan-300">{altValue}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">VEL</span>
            <span className="text-slate-100">{telemetry.velocityMs.toFixed(0)} m/s</span>
          </div>
          {showMach && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">MACH</span>
              <span
                className={
                  telemetry.machNumber >= 0.95 && telemetry.machNumber <= 1.15
                    ? 'text-sky-300 font-semibold'
                    : 'text-slate-200'
                }
              >
                M {telemetry.machNumber.toFixed(2)}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">FUEL</span>
            <span className={activeFuelPct < 20 && isDescent ? 'text-rose-400' : 'text-amber-400'}>
              {activeFuelPct.toFixed(0)}%
            </span>
          </div>
          <div className="hidden xl:flex items-center gap-1.5">
            <span className="text-slate-500">PWR</span>
            <span className={telemetry.powerBusPct < 45 ? 'text-amber-400' : 'text-emerald-400'}>
              {Math.round(telemetry.powerBusPct)}%
            </span>
          </div>
          <div className="hidden xl:flex items-center gap-1.5">
            <span className="text-slate-500">ACC</span>
            <span className="text-slate-300">{telemetry.gForce.toFixed(2)} G</span>
          </div>
          <span className="hidden 2xl:inline text-[10px] text-slate-500 tracking-wider uppercase">
            Sim Model
          </span>
        </div>

        {/* Zone 3: Primary Header Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <a
            href="/me/missionverse/choose-mission.html"
            title="Return to mission selection"
            className="aero-btn inline-flex items-center px-2.5 py-1.5 text-[10px] font-bold tracking-wider text-cyan-200 border border-cyan-500/30 bg-cyan-950/30 hover:bg-cyan-900/50 whitespace-nowrap"
          >
            MISSIONS
          </a>
          <button
            type="button"
            onClick={onOpenNav}
            className={`aero-btn px-2.5 py-1.5 text-xs font-medium border flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              pendingManeuver
                ? 'bg-amber-600/35 border-amber-400 text-amber-100 hover:bg-amber-600/50'
                : 'bg-[#172036] border-slate-700/70 text-slate-100 hover:bg-[#202d4a]'
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden md:inline">Nav Map (M)</span>
          </button>

          <button
            type="button"
            onClick={onOpenDesigner}
            className="aero-btn px-2.5 py-1.5 text-xs font-medium text-slate-100 bg-[#172036] hover:bg-[#202d4a] border border-slate-700/70 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
            <span>Mission Design</span>
          </button>

          <button
            type="button"
            onClick={onOpenHelp}
            aria-label="Controls and flight guide"
            className="aero-btn p-1.5 text-slate-200 hover:text-white bg-[#172036] hover:bg-[#202d4a] border border-slate-700/70 transition-colors cursor-pointer"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Compact 6-Step Flight Progress Strip */}
      <div className="fixed top-12 left-0 right-0 z-10 h-6 bg-[#090d18]/90 border-b border-slate-800/70 hidden sm:flex items-center justify-center gap-4 px-4 font-mono-tabular text-[10px] pointer-events-none">
        {timelineSteps.map((step, idx) => {
          const done = idx < currentStageIdx;
          const active = idx === currentStageIdx;
          return (
            <div key={step} className="flex items-center gap-2">
              <span
                className={
                  active
                    ? 'text-amber-300 font-bold'
                    : done
                      ? 'text-emerald-400'
                      : 'text-slate-500'
                }
              >
                {idx + 1}. {step}
              </span>
              {idx < timelineSteps.length - 1 && <span className="text-slate-700">›</span>}
            </div>
          );
        })}
      </div>

      {/* Terminal Countdown Banner */}
      {isCountdown && (
        <div className="aero-panel fixed top-20 left-1/2 -translate-x-1/2 z-20 px-6 py-2.5 bg-[#0d1322]/95 border-amber-500/80 text-center">
          <div className="text-[10px] font-mono-tabular uppercase tracking-widest text-amber-400">
            Terminal Ignition Sequence · {mission.launchVehicle}
          </div>
          <div className="font-display text-xl md:text-2xl text-white mt-0.5">
            T - 00:0{Math.max(0, Math.ceil(telemetry.countdownSec))}
          </div>
        </div>
      )}

      {/* Pending Maneuver Prompt Banner */}
      {pendingManeuver && isInFlight && (
        <div className="aero-panel fixed top-20 left-1/2 -translate-x-1/2 z-20 w-[min(470px,92vw)] px-4 py-2.5 bg-[#0d1322]/95 border-amber-500/80 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-mono-tabular uppercase tracking-wider text-amber-400">
              Maneuver Burn Window Open
            </div>
            <div className="text-xs font-semibold text-slate-100 truncate">
              {pendingManeuver.title} ({pendingManeuver.requiredDeltaVMs} m/s ·{' '}
              {pendingManeuver.fuelCostPct}% fuel)
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onOpenNav}
              className="aero-btn px-2.5 py-1 text-[11px] font-medium text-slate-100 bg-[#1b253d] hover:bg-[#263454] border border-slate-700/70 cursor-pointer whitespace-nowrap shrink-0"
            >
              Inspect
            </button>
            <button
              type="button"
              onClick={() => onExecuteManeuver(pendingManeuver.type)}
              className="aero-btn px-3 py-1 text-[11px] font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-300/60 flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Flame className="w-3 h-3" />
              <span>Burn {pendingManeuver.type}</span>
            </button>
          </div>
        </div>
      )}

      {/* Left Column: Systems Strip & Phase-Specific Guidance */}
      <div className="fixed top-20 left-4 z-20 flex flex-col gap-2.5 w-72 max-w-[calc(100vw-2rem)] pointer-events-none">
        {/* Compact Spacecraft Systems Matrix during active flight */}
        {isInFlight && (
          <div className="aero-panel p-2.5 bg-[#0d1322]/95 pointer-events-auto">
            <div className="flex items-center justify-between text-[11px] mb-1.5">
              <span className="font-display text-[11px] text-slate-200">Systems</span>
              <span className="font-mono-tabular text-[10px] text-slate-400">
                ERR {telemetry.trajectoryErrorDeg.toFixed(1)}° ·{' '}
                {telemetry.rcsActive ? 'RCS FIRING' : 'RCS IDLE'}
              </span>
            </div>

            <div className="grid grid-cols-5 gap-1 font-mono-tabular text-[10px] text-center mb-2">
              {(
                [
                  ['PROP', telemetry.systemsStatus.propulsion],
                  ['PWR', telemetry.systemsStatus.power],
                  ['GUID', telemetry.systemsStatus.guidance],
                  ['COMM', telemetry.systemsStatus.comms],
                  ['LSS', telemetry.systemsStatus.lifeSupport],
                ] as Array<[string, SystemHealth]>
              ).map(([label, state]) => (
                <div key={label} className={`aero-slot py-1 border ${sysColor(state)}`}>
                  <div className="text-[9px] opacity-80">{label}</div>
                  <div className="font-bold">{state}</div>
                </div>
              ))}
            </div>

            {/* Active DSN Science Downlink Meter */}
            <div className="aero-slot px-2 py-1 mb-2 bg-[#090d18] flex items-center justify-between text-[10px] font-mono-tabular">
              <span className="text-cyan-300 flex items-center gap-1">
                <SatelliteDish className="w-3 h-3 text-cyan-400" />
                DSN {telemetry.downlinkRateKbps} kbps
              </span>
              <span className="text-slate-300">
                TX {telemetry.dataTransmittedMb.toFixed(1)} MB
                {telemetry.dataQueuedMb > 0.2 ? ` (+${telemetry.dataQueuedMb.toFixed(1)})` : ''}
              </span>
            </div>

            {isTranslunarCruise && (
              <div className="aero-slot px-2.5 py-1.5 mb-2 bg-[#090d18] border-cyan-500/40">
                <div className="flex items-center justify-between text-[11px] font-mono-tabular">
                  <span className="text-cyan-300 font-semibold">Nav Gates Passed</span>
                  <span className="text-amber-300 font-bold">
                    {telemetry.gatesPassed} / {telemetry.gatesTotal}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Steer WASD through glowing rings for +15 Sci
                </div>
              </div>
            )}

            <div className="flex items-center justify-between text-[11px] font-mono-tabular text-slate-300">
              <span>
                P {telemetry.pitchDeg}° · Y {telemetry.yawDeg}° · R {telemetry.rollDeg}°
              </span>
              {!isDescent && !isSurfaceOps && (
                <button
                  type="button"
                  onClick={() => setIsAttitudeOpen((p) => !p)}
                  className="text-cyan-400 hover:text-cyan-300 text-[11px] cursor-pointer"
                >
                  {isAttitudeOpen ? 'Hide Stick' : 'RCS Stick'}
                </button>
              )}
            </div>

            {/* Expandable Touch/Mouse RCS & Throttle Pad for Ascent/Cruise/Orbit */}
            {isAttitudeOpen && !isDescent && !isSurfaceOps && (
              <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 space-y-2">
                <div className="grid grid-cols-3 gap-1 w-32 mx-auto">
                  <div />
                  <button
                    type="button"
                    {...holdKeyProps('KeyW')}
                    aria-label="Pitch Up"
                    className="aero-btn p-1.5 bg-[#1b243b] hover:bg-[#263352] border border-slate-700/70 text-slate-100 flex justify-center cursor-pointer"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <div />
                  <button
                    type="button"
                    {...holdKeyProps('KeyA')}
                    aria-label="Yaw Left"
                    className="aero-btn p-1.5 bg-[#1b243b] hover:bg-[#263352] border border-slate-700/70 text-slate-100 flex justify-center cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    {...holdKeyProps('KeyS')}
                    aria-label="Pitch Down"
                    className="aero-btn p-1.5 bg-[#1b243b] hover:bg-[#263352] border border-slate-700/70 text-slate-100 flex justify-center cursor-pointer"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    {...holdKeyProps('KeyD')}
                    aria-label="Yaw Right"
                    className="aero-btn p-1.5 bg-[#1b243b] hover:bg-[#263352] border border-slate-700/70 text-slate-100 flex justify-center cursor-pointer"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div>
                  <div className="flex justify-between text-[10px] font-mono-tabular text-slate-400 mb-1">
                    <span>Engine Throttle</span>
                    <span>{Math.round(telemetry.throttle * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={telemetry.throttle}
                    onChange={(e) => onSetThrottle(parseFloat(e.target.value))}
                    className="w-full aero-slider"
                  />
                </div>

                <button
                  type="button"
                  onClick={onToggleAutopilot}
                  className={`aero-btn w-full py-1 text-[11px] font-medium border cursor-pointer ${
                    telemetry.autopilotEnabled
                      ? 'bg-cyan-950/80 border-cyan-500 text-cyan-200'
                      : 'bg-[#172036] border-slate-700/70 text-slate-300'
                  }`}
                >
                  {telemetry.autopilotEnabled ? 'SAS Attitude Hold: ON' : 'Manual RCS Pilot'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Orbital Reconnaissance / JWST Observatory Card */}
        {isOrbitSurvey && (
          <div className="aero-panel p-3.5 bg-[#0d1322]/95 pointer-events-auto">
            <div className="flex items-center justify-between text-xs font-medium text-slate-200 mb-1.5">
              <span className="font-display text-[11px] text-cyan-300 truncate">
                {orbitSurveyCfg.title}
              </span>
              <span className="font-mono-tabular text-cyan-300 shrink-0">
                {telemetry.surfaceOpsProgress.toFixed(0)}%
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed mb-2.5">
              {orbitSurveyCfg.desc}
            </p>
            <div className="space-y-1.5 mb-2.5">
              {orbitSurveyCfg.tasks.map((taskLabel, idx) => {
                const done = telemetry.orbitTasksDone[idx];
                return (
                  <button
                    key={taskLabel}
                    type="button"
                    disabled={done}
                    onClick={() => onCompleteOrbitTask(idx)}
                    className={`aero-btn w-full text-left px-2.5 py-1.5 text-[11px] border flex items-center justify-between gap-2 transition-colors ${
                      done
                        ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300'
                        : 'bg-[#172036] hover:bg-[#202d4a] border-slate-700/70 text-slate-100 cursor-pointer'
                    }`}
                  >
                    <span className="truncate">{taskLabel}</span>
                    <span className="font-mono-tabular text-[10px] shrink-0">
                      {done ? 'LOGGED' : 'EXEC'}
                    </span>
                  </button>
                );
              })}
            </div>
            {!mission.hasReturnJourney && telemetry.orbitTasksDone.every(Boolean) && (
              <button
                type="button"
                onClick={onFinishOrbitSurvey}
                className="aero-btn w-full py-1.5 px-3 mb-2 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-300/60 transition-colors cursor-pointer"
              >
                {mission.id === 'lunar-orbiter-1'
                  ? 'Complete Survey & End Mission'
                  : 'Complete Science Downlink'}
              </button>
            )}
            <div className="w-full h-2 rounded-full bg-[#090d18] overflow-hidden border border-slate-800">
              <div
                className="h-full bg-cyan-400 transition-all duration-300"
                style={{ width: `${Math.min(100, telemetry.surfaceOpsProgress)}%` }}
              />
            </div>
          </div>
        )}

        {/* Lunar Descent Guidance Strip */}
        {isDescent && (
          <div className="aero-panel p-3.5 bg-[#0d1322]/95 pointer-events-auto">
            <div className="flex items-center justify-between text-xs font-medium text-slate-300 mb-2">
              <span className="font-display text-[11px] text-amber-300">Descent Guidance</span>
              <span className="font-mono-tabular text-amber-400">
                {telemetry.distanceToTargetM.toFixed(0)}m
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 font-mono-tabular text-xs mb-2.5">
              <div className="aero-slot p-1.5 bg-[#090d18]">
                <div className="text-[10px] text-slate-500">V-SINK</div>
                <div className={telemetry.verticalSpeedMs < -3.2 ? 'text-rose-400' : 'text-emerald-400'}>
                  {telemetry.verticalSpeedMs.toFixed(2)} m/s
                </div>
              </div>
              <div className="aero-slot p-1.5 bg-[#090d18]">
                <div className="text-[10px] text-slate-500">H-DRIFT</div>
                <div className={telemetry.horizontalSpeedMs > 2.0 ? 'text-amber-400' : 'text-slate-200'}>
                  {telemetry.horizontalSpeedMs.toFixed(2)} m/s
                </div>
              </div>
              <div className="aero-slot p-1.5 bg-[#090d18]">
                <div className="text-[10px] text-slate-500">RADAR ALT</div>
                <div className="text-cyan-300">{telemetry.lunarAltitudeM.toFixed(1)} m</div>
              </div>
              <div className="aero-slot p-1.5 bg-[#090d18]">
                <div className="text-[10px] text-slate-500">GEAR</div>
                <div className={telemetry.gearDeployed ? 'text-emerald-400' : 'text-amber-400'}>
                  {telemetry.gearDeployed ? 'DEPLOYED' : 'STOWED'}
                </div>
              </div>
            </div>

            {/* Throttle Control */}
            <div className="mb-2.5">
              <div className="flex justify-between text-[11px] font-mono-tabular text-slate-400 mb-1">
                <span>Descent Throttle</span>
                <span>{Math.round(telemetry.throttle * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={telemetry.throttle}
                onChange={(e) => onSetThrottle(parseFloat(e.target.value))}
                className="w-full aero-slider"
              />
            </div>

            {/* Touch/Mouse Attitude Buttons for Descent */}
            <div className="grid grid-cols-3 gap-1 w-28 mx-auto mb-2.5">
              <div />
              <button
                type="button"
                {...holdKeyProps('KeyW')}
                aria-label="Tilt Forward"
                className="aero-btn p-1.5 bg-[#1b243b] hover:bg-[#263352] border border-slate-700/70 text-slate-100 flex justify-center cursor-pointer"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <div />
              <button
                type="button"
                {...holdKeyProps('KeyA')}
                aria-label="Tilt Left"
                className="aero-btn p-1.5 bg-[#1b243b] hover:bg-[#263352] border border-slate-700/70 text-slate-100 flex justify-center cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                {...holdKeyProps('KeyS')}
                aria-label="Tilt Back"
                className="aero-btn p-1.5 bg-[#1b243b] hover:bg-[#263352] border border-slate-700/70 text-slate-100 flex justify-center cursor-pointer"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                {...holdKeyProps('KeyD')}
                aria-label="Tilt Right"
                className="aero-btn p-1.5 bg-[#1b243b] hover:bg-[#263352] border border-slate-700/70 text-slate-100 flex justify-center cursor-pointer"
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onToggleAutopilot}
                className={`aero-btn flex-1 py-1.5 px-2 text-[11px] font-medium border transition-colors cursor-pointer ${
                  telemetry.autopilotEnabled
                    ? 'bg-cyan-950/80 border-cyan-500 text-cyan-200'
                    : 'bg-[#172036] border-slate-700/70 text-slate-300'
                }`}
              >
                {telemetry.autopilotEnabled ? 'Auto-Assist: ON' : 'Manual Pilot'}
              </button>
              <button
                type="button"
                onClick={onToggleGear}
                className={`aero-btn py-1.5 px-2.5 text-[11px] font-medium border transition-colors cursor-pointer ${
                  telemetry.gearDeployed
                    ? 'bg-emerald-950/80 border-emerald-600 text-emerald-300'
                    : 'bg-amber-600/30 border-amber-500 text-amber-200'
                }`}
              >
                Gear (G)
              </button>
            </div>
            <div className="text-[10px] text-slate-500 mt-2 font-mono-tabular">
              R/F Throttle · WASD/Arrows Tilt · G Gear
            </div>
          </div>
        )}

        {/* Surface EVA, rover, or stationary-lander operations */}
        {isSurfaceOps && (
          <div className="aero-panel p-3.5 bg-[#0d1322]/95 pointer-events-auto space-y-2.5">
            <div className="flex items-center justify-between text-xs font-medium text-emerald-300">
              <span className="font-display text-[11px]">
                {isSurveyorOps ? 'Surveyor Remote Operations' : 'Lunar Surface EVA'}
              </span>
              <span className="font-mono-tabular">{telemetry.surfaceOpsProgress.toFixed(0)}%</span>
            </div>

            <div className="grid grid-cols-2 gap-2 font-mono-tabular text-[11px]">
              <div className="aero-slot p-2 bg-[#090d18]">
                <div className="text-[10px] text-slate-500">{isSurveyorOps ? 'TASKS LOGGED' : 'FIELD SAMPLES'}</div>
                <div className="text-cyan-300 font-semibold">
                  {telemetry.surfaceSamplesCollected} / {telemetry.surfaceSamplesTotal}
                </div>
              </div>
              <div className="aero-slot p-2 bg-[#090d18]">
                <div className="text-[10px] text-slate-500">
                  {isSurveyorOps ? 'INSTRUMENTS' : hasRoverCapability ? 'LRV TRAVERSE' : 'EVA TRAVERSE'}
                </div>
                <div className="text-amber-300 font-semibold">
                  {isSurveyorOps ? 'TV + SOIL SAMPLER' : `${telemetry.roverDistanceM} m`}
                </div>
              </div>
            </div>

            {/* Nearest Discovery Waypoint Compass */}
            {!isSurveyorOps && telemetry.nearestDiscoveryDistM > 0 && (
              <div className="aero-slot px-2.5 py-1.5 bg-[#090d18] border-amber-500/40 flex items-center justify-between font-mono-tabular text-[11px]">
                <span className="text-slate-300">Nearest Beacon</span>
                <span className="flex items-center gap-1.5 text-amber-300 font-semibold">
                  <Navigation
                    className="w-3.5 h-3.5 text-cyan-400 transition-transform duration-100"
                    style={{ transform: `rotate(${telemetry.nearestDiscoveryBearingDeg}deg)` }}
                  />
                  <span>{telemetry.nearestDiscoveryDistM} m</span>
                </span>
              </div>
            )}

            {!telemetry.surfaceInstrumentsDeployed && (
              <button
                type="button"
                onClick={onDeploySurface}
                className="aero-btn w-full py-1.5 px-3 text-xs font-medium bg-cyan-950/80 hover:bg-cyan-900/80 text-cyan-200 border border-cyan-500 transition-colors cursor-pointer"
              >
                {isSurveyorOps ? 'Power TV Camera & Soil Sampler' : 'Deploy Surface Experiments'}
              </button>
            )}

            {isSurveyorOps && (
              <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                {surveyorSurfaceTasks.map((task, idx) => {
                  const done = telemetry.surfaceTasksDone[idx];
                  return (
                    <button
                      key={task}
                      type="button"
                      disabled={!telemetry.surfaceInstrumentsDeployed || done}
                      onClick={() => onCompleteSurfaceTask(idx)}
                      className={`aero-btn w-full text-left px-2.5 py-1.5 text-[11px] border flex items-center justify-between gap-2 ${
                        done
                          ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300'
                          : telemetry.surfaceInstrumentsDeployed
                            ? 'bg-[#172036] hover:bg-[#202d4a] border-slate-700/70 text-slate-100 cursor-pointer'
                            : 'bg-[#0a0e18] border-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      <span>{task}</span>
                      <span className="font-mono-tabular text-[10px] shrink-0">{done ? 'LOGGED' : 'EXEC'}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* The Apollo 17 rover and Apollo 11 suited crew can traverse the surface. */}
            {!isSurveyorOps && (hasRoverCapability || hasEvaTraversal) && (
              <div className="pt-2 border-t border-slate-800/80 space-y-2">
                <div className="text-[10px] font-mono-tabular text-slate-400 text-center">
                  {hasRoverCapability
                    ? 'Drive the Lunar Roving Vehicle to sample stations (WASD)'
                    : 'Walk in the EVA suit to sample stations (WASD)'}
                </div>
              <div className="grid grid-cols-3 gap-1 w-28 mx-auto">
                <div />
                <button
                  type="button"
                  {...holdKeyProps('KeyW')}
                  aria-label={hasRoverCapability ? 'Drive forward' : 'Walk forward'}
                  className="aero-btn p-1.5 bg-[#1b243b] hover:bg-[#263352] border border-slate-700/70 text-slate-100 flex justify-center cursor-pointer"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <div />
                <button
                  type="button"
                  {...holdKeyProps('KeyA')}
                  aria-label="Turn Left"
                  className="aero-btn p-1.5 bg-[#1b243b] hover:bg-[#263352] border border-slate-700/70 text-slate-100 flex justify-center cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  {...holdKeyProps('KeyS')}
                  aria-label={hasRoverCapability ? 'Drive reverse' : 'Walk backward'}
                  className="aero-btn p-1.5 bg-[#1b243b] hover:bg-[#263352] border border-slate-700/70 text-slate-100 flex justify-center cursor-pointer"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  {...holdKeyProps('KeyD')}
                  aria-label="Turn Right"
                  className="aero-btn p-1.5 bg-[#1b243b] hover:bg-[#263352] border border-slate-700/70 text-slate-100 flex justify-center cursor-pointer"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {hasEvaTraversal && (
                <button
                  type="button"
                  onClick={onEvaHop}
                  className="aero-btn py-1.5 px-2 text-[11px] font-medium bg-[#1b243b] hover:bg-[#263352] text-amber-300 border border-amber-500/40 cursor-pointer"
                >
                  Lunar Hop (Space)
                </button>
              )}
              </div>
            )}

            <button
              type="button"
              disabled={isSurveyorOps && (!telemetry.surfaceInstrumentsDeployed || !surveyorTasksComplete)}
              onClick={onProceedSurface}
              className={`aero-btn w-full py-1.5 px-3 text-xs font-semibold border transition-colors ${
                isSurveyorOps && (!telemetry.surfaceInstrumentsDeployed || !surveyorTasksComplete)
                  ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-300/60 cursor-pointer'
              }`}
            >
              {isSurveyorOps
                ? 'Transmit Surveyor Results'
                : mission.category === 'crewed' && mission.hasReturnJourney
                  ? 'Ignite Ascent Stage Now'
                  : 'Complete Surface Telemetry'}
            </button>
          </div>
        )}
      </div>

      {/* Right-side Collapsible Mission Control Comms Log + Discovery Toast */}
      <div className="fixed top-20 right-4 z-20 flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={() => setIsCommsOpen((p) => !p)}
          className="aero-btn px-3 py-1.5 text-xs font-medium text-slate-100 bg-[#0d1322]/95 hover:bg-[#172036] border border-slate-700/70 flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
          <span>Mission Control Log ({commLog.length})</span>
        </button>

        {isCommsOpen && (
          <div className="aero-panel w-80 max-w-[calc(100vw-2rem)] bg-[#0d1322]/95 overflow-hidden">
            <div className="px-3.5 py-2.5 border-b border-slate-800/80 flex items-center justify-between gap-2 bg-[#131b2e]">
              <span className="font-display text-[11px] text-slate-100 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-emerald-400" />
                Flight Loop
              </span>
              <button
                type="button"
                onClick={onToggleSpeech}
                className={`aero-btn px-2 py-0.5 text-[10px] font-mono-tabular border cursor-pointer ${
                  speechEnabled
                    ? 'bg-emerald-950/80 border-emerald-600 text-emerald-300'
                    : 'bg-[#172036] border-slate-700/70 text-slate-300'
                }`}
              >
                Voice: {speechEnabled ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* Volume Slider */}
            <div className="px-3.5 py-2 border-b border-slate-800/80 flex items-center gap-2.5">
              <span className="text-[10px] font-mono-tabular text-slate-400 shrink-0">VOL</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => onChangeVolume(parseFloat(e.target.value))}
                className="w-full aero-slider"
              />
              <span className="text-[10px] font-mono-tabular text-slate-300 w-8 text-right">
                {Math.round((isMuted ? 0 : volume) * 100)}%
              </span>
            </div>

            <div className="max-h-64 overflow-y-auto aero-scroll p-3 space-y-2">
              {commLog.map((entry) => (
                <div
                  key={entry.id}
                  className="text-[11px] leading-snug border-l-2 pl-2.5 py-0.5 border-slate-600"
                >
                  <div className="flex items-center justify-between font-mono-tabular text-[10px] text-slate-500">
                    <span
                      className={
                        entry.tone === 'warn'
                          ? 'text-amber-400 font-semibold'
                          : entry.tone === 'success'
                            ? 'text-emerald-400 font-semibold'
                            : 'text-cyan-400 font-semibold'
                      }
                    >
                      {entry.speaker}
                    </span>
                    <span>{entry.timeLabel}</span>
                  </div>
                  <div className="text-slate-200 mt-0.5">{entry.message}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lunar Discovery Toast Card */}
        {telemetry.latestDiscovery && (
          <div className="aero-panel w-80 max-w-[calc(100vw-2rem)] p-3.5 bg-[#0d1322]/95 border-cyan-400/70">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 text-cyan-300">
                <Sparkles className="w-4 h-4 shrink-0 text-amber-400" />
                <span className="text-[10px] font-mono-tabular uppercase tracking-wider text-amber-300">
                  Moon Discovery · +{telemetry.latestDiscovery.points} Sci
                </span>
              </div>
              <button
                type="button"
                onClick={onDismissDiscovery}
                aria-label="Dismiss discovery"
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="font-display text-sm text-white mt-1">
              {telemetry.latestDiscovery.title}
            </div>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              {telemetry.latestDiscovery.fact}
            </p>
          </div>
        )}
      </div>

      {/* Mission Outcome / Performance Assessment Debrief Card */}
      {isFinished && (
        <div className="aero-panel fixed top-20 left-1/2 -translate-x-1/2 z-20 w-[min(660px,94vw)] max-h-[calc(100vh-155px)] overflow-y-auto aero-scroll p-5 bg-[#0d1322]/95">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-mono-tabular ${
                    telemetry.landingGrade === 'CRASH' ? 'text-rose-400' : 'text-amber-400'
                  }`}
                >
                  {completionGradeLabel}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-mono-tabular text-cyan-300">
                  <Award className="w-3.5 h-3.5 text-amber-400" />
                  {telemetry.missionAwardRank}
                </span>
              </div>
              <h3 className="font-display text-base md:text-lg text-white mt-0.5">
                {completionHeaderTitle}
              </h3>
            </div>
            <div className="aero-slot px-3 py-1.5 bg-[#090d18] text-right font-mono-tabular shrink-0">
              <div className="text-2xl font-bold text-amber-400">{telemetry.overallScore}</div>
              <div className="text-[10px] text-slate-400 uppercase">Score / 100</div>
            </div>
          </div>

          <p className="text-xs text-slate-300 mt-2.5 leading-relaxed">{telemetry.outcomeMessage}</p>

          {/* 5-Axis Performance Breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-4">
            {[
              ['Fuel Margin', telemetry.fuelScore],
              ['Navigation', telemetry.navScore],
              [mission.hasLunarLanding ? 'Touchdown' : 'Survey', telemetry.landingScore],
              ['Science Yield', Math.min(100, Math.round((telemetry.scienceTotalScore / 180) * 100))],
              ['Safety', telemetry.safetyScore],
            ].map(([lbl, val]) => (
              <div key={String(lbl)} className="aero-slot p-2 bg-[#090d18]">
                <div className="text-[10px] text-slate-400">{lbl}</div>
                <div className="font-mono-tabular text-sm font-semibold text-slate-100 mt-0.5">
                  {val}%
                </div>
              </div>
            ))}
          </div>

          {/* NASA Space Apps Engineering Design & Gameplay Diagnostics */}
          <div className="aero-slot p-3 mt-3 bg-[#090d18] grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px] font-mono-tabular">
            <div>
              <div className="text-[10px] text-slate-500">POWER</div>
              <div className="text-emerald-300">{POWER_SOURCES[design.powerSource ?? 'solar'].shortLabel}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">LAUNCH ENGINE</div>
              <div className="text-amber-300">
                {ENGINE_PACKAGES[design.enginePackage ?? 'heritage'].name}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">DOWNLINK</div>
              <div className="text-cyan-300">{telemetry.dataTransmittedMb.toFixed(1)} MB</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">NAV GATES</div>
              <div className="text-amber-300">
                {telemetry.gatesPassed} / {telemetry.gatesTotal}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">
                {mission.hasLunarLanding ? 'MOON WONDERS' : 'SURVEY TASKS'}
              </div>
              <div className="text-slate-100">
                {mission.hasLunarLanding
                  ? `${telemetry.surfaceSamplesCollected} / ${telemetry.surfaceSamplesTotal} (${telemetry.roverDistanceM}m)`
                  : `${telemetry.orbitTasksDone.filter(Boolean).length} / 3 Logged`}
              </div>
            </div>
          </div>

          {telemetry.landingGrade !== 'CRASH' && mission.objectives.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {mission.objectives.map((obj, idx) => (
                <div key={idx} className="flex items-start gap-1.5 text-[11px] text-slate-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{obj}</span>
                </div>
              ))}
            </div>
          )}

          {decisionsLog.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-800/80">
              <div className="text-[10px] font-medium uppercase tracking-wider text-cyan-400 mb-1.5">
                Flight Director Decisions Recorded
              </div>
              <div className="space-y-1">
                {decisionsLog.map((d, idx) => (
                  <div key={idx} className="text-[11px] text-slate-300">
                    <span className="text-slate-100 font-medium">{d.eventTitle}:</span>{' '}
                    {d.chosenLabel} — <span className="text-slate-400">{d.consequence}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-3 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400">
            <span className="text-amber-400 font-medium">Engineering Takeaway:</span>{' '}
            {telemetry.landingGrade === 'CRASH'
              ? 'Keep vertical sink under 3.5 m/s, horizontal drift under 2.5 m/s, and deploy landing gear (G) above 30 m.'
              : `Completed with ${telemetry.scienceTotalScore} science pts (${metrics.dataRateKbps} kbps ${COMMS_SYSTEMS[design.commsSystem ?? 'omni-sband'].shortLabel}, ${TRAJECTORY_PROFILES[design.trajectoryType ?? 'free-return'].name}) in ${design.difficulty.toUpperCase()} mode.`}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 mt-4">
            <button
              type="button"
              onClick={onSkipToMoon}
              className="aero-btn px-3.5 py-1.5 text-xs font-medium bg-[#172036] hover:bg-[#202d4a] text-slate-100 border border-slate-700/70 transition-colors cursor-pointer"
            >
              {mission.isDeepSpaceL2 ? 'Retry L2 Approach' : 'Retry Lunar Approach'}
            </button>
            <button
              type="button"
              onClick={onResetPad}
              className="aero-btn px-3.5 py-1.5 text-xs font-medium bg-[#172036] hover:bg-[#202d4a] text-slate-100 border border-slate-700/70 transition-colors cursor-pointer"
            >
              Reset to Launch Pad
            </button>
            <button
              type="button"
              onClick={handleExportReport}
              className="aero-btn px-3.5 py-1.5 text-xs font-medium bg-cyan-950/80 hover:bg-cyan-900/80 text-cyan-200 border border-cyan-500/60 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Report</span>
            </button>
            <button
              type="button"
              onClick={onOpenDesigner}
              className="aero-btn px-3.5 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-300/60 transition-colors cursor-pointer"
            >
              Configure Next Mission
            </button>
            <a
              href="/me/missionverse/choose-mission.html"
              className="aero-btn px-3.5 py-1.5 text-xs font-semibold bg-cyan-950/80 hover:bg-cyan-900/80 text-cyan-100 border border-cyan-500/60 transition-colors"
            >
              Choose Another Mission
            </a>
          </div>
        </div>
      )}

      {/* Collapsible Bottom Aerospace Flight Deck Dock */}
      <div
        className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center transition-transform duration-200 ${
          isDockCollapsed ? 'translate-y-[calc(100%-26px)]' : 'translate-y-0'
        }`}
      >
        <button
          type="button"
          onClick={onToggleDock}
          className="aero-btn rounded-b-none px-3 py-1 text-[11px] font-medium text-slate-200 bg-[#0d1322]/95 border border-b-0 border-slate-700/70 flex items-center gap-1 hover:text-white cursor-pointer"
        >
          {isDockCollapsed ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
          <span>{isDockCollapsed ? 'Show Controls' : 'Hide Controls'}</span>
        </button>

        <div className="aero-panel w-[min(1080px,96vw)] px-3.5 py-2.5 bg-[#0d1322]/95 flex flex-wrap items-center justify-between gap-2">
          {/* Primary Flight Action */}
          <div className="flex items-center gap-1.5">
            {isPrelaunch ? (
              <button
                type="button"
                disabled={!metrics.isGoForLaunch}
                onClick={onStartCountdown}
                className={`aero-btn px-3.5 py-1.5 text-xs font-semibold border flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                  metrics.isGoForLaunch
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-300/60 cursor-pointer'
                    : 'bg-[#171d2c] text-slate-500 border-slate-800 cursor-not-allowed'
                }`}
              >
                <Rocket className="w-3.5 h-3.5" />
                <span>Start Countdown</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onResetPad}
                className="aero-btn px-3 py-1.5 text-xs font-medium text-slate-100 bg-[#172036] hover:bg-[#202d4a] border border-slate-700/70 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Pad</span>
              </button>
            )}

            {canPause && (
              <button
                type="button"
                onClick={onTogglePause}
                className={`aero-btn px-3 py-1.5 text-xs font-medium border flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  telemetry.isPaused
                    ? 'bg-emerald-950/80 border-emerald-600 text-emerald-300 hover:bg-emerald-900/80'
                    : 'bg-[#172036] border-slate-700/70 text-slate-100 hover:bg-[#202d4a]'
                }`}
              >
                {telemetry.isPaused ? (
                  <Play className="w-3.5 h-3.5" />
                ) : (
                  <Pause className="w-3.5 h-3.5" />
                )}
                <span>{telemetry.isPaused ? 'Resume (P)' : 'Pause (P)'}</span>
              </button>
            )}

            {canJumpToMoon && (
              <button
                type="button"
                onClick={onSkipToMoon}
                className="aero-btn px-2.5 py-1.5 text-xs font-medium text-cyan-200 bg-cyan-950/75 hover:bg-cyan-900/80 border border-cyan-700 flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FastForward className="w-3.5 h-3.5" />
                <span>{mission.isDeepSpaceL2 ? 'Jump to L2' : 'Jump to Moon'}</span>
              </button>
            )}
          </div>

          {/* All 7 Camera Angle Presets */}
          <div className="aero-slot flex items-center gap-0.5 p-0.5 bg-[#090d18] overflow-x-auto">
            {(
              [
                ['cinematic', 'Cinematic'],
                ['chase', 'Chase'],
                ['cockpit', 'Cockpit'],
                ['orbital', 'Orbital'],
                ['stage', 'Stage Cam'],
                ['lander', mission.hasLunarLanding ? 'Lander' : mission.csmName ? 'CSM' : 'Spacecraft'],
                ['free', 'Free Orbit'],
              ] as Array<[CameraPreset, string]>
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => onSelectCamera(id)}
                className={`px-2 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  cameraPreset === id
                    ? 'bg-[#253352] text-white border border-slate-500/60'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Time Warp & Audio */}
          <div className="flex items-center gap-1.5">
            <div className="aero-slot flex items-center gap-0.5 p-0.5 bg-[#090d18] font-mono-tabular">
              {[1, 2, 4].map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => onSelectWarp(w)}
                  className={`px-2 py-1 text-[11px] rounded-md transition-colors cursor-pointer ${
                    timeWarp === w
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {w}x
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onToggleMute}
              aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
              className="aero-btn p-1.5 text-slate-200 hover:text-white bg-[#172036] hover:bg-[#202d4a] border border-slate-700/70 transition-colors cursor-pointer"
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4 text-slate-500" />
              ) : (
                <Volume2 className="w-4 h-4 text-amber-400" />
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
