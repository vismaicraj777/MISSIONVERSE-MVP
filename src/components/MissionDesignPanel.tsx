import React, { useState } from 'react';
import {
  COMMS_SYSTEMS,
  CommsSystemType,
  ComputedMissionMetrics,
  CustomMissionDraft,
  DEFAULT_CUSTOM_DRAFT,
  DIFFICULTY_INFO,
  DifficultyMode,
  ENGINE_PACKAGES,
  EnginePackageType,
  MISSIONS,
  MissionCategory,
  MissionConfig,
  MissionDesignState,
  POWER_SOURCES,
  PowerSourceType,
  SCIENCE_PAYLOADS,
  TRAJECTORY_PROFILES,
  TrajectoryProfileType,
  VehicleArchitecture,
} from '../data/missions';
import {
  AlertTriangle,
  BatteryCharging,
  Check,
  ChevronRight,
  Fuel,
  MapPin,
  Orbit,
  Radio,
  Rocket,
  SatelliteDish,
  ShieldCheck,
  Wrench,
  X,
} from 'lucide-react';

interface MissionDesignPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMission: MissionConfig;
  design: MissionDesignState;
  metrics: ComputedMissionMetrics;
  onSelectMission: (missionId: string) => void;
  onTogglePayload: (payloadId: string) => void;
  onChangeFuel: (ratio: number) => void;
  onChangeGuidance: (level: 'standard' | 'precision') => void;
  onChangeDifficulty: (mode: DifficultyMode) => void;
  onChangeLandingSite: (siteId: string) => void;
  onChangePowerSource: (power: PowerSourceType) => void;
  onChangeEnginePackage: (engine: EnginePackageType) => void;
  onChangeCommsSystem: (comms: CommsSystemType) => void;
  onChangeTrajectory: (traj: TrajectoryProfileType) => void;
  onUpdateCustomDraft: (patch: Partial<CustomMissionDraft>) => void;
  onLaunch: () => void;
}

type ReadinessState = 'GO' | 'AMBER' | 'RED';

const MODEL_SOURCE_NOTES: Record<string, string> = {
  'apollo-11': 'NASA GLBs: Saturn V, Apollo LM, Apollo CSM reference.',
  'apollo-8': 'NASA GLBs: Saturn V and Apollo CSM reference; no lunar lander.',
  'apollo-17': 'NASA GLBs: Saturn V, Apollo LM and CSM reference; Apollo LRV rebuilt from NASA press-kit drawings.',
  'lunar-orbiter-1': 'LO-1 reconstructed from NASA mission data; Atlas 6/Agena-family GLBs are visual references, not this exact flight stack.',
  'surveyor-3': 'Surveyor-C rebuilt from NASA/JPL drawings; launch stages are schematic Atlas-Centaur references.',
  jwst: 'NASA/GSFC JWST GLB; Ariane 5 ECA launch vehicle is a data-based procedural reconstruction.',
};

export const MissionDesignPanel: React.FC<MissionDesignPanelProps> = ({
  isOpen,
  onClose,
  selectedMission,
  design,
  metrics,
  onSelectMission,
  onTogglePayload,
  onChangeFuel,
  onChangeGuidance,
  onChangeDifficulty,
  onChangeLandingSite,
  onChangePowerSource,
  onChangeEnginePackage,
  onChangeCommsSystem,
  onChangeTrajectory,
  onUpdateCustomDraft,
  onLaunch,
}) => {
  const [categoryTab, setCategoryTab] = useState<MissionCategory>(
    design.missionId === 'custom-architect' ? 'custom' : selectedMission.category,
  );
  const [checklist, setChecklist] = useState<boolean[]>([true, true, true, true]);

  if (!isOpen) return null;

  const filteredMissions = MISSIONS.filter((m) => m.category === categoryTab);
  const allChecked = checklist.every(Boolean);
  const canCommitLaunch = metrics.isGoForLaunch && allChecked;
  const draft = design.customDraft ?? DEFAULT_CUSTOM_DRAFT;
  const activePower = design.powerSource ?? 'solar';
  const activeComms = design.commsSystem ?? 'omni-sband';
  const activeTraj = design.trajectoryType ?? 'free-return';

  const toggleCheckItem = (idx: number) => {
    setChecklist((prev) => prev.map((v, i) => (i === idx ? !v : v)));
  };

  const powerPctUsed = Math.min(
    100,
    Math.round((metrics.powerUsedW / Math.max(1, metrics.effectivePowerBusW)) * 100),
  );
  const budgetPctUsed = Math.min(
    100,
    Math.round((metrics.totalCostM / Math.max(1, metrics.budgetCapM)) * 100),
  );
  const dvPctMargin = Math.max(
    0,
    Math.min(100, Math.round((metrics.availableDeltaV / Math.max(1, metrics.requiredDeltaV + 600)) * 100)),
  );

  const readinessMatrix: Array<{ label: string; state: ReadinessState; detail: string }> = [
    {
      label: 'Mission Profile',
      state: design.selectedPayloadIds.length > 0 ? 'GO' : 'RED',
      detail: selectedMission.isDeepSpaceL2
        ? 'Sun-Earth L2 Observatory'
        : selectedMission.hasLunarLanding
          ? 'Landing + Surface Ops'
          : 'Lunar Orbit Survey',
    },
    {
      label: 'Propulsion / Δv',
      state:
        metrics.deltaVMargin < 0 || metrics.twr < 1.12
          ? 'RED'
          : metrics.deltaVMargin < 180
            ? 'AMBER'
            : 'GO',
      detail: `${metrics.deltaVMargin >= 0 ? '+' : ''}${metrics.deltaVMargin} m/s · TWR ${metrics.twr.toFixed(2)}`,
    },
    {
      label: 'Power Bus',
      state:
        metrics.powerUsedW > metrics.effectivePowerBusW
          ? 'RED'
          : metrics.powerUsedW > metrics.effectivePowerBusW * 0.9 ||
              (metrics.isPolarShadowed && activePower === 'solar')
            ? 'AMBER'
            : 'GO',
      detail: `${metrics.powerUsedW}W / ${metrics.effectivePowerBusW}W`,
    },
    {
      label: 'Guidance / Nav',
      state: design.guidanceLevel === 'precision' ? 'GO' : 'AMBER',
      detail: design.guidanceLevel === 'precision' ? 'Terrain TRN + IMU' : 'Standard IMU Only',
    },
    {
      label: 'Comms Downlink',
      state: metrics.dataRateKbps >= 90 ? 'GO' : 'AMBER',
      detail: `${metrics.dataRateKbps} kbps (${COMMS_SYSTEMS[activeComms].shortLabel})`,
    },
    {
      label: 'Budget & Thermal',
      state: metrics.totalCostM <= metrics.budgetCapM ? 'GO' : 'RED',
      detail: `${metrics.totalCostM} / ${metrics.budgetCapM} M cr`,
    },
    {
      label: 'Checklist Status',
      state: allChecked ? 'GO' : 'AMBER',
      detail: `${checklist.filter(Boolean).length}/4 Verified`,
    },
  ];

  const badgeTone = (state: ReadinessState) =>
    state === 'GO'
      ? 'text-emerald-300 border-emerald-700 bg-emerald-950/60'
      : state === 'AMBER'
        ? 'text-amber-300 border-amber-700 bg-amber-950/60'
        : 'text-rose-300 border-rose-700 bg-rose-950/60';

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-3 md:p-6 bg-black/80">
      <div className="aero-panel w-full max-w-6xl max-h-[92vh] flex flex-col bg-[#0d1322] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-[#131b2e]">
          <div>
            <h2 className="font-display text-sm md:text-base tracking-tight text-amber-300">
              Space Mission Design & Architect Console
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Trade mass, Δv, power, communications, propulsion, and budget. Historical hardware is the baseline; engine upgrades are what-if studies.
            </p>
            <p className="text-[10px] text-slate-400 mt-1">
              Budget values are MissionVerse M-credits, not NASA contract costs. Scores and upgrade performance are game estimates.
            </p>
            <p className="text-[10px] text-slate-500 mt-1">
              Liftoff TWR uses the launch vehicle’s approximate full-stack mass; mission Δv is a simplified combined-vehicle estimate.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close mission designer"
            className="aero-btn p-2 text-slate-200 hover:text-white bg-[#1e273d] hover:bg-[#2a3654] border border-slate-700/70 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Main Body */}
        <div className="flex-1 overflow-y-auto aero-scroll p-5 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Mission Profile & Custom Architect */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-300">
                01. Mission Profile
              </span>
              <div className="aero-slot flex items-center gap-1 p-1 bg-[#090d18]">
                <button
                  type="button"
                  onClick={() => setCategoryTab('crewed')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    categoryTab === 'crewed'
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Crewed
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryTab('uncrewed')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    categoryTab === 'uncrewed'
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Uncrewed
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCategoryTab('custom');
                    if (design.missionId !== 'custom-architect') {
                      onSelectMission('custom-architect');
                    }
                  }}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1 cursor-pointer ${
                    categoryTab === 'custom'
                      ? 'bg-cyan-400 text-slate-950 font-semibold'
                      : 'text-cyan-300 hover:text-cyan-100'
                  }`}
                >
                  <Wrench className="w-3 h-3" />
                  <span>Architect</span>
                </button>
              </div>
            </div>

            {categoryTab === 'custom' ? (
              <div className="aero-slot p-4 bg-[#090d18] border-cyan-500/50 space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="font-display text-xs text-cyan-300 uppercase tracking-wider">
                    Custom Mission Builder
                  </span>
                  <span className="font-mono-tabular text-[11px] text-amber-300">
                    {selectedMission.launchVehicle}
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Mission Name</label>
                  <input
                    type="text"
                    maxLength={28}
                    value={draft.name}
                    onChange={(e) => onUpdateCustomDraft({ name: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-[#111829] border border-slate-700/80 rounded-md text-white focus:outline-none focus:border-cyan-400"
                    placeholder="Artemis Explorer-X"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Launch Vehicle</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(
                      [
                        ['saturn-v', 'Saturn V (Crewed)'],
                        ['sls-robotic', 'SLS Block 1'],
                        ['ariane-5', 'Ariane 5 ECA'],
                        ['lvm3', 'LVM3-M4'],
                      ] as Array<[VehicleArchitecture, string]>
                    ).map(([arch, label]) => (
                      <button
                        key={arch}
                        type="button"
                        onClick={() => onUpdateCustomDraft({ architecture: arch })}
                        className={`aero-btn px-2.5 py-1.5 text-xs border text-left cursor-pointer ${
                          draft.architecture === arch
                            ? 'bg-cyan-950/80 border-cyan-400 text-cyan-100 font-semibold'
                            : 'bg-[#111829] border-slate-800 text-slate-300 hover:bg-[#172036]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Lunar Destination</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(
                      [
                        ['south-pole', 'South Pole Cold Trap'],
                        ['mare-tranq', 'Tranquility Mare'],
                        ['taurus-littrow', 'Taurus-Littrow Valley'],
                        ['lunar-orbit', '112 km Lunar Orbit'],
                      ] as Array<[CustomMissionDraft['destinationId'], string]>
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onUpdateCustomDraft({ destinationId: id })}
                        className={`aero-btn px-2.5 py-1.5 text-xs border text-left cursor-pointer ${
                          draft.destinationId === id
                            ? 'bg-amber-950/60 border-amber-400 text-amber-100 font-semibold'
                            : 'bg-[#111829] border-slate-800 text-slate-300 hover:bg-[#172036]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {draft.destinationId !== 'lunar-orbit' && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => onUpdateCustomDraft({ hasRoverOps: !draft.hasRoverOps })}
                      className={`aero-btn px-2.5 py-1.5 text-xs border flex items-center justify-between cursor-pointer ${
                        draft.hasRoverOps
                          ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200'
                          : 'bg-[#111829] border-slate-800 text-slate-400'
                      }`}
                    >
                      <span>Surface Rover</span>
                      <span className="font-mono-tabular text-[10px]">
                        {draft.hasRoverOps ? 'YES' : 'NO'}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={draft.architecture !== 'saturn-v'}
                      onClick={() =>
                        onUpdateCustomDraft({ hasReturnJourney: !draft.hasReturnJourney })
                      }
                      className={`aero-btn px-2.5 py-1.5 text-xs border flex items-center justify-between ${
                        draft.architecture !== 'saturn-v'
                          ? 'opacity-40 cursor-not-allowed bg-[#0a0e18] border-slate-800 text-slate-500'
                          : draft.hasReturnJourney
                            ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200 cursor-pointer'
                            : 'bg-[#111829] border-slate-800 text-slate-400 cursor-pointer'
                      }`}
                    >
                      <span>Earth Return</span>
                      <span className="font-mono-tabular text-[10px]">
                        {draft.architecture === 'saturn-v' && draft.hasReturnJourney ? 'YES' : '1-WAY'}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {filteredMissions.map((m) => {
                  const active = m.id === selectedMission.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => onSelectMission(m.id)}
                      className={`aero-btn w-full text-left p-3.5 border transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#192338] border-amber-400'
                          : 'bg-[#111829] border-slate-800/80 hover:bg-[#172036]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display text-sm text-slate-100">{m.name}</span>
                        <span className="font-mono-tabular text-xs text-slate-400">
                          {m.designation} · {m.year}
                        </span>
                      </div>
                      <div className="text-xs text-amber-400 mt-1">
                        {m.launchVehicle} ·{' '}
                        {m.csmName && m.hasLunarLanding
                          ? `${m.csmName} + ${m.landerName}`
                          : m.landerName}
                      </div>
                      <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">{m.summary}</p>
                      <div className="text-[11px] text-slate-400 mt-2 font-mono-tabular">
                        Target: {m.targetSite}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Historical Context vs Simulated Disclaimer */}
            <div className="aero-slot p-3.5 bg-[#090d18] space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono-tabular">
                <span className="text-cyan-400 uppercase tracking-wider">Mission Brief</span>
                <span className="text-slate-400">{selectedMission.historicalDate}</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {selectedMission.historicalFact}
              </p>
              <div className="pt-2 border-t border-slate-800/80">
                <div className="text-[10px] font-medium uppercase tracking-wider text-cyan-400 mb-1">
                  Documented propulsion
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {selectedMission.propulsionSummary}
                </p>
              </div>
              {selectedMission.bonusObjectives.length > 0 && (
                <div className="pt-2 border-t border-slate-800/80">
                  <div className="text-[10px] font-medium uppercase tracking-wider text-amber-400 mb-1">
                    Bonus Flight Objectives
                  </div>
                  {selectedMission.bonusObjectives.map((b, i) => (
                    <div key={i} className="text-[11px] text-slate-400">
                      · {b}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Difficulty, Landing Sites, Payloads, Subsystems & Readiness */}
          <div className="lg:col-span-7 flex flex-col gap-5">
            {/* Difficulty Mode */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-300">
                  02. Simulation Mode & Difficulty
                </span>
                <span className="text-[11px] font-mono-tabular text-slate-400">
                  {design.difficulty === 'challenge'
                    ? 'Tight Fuel & Anomalies Active'
                    : 'Educational Physics Model'}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(['practice', 'historical', 'challenge'] as DifficultyMode[]).map((mode) => {
                  const info = DIFFICULTY_INFO[mode];
                  const active = design.difficulty === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => onChangeDifficulty(mode)}
                      className={`aero-btn text-left p-2.5 border transition-colors cursor-pointer ${
                        active
                          ? 'bg-amber-950/60 border-amber-400 text-slate-100'
                          : 'bg-[#111829] border-slate-800/80 text-slate-400 hover:bg-[#172036]'
                      }`}
                    >
                      <div className="text-xs font-semibold text-slate-100">{info.label}</div>
                      <div className="text-[11px] text-slate-300 mt-1 leading-snug">
                        {info.subtitle}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Landing Site Selection */}
            {selectedMission.landingSites && selectedMission.landingSites.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-amber-400" />
                    Landing Zone Target
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {selectedMission.landingSites.map((site) => {
                    const active =
                      (design.selectedSiteId ?? selectedMission.landingSites?.[0]?.id) === site.id;
                    return (
                      <button
                        key={site.id}
                        type="button"
                        onClick={() => onChangeLandingSite(site.id)}
                        className={`aero-btn text-left p-3 border transition-colors cursor-pointer ${
                          active
                            ? 'bg-cyan-950/65 border-cyan-400'
                            : 'bg-[#111829] border-slate-800/80 hover:bg-[#172036]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-slate-100">{site.name}</span>
                          <span className="font-mono-tabular text-[11px] text-emerald-400">
                            +{site.scienceBonus} Sci
                          </span>
                        </div>
                        <div className="font-mono-tabular text-[10px] text-slate-400 mt-0.5">
                          {site.coordinates} · Roughness {site.roughnessFactor.toFixed(2)}x
                        </div>
                        <p className="text-[11px] text-slate-300 mt-1">{site.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Scientific Instrument Pickups */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-300">
                  03. Mission Hardware & Science Payloads
                </span>
                <span className="font-mono-tabular text-xs text-slate-400">
                  {design.selectedPayloadIds.length} Selected · {metrics.payloadMassKg} kg
                </span>
              </div>
              <p className="text-[10px] text-slate-500 mb-2">
                Historical mission hardware is preselected. Other options are MissionVerse what-if packages; their mass and price are game estimates.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {SCIENCE_PAYLOADS.map((p) => {
                  const selected = design.selectedPayloadIds.includes(p.id);
                  const isCustomRoverDesign =
                    p.id === 'lrv-rover' &&
                    selectedMission.id === 'custom-architect' &&
                    Boolean(selectedMission.hasRoverOps);
                  const disabledForUncrewed =
                    selectedMission.category === 'uncrewed' &&
                    p.recommendedFor === 'crewed' &&
                    !isCustomRoverDesign;
                  const unavailableRover =
                    p.id === 'lrv-rover' && !selectedMission.hasRoverOps;
                  const fixedHistoricalRover =
                    p.id === 'lrv-rover' && selectedMission.id !== 'custom-architect';
                  const disabled = disabledForUncrewed || unavailableRover || fixedHistoricalRover;
                  const isHistoricalHardware = Boolean(
                    selectedMission.heritagePayloadIds?.includes(p.id),
                  );
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => onTogglePayload(p.id)}
                      className={`aero-btn text-left p-3 border transition-colors ${
                        disabled
                          ? 'opacity-40 cursor-not-allowed bg-[#0a0e18] border-slate-800/60'
                          : selected
                            ? 'bg-cyan-950/65 border-cyan-400 cursor-pointer'
                            : 'bg-[#111829] border-slate-800/80 hover:bg-[#172036] cursor-pointer'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs font-semibold text-slate-100">{p.name}</div>
                          <div className="font-mono-tabular text-[11px] text-slate-300 mt-0.5">
                            {p.massKg} kg · {p.powerW} W · {p.costM} M cr · +{p.scienceValue} Sci
                          </div>
                          <div className={`text-[10px] mt-1 ${isHistoricalHardware ? 'text-emerald-300' : 'text-amber-300'}`}>
                            {isHistoricalHardware
                              ? 'Documented mission hardware'
                              : selectedMission.id === 'custom-architect'
                                ? 'Custom design estimate'
                                : 'MissionVerse what-if option'}
                          </div>
                          {p.id === 'lrv-rover' && (
                            <div className="text-[10px] text-slate-400 mt-1">
                              {selectedMission.id === 'apollo-17'
                                ? 'Apollo 17 mission hardware · fixed'
                                : selectedMission.id === 'custom-architect'
                                  ? selectedMission.hasRoverOps
                                    ? 'Available in this custom design'
                                    : 'Enable Surface Rover in mission design'
                                  : 'Not carried on this mission'}
                            </div>
                          )}
                        </div>
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 ${
                            selected
                              ? 'bg-cyan-400 border-cyan-200 text-slate-950'
                              : 'border-slate-500 bg-[#090d18]'
                          }`}
                        >
                          {selected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 04. Spacecraft Subsystems & Trajectory Trade-Offs */}
            <div className="space-y-3 pt-2 border-t border-slate-800/80">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-300 block">
                04. Power, Communications & Trajectory Trade-Offs
              </span>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Power Source */}
                <div className="aero-slot p-3 bg-[#090d18] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-200 font-medium flex items-center gap-1.5">
                      <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
                      Power Source
                    </span>
                    <span className="font-mono-tabular text-[10px] text-emerald-300">
                      {metrics.effectivePowerBusW}W
                    </span>
                  </div>
                  <div className="space-y-1">
                    {(Object.keys(POWER_SOURCES) as PowerSourceType[]).map((pid) => {
                      const spec = POWER_SOURCES[pid];
                      const active = activePower === pid;
                      return (
                        <button
                          key={pid}
                          type="button"
                          onClick={() => onChangePowerSource(pid)}
                          className={`aero-btn w-full text-left px-2.5 py-1.5 text-[11px] border flex items-center justify-between cursor-pointer ${
                            active
                              ? 'bg-emerald-950/60 border-emerald-400 text-emerald-100 font-semibold'
                              : 'bg-[#111829] border-slate-800 text-slate-300 hover:bg-[#172036]'
                          }`}
                        >
                          <span>{spec.shortLabel}</span>
                          <span className="font-mono-tabular text-[10px] text-slate-400">
                            {spec.costM > 0 ? `${spec.costM} M cr` : 'Base'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-slate-400 leading-snug">
                    {POWER_SOURCES[activePower].tradeoffNote}
                    {selectedMission.id.startsWith('apollo-')
                      ? ` Apollo’s CSM used fuel cells and its LM used separate batteries${selectedMission.id === 'apollo-11' ? '; Apollo 11 EASEP used solar panels' : selectedMission.id === 'apollo-17' ? '; Apollo 17 ALSEP used a SNAP-27 radioisotope generator' : ''}. This selector simplifies separate vehicle systems into one game bus.`
                      : ''}
                  </p>
                </div>

                {/* Communications Downlink */}
                <div className="aero-slot p-3 bg-[#090d18] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-200 font-medium flex items-center gap-1.5">
                      <SatelliteDish className="w-3.5 h-3.5 text-cyan-400" />
                      Comms Link
                    </span>
                    <span className="font-mono-tabular text-[10px] text-cyan-300">
                      {metrics.dataRateKbps} kbps
                    </span>
                  </div>
                  <div className="space-y-1">
                    {(Object.keys(COMMS_SYSTEMS) as CommsSystemType[]).map((cid) => {
                      const spec = COMMS_SYSTEMS[cid];
                      const active = activeComms === cid;
                      return (
                        <button
                          key={cid}
                          type="button"
                          onClick={() => onChangeCommsSystem(cid)}
                          className={`aero-btn w-full text-left px-2.5 py-1.5 text-[11px] border flex items-center justify-between cursor-pointer ${
                            active
                              ? 'bg-cyan-950/60 border-cyan-400 text-cyan-100 font-semibold'
                              : 'bg-[#111829] border-slate-800 text-slate-300 hover:bg-[#172036]'
                          }`}
                        >
                          <span>{spec.shortLabel}</span>
                          <span className="font-mono-tabular text-[10px] text-slate-400">
                            {spec.costM > 0 ? `${spec.costM} M cr` : 'Base'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-slate-400 leading-snug">
                    {COMMS_SYSTEMS[activeComms].tradeoffNote}
                  </p>
                </div>

                {/* Trajectory Corridor */}
                <div className="aero-slot p-3 bg-[#090d18] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-200 font-medium flex items-center gap-1.5">
                      <Orbit className="w-3.5 h-3.5 text-amber-400" />
                      Trajectory
                    </span>
                    <span className="font-mono-tabular text-[10px] text-amber-300">
                      {TRAJECTORY_PROFILES[activeTraj].deltaVOffsetMs} m/s
                    </span>
                  </div>
                  <div className="space-y-1">
                    {(Object.keys(TRAJECTORY_PROFILES) as TrajectoryProfileType[]).map((tid) => {
                      const spec = TRAJECTORY_PROFILES[tid];
                      const active = activeTraj === tid;
                      return (
                        <button
                          key={tid}
                          type="button"
                          onClick={() => onChangeTrajectory(tid)}
                          className={`aero-btn w-full text-left px-2.5 py-1.5 text-[11px] border flex items-center justify-between cursor-pointer ${
                            active
                              ? 'bg-amber-950/60 border-amber-400 text-amber-100 font-semibold'
                              : 'bg-[#111829] border-slate-800 text-slate-300 hover:bg-[#172036]'
                          }`}
                        >
                          <span className="truncate">{spec.name.split(' ')[0]}</span>
                          <span className="font-mono-tabular text-[10px] text-slate-400">
                            {spec.deltaVOffsetMs === 0 ? 'Std' : `${spec.deltaVOffsetMs} Δv`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-slate-400 leading-snug">
                    {TRAJECTORY_PROFILES[activeTraj].tradeoffNote}
                  </p>
                </div>
              </div>
            </div>

            {/* Propellant & Guidance Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800/80">
              <div className="aero-slot p-3.5 bg-[#090d18]">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-slate-200 font-medium flex items-center gap-1.5">
                    <Fuel className="w-3.5 h-3.5 text-amber-400" />
                    Propellant Load
                  </span>
                  <span className="font-mono-tabular text-amber-400">
                    {Math.round(design.fuelFillRatio * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.7}
                  max={1.0}
                  step={0.01}
                  value={design.fuelFillRatio}
                  onChange={(e) => onChangeFuel(parseFloat(e.target.value))}
                  className="w-full aero-slider"
                />
                <div className="flex justify-between text-[11px] text-slate-400 mt-1.5 font-mono-tabular">
                  <span>70% Light</span>
                  <span>100% Max Tankage</span>
                </div>
              </div>

              <div className="aero-slot p-3.5 bg-[#090d18]">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-slate-200 font-medium flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-cyan-400" />
                    Guidance Avionics
                  </span>
                  <span className="font-mono-tabular text-slate-400">
                    {design.guidanceLevel === 'precision' ? '+28 M cr · 25W' : 'Base'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => onChangeGuidance('standard')}
                    className={`aero-btn px-2.5 py-1.5 text-xs border transition-colors cursor-pointer ${
                      design.guidanceLevel === 'standard'
                        ? 'bg-[#232d42] border-slate-400 text-white font-medium'
                        : 'bg-[#111829] border-slate-800/80 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Standard IMU
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeGuidance('precision')}
                    className={`aero-btn px-2.5 py-1.5 text-xs border transition-colors cursor-pointer ${
                      design.guidanceLevel === 'precision'
                        ? 'bg-cyan-950/80 border-cyan-400 text-cyan-200 font-medium'
                        : 'bg-[#111829] border-slate-800/80 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Terrain TRN
                  </button>
                </div>
              </div>
            </div>

            <div className="aero-slot p-3.5 bg-[#090d18] space-y-2">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-slate-200 font-medium flex items-center gap-1.5">
                  <Rocket className="w-3.5 h-3.5 text-amber-400" />
                  Launch Propulsion Package
                </span>
                <span className="font-mono-tabular text-[10px] text-amber-300">
                  {metrics.engineThrustMultiplier === 1
                    ? 'Baseline'
                    : `${Math.round((metrics.engineThrustMultiplier - 1) * 100)}% thrust · ${Math.round((metrics.engineIspMultiplier - 1) * 100)}% Isp`}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                {(Object.keys(ENGINE_PACKAGES) as EnginePackageType[]).map((engineId) => {
                  const spec = ENGINE_PACKAGES[engineId];
                  const active = (design.enginePackage ?? 'heritage') === engineId;
                  return (
                    <button
                      key={engineId}
                      type="button"
                      onClick={() => onChangeEnginePackage(engineId)}
                      className={`aero-btn text-left px-2.5 py-2 border cursor-pointer ${
                        active
                          ? 'bg-amber-950/60 border-amber-400 text-amber-100'
                          : 'bg-[#111829] border-slate-800 text-slate-300 hover:bg-[#172036]'
                      }`}
                    >
                      <span className="block text-[11px] font-semibold">{spec.name}</span>
                      <span className="block text-[10px] font-mono-tabular text-slate-400 mt-1">
                        {spec.costM ? `${spec.costM} M cr` : 'Baseline'} · {spec.massKg} kg
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-slate-400 leading-snug">
                {ENGINE_PACKAGES[design.enginePackage ?? 'heritage'].tradeoffNote}
              </p>
            </div>

            {/* 05. Visual Resource Constraint Gauges & Readiness Matrix */}
            <div className="aero-slot p-4 bg-[#090d18] space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  05. Engineering Constraints & Readiness Matrix
                </span>
                <span className="font-mono-tabular text-xs text-amber-400">
                  Projected Science: {metrics.scienceScore} pts ({metrics.scienceMultiplier}x link)
                </span>
              </div>

              {/* 3 Live Resource Balance Bars */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono-tabular text-[11px]">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-400">Δv Capability</span>
                    <span className={metrics.deltaVMargin < 0 ? 'text-rose-400' : 'text-emerald-300'}>
                      {metrics.availableDeltaV} / {metrics.requiredDeltaV} m/s
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-[#111829] overflow-hidden">
                    <div
                      className={`h-full transition-all ${metrics.deltaVMargin < 0 ? 'bg-rose-500' : 'bg-emerald-400'}`}
                      style={{ width: `${dvPctMargin}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-400">Power Load</span>
                    <span className={metrics.powerUsedW > metrics.effectivePowerBusW ? 'text-rose-400' : 'text-cyan-300'}>
                      {metrics.powerUsedW} / {metrics.effectivePowerBusW} W
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-[#111829] overflow-hidden">
                    <div
                      className={`h-full transition-all ${metrics.powerUsedW > metrics.effectivePowerBusW ? 'bg-rose-500' : 'bg-cyan-400'}`}
                      style={{ width: `${powerPctUsed}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-400">Budget Cap</span>
                    <span className={metrics.totalCostM > metrics.budgetCapM ? 'text-rose-400' : 'text-amber-300'}>
                      {metrics.totalCostM} / {metrics.budgetCapM} M cr
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-[#111829] overflow-hidden">
                    <div
                      className={`h-full transition-all ${metrics.totalCostM > metrics.budgetCapM ? 'bg-rose-500' : 'bg-amber-400'}`}
                      style={{ width: `${budgetPctUsed}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {readinessMatrix.map((sys) => (
                  <div key={sys.label} className={`aero-slot p-2 border ${badgeTone(sys.state)}`}>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] text-slate-200 truncate">{sys.label}</span>
                      <span className="font-mono-tabular text-[10px] font-bold">{sys.state}</span>
                    </div>
                    <div className="font-mono-tabular text-[11px] text-slate-100 mt-1 truncate">
                      {sys.detail}
                    </div>
                  </div>
                ))}
                <div className="aero-slot p-2 bg-[#111829]">
                  <div className="text-[10px] text-slate-400">Total Stack Mass</div>
                  <div className="font-mono-tabular text-[11px] font-semibold text-slate-100 mt-1">
                    {metrics.totalSpacecraftMassKg.toLocaleString()} kg
                  </div>
                </div>
              </div>

              {/* Interactive Pre-Launch Verification Checklist */}
              <div className="pt-3 border-t border-slate-800/80">
                <div className="text-[11px] font-medium uppercase tracking-wider text-slate-300 mb-2">
                  Flight Director Pre-Launch Checklist
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {[
                    'Cryogenic LH2/LOX Tanking Pressurized',
                    'Guidance IMU Alignment & Platform Calibrated',
                    'Range Safety & S-Band Telemetry Downlink Verified',
                    'Stage Pyrotechnic Separation Arming Confirmed',
                  ].map((label, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => toggleCheckItem(idx)}
                      className="flex items-center gap-2 text-left text-[11px] text-slate-300 hover:text-white py-1 cursor-pointer"
                    >
                      <span
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          checklist[idx]
                            ? 'bg-emerald-500 border-emerald-300 text-slate-950'
                            : 'border-slate-500 bg-[#090d18]'
                        }`}
                      >
                        {checklist[idx] && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </span>
                      <span className="truncate">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {metrics.warnings.length > 0 && (
                <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-1">
                  {metrics.warnings.map((w, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-rose-400">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-slate-800/80 bg-[#131b2e]">
          <div className="text-xs text-slate-300 font-mono-tabular">
            <div>{selectedMission.launchVehicle} · {selectedMission.targetSite}</div>
            <div className="text-[10px] text-slate-400 mt-1" title={MODEL_SOURCE_NOTES[selectedMission.id]}>
              MODEL SOURCE · {MODEL_SOURCE_NOTES[selectedMission.id] ?? 'NASA mission data and procedural reconstruction.'}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="aero-btn px-4 py-2 text-xs font-medium text-slate-200 hover:text-white bg-[#1e273d] hover:bg-[#2a3654] border border-slate-700/70 transition-colors cursor-pointer"
            >
              Inspect on Pad
            </button>
            <button
              type="button"
              disabled={!canCommitLaunch}
              onClick={onLaunch}
              className={`aero-btn px-5 py-2 text-xs font-semibold border flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 ${
                canCommitLaunch
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-300/60 cursor-pointer'
                  : 'bg-[#171d2c] text-slate-500 border-slate-800 cursor-not-allowed'
              }`}
            >
              <Rocket className="w-4 h-4" />
              <span>
                {!metrics.isGoForLaunch
                  ? 'No-Go: Resolve Constraints'
                  : !allChecked
                    ? 'Complete Checklist to Launch'
                    : 'Commit to Launch Countdown'}
              </span>
              {canCommitLaunch && <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
