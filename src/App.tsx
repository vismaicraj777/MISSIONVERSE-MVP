/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ControlsHelpModal } from './components/ControlsHelpModal';
import { CommLogEntry, DecisionRecord, FlightHUD } from './components/FlightHUD';
import { MissionDesignPanel } from './components/MissionDesignPanel';
import { MissionEventModal } from './components/MissionEventModal';
import { TrajectoryNavModal } from './components/TrajectoryNavModal';
import { MISSION_EVENTS, MissionEvent, MissionEventOption } from './data/missionEvents';
import {
  CommsSystemType,
  computeMissionMetrics,
  CustomMissionDraft,
  DEFAULT_CUSTOM_DRAFT,
  DifficultyMode,
  EnginePackageType,
  MISSIONS,
  MissionDesignState,
  PowerSourceType,
  resolveMissionConfig,
  TrajectoryProfileType,
} from './data/missions';
import {
  CameraPreset,
  FlightPhase,
  ManeuverPlan,
  SpaceSimulation,
  TelemetrySnapshot,
} from './engine/SpaceSimulation';

// The MISSIONVERSE mission pages pass a mission id in the URL when the
// visitor chooses CHOOSE THIS CHALLENGE. Fall back to Apollo 11 for direct visits.
const MISSIONVERSE_ID_MAP: Record<string, string> = {
  apollo11: 'apollo-11',
  apollo17: 'apollo-17',
  apollo8: 'apollo-8',
  lunarorbiter1: 'lunar-orbiter-1',
  surveyor3: 'surveyor-3',
  jwst: 'jwst',
};

const requestedMissionId =
  typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('mission') ?? ''
    : '';
const resolvedInitialMissionId =
  MISSIONVERSE_ID_MAP[requestedMissionId] ?? requestedMissionId;
const INITIAL_MISSION =
  MISSIONS.find((mission) => mission.id === resolvedInitialMissionId) ?? MISSIONS[0];

const historicalPowerForMission = (missionId: string): PowerSourceType =>
  missionId.startsWith('apollo-') ? 'fuel-cell' : 'solar';

const CAMERA_ORDER: CameraPreset[] = [
  'cinematic',
  'chase',
  'cockpit',
  'orbital',
  'stage',
  'lander',
  'free',
];

const INITIAL_TELEMETRY: TelemetrySnapshot = {
  phase: 'PRELAUNCH',
  phaseLabel: 'Pre-Launch Pad Readiness',
  activeStageName: `${INITIAL_MISSION.launchVehicle} Ready`,
  missionTimeSec: 0,
  countdownSec: 5,
  altitudeKm: 0,
  altitudeReference: 'EARTH',
  lunarAltitudeM: 0,
  earthDistanceKm: 0,
  moonDistanceKm: 384400,
  velocityMs: 0,
  verticalSpeedMs: 0,
  horizontalSpeedMs: 0,
  downrangeKm: 0,
  machNumber: 0,
  stageFuelPct: 100,
  landerFuelPct: 100,
  deltaVRemainingMs: 5200,
  powerBusPct: 100,
  commsSignalPct: 98,
  trajectoryErrorDeg: 1.2,
  throttle: 0,
  pitchDeg: 0,
  yawDeg: 0,
  rollDeg: 0,
  gearDeployed: false,
  autopilotEnabled: true,
  rcsActive: false,
  isPaused: false,
  accelerationMs2: 0,
  gForce: 1.0,
  distanceToTargetM: 0,
  surfaceOpsProgress: 0,
  surfaceSamplesCollected: 0,
  surfaceSamplesTotal: 5,
  surfaceTasksDone: [false, false, false],
  surfaceInstrumentsDeployed: false,
  roverDistanceM: 0,
  nearestDiscoveryDistM: 0,
  nearestDiscoveryBearingDeg: 0,
  dataQueuedMb: 0,
  dataTransmittedMb: 0,
  downlinkRateKbps: 112,
  gatesPassed: 0,
  gatesTotal: 4,
  latestDiscovery: null,
  orbitTasksDone: [false, false, false],
  systemsStatus: {
    propulsion: 'GO',
    power: 'GO',
    guidance: 'GO',
    comms: 'GO',
    lifeSupport: 'GO',
  },
  maneuverPending: null,
  fuelScore: 100,
  navScore: 95,
  landingScore: 0,
  scienceTotalScore: 0,
  safetyScore: 100,
  overallScore: 95,
  missionAwardRank: 'Mission Qualified',
};

function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `T+${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const simRef = useRef<SpaceSimulation | null>(null);
  const triggeredEventsRef = useRef<Set<string>>(new Set());
  const missionTimeRef = useRef<number>(0);

  const [design, setDesign] = useState<MissionDesignState>({
    missionId: INITIAL_MISSION.id,
    selectedPayloadIds: INITIAL_MISSION.defaultPayloads,
    fuelFillRatio: 1.0,
    guidanceLevel: 'precision',
    difficulty: 'historical',
    selectedSiteId: INITIAL_MISSION.landingSites?.[0]?.id,
    powerSource: historicalPowerForMission(INITIAL_MISSION.id),
    enginePackage: 'heritage',
    commsSystem: 'omni-sband',
    trajectoryType: 'free-return',
    customDraft: DEFAULT_CUSTOM_DRAFT,
  });

  const [isDesignerOpen, setIsDesignerOpen] = useState(false);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isDockCollapsed, setIsDockCollapsed] = useState(false);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('chase');
  const [timeWarp, setTimeWarp] = useState(1);
  const [isMuted, setIsMuted] = useState(() => {
    try {
      return window.localStorage.getItem('missionverse:muted') === 'true';
    } catch {
      return false;
    }
  });
  const [volume, setVolume] = useState(0.75);
  const [speechEnabled, setSpeechEnabled] = useState(false);
  const [telemetry, setTelemetry] = useState<TelemetrySnapshot>(INITIAL_TELEMETRY);
  const [webglError, setWebglError] = useState<string | null>(null);
  const [contextLost, setContextLost] = useState(false);
  const [activeEvent, setActiveEvent] = useState<MissionEvent | null>(null);
  const [decisionsLog, setDecisionsLog] = useState<DecisionRecord[]>([]);
  const [commLog, setCommLog] = useState<CommLogEntry[]>([
    {
      id: 'init-1',
      timeLabel: 'T+00:00',
      speaker: 'FLIGHT',
      message: `${INITIAL_MISSION.name} (${INITIAL_MISSION.designation}) on Pad LC-39A. Systems GO for mission configuration.`,
      tone: 'info',
    },
  ]);

  const selectedMission = useMemo(() => resolveMissionConfig(design), [design]);

  const metrics = useMemo(
    () => computeMissionMetrics(selectedMission, design),
    [selectedMission, design],
  );

  const selectedMissionRef = useRef(selectedMission);
  const designRef = useRef(design);
  selectedMissionRef.current = selectedMission;
  designRef.current = design;

  const lastRecordedTerminalRef = useRef('');
  useEffect(() => {
    const isTerminal = telemetry.phase === 'MISSION_COMPLETE' || telemetry.phase === 'MISSION_FAILED';
    if (!isTerminal) {
      lastRecordedTerminalRef.current = '';
      return;
    }

    const terminalKey = `${selectedMission.id}:${telemetry.phase}`;
    if (lastRecordedTerminalRef.current === terminalKey) return;
    lastRecordedTerminalRef.current = terminalKey;

    try {
      const saved = JSON.parse(window.localStorage.getItem('missionverse:history') ?? '[]');
      const history = Array.isArray(saved) ? saved : [];
      history.unshift({
        mission: selectedMission.name,
        missionId: selectedMission.id,
        designation: selectedMission.designation,
        launchVehicle: selectedMission.launchVehicle,
        result: telemetry.phase,
        score: telemetry.overallScore,
        grade: telemetry.missionAwardRank,
        outcome: telemetry.outcomeMessage ?? '',
        date: new Date().toISOString(),
        design: {
          power: design.powerSource ?? 'solar',
          engines: design.enginePackage ?? 'heritage',
          communications: design.commsSystem ?? 'omni-sband',
          trajectory: design.trajectoryType ?? 'free-return',
        },
      });
      window.localStorage.setItem('missionverse:history', JSON.stringify(history.slice(0, 30)));
    } catch {
      // The mission itself remains playable if browser storage is unavailable.
    }
  }, [
    design.commsSystem,
    design.enginePackage,
    design.powerSource,
    design.trajectoryType,
    selectedMission.designation,
    selectedMission.id,
    selectedMission.launchVehicle,
    selectedMission.name,
    telemetry.missionAwardRank,
    telemetry.outcomeMessage,
    telemetry.overallScore,
    telemetry.phase,
  ]);

  const pushComm = useCallback(
    (speaker: string, message: string, tone: CommLogEntry['tone'] = 'info', speak = false) => {
      const entry: CommLogEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timeLabel: formatClock(missionTimeRef.current),
        speaker,
        message,
        tone,
      };
      setCommLog((prev) => [entry, ...prev].slice(0, 40));
      if (speak) {
        simRef.current?.speakCallout(`${speaker}: ${message}`);
      }
    },
    [],
  );

  const handlePhaseChange = useCallback(
    (phase: FlightPhase) => {
      const m = selectedMissionRef.current;
      const d = designRef.current;

      const phaseCalls: Partial<Record<FlightPhase, [string, string, CommLogEntry['tone']]>> = {
        COUNTDOWN: ['LAUNCH CONTROL', `T-minus 5 seconds and counting for ${m.name}.`, 'info'],
        IGNITION: ['FLIGHT', `Main engine ignition sequence started on ${m.launchVehicle}.`, 'info'],
        LIFTOFF: ['CAPCOM', `Liftoff! We have cleared the tower on ${m.name}.`, 'success'],
        STAGE_1_SEP: ['FIDO', 'MECO confirmed. Stage 1 separation clean.', 'info'],
        STAGE_2_ASCENT: ['GUIDANCE', 'Stage 2 ignition. Guidance nominal downrange.', 'info'],
        EARTH_DEPARTURE: [
          'FIDO',
          m.isDeepSpaceL2
            ? 'Go for Ariane 5 ESC-A precision Sun-Earth L2 injection burn.'
            : 'Go for Trans-Lunar Injection burn.',
          'info',
        ],
        TRANSLUNAR_CRUISE: [
          'NAV',
          m.isDeepSpaceL2
            ? 'L2 injection cutoff nominal! Fairing jettisoned. Monitor MCC-2 trajectory.'
            : 'TLI cutoff nominal. Monitor cislunar trajectory and confirm MCC-2 burn.',
          'info',
        ],
        LUNAR_APPROACH: [
          'FLIGHT',
          m.isDeepSpaceL2
            ? 'Approaching Sun-Earth L2 Halo Orbit (1.5M km). Prepare insertion burn.'
            : 'Entering lunar sphere of influence. Prepare LOI burn.',
          'info',
        ],
        LUNAR_ORBIT: [
          'CAPCOM',
          m.isDeepSpaceL2
            ? 'JWST captured cleanly into Sun-Earth L2 Halo Orbit!'
            : 'Lunar orbit capture confirmed at 112 km.',
          'success',
        ],
        LUNAR_ORBIT_SURVEY: [
          'CAPCOM',
          m.isDeepSpaceL2
            ? 'Unfolding 5-layer Kapton sunshield and calibrating 18 gold mirror segments.'
            : m.id === 'lunar-orbiter-1'
              ? 'Lunar Orbiter 1 in mapping orbit. Capture Apollo sites & Earthrise frames.'
              : `${m.csmName ?? 'CSM-103'} in survey orbit. Complete Earthrise & site reconnaissance tasks.`,
          'info',
        ],
        LUNAR_DESCENT: ['GUIDANCE', 'Powered descent initiated. Watch sink rate and landing gear.', 'info'],
        SURFACE_OPS: [
          'CAPCOM',
          m.id === 'surveyor-3'
            ? 'Touchdown in Surveyor Crater! Soil-sampler scoop & panoramic cameras ready.'
            : `Contact light! ${m.landerName} settled on lunar surface. Deploy science & explore.`,
          'success',
        ],
        LUNAR_ASCENT: ['GUIDANCE', 'Ascent stage ignition! Rising to lunar orbit rendezvous.', 'info'],
        LUNAR_RENDEZVOUS: ['FLIGHT', 'CSM docking complete. Execute TEI burn for Earth return.', 'success'],
        RETURN_JOURNEY: ['FIDO', 'Trans-Earth Injection complete. Inbound to Earth corridor.', 'info'],
        EARTH_REENTRY: ['CAPCOM', 'Entry interface at 120 km. Heatshield plasma nominal.', 'info'],
        MISSION_COMPLETE: ['FLIGHT', `${m.name} mission accomplished!`, 'success'],
        MISSION_FAILED: ['FLIGHT', 'Vehicle lost. Review descent telemetry and try again.', 'warn'],
      };

      const call = phaseCalls[phase];
      if (call) {
        pushComm(call[0], call[1], call[2], true);
      }

      // Check dynamic in-flight event triggers
      const candidate = MISSION_EVENTS.find((ev) => {
        if (triggeredEventsRef.current.has(ev.id)) return false;
        if (ev.phaseTrigger !== phase) return false;
        if (ev.missionFilter && !ev.missionFilter.includes(m.id)) return false;
        if (ev.categoryFilter && ev.categoryFilter !== m.category) return false;
        // In practice mode trigger only Apollo 11 1202 or Apollo 8 Earthrise highlights
        if (
          d.difficulty === 'practice' &&
          ev.id !== 'apollo11-1202-alarm' &&
          ev.id !== 'apollo8-earthrise-window'
        ) {
          return false;
        }
        return true;
      });

      if (candidate) {
        triggeredEventsRef.current.add(candidate.id);
        simRef.current?.setPaused(true);
        simRef.current?.playWarningChime();
        setActiveEvent(candidate);
      }
    },
    [pushComm],
  );

  // Mount Three.js simulation once in isolated ref container
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    try {
      const sim = new SpaceSimulation(
        container,
        selectedMission,
        design,
        metrics,
        (snap) => {
          missionTimeRef.current = snap.missionTimeSec;
          setTelemetry(snap);
        },
        handlePhaseChange,
        (lost) => {
          setContextLost(lost);
        },
      );
      simRef.current = sim;

      return () => {
        sim.dispose();
        simRef.current = null;
      };
    } catch (err) {
      setWebglError(
        err instanceof Error ? err.message : 'Unable to initialize 3D WebGL viewport.',
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    simRef.current?.setMuted(isMuted);
    try {
      window.localStorage.setItem('missionverse:muted', String(isMuted));
    } catch {
      // Muting still works for this flight when storage is unavailable.
    }
  }, [isMuted]);

  // Keyboard flight controls
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName ?? '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.code === 'KeyM' && !isDesignerOpen && !activeEvent) {
        e.preventDefault();
        setIsNavOpen((prev) => !prev);
        return;
      }
      if (e.code === 'KeyH' && !isDesignerOpen && !activeEvent) {
        e.preventDefault();
        setIsHelpOpen((prev) => !prev);
        return;
      }

      if (isDesignerOpen || activeEvent || isNavOpen || isHelpOpen) return;

      if (simRef.current) {
        simRef.current.keysPressed[e.code] = true;
      }

      if (e.code === 'KeyP') {
        simRef.current?.togglePause();
      } else if (e.code === 'KeyG') {
        simRef.current?.toggleGear();
      } else if (e.code === 'KeyC') {
        setCameraPreset((prev) => {
          const next = CAMERA_ORDER[(CAMERA_ORDER.indexOf(prev) + 1) % CAMERA_ORDER.length];
          simRef.current?.setCameraPreset(next);
          return next;
        });
      } else if (e.code === 'Space') {
        e.preventDefault();
        if (telemetry.phase === 'PRELAUNCH' && metrics.isGoForLaunch) {
          simRef.current?.startCountdown();
        } else if (telemetry.phase === 'SURFACE_OPS') {
          simRef.current?.triggerEvaHop();
        } else if (
          telemetry.phase !== 'PRELAUNCH' &&
          telemetry.phase !== 'COUNTDOWN' &&
          telemetry.phase !== 'MISSION_COMPLETE' &&
          telemetry.phase !== 'MISSION_FAILED'
        ) {
          simRef.current?.togglePause();
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (simRef.current) {
        simRef.current.keysPressed[e.code] = false;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [
    isDesignerOpen,
    activeEvent,
    isNavOpen,
    isHelpOpen,
    telemetry.phase,
    metrics.isGoForLaunch,
  ]);

  const applyDesignToSim = (nextDesign: MissionDesignState) => {
    const nextMission = resolveMissionConfig(nextDesign);
    const nextMetrics = computeMissionMetrics(nextMission, nextDesign);
    triggeredEventsRef.current.clear();
    setActiveEvent(null);
    setDecisionsLog([]);
    setDesign(nextDesign);
    simRef.current?.loadMission(nextMission, nextDesign, nextMetrics);
    setCameraPreset('chase');
    setCommLog([
      {
        id: `load-${Date.now()}`,
        timeLabel: 'T+00:00',
        speaker: 'FLIGHT',
        message: `${nextMission.name} configured in ${nextDesign.difficulty.toUpperCase()} mode. Ready on launch pad.`,
        tone: 'info',
      },
    ]);
  };

  const handleSelectMission = (missionId: string) => {
    const draftDesign = { ...design, missionId };
    const nextMission = resolveMissionConfig(draftDesign);
    const recommendedPower: PowerSourceType =
      missionId === 'custom-architect' && design.customDraft?.destinationId === 'south-pole'
        ? 'rtg'
        : historicalPowerForMission(nextMission.id);
    applyDesignToSim({
      ...draftDesign,
      selectedPayloadIds: [...nextMission.defaultPayloads],
      fuelFillRatio: 1.0,
      guidanceLevel: 'precision',
      selectedSiteId: nextMission.landingSites?.[0]?.id,
      powerSource: recommendedPower,
      enginePackage: 'heritage',
    });
  };

  const handleTogglePayload = (payloadId: string) => {
    if (payloadId === 'lrv-rover' && selectedMissionRef.current.id !== 'custom-architect') {
      return;
    }
    if (payloadId === 'lrv-rover' && !selectedMissionRef.current.hasRoverOps) {
      return;
    }
    const exists = design.selectedPayloadIds.includes(payloadId);
    const nextIds = exists
      ? design.selectedPayloadIds.filter((id) => id !== payloadId)
      : [...design.selectedPayloadIds, payloadId];
    applyDesignToSim({ ...design, selectedPayloadIds: nextIds });
  };

  const handleChangeFuel = (ratio: number) => {
    applyDesignToSim({ ...design, fuelFillRatio: ratio });
  };

  const handleChangeGuidance = (level: 'standard' | 'precision') => {
    applyDesignToSim({ ...design, guidanceLevel: level });
  };

  const handleChangeDifficulty = (mode: DifficultyMode) => {
    applyDesignToSim({ ...design, difficulty: mode });
  };

  const handleChangeLandingSite = (siteId: string) => {
    applyDesignToSim({ ...design, selectedSiteId: siteId });
  };

  const handleChangePowerSource = (powerSource: PowerSourceType) => {
    applyDesignToSim({ ...design, powerSource });
  };

  const handleChangeEnginePackage = (enginePackage: EnginePackageType) => {
    applyDesignToSim({ ...design, enginePackage });
  };

  const handleChangeCommsSystem = (commsSystem: CommsSystemType) => {
    applyDesignToSim({ ...design, commsSystem });
  };

  const handleChangeTrajectory = (trajectoryType: TrajectoryProfileType) => {
    applyDesignToSim({ ...design, trajectoryType });
  };

  const handleUpdateCustomDraft = (patch: Partial<CustomMissionDraft>) => {
    const nextDraft: CustomMissionDraft = {
      ...(design.customDraft ?? DEFAULT_CUSTOM_DRAFT),
      ...patch,
    };
    const nextDesign: MissionDesignState = {
      ...design,
      missionId: 'custom-architect',
      customDraft: nextDraft,
    };
    const nextMission = resolveMissionConfig(nextDesign);
    const selectedPayloadIds = nextMission.hasRoverOps
      ? Array.from(new Set([...design.selectedPayloadIds, 'lrv-rover']))
      : design.selectedPayloadIds.filter((id) => id !== 'lrv-rover');
    applyDesignToSim({
      ...nextDesign,
      selectedPayloadIds,
      selectedSiteId: nextMission.landingSites?.[0]?.id,
      powerSource: nextDraft.destinationId === 'south-pole' ? 'rtg' : design.powerSource ?? 'solar',
    });
  };

  const handleStartCountdown = () => {
    if (!metrics.isGoForLaunch) return;
    setIsDesignerOpen(false);
    simRef.current?.startCountdown();
    setCameraPreset('chase');
  };

  const handleSkipToMoon = () => {
    setIsDesignerOpen(false);
    setIsNavOpen(false);
    simRef.current?.skipToLunarApproach();
    setCameraPreset(selectedMission.hasLunarLanding ? 'lander' : 'orbital');
    pushComm(
      'FIDO',
      selectedMission.isDeepSpaceL2
        ? 'Jumped directly to Sun-Earth L2 Halo Approach corridor. Prepare HOI burn.'
        : 'Jumped directly to Lunar Approach corridor. Prepare for LOI burn.',
      'info',
    );
  };

  const handleResetPad = () => {
    triggeredEventsRef.current.clear();
    setActiveEvent(null);
    setDecisionsLog([]);
    simRef.current?.loadMission(selectedMission, design, metrics);
    setCameraPreset('chase');
    setCommLog([
      {
        id: `reset-${Date.now()}`,
        timeLabel: 'T+00:00',
        speaker: 'FLIGHT',
        message: `${selectedMission.name} reset on launch pad.`,
        tone: 'info',
      },
    ]);
  };

  const handleChooseEventOption = (option: MissionEventOption) => {
    if (!activeEvent) return;
    simRef.current?.applyEventConsequence(option.effects);
    simRef.current?.setPaused(false);
    setDecisionsLog((prev) => [
      ...prev,
      {
        eventTitle: activeEvent.title,
        chosenLabel: option.label,
        consequence: option.consequenceText,
      },
    ]);
    pushComm(
      activeEvent.caller,
      `Decision logged: ${option.label} — ${option.consequenceText}`,
      'warn',
    );
    setActiveEvent(null);
  };

  const handleExecuteManeuver = (type: ManeuverPlan['type']) => {
    simRef.current?.executeManeuverBurn(type);
    pushComm('FIDO', `${type} engine burn confirmed. Trajectory vector updated.`, 'success', true);
  };

  const handleSelectCamera = (preset: CameraPreset) => {
    setCameraPreset(preset);
    simRef.current?.setCameraPreset(preset);
  };

  const handleSelectWarp = (warp: number) => {
    setTimeWarp(warp);
    simRef.current?.setTimeWarp(warp);
  };

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    simRef.current?.setMuted(next);
  };

  const handleChangeVolume = (vol: number) => {
    setVolume(vol);
    if (vol > 0 && isMuted) {
      setIsMuted(false);
      simRef.current?.setMuted(false);
    }
    simRef.current?.setVolume(vol);
  };

  const handleToggleSpeech = () => {
    const next = !speechEnabled;
    setSpeechEnabled(next);
    simRef.current?.setSpeechEnabled(next);
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#06080d] select-none">
      {/* Isolated WebGL Viewport */}
      <div ref={canvasMountRef} className="w-full h-full" />

      {webglError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#060911] p-6">
          <div className="aero-panel max-w-md p-6 bg-[#0d1322] text-center">
            <h2 className="font-display text-base text-white">
              3D Viewport Unavailable
            </h2>
            <p className="text-xs text-slate-300 mt-2">{webglError}</p>
          </div>
        </div>
      )}

      {contextLost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6">
          <div className="aero-panel max-w-md p-5 bg-[#0d1322] border-amber-500/60 text-center">
            <h2 className="font-display text-sm text-amber-300">
              WebGL Graphics Context Interrupted
            </h2>
            <p className="text-xs text-slate-300 mt-2">
              Attempting automatic GPU context recovery. You can also reset the pad if needed.
            </p>
          </div>
        </div>
      )}

      {/* Semantic HUD & Collapsible Bottom Dock */}
      <FlightHUD
        mission={selectedMission}
        design={design}
        metrics={metrics}
        telemetry={telemetry}
        cameraPreset={cameraPreset}
        timeWarp={timeWarp}
        isMuted={isMuted}
        volume={volume}
        speechEnabled={speechEnabled}
        isDockCollapsed={isDockCollapsed}
        commLog={commLog}
        decisionsLog={decisionsLog}
        onToggleDock={() => setIsDockCollapsed((p) => !p)}
        onOpenDesigner={() => setIsDesignerOpen(true)}
        onOpenNav={() => setIsNavOpen(true)}
        onOpenHelp={() => setIsHelpOpen(true)}
        onStartCountdown={handleStartCountdown}
        onSkipToMoon={handleSkipToMoon}
        onResetPad={handleResetPad}
        onTogglePause={() => simRef.current?.togglePause()}
        onProceedSurface={() => simRef.current?.triggerNextPhaseFromSurface()}
        onDeploySurface={() => simRef.current?.triggerSurfaceDeploy()}
        onCompleteSurfaceTask={(idx) => simRef.current?.completeSurveyorSurfaceTask(idx)}
        onCompleteOrbitTask={(idx) => simRef.current?.completeOrbitTask(idx)}
        onFinishOrbitSurvey={() => simRef.current?.finishOrbitalSurvey()}
        onExecuteManeuver={handleExecuteManeuver}
        onSelectCamera={handleSelectCamera}
        onSelectWarp={handleSelectWarp}
        onToggleMute={handleToggleMute}
        onChangeVolume={handleChangeVolume}
        onToggleSpeech={handleToggleSpeech}
        onToggleAutopilot={() => simRef.current?.setAutopilot(!telemetry.autopilotEnabled)}
        onToggleGear={() => simRef.current?.toggleGear()}
        onSetThrottle={(val) => simRef.current?.setThrottle(val)}
        onVirtualInput={(code, pressed) => simRef.current?.setVirtualInput(code, pressed)}
        onEvaHop={() => simRef.current?.triggerEvaHop()}
        onDismissDiscovery={() => simRef.current?.dismissDiscovery()}
      />

      {/* Space Mission Design & Pre-Launch Readiness Console */}
      <MissionDesignPanel
        isOpen={isDesignerOpen}
        onClose={() => setIsDesignerOpen(false)}
        selectedMission={selectedMission}
        design={design}
        metrics={metrics}
        onSelectMission={handleSelectMission}
        onTogglePayload={handleTogglePayload}
        onChangeFuel={handleChangeFuel}
        onChangeGuidance={handleChangeGuidance}
        onChangeDifficulty={handleChangeDifficulty}
        onChangeLandingSite={handleChangeLandingSite}
        onChangePowerSource={handleChangePowerSource}
        onChangeEnginePackage={handleChangeEnginePackage}
        onChangeCommsSystem={handleChangeCommsSystem}
        onChangeTrajectory={handleChangeTrajectory}
        onUpdateCustomDraft={handleUpdateCustomDraft}
        onLaunch={handleStartCountdown}
      />

      {/* Cislunar Navigation & Maneuver Planner Modal */}
      <TrajectoryNavModal
        isOpen={isNavOpen}
        onClose={() => setIsNavOpen(false)}
        mission={selectedMission}
        telemetry={telemetry}
        onExecuteManeuver={handleExecuteManeuver}
      />

      {/* In-Flight Mission Event / Anomaly Modal */}
      <MissionEventModal event={activeEvent} onSelectOption={handleChooseEventOption} />

      {/* Controls & Flight Guide Modal */}
      <ControlsHelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  );
}
