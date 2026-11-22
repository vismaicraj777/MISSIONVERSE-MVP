export type MissionCategory = 'crewed' | 'uncrewed' | 'custom';

export type DifficultyMode = 'practice' | 'historical' | 'challenge';

export type PowerSourceType = 'solar' | 'rtg' | 'fuel-cell';
export type CommsSystemType = 'omni-sband' | 'high-gain-dish' | 'optical-laser';
export type TrajectoryProfileType = 'free-return' | 'direct' | 'low-energy';
export type EnginePackageType = 'heritage' | 'high-thrust' | 'high-efficiency';

export type VehicleArchitecture =
  | 'saturn-v'
  | 'atlas-centaur'
  | 'atlas-agena'
  | 'molniya-m'
  | 'lvm3'
  | 'sls-robotic'
  | 'ariane-5';

export interface LandingSiteOption {
  id: string;
  name: string;
  coordinates: string;
  roughnessFactor: number; // 0.8 (flat) to 1.4 (cratered)
  scienceBonus: number;
  offsetX: number;
  offsetZ: number;
  description: string;
}

export interface SciencePayload {
  id: string;
  name: string;
  shortCode: string;
  massKg: number;
  powerW: number;
  costM: number;
  dataRateKbps: number;
  scienceValue: number;
  description: string;
  recommendedFor: MissionCategory | 'both';
  /** Mission IDs on which this package represents documented flown hardware. */
  heritageMissionIds?: string[];
}

export interface MissionConfig {
  id: string;
  name: string;
  designation: string;
  year: number;
  historicalDate: string;
  agency: string;
  category: MissionCategory;
  architecture: VehicleArchitecture;
  launchVehicle: string;
  propulsionSummary: string;
  csmName?: string;
  landerName: string;
  targetSite: string;
  landingSites?: LandingSiteOption[];
  missionType: 'lunar-landing' | 'lunar-orbit' | 'deep-space-l2';
  hasLunarLanding: boolean;
  hasReturnJourney: boolean;
  hasRoverOps?: boolean;
  isDeepSpaceL2?: boolean;
  targetDistanceKm?: number;
  summary: string;
  historicalFact: string;
  objectives: string[];
  bonusObjectives: string[];
  crew?: string;
  budgetCapM: number;
  powerBusW: number;
  baseDryMassKg: number;
  baseFuelMassKg: number;
  maxFuelCapacityKg: number;
  /** Approximate full-stack wet mass at liftoff; spacecraft configuration deltas are added in the design model. */
  launchVehicleLiftoffMassKg: number;
  liftoffThrustKn: number;
  specificImpulseVac: number;
  requiredDeltaV: number; // m/s required from liftoff to mission completion
  landerDryMassKg: number;
  landerFuelKg: number;
  landerThrustN: number;
  defaultPayloads: string[];
  /** Payload package IDs that match documented hardware for this mission. */
  heritagePayloadIds?: string[];
  lunarTerrainSeed: number;
  craterDensity: number;
  surfaceTint: string;
}

export const DIFFICULTY_INFO: Record<
  DifficultyMode,
  {
    label: string;
    subtitle: string;
    deltaVBonus: number;
    fuelScale: number;
    autoAssistDefault: boolean;
    eventFrequency: 'guided' | 'standard' | 'high';
  }
> = {
  practice: {
    label: 'Guided Practice',
    subtitle: 'Extra Δv margin, descent auto-assist active, guided event prompts.',
    deltaVBonus: 320,
    fuelScale: 1.12,
    autoAssistDefault: true,
    eventFrequency: 'guided',
  },
  historical: {
    label: 'Historical Mission',
    subtitle: 'Authentic mission sequence, nominal margins, manual maneuver confirmations.',
    deltaVBonus: 0,
    fuelScale: 1.0,
    autoAssistDefault: true,
    eventFrequency: 'standard',
  },
  challenge: {
    label: 'Challenge Mode',
    subtitle: 'Simulated alternative anomalies, tight fuel margins, manual descent encouraged.',
    deltaVBonus: -160,
    fuelScale: 0.92,
    autoAssistDefault: false,
    eventFrequency: 'high',
  },
};

export const SCIENCE_PAYLOADS: SciencePayload[] = [
  {
    id: 'seismometer',
    name: 'Apollo 11 Passive Seismic Package (PSEP)',
    shortCode: 'PSE',
    massKg: 48,
    powerW: 24,
    costM: 18,
    dataRateKbps: 12,
    scienceValue: 22,
    description: 'Apollo 11 EASEP package with passive seismometers for moonquakes and meteoroid impacts. Game mass, power, and cost are estimates.',
    recommendedFor: 'both',
    heritageMissionIds: ['apollo-11'],
  },
  {
    id: 'retroreflector',
    name: 'Laser Ranging Retroreflector',
    shortCode: 'LRRR',
    massKg: 24,
    powerW: 0,
    costM: 9,
    dataRateKbps: 2,
    scienceValue: 18,
    description: 'Apollo lunar laser ranging array. Flown on Apollo 11 and later landing missions including Apollo 17.',
    recommendedFor: 'both',
    heritageMissionIds: ['apollo-11', 'apollo-17'],
  },
  {
    id: 'spectrometer',
    name: 'Alpha-Particle X-Ray Spectrometer (Concept)',
    shortCode: 'APXS',
    massKg: 35,
    powerW: 32,
    costM: 22,
    dataRateKbps: 18,
    scienceValue: 25,
    description: 'MissionVerse what-if payload for elemental analysis; this instrument was not flown on the six missions in this library.',
    recommendedFor: 'both',
  },
  {
    id: 'stereo-cam',
    name: 'Stereo Terrain Imager (Concept)',
    shortCode: 'STI',
    massKg: 29,
    powerW: 28,
    costM: 14,
    dataRateKbps: 64,
    scienceValue: 19,
    description: 'MissionVerse what-if surface mapping camera. Apollo crews used handheld film cameras; this is not their flown camera system.',
    recommendedFor: 'both',
  },
  {
    id: 'core-drill',
    name: 'Apollo Deep-Drill & Heat-Flow Package',
    shortCode: 'DTHF',
    massKg: 82,
    powerW: 65,
    costM: 34,
    dataRateKbps: 24,
    scienceValue: 32,
    description: 'Game abstraction of Apollo 17 deep-core drilling and heat-flow probes; it is not a polar ice drill.',
    recommendedFor: 'both',
    heritageMissionIds: ['apollo-17'],
  },
  {
    id: 'lrv-rover',
    name: 'Apollo Lunar Roving Vehicle (LRV)',
    shortCode: 'LSRV',
    massKg: 210,
    powerW: 85,
    costM: 58,
    dataRateKbps: 96,
    scienceValue: 45,
    description: 'Battery-powered crew rover. Only Apollo 15, 16, and 17 carried an LRV; this mission set includes Apollo 17.',
    recommendedFor: 'crewed',
    heritageMissionIds: ['apollo-17'],
  },
  {
    id: 'magnetometer',
    name: 'Surface Magnetometer (Concept)',
    shortCode: 'MAG',
    massKg: 31,
    powerW: 19,
    costM: 15,
    dataRateKbps: 10,
    scienceValue: 20,
    description: 'MissionVerse what-if magnetic-field package; not part of these missions’ historical payloads.',
    recommendedFor: 'both',
  },
  {
    id: 'crew-camera',
    name: 'Crew Film Camera Kit',
    shortCode: 'CAM',
    massKg: 12,
    powerW: 0,
    costM: 4,
    dataRateKbps: 0,
    scienceValue: 14,
    description: 'Game abstraction of Apollo handheld still-photography equipment; exposed film returns with the crew.',
    recommendedFor: 'crewed',
    heritageMissionIds: ['apollo-8', 'apollo-11', 'apollo-17'],
  },
  {
    id: 'alsep-geophysics',
    name: 'Apollo 17 ALSEP Geophysics Suite',
    shortCode: 'ALSEP',
    massKg: 150,
    powerW: 62,
    costM: 20,
    dataRateKbps: 18,
    scienceValue: 34,
    description: 'Simplified package for Apollo 17 heat-flow, seismic-profiling, gravimeter, atmospheric, and ejecta experiments.',
    recommendedFor: 'crewed',
    heritageMissionIds: ['apollo-17'],
  },
  {
    id: 'lunar-orbiter-imager',
    name: 'Lunar Orbiter Film Imaging System',
    shortCode: 'LOIS',
    massKg: 68,
    powerW: 52,
    costM: 18,
    dataRateKbps: 36,
    scienceValue: 32,
    description: 'Lunar Orbiter’s dual-lens film camera, onboard film processing, scanning, and image transmission system.',
    recommendedFor: 'uncrewed',
    heritageMissionIds: ['lunar-orbiter-1'],
  },
  {
    id: 'radiation-dosimeter',
    name: 'Radiation Dosimeter',
    shortCode: 'RAD',
    massKg: 8,
    powerW: 6,
    costM: 5,
    dataRateKbps: 2,
    scienceValue: 8,
    description: 'Measures the radiation environment during lunar orbit operations.',
    recommendedFor: 'uncrewed',
    heritageMissionIds: ['lunar-orbiter-1'],
  },
  {
    id: 'micrometeoroid-detector',
    name: 'Micrometeoroid Detectors',
    shortCode: 'MMD',
    massKg: 10,
    powerW: 4,
    costM: 5,
    dataRateKbps: 2,
    scienceValue: 8,
    description: 'Records micrometeoroid impacts while the orbiter is in lunar orbit.',
    recommendedFor: 'uncrewed',
    heritageMissionIds: ['lunar-orbiter-1'],
  },
  {
    id: 'surveyor-camera',
    name: 'Surveyor TV Camera System',
    shortCode: 'TV',
    massKg: 8,
    powerW: 25,
    costM: 5,
    dataRateKbps: 24,
    scienceValue: 18,
    description: 'Surveyor 3’s surface television camera and imaging system for panoramas and close-up views.',
    recommendedFor: 'uncrewed',
    heritageMissionIds: ['surveyor-3'],
  },
  {
    id: 'surveyor-sampler',
    name: 'Surveyor Soil Mechanics Surface Sampler',
    shortCode: 'SMSS',
    massKg: 10,
    powerW: 12,
    costM: 7,
    dataRateKbps: 5,
    scienceValue: 20,
    description: 'Surveyor 3’s articulated scoop sampled and trenched lunar soil; it was not a drill or rover.',
    recommendedFor: 'uncrewed',
    heritageMissionIds: ['surveyor-3'],
  },
  {
    id: 'jwst-instruments',
    name: 'Webb Integrated Science Instruments',
    shortCode: 'NIR/IR',
    massKg: 500,
    powerW: 1800,
    costM: 64,
    dataRateKbps: 96,
    scienceValue: 48,
    description: 'Game package representing Webb’s integrated NIRCam, NIRSpec, MIRI, and FGS/NIRISS instrument suite.',
    recommendedFor: 'uncrewed',
    heritageMissionIds: ['jwst'],
  },
];

export const MISSIONS: MissionConfig[] = [
  {
    id: 'apollo-11',
    name: 'Apollo 11',
    designation: 'AS-506',
    year: 1969,
    historicalDate: 'July 16–24, 1969',
    agency: 'NASA',
    category: 'crewed',
    architecture: 'saturn-v',
    launchVehicle: 'Saturn V',
    propulsionSummary:
      'Saturn V: S-IC 5 × F-1 (LOX/RP-1), S-II 5 × J-2 and S-IVB 1 × restartable J-2 (LOX/LH₂). CSM-107 used the AJ10-137 Service Propulsion System. LM-5 had separate descent and ascent engines; both used Aerozine 50 / nitrogen tetroxide. No rover flew on Apollo 11.',
    csmName: 'CSM-107 Columbia',
    landerName: 'LM-5 Eagle',
    targetSite: 'Mare Tranquillitatis (0.67° N, 23.47° E)',
    landingSites: [
      {
        id: 'tranquility-base',
        name: 'Tranquility Base (Historical)',
        coordinates: '0.67° N, 23.47° E',
        roughnessFactor: 0.9,
        scienceBonus: 15,
        offsetX: 0,
        offsetZ: 0,
        description: 'Flat basaltic mare plain selected for first crewed touchdown.',
      },
      {
        id: 'west-crater-rim',
        name: 'West Crater Boulder Rim',
        coordinates: '0.71° N, 23.51° E',
        roughnessFactor: 1.25,
        scienceBonus: 32,
        offsetX: 18,
        offsetZ: -12,
        description: 'High-relief crater rim with exposed bedrock ejecta (+science yield, tighter hover).',
      },
    ],
    missionType: 'lunar-landing',
    hasLunarLanding: true,
    hasReturnJourney: true,
    hasRoverOps: false,
    summary:
      'First crewed lunar landing. Three-stage Saturn V ascent from LC-39A, CSM transposition and LM extraction, powered descent into Tranquility Base, surface EASEP deployment, lunar ascent, and Earth return.',
    historicalFact:
      'Launched July 16, 1969 from LC-39A. Neil Armstrong and Buzz Aldrin landed LM-5 Eagle on July 20 while Michael Collins orbited in CSM-107 Columbia.',
    objectives: [
      'Saturn V 3-stage ascent & Trans-Lunar Injection',
      'Execute Translunar Mid-Course Correction & LOI',
      'Powered descent of LM-5 Eagle to Mare Tranquillitatis',
      'Deploy EASEP seismic & laser instruments on surface',
      'LM ascent rendezvous with CSM Columbia & Earth return',
    ],
    bonusObjectives: [
      'Touch down within 15 m of landing beacon with <= 2.0 m/s sink',
      'Collect 2 surface regolith/instrument readings before ascent',
    ],
    crew: 'Armstrong · Aldrin · Collins',
    budgetCapM: 280,
    powerBusW: 240,
    baseDryMassKg: 14200,
    baseFuelMassKg: 41200,
    maxFuelCapacityKg: 44000,
    launchVehicleLiftoffMassKg: 2948350,
    liftoffThrustKn: 34500,
    specificImpulseVac: 418,
    requiredDeltaV: 5150,
    landerDryMassKg: 4850,
    landerFuelKg: 8200,
    landerThrustN: 45040,
    defaultPayloads: ['seismometer', 'retroreflector', 'crew-camera'],
    heritagePayloadIds: ['seismometer', 'retroreflector', 'crew-camera'],
    lunarTerrainSeed: 11,
    craterDensity: 1.0,
    surfaceTint: '#8b8d91',
  },
  {
    id: 'apollo-8',
    name: 'Apollo 8',
    designation: 'AS-503',
    year: 1968,
    historicalDate: 'December 21–27, 1968',
    agency: 'NASA',
    category: 'crewed',
    architecture: 'saturn-v',
    launchVehicle: 'Saturn V',
    propulsionSummary:
      'Saturn V: S-IC 5 × F-1, S-II 5 × J-2, S-IVB 1 × restartable J-2. CSM-103 used its AJ10-137 Service Propulsion System (Aerozine 50 / nitrogen tetroxide). Apollo 8 carried no flight Lunar Module or rover.',
    csmName: 'CSM-103',
    landerName: 'CSM-103 (No Lander)',
    targetSite: 'Low Lunar Orbit (~70 mi circular; initial orbit ~70 × 193 mi)',
    missionType: 'lunar-orbit',
    hasLunarLanding: false,
    hasReturnJourney: true,
    hasRoverOps: false,
    summary:
      'First crewed voyage to leave Earth orbit. Saturn V launch, S-IVB Trans-Lunar Injection, Lunar Orbit Insertion, Earthrise observation, landing-site reconnaissance, and Trans-Earth return (no lunar landing).',
    historicalFact:
      'Launched December 21, 1968. Frank Borman, Jim Lovell, and Bill Anders flew CSM-103 for 10 lunar orbits. LTA-B structural test hardware occupied the LM position; Apollo 8 carried no flight Lunar Module and no rover. Anders held the Lunar Module Pilot crew role despite the absent LM, and the crew captured the iconic Earthrise photograph.',
    objectives: [
      'Saturn V 3-stage ascent & Trans-Lunar Injection',
      'CSM-103 separation from S-IVB (LTA-B ballast)',
      'Execute Mid-Course Correction & Lunar Orbit Insertion',
      'Earthrise observation & Apollo landing site survey',
      'Trans-Earth Injection (TEI), atmospheric entry & splashdown',
    ],
    bonusObjectives: [
      'Complete all 3 orbital reconnaissance passes in the approximately 70-mile circular orbit',
      'Maintain >= 25% SPS propellant reserve after TEI',
    ],
    crew: 'Borman · Lovell · Anders',
    budgetCapM: 210,
    powerBusW: 165,
    baseDryMassKg: 11800,
    baseFuelMassKg: 35600,
    maxFuelCapacityKg: 38000,
    launchVehicleLiftoffMassKg: 2948350,
    liftoffThrustKn: 34500,
    specificImpulseVac: 415,
    requiredDeltaV: 4850,
    landerDryMassKg: 6200,
    landerFuelKg: 4800,
    landerThrustN: 91200,
    defaultPayloads: ['crew-camera'],
    heritagePayloadIds: ['crew-camera'],
    lunarTerrainSeed: 8,
    craterDensity: 0.85,
    surfaceTint: '#94969b',
  },
  {
    id: 'apollo-17',
    name: 'Apollo 17',
    designation: 'AS-512',
    year: 1972,
    historicalDate: 'December 7–19, 1972',
    agency: 'NASA',
    category: 'crewed',
    architecture: 'saturn-v',
    launchVehicle: 'Saturn V',
    propulsionSummary:
      'Saturn V: S-IC 5 × F-1 (LOX/RP-1), S-II 5 × J-2 and S-IVB 1 × restartable J-2 (LOX/LH₂). CSM-114 used an AJ10-137 SPS; LM-12 used separate descent and ascent engines burning Aerozine 50 / nitrogen tetroxide. Apollo 17 carried a battery-powered Lunar Roving Vehicle.',
    csmName: 'CSM-114 America',
    landerName: 'LM-12 Challenger',
    targetSite: 'Taurus-Littrow Valley (20.19° N, 30.77° E)',
    landingSites: [
      {
        id: 'taurus-littrow',
        name: 'Taurus-Littrow Valley Floor (Historical)',
        coordinates: '20.19° N, 30.77° E',
        roughnessFactor: 1.05,
        scienceBonus: 20,
        offsetX: 0,
        offsetZ: 0,
        description: 'Highland valley graben flanked by North and South Massifs.',
      },
      {
        id: 'shorty-crater',
        name: 'Shorty Crater Orange-Soil Rim',
        coordinates: '20.16° N, 30.71° E',
        roughnessFactor: 1.35,
        scienceBonus: 40,
        offsetX: -16,
        offsetZ: 14,
        description: 'Volcanic pyroclastic glass deposit rim (+40 science, steeper terrain).',
      },
    ],
    missionType: 'lunar-landing',
    hasLunarLanding: true,
    hasReturnJourney: true,
    hasRoverOps: true,
    summary:
      'Final Apollo J-mission geological expedition. Heavy-payload Saturn V carrying Lunar Roving Vehicle and subsurface core drill into Taurus-Littrow highlands, rover traverse, ascent rendezvous, and return.',
    historicalFact:
      'Launched December 7, 1972 — the only night launch of Saturn V. Gene Cernan and geologist Harrison Schmitt traversed 35.9 km in the LRV while Ron Evans operated orbital sensors in CSM-114 America.',
    objectives: [
      'Saturn V heavy-payload ascent & TLI burn',
      'CSM America extraction of LM-12 Challenger & LOI',
      'Highland valley descent to Taurus-Littrow',
      'LRV geological traverse, core drill & ALSEP deployment',
      'LM ascent stage liftoff, rendezvous & Earth return',
    ],
    bonusObjectives: [
      'Drive Lunar Rover to all 3 geological sample stations',
      'Touch down within 12 m of beacon target zone',
    ],
    crew: 'Cernan · Schmitt · Evans',
    budgetCapM: 340,
    powerBusW: 290,
    baseDryMassKg: 14900,
    baseFuelMassKg: 43200,
    maxFuelCapacityKg: 45500,
    launchVehicleLiftoffMassKg: 2948350,
    liftoffThrustKn: 35100,
    specificImpulseVac: 422,
    requiredDeltaV: 5250,
    landerDryMassKg: 5100,
    landerFuelKg: 8800,
    landerThrustN: 46700,
    defaultPayloads: ['lrv-rover', 'core-drill', 'alsep-geophysics', 'crew-camera'],
    heritagePayloadIds: ['lrv-rover', 'core-drill', 'alsep-geophysics', 'crew-camera'],
    lunarTerrainSeed: 17,
    craterDensity: 1.35,
    surfaceTint: '#807d78',
  },
  {
    id: 'lunar-orbiter-1',
    name: 'Lunar Orbiter 1',
    designation: 'LO-1',
    year: 1966,
    historicalDate: 'August 10 – October 29, 1966',
    agency: 'NASA / Boeing',
    category: 'uncrewed',
    architecture: 'atlas-agena',
    launchVehicle: 'Atlas-Agena D',
    propulsionSummary:
      'Atlas-Agena D: Atlas-D booster/sustainer delivered the stack to parking orbit; the restartable Agena D stage supplied translunar injection. Lunar Orbiter 1 used its own main engine for lunar-orbit insertion and trajectory corrections.',
    landerName: 'Lunar Orbiter 1 Spacecraft',
    targetSite: 'Equatorial Lunar Orbit (189 km × 1,867 km)',
    missionType: 'lunar-orbit',
    hasLunarLanding: false,
    hasReturnJourney: false,
    hasRoverOps: false,
    summary:
      'First U.S. spacecraft to orbit the Moon. Atlas-Agena D launch, trans-lunar injection, lunar orbit capture, high-resolution Apollo landing site photography, and DSN downlink (no landing or Earth return).',
    historicalFact:
      'Launched August 10, 1966. Lunar Orbiter 1 photographed Apollo candidate landing zones and returned the first Earth image from lunar distance. After an extended engineering phase, controllers commanded it to impact the Moon on October 29, 1966.',
    objectives: [
      'Atlas-Agena D ascent & trans-lunar injection',
      'Equatorial Lunar Orbit Insertion burn',
      'Photograph Apollo landing zones & Earthrise view',
      'Transmit photographic strips and tracking data to Earth',
    ],
    bonusObjectives: [
      'Complete orbital photography and selenodetic tracking passes',
      'Maintain >= 90% DSN high-gain signal during imaging downlink',
    ],
    budgetCapM: 145,
    powerBusW: 145,
    baseDryMassKg: 2050,
    baseFuelMassKg: 7450,
    maxFuelCapacityKg: 8250,
    launchVehicleLiftoffMassKg: 126600,
    liftoffThrustKn: 1824,
    specificImpulseVac: 400,
    requiredDeltaV: 4980,
    landerDryMassKg: 386,
    landerFuelKg: 0,
    landerThrustN: 445,
    defaultPayloads: ['lunar-orbiter-imager', 'radiation-dosimeter', 'micrometeoroid-detector'],
    heritagePayloadIds: ['lunar-orbiter-imager', 'radiation-dosimeter', 'micrometeoroid-detector'],
    lunarTerrainSeed: 66,
    craterDensity: 0.95,
    surfaceTint: '#8d9096',
  },
  {
    id: 'surveyor-3',
    name: 'Surveyor 3',
    designation: 'SC-3',
    year: 1967,
    historicalDate: 'April 17 – May 4, 1967',
    agency: 'NASA / JPL',
    category: 'uncrewed',
    architecture: 'atlas-centaur',
    launchVehicle: 'Atlas-Centaur AC-12',
    propulsionSummary:
      'Atlas LV-3C / Centaur D: Atlas booster/sustainer followed by a two-engine RL-10 Centaur stage. Surveyor 3 used a solid main retrorocket and three throttleable vernier engines for lunar descent.',
    landerName: 'Surveyor 3 Soil-Sampler',
    targetSite: 'Oceanus Procellarum — Surveyor Crater (3.01° S, 23.42° W)',
    landingSites: [
      {
        id: 'surveyor-crater',
        name: 'Surveyor Crater Inner Slope (Historical)',
        coordinates: '3.01° S, 23.42° W',
        roughnessFactor: 1.05,
        scienceBonus: 24,
        offsetX: 0,
        offsetZ: 0,
        description: 'Site where Surveyor 3 bounced twice before settling; later visited by Apollo 12.',
      },
      {
        id: 'procellarum-ridge',
        name: 'Procellarum Ejecta Bench',
        coordinates: '2.98° S, 23.38° W',
        roughnessFactor: 1.25,
        scienceBonus: 35,
        offsetX: 16,
        offsetZ: -12,
        description: 'Higher-relief ejecta apron offering deeper regolith trenching science.',
      },
    ],
    missionType: 'lunar-landing',
    hasLunarLanding: true,
    hasReturnJourney: false,
    hasRoverOps: false,
    summary:
      'NASA robotic trenching lander equipped with the pantograph Soil Mechanics Surface Sampler scoop arm to dig lunar trenches and prove surface bearing strength for Apollo crews.',
    historicalFact:
      'Surveyor 3 landed inside a 200-meter crater on April 20, 1967, dug four test trenches with its robotic claw, and was famously visited 31 months later by Apollo 12 astronauts Pete Conrad and Alan Bean.',
    objectives: [
      'Atlas-Centaur AC-12 launch & fairing separation',
      'Translunar cruise & mid-course trajectory correction',
      'Vernier-guided touchdown in Surveyor Crater',
      'Operate robotic soil-sampler scoop & transmit TV scans',
    ],
    bonusObjectives: [
      'Touch down within 15 m of crater target with <= 2.2 m/s sink',
      'Survey crater regolith targets & transmit high-rate telemetry',
    ],
    budgetCapM: 150,
    powerBusW: 135,
    baseDryMassKg: 2180,
    baseFuelMassKg: 7780,
    maxFuelCapacityKg: 8600,
    launchVehicleLiftoffMassKg: 137000,
    liftoffThrustKn: 1730,
    specificImpulseVac: 400,
    requiredDeltaV: 5060,
    landerDryMassKg: 302,
    landerFuelKg: 725,
    landerThrustN: 1880,
    defaultPayloads: ['surveyor-camera', 'surveyor-sampler'],
    heritagePayloadIds: ['surveyor-camera', 'surveyor-sampler'],
    lunarTerrainSeed: 303,
    craterDensity: 1.15,
    surfaceTint: '#84878d',
  },
  {
    id: 'jwst',
    name: 'James Webb Space Telescope',
    designation: 'JWST · L2',
    year: 2021,
    historicalDate: 'December 25, 2021 – Present',
    agency: 'NASA / ESA / CSA',
    category: 'uncrewed',
    architecture: 'ariane-5',
    launchVehicle: 'Ariane 5 ECA',
    propulsionSummary:
      'Ariane 5 ECA: two solid boosters, a Vulcain 2 cryogenic core engine, and an HM7B cryogenic upper-stage engine. Webb uses hydrazine / nitrogen tetroxide bipropellant for major maneuvers and hydrazine monopropellant thrusters for smaller corrections.',
    landerName: 'Webb Observatory (18-Mirror IR)',
    targetSite: 'Sun-Earth L2 Halo Orbit (1,500,000 km)',
    missionType: 'deep-space-l2',
    hasLunarLanding: false,
    hasReturnJourney: false,
    hasRoverOps: false,
    isDeepSpaceL2: true,
    targetDistanceKm: 1500000,
    summary:
      'Flagship infrared space observatory launched by Ariane 5 ECA to the Sun-Earth L2 Lagrange point 1.5 million km from Earth, unfolding a 5-layer Kapton sunshield and 18 gold hexagonal mirrors.',
    historicalFact:
      'Launched December 25, 2021 from Kourou. Ariane 5’s ultra-precise injection saved enough hydrazine propellant to double Webb’s operational science life past 20 years.',
    objectives: [
      'Ariane 5 ECA twin-booster ascent & fairing jettison',
      'Execute MCC-1a and MCC-1b transfer corrections',
      'Execute MCC-2 and enter a Sun-Earth L2 halo orbit (~1,500,000 km)',
      'Unfold 5-layer sunshield, align 18 gold mirrors & capture deep field',
    ],
    bonusObjectives: [
      'Complete sunshield tensioning, mirror phasing & deep-field IR scan',
      'Preserve station-keeping propellant through accurate launch injection',
    ],
    budgetCapM: 330,
    powerBusW: 2000,
    baseDryMassKg: 5399,
    baseFuelMassKg: 301,
    maxFuelCapacityKg: 301,
    launchVehicleLiftoffMassKg: 780000,
    liftoffThrustKn: 13100,
    specificImpulseVac: 290,
    requiredDeltaV: 120,
    landerDryMassKg: 6161,
    landerFuelKg: 0,
    landerThrustN: 440,
    defaultPayloads: ['jwst-instruments'],
    heritagePayloadIds: ['jwst-instruments'],
    lunarTerrainSeed: 2021,
    craterDensity: 0.7,
    surfaceTint: '#7a7e86',
  },
];

export interface PowerSourceSpec {
  id: PowerSourceType;
  name: string;
  shortLabel: string;
  massKg: number;
  costM: number;
  busMultiplier: number;
  polarEfficiency: number;
  tradeoffNote: string;
}

export interface CommsSystemSpec {
  id: CommsSystemType;
  name: string;
  shortLabel: string;
  massKg: number;
  powerW: number;
  costM: number;
  bonusKbps: number;
  scienceMultiplier: number;
  tradeoffNote: string;
}

export interface TrajectoryProfileSpec {
  id: TrajectoryProfileType;
  name: string;
  deltaVOffsetMs: number;
  safetyBonus: number;
  transitScale: number;
  tradeoffNote: string;
}

export interface EnginePackageSpec {
  id: EnginePackageType;
  name: string;
  massKg: number;
  costM: number;
  thrustMultiplier: number;
  ispMultiplier: number;
  tradeoffNote: string;
  isHypothetical: boolean;
}

// Upgrade packages are transparent gameplay scenarios, not flown engine designs.
export const ENGINE_PACKAGES: Record<EnginePackageType, EnginePackageSpec> = {
  heritage: {
    id: 'heritage',
    name: 'Mission Flight Hardware',
    massKg: 0,
    costM: 0,
    thrustMultiplier: 1,
    ispMultiplier: 1,
    tradeoffNote: 'Uses the documented engine family for the selected mission.',
    isHypothetical: false,
  },
  'high-thrust': {
    id: 'high-thrust',
    name: 'High-Thrust Study',
    massKg: 180,
    costM: 24,
    thrustMultiplier: 1.12,
    ispMultiplier: 0.98,
    tradeoffNote: 'What-if package: +12% modeled thrust, −2% efficiency, +180 kg. Gameplay estimates only.',
    isHypothetical: true,
  },
  'high-efficiency': {
    id: 'high-efficiency',
    name: 'High-Efficiency Study',
    massKg: 130,
    costM: 28,
    thrustMultiplier: 0.96,
    ispMultiplier: 1.06,
    tradeoffNote: 'What-if package: +6% modeled efficiency, −4% thrust, +130 kg. Gameplay estimates only.',
    isHypothetical: true,
  },
};

export const POWER_SOURCES: Record<PowerSourceType, PowerSourceSpec> = {
  solar: {
    id: 'solar',
    name: 'Deployable Solar Array',
    shortLabel: 'Solar',
    massKg: 0,
    costM: 0,
    busMultiplier: 1.0,
    polarEfficiency: 0.62,
    tradeoffNote: 'Baseline cost & mass. Loses 38% output in polar or shadowed craters.',
  },
  rtg: {
    id: 'rtg',
    name: 'MMRTG Plutonium Isotope',
    shortLabel: 'MMRTG',
    massKg: 95,
    costM: 28,
    busMultiplier: 1.18,
    polarEfficiency: 1.0,
    tradeoffNote: '100% power in pitch-black polar craters (+18% bus), heavier & pricier.',
  },
  'fuel-cell': {
    id: 'fuel-cell',
    name: 'Cryo H2/O2 Fuel Cells',
    shortLabel: 'Fuel Cell',
    massKg: 60,
    costM: 16,
    busMultiplier: 1.38,
    polarEfficiency: 0.95,
    tradeoffNote: 'Massive +38% peak bus power for drills & rovers; moderate mass.',
  },
};

export const COMMS_SYSTEMS: Record<CommsSystemType, CommsSystemSpec> = {
  'omni-sband': {
    id: 'omni-sband',
    name: 'S-Band Omni Array',
    shortLabel: 'S-Band',
    massKg: 0,
    powerW: 0,
    costM: 0,
    bonusKbps: 0,
    scienceMultiplier: 1.0,
    tradeoffNote: 'Baseline telemetry link. Zero extra mass or power draw.',
  },
  'high-gain-dish': {
    id: 'high-gain-dish',
    name: 'Gimbaled X-Band High-Gain Dish',
    shortLabel: 'High-Gain',
    massKg: 36,
    powerW: 16,
    costM: 14,
    bonusKbps: 88,
    scienceMultiplier: 1.12,
    tradeoffNote: '+88 kbps deep-space downlink and +12% science telemetry return.',
  },
  'optical-laser': {
    id: 'optical-laser',
    name: 'Deep Space Optical Laser',
    shortLabel: 'Optical Laser',
    massKg: 28,
    powerW: 28,
    costM: 26,
    bonusKbps: 220,
    scienceMultiplier: 1.24,
    tradeoffNote: '+220 kbps ultra-fast HD downlink & +24% science multiplier; draws 28W.',
  },
};

export const TRAJECTORY_PROFILES: Record<TrajectoryProfileType, TrajectoryProfileSpec> = {
  'free-return': {
    id: 'free-return',
    name: 'Free-Return Apollo Loop',
    deltaVOffsetMs: 0,
    safetyBonus: 6,
    transitScale: 1.0,
    tradeoffNote: 'Safest natural Earth-return abort corridor (+6% safety margin).',
  },
  direct: {
    id: 'direct',
    name: 'Direct High-Energy Ascent',
    deltaVOffsetMs: -140,
    safetyBonus: -4,
    transitScale: 0.85,
    tradeoffNote: 'Saves 140 m/s Δv & fast transit; tighter abort corridor (-4% safety).',
  },
  'low-energy': {
    id: 'low-energy',
    name: 'Ballistic Low-Energy Transfer',
    deltaVOffsetMs: -320,
    safetyBonus: 2,
    transitScale: 1.25,
    tradeoffNote: 'Saves 320 m/s Δv for heavy science payloads; longer coast duration.',
  },
};

export interface CustomMissionDraft {
  name: string;
  architecture: VehicleArchitecture;
  destinationId: 'mare-tranq' | 'taurus-littrow' | 'south-pole' | 'lunar-orbit';
  hasRoverOps: boolean;
  hasReturnJourney: boolean;
}

export const DEFAULT_CUSTOM_DRAFT: CustomMissionDraft = {
  name: 'Artemis Explorer-X',
  architecture: 'sls-robotic',
  destinationId: 'south-pole',
  hasRoverOps: true,
  hasReturnJourney: false,
};

export function buildCustomMissionConfig(draft: CustomMissionDraft): MissionConfig {
  const archSpecs: Record<
    VehicleArchitecture,
    {
      launchVehicle: string;
      landerName: string;
      csmName?: string;
      category: 'crewed' | 'uncrewed';
      budgetCapM: number;
      powerBusW: number;
      baseDryMassKg: number;
      baseFuelMassKg: number;
      maxFuelCapacityKg: number;
      launchVehicleLiftoffMassKg: number;
      liftoffThrustKn: number;
      specificImpulseVac: number;
      requiredDeltaV: number;
    }
  > = {
    'saturn-v': {
      launchVehicle: 'Saturn V',
      landerName: 'LM Custom',
      csmName: 'CSM Voyager',
      category: 'crewed',
      budgetCapM: 340,
      powerBusW: 280,
      baseDryMassKg: 14500,
      baseFuelMassKg: 42400,
      maxFuelCapacityKg: 45500,
      launchVehicleLiftoffMassKg: 2948350,
      liftoffThrustKn: 34800,
      specificImpulseVac: 422,
      requiredDeltaV: 5150,
    },
    'sls-robotic': {
      launchVehicle: 'SLS Block 1',
      landerName: 'Artemis Prospect Lander',
      category: 'uncrewed',
      budgetCapM: 260,
      powerBusW: 240,
      baseDryMassKg: 5400,
      baseFuelMassKg: 18400,
      maxFuelCapacityKg: 20200,
      launchVehicleLiftoffMassKg: 2600000,
      liftoffThrustKn: 39100,
      specificImpulseVac: 432,
      requiredDeltaV: 5200,
    },
    lvm3: {
      launchVehicle: 'LVM3-M4',
      landerName: 'Vikram Custom',
      category: 'uncrewed',
      budgetCapM: 185,
      powerBusW: 195,
      baseDryMassKg: 3200,
      baseFuelMassKg: 11800,
      maxFuelCapacityKg: 13000,
      launchVehicleLiftoffMassKg: 640000,
      liftoffThrustKn: 9800,
      specificImpulseVac: 414,
      requiredDeltaV: 5120,
    },
    'atlas-centaur': {
      launchVehicle: 'Atlas-Centaur',
      landerName: 'Surveyor Custom',
      category: 'uncrewed',
      budgetCapM: 150,
      powerBusW: 150,
      baseDryMassKg: 2150,
      baseFuelMassKg: 7850,
      maxFuelCapacityKg: 8700,
      launchVehicleLiftoffMassKg: 137000,
      liftoffThrustKn: 1730,
      specificImpulseVac: 402,
      requiredDeltaV: 5020,
    },
    'molniya-m': {
      launchVehicle: 'Molniya-M',
      landerName: 'Luna Custom Station',
      category: 'uncrewed',
      budgetCapM: 135,
      powerBusW: 135,
      baseDryMassKg: 1980,
      baseFuelMassKg: 7150,
      maxFuelCapacityKg: 7900,
      launchVehicleLiftoffMassKg: 305000,
      liftoffThrustKn: 3980,
      specificImpulseVac: 396,
      requiredDeltaV: 4950,
    },
    'atlas-agena': {
      launchVehicle: 'Atlas-Agena D',
      landerName: 'Custom Lunar Orbiter',
      category: 'uncrewed',
      budgetCapM: 145,
      powerBusW: 145,
      baseDryMassKg: 2050,
      baseFuelMassKg: 7450,
      maxFuelCapacityKg: 8250,
      launchVehicleLiftoffMassKg: 126600,
      liftoffThrustKn: 1824,
      specificImpulseVac: 400,
      requiredDeltaV: 4980,
    },
    'ariane-5': {
      launchVehicle: 'Ariane 5 ECA',
      landerName: 'Deep-Space Observatory',
      category: 'uncrewed',
      budgetCapM: 330,
      powerBusW: 265,
      baseDryMassKg: 6160,
      baseFuelMassKg: 21800,
      maxFuelCapacityKg: 24000,
      launchVehicleLiftoffMassKg: 780000,
      liftoffThrustKn: 13100,
      specificImpulseVac: 446,
      requiredDeltaV: 5340,
    },
  };

  const destMap: Record<
    CustomMissionDraft['destinationId'],
    {
      targetSite: string;
      hasLunarLanding: boolean;
      craterDensity: number;
      seed: number;
      tint: string;
      site: LandingSiteOption;
    }
  > = {
    'mare-tranq': {
      targetSite: 'Mare Tranquillitatis (0.67° N, 23.47° E)',
      hasLunarLanding: true,
      craterDensity: 0.95,
      seed: 11,
      tint: '#8b8d91',
      site: {
        id: 'custom-mare',
        name: 'Tranquility Basalt Plain',
        coordinates: '0.67° N, 23.47° E',
        roughnessFactor: 0.9,
        scienceBonus: 20,
        offsetX: 0,
        offsetZ: 0,
        description: 'Smooth mare plain ideal for precision landing & high-speed rover testing.',
      },
    },
    'taurus-littrow': {
      targetSite: 'Taurus-Littrow Valley (20.19° N, 30.77° E)',
      hasLunarLanding: true,
      craterDensity: 1.3,
      seed: 17,
      tint: '#807d78',
      site: {
        id: 'custom-valley',
        name: 'Taurus-Littrow Highlands',
        coordinates: '20.19° N, 30.77° E',
        roughnessFactor: 1.15,
        scienceBonus: 32,
        offsetX: -10,
        offsetZ: 8,
        description: 'Dramatic highland graben rich in orange pyroclastic volcanic glass.',
      },
    },
    'south-pole': {
      targetSite: 'Shackleton & Nobile Polar Ridge (85.2° S)',
      hasLunarLanding: true,
      craterDensity: 1.5,
      seed: 42,
      tint: '#94979e',
      site: {
        id: 'custom-pole',
        name: 'Lunar South Pole Cold Trap',
        coordinates: '85.2° S, 55.4° E',
        roughnessFactor: 1.35,
        scienceBonus: 45,
        offsetX: 8,
        offsetZ: -10,
        description: 'High-value water-ice prospecting ridge with deep crater shadows (RTG recommended).',
      },
    },
    'lunar-orbit': {
      targetSite: 'Polar Lunar Reconnaissance Orbit (112 km)',
      hasLunarLanding: false,
      craterDensity: 0.85,
      seed: 8,
      tint: '#94969b',
      site: {
        id: 'custom-orbit',
        name: '112 km Reconnaissance Orbit',
        coordinates: 'Orbital Survey',
        roughnessFactor: 0.8,
        scienceBonus: 24,
        offsetX: 0,
        offsetZ: 0,
        description: 'Orbital imaging, Earthrise optical framing, and gravity-field mapping.',
      },
    },
  };

  const a = archSpecs[draft.architecture];
  const d = destMap[draft.destinationId];
  const allowReturn = draft.hasReturnJourney && a.category === 'crewed';

  return {
    id: 'custom-architect',
    name: draft.name.trim() || 'Artemis Explorer-X',
    designation: 'CUSTOM-01',
    year: 2026,
    historicalDate: 'Player-Designed NASA Space Apps Architecture',
    agency: 'Mission Architect',
    category: a.category,
    architecture: draft.architecture,
    launchVehicle: a.launchVehicle,
    propulsionSummary: `${a.launchVehicle} selected in MissionVerse Custom Architect. Engine performance values are scenario assumptions, not a flight-qualified design.`,
    csmName: a.csmName,
    landerName: a.landerName,
    targetSite: d.targetSite,
    landingSites: d.hasLunarLanding ? [d.site] : undefined,
    missionType: d.hasLunarLanding ? 'lunar-landing' : 'lunar-orbit',
    hasLunarLanding: d.hasLunarLanding,
    hasReturnJourney: allowReturn || !d.hasLunarLanding,
    hasRoverOps: d.hasLunarLanding && draft.hasRoverOps,
    summary: `Custom-engineered ${a.launchVehicle} mission targeting ${d.targetSite}. Balance mass, power source, communications bandwidth, and trajectory Δv.`,
    historicalFact:
      'Designed in MissionVerse Architect Studio — demonstrates real NASA systems engineering trade-offs across propulsion, power, comms, and science return.',
    objectives: [
      `${a.launchVehicle} ascent & trajectory injection`,
      'Navigate Cislunar booster gates & execute LOI burn',
      d.hasLunarLanding
        ? `Powered descent & rover exploration at ${d.site.name}`
        : 'Complete 112 km orbital survey & Earthrise imaging',
      allowReturn || !d.hasLunarLanding ? 'Trans-Earth return & splashdown' : 'Transmit high-bandwidth surface telemetry',
    ],
    bonusObjectives: [
      'Pass all 4 Cislunar alignment gates',
      'Scan all 5 lunar geological discovery landmarks',
    ],
    crew: a.category === 'crewed' ? 'Player Flight Crew' : undefined,
    budgetCapM: a.budgetCapM,
    powerBusW: a.powerBusW,
    baseDryMassKg: a.baseDryMassKg,
    baseFuelMassKg: a.baseFuelMassKg,
    maxFuelCapacityKg: a.maxFuelCapacityKg,
    launchVehicleLiftoffMassKg: a.launchVehicleLiftoffMassKg,
    liftoffThrustKn: a.liftoffThrustKn,
    specificImpulseVac: a.specificImpulseVac,
    requiredDeltaV: a.requiredDeltaV,
    landerDryMassKg: 1850,
    landerFuelKg: 3200,
    landerThrustN: 18500,
    defaultPayloads: ['spectrometer', 'stereo-cam'],
    lunarTerrainSeed: d.seed,
    craterDensity: d.craterDensity,
    surfaceTint: d.tint,
  };
}

export interface MissionDesignState {
  missionId: string;
  selectedPayloadIds: string[];
  fuelFillRatio: number; // 0.70 to 1.00
  guidanceLevel: 'standard' | 'precision';
  difficulty: DifficultyMode;
  selectedSiteId?: string;
  powerSource?: PowerSourceType;
  enginePackage?: EnginePackageType;
  commsSystem?: CommsSystemType;
  trajectoryType?: TrajectoryProfileType;
  customDraft?: CustomMissionDraft;
}

export interface ComputedMissionMetrics {
  payloadMassKg: number;
  subsystemMassKg: number;
  totalSpacecraftMassKg: number;
  availableDeltaV: number;
  requiredDeltaV: number;
  deltaVMargin: number;
  twr: number;
  engineThrustMultiplier: number;
  engineIspMultiplier: number;
  powerUsedW: number;
  powerBusW: number;
  effectivePowerBusW: number;
  isPolarShadowed: boolean;
  totalCostM: number;
  budgetCapM: number;
  dataRateKbps: number;
  scienceScore: number;
  scienceMultiplier: number;
  landerFuelScale: number;
  transitTimeScale: number;
  trajectorySafetyBonus: number;
  isGoForLaunch: boolean;
  warnings: string[];
}

export function resolveMissionConfig(design: MissionDesignState): MissionConfig {
  if (design.missionId === 'custom-architect') {
    return buildCustomMissionConfig(design.customDraft ?? DEFAULT_CUSTOM_DRAFT);
  }
  return MISSIONS.find((m) => m.id === design.missionId) ?? MISSIONS[0];
}

export function computeMissionMetrics(
  mission: MissionConfig,
  design: MissionDesignState,
): ComputedMissionMetrics {
  const diff = DIFFICULTY_INFO[design.difficulty ?? 'historical'];
  const pwrSpec = POWER_SOURCES[design.powerSource ?? 'solar'];
  const engineSpec = ENGINE_PACKAGES[design.enginePackage ?? 'heritage'];
  const commSpec = COMMS_SYSTEMS[design.commsSystem ?? 'omni-sband'];
  const trajSpec = TRAJECTORY_PROFILES[design.trajectoryType ?? 'free-return'];

  const isPolarShadowed =
    design.selectedSiteId === 'shorty-crater' ||
    design.selectedSiteId === 'custom-pole';

  const chosen = SCIENCE_PAYLOADS.filter((p) => design.selectedPayloadIds.includes(p.id));
  const payloadMassKg = chosen.reduce((acc, p) => acc + p.massKg, 0);
  const subsystemMassKg = pwrSpec.massKg + commSpec.massKg + engineSpec.massKg;

  const powerUsedW =
    chosen.reduce((acc, p) => acc + p.powerW, 0) +
    (design.guidanceLevel === 'precision' ? 25 : 10) +
    commSpec.powerW;

  const shadowPenaltyFactor = isPolarShadowed ? pwrSpec.polarEfficiency : 1.0;
  const effectivePowerBusW = Math.round(
    mission.powerBusW * pwrSpec.busMultiplier * shadowPenaltyFactor,
  );

  const payloadCostM = chosen.reduce((acc, p) => acc + p.costM, 0);
  const guidanceCostM = design.guidanceLevel === 'precision' ? 28 : 0;
  const baseMissionCostM = Math.round(mission.budgetCapM * 0.56);
  const totalCostM = baseMissionCostM + payloadCostM + guidanceCostM + pwrSpec.costM + commSpec.costM + engineSpec.costM;

  const dataRateKbps = chosen.reduce((acc, p) => acc + p.dataRateKbps, 0) + 16 + commSpec.bonusKbps;
  const siteBonus =
    mission.landingSites?.find((s) => s.id === design.selectedSiteId)?.scienceBonus ?? 0;
  const rawScience = chosen.reduce((acc, p) => acc + p.scienceValue, 0) + siteBonus;
  const scienceScore = Math.round(rawScience * commSpec.scienceMultiplier);

  const fuelMassKg = mission.maxFuelCapacityKg * design.fuelFillRatio;
  const dryMassKg = mission.baseDryMassKg + payloadMassKg + subsystemMassKg;
  const totalSpacecraftMassKg = dryMassKg + fuelMassKg;

  const g0 = 9.80665;
  const baselinePayloadMassKg = (mission.heritagePayloadIds ?? []).reduce((sum, id) => {
    return sum + (SCIENCE_PAYLOADS.find((payload) => payload.id === id)?.massKg ?? 0);
  }, 0);
  const baselinePowerSource: PowerSourceType = mission.id.startsWith('apollo-') ? 'fuel-cell' : 'solar';
  const configurationMassDeltaKg =
    payloadMassKg - baselinePayloadMassKg +
    pwrSpec.massKg - POWER_SOURCES[baselinePowerSource].massKg +
    commSpec.massKg +
    engineSpec.massKg +
    mission.maxFuelCapacityKg * (design.fuelFillRatio - 1);
  const modeledLiftoffMassKg = Math.max(
    1,
    mission.launchVehicleLiftoffMassKg + configurationMassDeltaKg,
  );
  const twr = Number(
    ((mission.liftoffThrustKn * 1000 * engineSpec.thrustMultiplier) / (modeledLiftoffMassKg * g0)).toFixed(2),
  );

  // Tsiolkovsky rocket equation scaled to upper-stage + TLI + LOI budget
  const massRatio = totalSpacecraftMassKg / dryMassKg;
  const availableDeltaV =
    Math.round(mission.specificImpulseVac * engineSpec.ispMultiplier * g0 * Math.log(massRatio)) + diff.deltaVBonus;
  const requiredDeltaV =
    mission.requiredDeltaV +
    (design.guidanceLevel === 'precision' ? -80 : 0) +
    trajSpec.deltaVOffsetMs;
  const deltaVMargin = availableDeltaV - requiredDeltaV;

  const warnings: string[] = [];
  if (chosen.length === 0) {
    warnings.push('Select at least 1 science payload instrument.');
  }
  if (deltaVMargin < 0) {
    warnings.push(
      `Insufficient Delta-V (${deltaVMargin} m/s deficit). Reduce payload mass, increase fuel, or select Low-Energy trajectory.`,
    );
  }
  if (twr < 1.12) {
    warnings.push(`Thrust-to-Weight ratio too low (${twr}). Reduce spacecraft mass.`);
  }
  if (powerUsedW > effectivePowerBusW) {
    warnings.push(
      isPolarShadowed && (design.powerSource ?? 'solar') === 'solar'
        ? `Polar shadow reduced Solar Bus to ${effectivePowerBusW}W (need ${powerUsedW}W). Switch to MMRTG or Fuel Cell!`
        : `Power draw (${powerUsedW} W) exceeds spacecraft bus (${effectivePowerBusW} W).`,
    );
  }
  if (totalCostM > mission.budgetCapM) {
    warnings.push(`MissionVerse cost (${totalCostM} M-credits) exceeds the game budget cap (${mission.budgetCapM} M-credits).`);
  }

  const landerFuelScale = Math.max(
    0.65,
    Math.min(1.25, design.fuelFillRatio * diff.fuelScale * (1 - (payloadMassKg + subsystemMassKg) / 2200)),
  );

  return {
    payloadMassKg,
    subsystemMassKg,
    totalSpacecraftMassKg: Math.round(totalSpacecraftMassKg),
    availableDeltaV,
    requiredDeltaV,
    deltaVMargin,
    twr,
    engineThrustMultiplier: engineSpec.thrustMultiplier,
    engineIspMultiplier: engineSpec.ispMultiplier,
    powerUsedW,
    powerBusW: effectivePowerBusW,
    effectivePowerBusW,
    isPolarShadowed,
    totalCostM,
    budgetCapM: mission.budgetCapM,
    dataRateKbps,
    scienceScore,
    scienceMultiplier: commSpec.scienceMultiplier,
    landerFuelScale,
    transitTimeScale: trajSpec.transitScale,
    trajectorySafetyBonus: trajSpec.safetyBonus,
    isGoForLaunch: warnings.length === 0,
    warnings,
  };
}
