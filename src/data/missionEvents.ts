import { DifficultyMode } from './missions';

export interface EventConsequence {
  fuelDeltaPct?: number;
  powerDeltaPct?: number;
  commsDeltaPct?: number;
  trajectoryErrDeltaDeg?: number;
  scienceDelta?: number;
  safetyDelta?: number;
  enableBackupSystem?: boolean;
  triggerSiteRelocate?: boolean;
  systemKey?: 'guidance' | 'comms' | 'power' | 'propulsion';
  newSystemState?: 'GO' | 'AMBER' | 'RED';
}

export interface MissionEventOption {
  id: string;
  label: string;
  summary: string;
  consequenceText: string;
  effects: EventConsequence;
}

export interface MissionEvent {
  id: string;
  title: string;
  caller: 'FLIGHT' | 'GUIDANCE' | 'EECOM' | 'FIDO' | 'CAPCOM';
  phaseTrigger: string;
  description: string;
  telemetryHint: string;
  minDifficulty?: DifficultyMode;
  missionFilter?: string[]; // if set, only triggers for these mission ids
  categoryFilter?: 'crewed' | 'uncrewed';
  options: MissionEventOption[];
}

export const MISSION_EVENTS: MissionEvent[] = [
  {
    id: 'stage2-pogo-oscillation',
    title: 'Center Engine Thrust Oscillation',
    caller: 'GUIDANCE',
    phaseTrigger: 'STAGE_2_ASCENT',
    description:
      'Stage 2 longitudinal vibration ("pogo" oscillation) detected on the center engine feed line. Structural G-load variance is climbing.',
    telemetryHint: 'Stage 2 Vibration +1.4 G · Guidance IMU Nominal',
    options: [
      {
        id: 'cutoff-center',
        label: 'Command Early Center-Engine Cutoff',
        summary: 'Shut down the center engine early and continue on outboard engines.',
        consequenceText: 'Eliminates structural stress; minor upper-stage propellant penalty (-4% fuel).',
        effects: { fuelDeltaPct: -4, safetyDelta: 6, systemKey: 'propulsion', newSystemState: 'GO' },
      },
      {
        id: 'damp-throttle',
        label: 'Ride Through with Attitude Hold',
        summary: 'Maintain full 5-engine thrust while damping pitch excursions.',
        consequenceText: 'Preserves full propellant margin; slight trajectory dispersion (+1.8° error).',
        effects: { trajectoryErrDeltaDeg: 1.8, safetyDelta: -4, systemKey: 'guidance', newSystemState: 'AMBER' },
      },
    ],
  },
  {
    id: 'tli-comms-dropout',
    title: 'S-Band High-Gain Telemetry Drop',
    caller: 'CAPCOM',
    phaseTrigger: 'TRANSLUNAR_CRUISE',
    description:
      'Tracking station handover shows 38% signal attenuation on the primary S-Band antenna array during translunar coast.',
    telemetryHint: 'Signal Strength 62% · Attitude Alignment Required',
    options: [
      {
        id: 'switch-omni',
        label: 'Switch to Omni-Directional Backup + Re-Acquire',
        summary: 'Use backup omni antennas and recalibrate tracking lock.',
        consequenceText: 'Restores 98% comms link; uses 12% auxiliary power bus momentarily.',
        effects: { commsDeltaPct: 36, powerDeltaPct: -8, systemKey: 'comms', newSystemState: 'GO' },
      },
      {
        id: 'roll-spacecraft',
        label: 'Execute 15° Passive Thermal Roll Calibration',
        summary: 'Adjust spacecraft roll attitude to sweep high-gain beam back onto Earth station.',
        consequenceText: 'Zero power loss; uses 1.5% RCS fuel and yields bonus navigation alignment.',
        effects: { fuelDeltaPct: -1.5, commsDeltaPct: 30, trajectoryErrDeltaDeg: -0.8, systemKey: 'comms', newSystemState: 'GO' },
      },
    ],
  },
  {
    id: 'eec-fuel-cell-load',
    title: 'Fuel Cell Bus Voltage Sag',
    caller: 'EECOM',
    phaseTrigger: 'LUNAR_APPROACH',
    description:
      'Prior to Lunar Orbit Insertion, Bus B shows elevated amperage draw from science heaters and radar pre-heat.',
    telemetryHint: 'Power Bus 68% · LOI Burn Pre-Heat Active',
    options: [
      {
        id: 'shed-heaters',
        label: 'Shed Auxiliary Experiment Heaters',
        summary: 'Temporarily power down non-essential science heaters during LOI.',
        consequenceText: 'Recovers +22% power margin for LOI; -5 science telemetry bonus.',
        effects: { powerDeltaPct: 22, scienceDelta: -5, systemKey: 'power', newSystemState: 'GO' },
      },
      {
        id: 'cross-tie',
        label: 'Cross-Tie Main Bus A & B',
        summary: 'Balance load across primary fuel cells without interrupting science.',
        consequenceText: 'Maintains full science yield (+10 Sci) with cautious power reserve (+8%).',
        effects: { powerDeltaPct: 8, scienceDelta: 10, systemKey: 'power', newSystemState: 'AMBER' },
      },
    ],
  },
  {
    id: 'apollo11-1202-alarm',
    title: 'AGC 1202 Executive Overflow Alarm',
    caller: 'GUIDANCE',
    phaseTrigger: 'LUNAR_DESCENT',
    missionFilter: ['apollo-11', 'apollo-17'],
    description:
      'Guidance computer reports a 1202 priority-scheduling overflow as rendezvous radar pulses compete with powered descent telemetry.',
    telemetryHint: 'Descent Radar Active · Computer Load 96%',
    options: [
      {
        id: 'go-descent',
        label: 'Verify Cycle Integrity & Continue Descent (GO)',
        summary: 'Confirm core landing guidance jobs are completing and inhibit non-essential displays.',
        consequenceText: 'Maintains nominal landing trajectory (+15 navigation score); keeps descent on schedule.',
        effects: { scienceDelta: 12, safetyDelta: 8, systemKey: 'guidance', newSystemState: 'GO' },
      },
      {
        id: 'manual-hover',
        label: 'Switch to Manual Attitude Stabilization',
        summary: 'Take direct pilot control and shed automated radar updates.',
        consequenceText: 'Clears AGC load immediately; requires manual hover control (-3% lander fuel).',
        effects: { fuelDeltaPct: -3, systemKey: 'guidance', newSystemState: 'GO' },
      },
    ],
  },
  {
    id: 'apollo8-earthrise-window',
    title: 'Orbital Attitude Roll for Earthrise Survey',
    caller: 'CAPCOM',
    phaseTrigger: 'LUNAR_ORBIT_SURVEY',
    missionFilter: ['apollo-8'],
    description:
      'CSM-103 is crossing the far-side terminator into sunlit lunar horizon. A crisp window exists to orient optics toward Earthrise and Mare Tranquillitatis.',
    telemetryHint: '112 km Lunar Orbit · Terminator Crossing',
    options: [
      {
        id: 'opt-photo',
        label: 'Roll CSM for High-Resolution Earthrise + Landing Survey',
        summary: 'Expend brief RCS impulse to frame Earthrise and Apollo 11 candidate sites.',
        consequenceText: '+28 Science & Reconnaissance yield; -2% RCS propellant.',
        effects: { fuelDeltaPct: -2, scienceDelta: 28, safetyDelta: 5 },
      },
      {
        id: 'conserve-rcs',
        label: 'Hold Inertial Attitude to Conserve Propellant',
        summary: 'Skip manual camera roll and keep maximum SPS/RCS margin for TEI.',
        consequenceText: '+4% propellant reserve for return; misses bonus optical framing.',
        effects: { fuelDeltaPct: 4 },
      },
    ],
  },
  {
    id: 'robotic-dust-panel',
    title: 'Solar Array Grazing Incidence / Thermal Alert',
    caller: 'EECOM',
    phaseTrigger: 'LUNAR_DESCENT',
    categoryFilter: 'uncrewed',
    description:
      'Low sun angle near the landing site reduces solar array output prior to terminal retro-braking.',
    telemetryHint: 'Array Output 64% · Terminal Descent Active',
    options: [
      {
        id: 'battery-boost',
        label: 'Engage Primary Battery Bus for Terminal Radar',
        summary: 'Ensure uninterrupted hazard-avoidance LIDAR/Doppler radar during touchdown.',
        consequenceText: 'Boosts guidance stability (+8 safety); draws -14% battery reserve.',
        effects: { powerDeltaPct: -14, safetyDelta: 8, systemKey: 'guidance', newSystemState: 'GO' },
      },
      {
        id: 'throttle-lidar',
        label: 'Reduce Telemetry Rate to Preserve Power',
        summary: 'Lower live downlink bandwidth to protect power bus for surface ops.',
        consequenceText: 'Saves +12% power for surface instruments; slight comms delay.',
        effects: { powerDeltaPct: 12, commsDeltaPct: -10, systemKey: 'power', newSystemState: 'GO' },
      },
    ],
  },
  {
    id: 'solar-proton-event',
    title: 'Solar Coronal Proton Flare Advisory',
    caller: 'FLIGHT',
    phaseTrigger: 'RETURN_JOURNEY',
    description:
      'NOAA solar observatory reports an elevated proton flux crossing the Earth-Moon corridor during Trans-Earth coast.',
    telemetryHint: 'Solar Flux +240 pfu · Service Module Shielding Available',
    options: [
      {
        id: 'orient-shield',
        label: 'Orient Heatshield/Service Mass Toward Sun',
        summary: 'Use heavy aft structure as radiation shield during peak flux.',
        consequenceText: 'Protects crew & avionics (+10 Safety); uses 2% RCS propellant.',
        effects: { fuelDeltaPct: -2, safetyDelta: 10, systemKey: 'comms', newSystemState: 'GO' },
      },
      {
        id: 'continue-science',
        label: 'Maintain Star-Tracker Attitude & Log Particle Data',
        summary: 'Keep instruments pointing at solar wind plasma for bonus science.',
        consequenceText: '+16 Science Yield; -6 Safety margin.',
        effects: { scienceDelta: 16, safetyDelta: -6, systemKey: 'comms', newSystemState: 'AMBER' },
      },
    ],
  },
  {
    id: 'polar-shadow-thermal',
    title: 'Crater Shadow Cryogenic Cold-Soak',
    caller: 'EECOM',
    phaseTrigger: 'SURFACE_OPS',
    minDifficulty: 'historical',
    description:
      'Long lunar terrain shadows are dropping rover battery & core-drill temperatures toward lower thermal limits.',
    telemetryHint: 'Avionics Temp -28°C · Auxiliary Heaters Ready',
    options: [
      {
        id: 'engage-heaters',
        label: 'Cycle Thermal Blanket Heaters',
        summary: 'Warm battery packs and optical bench for safe long-duration exploration.',
        consequenceText: '+10 Safety & Thermal GO; draws 10% power bus.',
        effects: { powerDeltaPct: -10, safetyDelta: 10, systemKey: 'power', newSystemState: 'GO' },
      },
      {
        id: 'burst-assay',
        label: 'Run High-Power Spectrometer Burst Now',
        summary: 'Use residual thermal energy for maximum science packet transmission.',
        consequenceText: '+18 Science Yield; -6% power reserve.',
        effects: { powerDeltaPct: -6, scienceDelta: 18, systemKey: 'power', newSystemState: 'AMBER' },
      },
    ],
  },
  {
    id: 'lunar-orbiter-film-anomaly',
    title: 'Dual-Lens Eastman Kodak Film Loop Tension',
    caller: 'GUIDANCE',
    phaseTrigger: 'LUNAR_ORBIT_SURVEY',
    missionFilter: ['lunar-orbiter-1'],
    description:
      'Lunar Orbiter 1’s automated film-transport drum reports elevated motor draw while scanning Apollo candidate landing Zone A-5.',
    telemetryHint: '189 km Pericynthion · Dual-Lens Readout Bus 74%',
    options: [
      {
        id: 'slow-scan-pass',
        label: 'Command Low-Rate Readout & Thermal Roll',
        summary: 'Reduce film advance speed and rotate solar paddles toward sun for thermal relief.',
        consequenceText: 'Clears film tension cleanly (+14 Science, +8 Safety); slight -2% RCS fuel.',
        effects: { fuelDeltaPct: -2, scienceDelta: 14, safetyDelta: 8, systemKey: 'guidance', newSystemState: 'GO' },
      },
      {
        id: 'full-wide-frame',
        label: 'Prioritize Full Earth-Moon Wide-Angle Frame',
        summary: 'Lock attitude immediately to capture the historic Earthrise-from-Moon strip.',
        consequenceText: 'Maximizes historic science (+26 Science); stresses power bus (-10% Power).',
        effects: { powerDeltaPct: -10, scienceDelta: 26, systemKey: 'power', newSystemState: 'AMBER' },
      },
    ],
  },
  {
    id: 'surveyor3-vernier-bounce',
    title: 'Radar Unlock Over Crater Rim Reflection',
    caller: 'GUIDANCE',
    phaseTrigger: 'LUNAR_DESCENT',
    missionFilter: ['surveyor-3'],
    description:
      'Reflective boulders inside Surveyor Crater caused a momentary Doppler radar unlock — vernier engines may keep firing through first contact, causing a bounce!',
    telemetryHint: 'Crater Slope Descent · Vernier Cutoff Arming',
    options: [
      {
        id: 'manual-vernier-cut',
        label: 'Arm Immediate 4-Foot Vernier Cutoff Backup',
        summary: 'Ensure clean engine shutdown at touchdown probe contact to prevent bouncing.',
        consequenceText: 'Stabilizes Surveyor Crater landing (+10 Safety, +10 Science).',
        effects: { safetyDelta: 10, scienceDelta: 10, systemKey: 'guidance', newSystemState: 'GO' },
      },
      {
        id: 'auto-hover-ride',
        label: 'Keep Vernier Throttle Closed-Loop Active',
        summary: 'Maintain continuous thrust compensation down to surface regolith.',
        consequenceText: 'Preserves full sampler power bus (+8 Power); uses -4% lander propellant.',
        effects: { fuelDeltaPct: -4, powerDeltaPct: 8, systemKey: 'propulsion', newSystemState: 'AMBER' },
      },
    ],
  },
  {
    id: 'jwst-sunshield-tension',
    title: '5-Layer Kapton Sunshield Tensioning Check',
    caller: 'EECOM',
    phaseTrigger: 'LUNAR_ORBIT_SURVEY',
    missionFilter: ['jwst'],
    description:
      'At Sun-Earth L2, thermal sensors across Kapton Layer 3 show asymmetric tensioning while cooling NIRCam optics down to 40 Kelvin.',
    telemetryHint: 'Hot Side +85°C / Cold Side -233°C · 90 Pulley Cables',
    options: [
      {
        id: 'trim-winch',
        label: 'Run Precision Winch Calibration Sweep',
        summary: 'Step tension motors incrementally to guarantee flat optical membrane separation.',
        consequenceText: 'Achieves optimal 40 K cryogenic isolation (+24 Science, +10 Safety); -8% power.',
        effects: { powerDeltaPct: -8, scienceDelta: 24, safetyDelta: 10, systemKey: 'power', newSystemState: 'GO' },
      },
      {
        id: 'skip-sweep-observe',
        label: 'Proceed Direct to 18-Mirror Phasing',
        summary: 'Keep current membrane tension and begin hexagonal mirror wavefront sensing early.',
        consequenceText: 'Conserves power (+6% Power) and captures early spectrum (+12 Science).',
        effects: { powerDeltaPct: 6, scienceDelta: 12, safetyDelta: -4, systemKey: 'guidance', newSystemState: 'AMBER' },
      },
    ],
  },
];
