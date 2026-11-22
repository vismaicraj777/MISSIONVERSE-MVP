import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import {
  ComputedMissionMetrics,
  DIFFICULTY_INFO,
  MissionConfig,
  MissionDesignState,
} from '../data/missions';
import { EventConsequence } from '../data/missionEvents';
import { MissionAudioEngine } from './audioEngine';
import { preloadNasaModels } from './nasaModelLoader';
import { createProceduralTextures, fbm2D, ProceduralTextureSet } from './proceduralTextures';
import {
  buildLaunchTower,
  buildNasaEvaAstronaut,
  buildNasaOrbitingCsm,
  buildNasaPadLandmarks,
  buildSurfaceEVAExplorer,
  buildSurveyor3Reconstruction,
  buildRocketAssembly,
  buildSurfaceRoverMesh,
  LaunchTowerAssembly,
  RocketAssembly,
  RoverAssembly,
} from './rocketModels';

export type FlightPhase =
  | 'PRELAUNCH'
  | 'COUNTDOWN'
  | 'IGNITION'
  | 'LIFTOFF'
  | 'STAGE_1_SEP'
  | 'STAGE_2_ASCENT'
  | 'STAGE_2_SEP'
  | 'EARTH_DEPARTURE'
  | 'TRANSLUNAR_CRUISE'
  | 'LUNAR_APPROACH'
  | 'LUNAR_ORBIT'
  | 'LUNAR_ORBIT_SURVEY'
  | 'LUNAR_DESCENT'
  | 'SURFACE_OPS'
  | 'LUNAR_ASCENT'
  | 'LUNAR_RENDEZVOUS'
  | 'RETURN_JOURNEY'
  | 'EARTH_REENTRY'
  | 'MISSION_COMPLETE'
  | 'MISSION_FAILED';

export type CameraPreset =
  | 'cinematic'
  | 'chase'
  | 'cockpit'
  | 'orbital'
  | 'stage'
  | 'lander'
  | 'free';

export type SystemHealth = 'GO' | 'AMBER' | 'RED';

export interface SystemsStatusSnapshot {
  propulsion: SystemHealth;
  power: SystemHealth;
  guidance: SystemHealth;
  comms: SystemHealth;
  lifeSupport: SystemHealth;
}

export interface ManeuverPlan {
  type: 'MCC' | 'LOI' | 'DOI' | 'TEI';
  title: string;
  requiredDeltaVMs: number;
  fuelCostPct: number;
  feasible: boolean;
  predictedOutcome: string;
  executed: boolean;
}

export interface DiscoveryToast {
  id: string;
  title: string;
  fact: string;
  points: number;
}

export interface TelemetrySnapshot {
  phase: FlightPhase;
  phaseLabel: string;
  activeStageName: string;
  missionTimeSec: number;
  countdownSec: number;
  altitudeKm: number;
  altitudeReference: 'EARTH' | 'MOON';
  lunarAltitudeM: number;
  earthDistanceKm: number;
  moonDistanceKm: number;
  velocityMs: number;
  verticalSpeedMs: number;
  horizontalSpeedMs: number;
  downrangeKm: number;
  machNumber: number;
  stageFuelPct: number;
  landerFuelPct: number;
  deltaVRemainingMs: number;
  powerBusPct: number;
  commsSignalPct: number;
  trajectoryErrorDeg: number;
  throttle: number;
  pitchDeg: number;
  yawDeg: number;
  rollDeg: number;
  gearDeployed: boolean;
  autopilotEnabled: boolean;
  rcsActive: boolean;
  isPaused: boolean;
  accelerationMs2: number;
  gForce: number;
  distanceToTargetM: number;
  surfaceOpsProgress: number;
  surfaceSamplesCollected: number;
  surfaceSamplesTotal: number;
  surfaceTasksDone: boolean[];
  surfaceInstrumentsDeployed: boolean;
  roverDistanceM: number;
  nearestDiscoveryDistM: number;
  nearestDiscoveryBearingDeg: number;
  dataQueuedMb: number;
  dataTransmittedMb: number;
  downlinkRateKbps: number;
  gatesPassed: number;
  gatesTotal: number;
  latestDiscovery: DiscoveryToast | null;
  orbitTasksDone: boolean[];
  systemsStatus: SystemsStatusSnapshot;
  maneuverPending: ManeuverPlan | null;
  fuelScore: number;
  navScore: number;
  landingScore: number;
  scienceTotalScore: number;
  safetyScore: number;
  overallScore: number;
  missionAwardRank: string;
  outcomeMessage?: string;
  landingGrade?: 'PRECISION' | 'NOMINAL' | 'HARD' | 'ORBITAL_RETURN' | 'CRASH';
}

interface DetachedStage {
  object: THREE.Object3D;
  velocity: THREE.Vector3;
  angularVel: THREE.Vector3;
  age: number;
}

interface Particle {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
  maxAge: number;
  sizeStart: number;
  sizeEnd: number;
  colorStart: THREE.Color;
  colorEnd: THREE.Color;
  kind: 'flame' | 'smoke' | 'dust' | 'rcs' | 'spark';
}

interface SurfaceSampleNode {
  id: string;
  title: string;
  fact: string;
  points: number;
  mesh: THREE.Group;
  crystal: THREE.Object3D;
  ring: THREE.Mesh;
  beaconBeam?: THREE.Mesh;
  x: number;
  z: number;
  collected: boolean;
}

interface CislunarGate {
  mesh: THREE.Group;
  ring: THREE.Mesh;
  passed: boolean;
  tFraction: number;
}

const PHASE_LABELS: Record<FlightPhase, string> = {
  PRELAUNCH: 'Pre-Launch Pad Readiness',
  COUNTDOWN: 'Terminal Launch Countdown',
  IGNITION: 'Main Engine Ignition Sequence',
  LIFTOFF: 'Liftoff & Stage 1 Atmospheric Ascent',
  STAGE_1_SEP: 'MECO & Stage 1 Separation',
  STAGE_2_ASCENT: 'Stage 2 Stratospheric Climb',
  STAGE_2_SEP: 'Stage 2 Separation & Upper-Stage Prep',
  EARTH_DEPARTURE: 'Earth Departure & Trans-Lunar Injection',
  TRANSLUNAR_CRUISE: 'Trans-Lunar Cruise & Mid-Course Nav',
  LUNAR_APPROACH: 'Lunar Approach & Orbit Insertion',
  LUNAR_ORBIT: 'Lunar Parking Orbit',
  LUNAR_ORBIT_SURVEY: 'Earthrise Observation & Orbital Reconnaissance',
  LUNAR_DESCENT: 'Powered Lunar Descent',
  SURFACE_OPS: 'Lunar Surface Exploration & Science',
  LUNAR_ASCENT: 'Lunar Ascent Burn',
  LUNAR_RENDEZVOUS: 'CSM Orbital Rendezvous & Docking',
  RETURN_JOURNEY: 'Trans-Earth Injection & Coast',
  EARTH_REENTRY: 'Earth Atmospheric Re-Entry & Splashdown',
  MISSION_COMPLETE: 'Mission Complete',
  MISSION_FAILED: 'Mission Terminated',
};

const DISCOVERY_PRESETS: Array<{ id: string; title: string; fact: string; color: number; offset: [number, number] }> = [
  {
    id: 'water-ice',
    title: 'Lunar Water-Ice Cold Trap',
    fact: 'Permanently shadowed craters near the Moon poles lock away ancient comet water ice that future astronauts can turn into drinking water and rocket fuel!',
    color: 0x38bdf8,
    offset: [16, 12],
  },
  {
    id: 'orange-glass',
    title: '3.8B-Year Orange Volcanic Glass',
    fact: 'Apollo 17 astronauts gasped when they spotted bright orange soil at Shorty Crater — tiny microscopic glass beads erupted from ancient lunar volcanoes!',
    color: 0xf97316,
    offset: [-17, 15],
  },
  {
    id: 'basalt-arch',
    title: 'Basalt Lava Ridge & Regolith Core',
    fact: 'Dark lunar plains called Maria formed when giant asteroid impacts flooded the Moon with ancient basalt lava seas over 3 billion years ago.',
    color: 0x22d3ee,
    offset: [11, -20],
  },
  {
    id: 'surveyor-relay',
    title: 'Historic Robotic Probe Relic',
    fact: 'Before humans walked on the Moon, robotic Surveyor probes tested whether lunar dust was firm enough to hold a heavy crewed lander.',
    color: 0xfacc15,
    offset: [-21, -14],
  },
  {
    id: 'helium-3',
    title: 'Solar-Wind Helium-3 Crystal Bed',
    fact: 'Because the Moon has no thick atmosphere, billions of years of solar wind implanted clean Helium-3 isotopes right into the dusty regolith.',
    color: 0xa855f7,
    offset: [26, -6],
  },
];

const APOLLO_11_SURFACE_PRESETS = [
  { id: 'tranquility-regolith', title: 'Collect lunar soil and rock samples', fact: 'Apollo 11 returned about 21.5 kg of lunar material from the Sea of Tranquility.', color: 0xc5b7a3, offset: [6, 3] as [number, number] },
  { id: 'tranquility-basalt', title: 'Document mare basalt', fact: 'The landing site lies on the basaltic plains of Mare Tranquillitatis.', color: 0x9ba0a3, offset: [-7, 5] as [number, number] },
  { id: 'eagle-panorama', title: 'Capture a landing-site panorama', fact: 'The crew photographed the landing area and documented boulders, craters, and the lunar horizon.', color: 0xddd5c8, offset: [9, -4] as [number, number] },
  { id: 'easel-site', title: 'Verify the EASEP experiment site', fact: 'The Early Apollo Scientific Experiments Package included a passive seismometer and laser-ranging retroreflector.', color: 0xb6a56d, offset: [-5, -7] as [number, number] },
  { id: 'lunar-sample-cache', title: 'Secure the sample return cache', fact: 'The lunar samples were packed for return to Earth in the command module Columbia.', color: 0xc5b7a3, offset: [3, 10] as [number, number] },
];

const APOLLO_17_SURFACE_PRESETS = [
  { id: 'shorty-orange-soil', title: 'Inspect orange soil at Shorty Crater', fact: 'Apollo 17 discovered orange volcanic glass beads at Shorty Crater in the Taurus-Littrow valley.', color: 0xd97732, offset: [12, 8] as [number, number] },
  { id: 'south-massif', title: 'Sample the South Massif slope', fact: 'The crew collected samples during rover traverses along the valley and massif margins.', color: 0xaaa39a, offset: [-14, 10] as [number, number] },
  { id: 'deep-core', title: 'Log a deep-core station', fact: 'Apollo 17 carried a deep-drill system to investigate lunar subsurface material.', color: 0xbcae91, offset: [10, -16] as [number, number] },
  { id: 'alsep-station', title: 'Check the ALSEP station', fact: 'The crew deployed a lunar surface experiment package for long-duration measurements.', color: 0xb6a56d, offset: [-9, -13] as [number, number] },
  { id: 'rover-traverse', title: 'Complete a rover science stop', fact: 'The Lunar Roving Vehicle extended the Apollo 17 crew’s geological traverse.', color: 0x9ba0a3, offset: [20, -4] as [number, number] },
];

const SURVEYOR_SURFACE_TASKS: Array<{ title: string; fact: string }> = [
  { title: 'Pan the TV camera across the landing site', fact: 'Surveyor 3 returned more than 6,000 television images of its surroundings.' },
  { title: 'Command the soil sampler to dig a trench', fact: 'Its surface sampler could reach about 1.5 m and dig to roughly 18 cm depth.' },
  { title: 'Record regolith response and downlink results', fact: 'The landing and sampling tests helped characterize the lunar soil for future crewed landings.' },
];

const _vec3 = new THREE.Vector3();
const _vec3b = new THREE.Vector3();
const _vec3c = new THREE.Vector3();
const _vec3d = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _color = new THREE.Color();

export class SpaceSimulation {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private textures: ProceduralTextureSet;
  private audio: MissionAudioEngine;
  private isSoftwareGl: boolean;

  private clock = new THREE.Clock();
  private frameId = 0;
  private disposed = false;

  // Lighting
  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private rimLight: THREE.DirectionalLight;
  private enginePointLight: THREE.PointLight;
  private sunDirection = new THREE.Vector3(140, 180, 120).normalize();

  // Environments
  private earthEnvGroup = new THREE.Group();
  private spaceEnvGroup = new THREE.Group();
  private lunarEnvGroup = new THREE.Group();
  private navTrajectoryGroup = new THREE.Group();

  private skyDomeMat: THREE.ShaderMaterial;
  private starsPoints: THREE.Points;
  private earthGlobe: THREE.Mesh;
  private earthClouds: THREE.Mesh;
  private earthAtmoMat!: THREE.ShaderMaterial;
  private earthNightShaderUniform: { value: THREE.Vector3 } = { value: new THREE.Vector3(0.5, 0.7, 0.4).normalize() };
  private distantMoon: THREE.Mesh;
  private sunCoronaSprite: THREE.Sprite;
  private cloudBankMesh: THREE.InstancedMesh | null = null;
  private oceanWaterMesh: THREE.Mesh | null = null;
  private padSearchlights: THREE.Mesh[] = [];
  private cryoTankPositions: THREE.Vector3[] = [];
  private launchTower: LaunchTowerAssembly | null = null;
  private padVabGroup = new THREE.Group();
  private padCrawlerGroup = new THREE.Group();

  // Atmospheric Shockwave & Re-Entry Setpieces
  private machConeMesh: THREE.Mesh;
  private reentryGroup = new THREE.Group();
  private reentryPlasmaMesh: THREE.Mesh;
  private parachuteGroup: THREE.Group;
  private splashdownOcean: THREE.Mesh;

  // Cislunar trajectory arcs & alignment rings
  private plannedTrajLine: THREE.Line | null = null;
  private actualTrajLine: THREE.Line | null = null;
  private trajMarkerMesh: THREE.Mesh | null = null;
  private cislunarGates: CislunarGate[] = [];
  private gatesPassed = 0;

  // Lunar surface height sampler, craters, rover & science targets
  private lunarTerrainMesh: THREE.Mesh | null = null;
  private lunarCraters: Array<{ x: number; z: number; r: number; depth: number }> = [];
  private targetZonePos = new THREE.Vector3(0, 0, 0);
  private targetHologramRing: THREE.Mesh | null = null;
  private descentLaserRing: THREE.Mesh | null = null;
  private surfaceScienceGroup = new THREE.Group();
  private orbitingCsmBeacon: THREE.Group | null = null;
  private surfaceRover: RoverAssembly | null = null;
  private surfaceEva: THREE.Group | null = null;
  private roverPos = new THREE.Vector3();
  private roverVelY = 0;
  private roverGrounded = true;
  private roverHeading = 0;
  private roverSpeed = 0;
  private roverDistanceM = 0;
  private roverJumpBonusAwarded = false;
  private roverPitchQuat = new THREE.Quaternion();
  private evaAstronautArm: THREE.Mesh | null = null;
  private surfaceFlagBanner: THREE.Mesh | null = null;
  private sampleNodes: SurfaceSampleNode[] = [];
  private surfaceSamplesCollected = 0;
  private surfaceTasksDone = [false, false, false];
  private surfaceInstrumentsDeployed = false;
  private latestDiscovery: DiscoveryToast | null = null;
  private dataQueuedMb = 0;
  private dataTransmittedMb = 0;

  // Active vehicle
  private rocket: RocketAssembly | null = null;
  private detachedStages: DetachedStage[] = [];

  // Particle system (Pooled Points)
  private readonly MAX_PARTICLES = 640;
  private particles: Particle[] = [];
  private particleGeo: THREE.BufferGeometry;
  private particlePoints: THREE.Points;
  private pPositions: Float32Array;
  private pColors: Float32Array;
  private pSizes: Float32Array;

  // Mission & Simulation State
  private mission!: MissionConfig;
  private design!: MissionDesignState;
  private metrics!: ComputedMissionMetrics;

  private phase: FlightPhase = 'PRELAUNCH';
  private phaseTimer = 0;
  private missionTime = 0;
  private countdownSec = 5;
  private lastCountdownWhole = 6;
  private timeWarp = 1;
  private isPaused = false;
  private cameraPreset: CameraPreset = 'chase';
  private userCameraActive = false;

  // Coherent Flight Kinematics
  private activeStageName = 'Stack Ready';
  private altitudeKm = 0;
  private altitudeReference: 'EARTH' | 'MOON' = 'EARTH';
  private earthDistanceKm = 0;
  private moonDistanceKm = 384400;
  private velocityMs = 0;
  private downrangeKm = 0;
  private machNumber = 0;
  private stageFuelPct = 100;
  private pitchRad = 0;
  private yawRad = 0;
  private rollRad = 0;
  private throttle = 0;
  private accelerationMs2 = 0;
  private gForce = 1.0;

  // Spacecraft systems & navigation state
  private powerBusPct = 100;
  private commsSignalPct = 98;
  private trajectoryErrorDeg = 0.6;
  private rcsActive = false;
  private systemsStatus: SystemsStatusSnapshot = {
    propulsion: 'GO',
    power: 'GO',
    guidance: 'GO',
    comms: 'GO',
    lifeSupport: 'GO',
  };
  private maneuverPending: ManeuverPlan | null = null;
  private mccExecuted = false;
  private loiExecuted = false;
  private teiExecuted = false;
  private orbitTasksDone = [false, false, false];
  private bonusScienceEarned = 0;
  private safetyScore = 100;
  private landingScore = 0;

  // Lunar Descent & Ascent physics
  private landerPos = new THREE.Vector3(0, 180, 0);
  private landerVel = new THREE.Vector3(0, 0, 0);
  private landerPitch = 0;
  private landerRoll = 0;
  private landerFuelPct = 100;
  private gearDeployed = false;
  private autopilotEnabled = true;
  private lunarTerrainBuilt = false;
  private surfaceOpsProgress = 0;
  private outcomeMessage = '';
  private landingGrade: TelemetrySnapshot['landingGrade'] = undefined;
  private lmDescentLeftOnSurface = false;

  // Input flags (keyboard + virtual UI controls)
  public keysPressed: Record<string, boolean> = {};
  public virtualInput: Record<string, boolean> = {};

  // Callbacks
  private onTelemetry: (snap: TelemetrySnapshot) => void;
  private onPhaseChange?: (phase: FlightPhase) => void;
  private onContextLoss?: (lost: boolean) => void;
  private lastTelemetryEmit = 0;

  constructor(
    container: HTMLElement,
    mission: MissionConfig,
    design: MissionDesignState,
    metrics: ComputedMissionMetrics,
    onTelemetry: (snap: TelemetrySnapshot) => void,
    onPhaseChange?: (phase: FlightPhase) => void,
    onContextLoss?: (lost: boolean) => void,
  ) {
    this.container = container;
    this.onTelemetry = onTelemetry;
    this.onPhaseChange = onPhaseChange;
    this.onContextLoss = onContextLoss;
    this.audio = new MissionAudioEngine();

    this.isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.96;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.handleContextRestored);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x03050a);
    this.scene.fog = new THREE.FogExp2(0x7fa9c8, 0.00024);

    const aspect = width / height;
    this.camera = new THREE.PerspectiveCamera(52, aspect, 0.25, 18000);
    this.camera.position.set(42, 22, 54);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.06;
    this.controls.maxDistance = 1400;
    this.controls.minDistance = 4;
    this.controls.addEventListener('start', () => {
      this.userCameraActive = true;
      this.cameraPreset = 'free';
    });

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.textures = createProceduralTextures(this.renderer.capabilities.getMaxAnisotropy());

    this.sunLight = new THREE.DirectionalLight(0xfff2df, 2.45);
    this.sunLight.position.set(140, 180, 120);
    this.sunDirection.copy(this.sunLight.position).normalize();
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    const d = 90;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 560;
    this.sunLight.shadow.bias = -0.0004;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.hemiLight = new THREE.HemisphereLight(0x8ec5fc, 0x303947, 0.58);
    this.scene.add(this.hemiLight);

    this.rimLight = new THREE.DirectionalLight(0x93c5fd, 0.75);
    this.rimLight.position.set(-90, 40, -110);
    this.scene.add(this.rimLight);

    this.enginePointLight = new THREE.PointLight(0xff9b42, 0, 160, 1.6);
    this.scene.add(this.enginePointLight);

    this.skyDomeMat = this.buildSkyDome();
    this.starsPoints = this.buildStarfield();
    const { earth, clouds } = this.buildEarthAndAtmosphere();
    this.earthGlobe = earth;
    this.earthClouds = clouds;
    this.distantMoon = this.buildDistantMoon();
    this.sunCoronaSprite = this.buildSunCorona();
    this.machConeMesh = this.buildMachCone();
    const { group: reentryGrp, plasma, chutes, ocean } = this.buildReentryAndSplashdown();
    this.reentryGroup = reentryGrp;
    this.reentryPlasmaMesh = plasma;
    this.parachuteGroup = chutes;
    this.splashdownOcean = ocean;
    this.buildNavTrajectoryOverlay();
    this.buildEarthPadTerrain();

    this.scene.add(
      this.earthEnvGroup,
      this.spaceEnvGroup,
      this.lunarEnvGroup,
      this.navTrajectoryGroup,
      this.reentryGroup,
    );
    this.lunarEnvGroup.visible = false;
    this.navTrajectoryGroup.visible = false;
    this.reentryGroup.visible = false;

    this.pPositions = new Float32Array(this.MAX_PARTICLES * 3);
    this.pColors = new Float32Array(this.MAX_PARTICLES * 3);
    this.pSizes = new Float32Array(this.MAX_PARTICLES);
    for (let i = 0; i < this.MAX_PARTICLES; i++) {
      this.particles.push({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        age: 0,
        maxAge: 1,
        sizeStart: 1,
        sizeEnd: 4,
        colorStart: new THREE.Color(0xffffff),
        colorEnd: new THREE.Color(0x444444),
        kind: 'flame',
      });
    }
    this.particleGeo = new THREE.BufferGeometry();
    this.particleGeo.setAttribute('position', new THREE.BufferAttribute(this.pPositions, 3));
    this.particleGeo.setAttribute('color', new THREE.BufferAttribute(this.pColors, 3));
    this.particleGeo.setAttribute('size', new THREE.BufferAttribute(this.pSizes, 1));

    const particleMat = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: this.textures.particleGlowMap },
        uPixelRatio: { value: this.renderer.getPixelRatio() },
      },
      vertexShader: `
        attribute float size;
        attribute vec3 color;
        varying vec3 vColor;
        uniform float uPixelRatio;
        void main() {
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = clamp(size * uPixelRatio * (380.0 / max(1.0, -mvPosition.z)), 2.0, 150.0);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform sampler2D uMap;
        varying vec3 vColor;
        void main() {
          vec4 tex = texture2D(uMap, gl_PointCoord);
          if (tex.a < 0.04) discard;
          gl_FragColor = vec4(vColor, tex.a * 0.88);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    this.particlePoints = new THREE.Points(this.particleGeo, particleMat);
    this.particlePoints.frustumCulled = false;
    this.scene.add(this.particlePoints);

    if (!this.isSoftwareGl) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.24, 0.35, 0.9);
      this.composer.addPass(this.bloomPass);
      this.composer.addPass(new OutputPass());
    }

    this.loadMission(mission, design, metrics);

    void preloadNasaModels(() => {
      if (this.disposed) return;
      this.upgradeSceneWithNasaModels();
    });

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    window.addEventListener('resize', this.handleResize);
    this.clock.start();
    this.tick();
  }

  private handleContextLost = (e: Event): void => {
    e.preventDefault();
    this.onContextLoss?.(true);
  };

  private handleContextRestored = (): void => {
    this.onContextLoss?.(false);
  };

  private transitionPhase(next: FlightPhase): void {
    if (this.phase === next) return;
    this.phase = next;
    this.phaseTimer = 0;
    this.onPhaseChange?.(next);
  }

  private buildSkyDome(): THREE.ShaderMaterial {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uZenith: { value: new THREE.Color(0x0d3b75) },
        uHorizon: { value: new THREE.Color(0x9bc7ed) },
        uGround: { value: new THREE.Color(0x162436) },
        uSunDir: { value: new THREE.Vector3(0.5, 0.6, 0.4).normalize() },
        uAtmosAlpha: { value: 1.0 },
      },
      vertexShader: `
        varying vec3 vWorldDir;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldDir = normalize(position);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform vec3 uZenith;
        uniform vec3 uHorizon;
        uniform vec3 uGround;
        uniform vec3 uSunDir;
        uniform float uAtmosAlpha;
        varying vec3 vWorldDir;
        void main() {
          float h = clamp(vWorldDir.y, -1.0, 1.0);
          vec3 sky = mix(uHorizon, uZenith, pow(max(h, 0.0), 0.52));
          if (h < 0.0) {
            sky = mix(uHorizon, uGround, smoothstep(0.0, -0.28, h));
          }
          float sunDot = max(dot(normalize(vWorldDir), uSunDir), 0.0);
          sky += vec3(1.0, 0.9, 0.72) * pow(sunDot, 52.0) * 0.5 * uAtmosAlpha;
          sky = mix(vec3(0.004, 0.007, 0.014), sky, uAtmosAlpha);
          gl_FragColor = vec4(sky, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
    });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(9000, 32, 24), mat);
    dome.frustumCulled = false;
    this.scene.add(dome);
    return mat;
  }

  private buildStarfield(): THREE.Points {
    const count = 4200;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const inBand = i < count * 0.34;
      const phi = inBand
        ? Math.PI * 0.5 + (Math.random() - 0.5) * 0.28 + Math.sin(theta * 2) * 0.14
        : Math.acos(2 * v - 1);
      const r = 6800;
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.cos(phi);
      const z = r * Math.sin(phi) * Math.sin(theta);
      const tilt = 0.48;
      positions[i * 3] = x;
      positions[i * 3 + 1] = y * Math.cos(tilt) - z * Math.sin(tilt);
      positions[i * 3 + 2] = y * Math.sin(tilt) + z * Math.cos(tilt);

      const brightness = (inBand ? 0.38 : 0.52) + Math.pow(Math.random(), 2.0) * 0.48;
      const spectral = Math.random();
      if (spectral > 0.78) {
        colors[i * 3] = brightness * 0.82;
        colors[i * 3 + 1] = brightness * 0.9;
        colors[i * 3 + 2] = brightness;
      } else if (spectral < 0.22) {
        colors[i * 3] = brightness;
        colors[i * 3 + 1] = brightness * 0.84;
        colors[i * 3 + 2] = brightness * 0.65;
      } else {
        colors[i * 3] = brightness * 0.97;
        colors[i * 3 + 1] = brightness * 0.97;
        colors[i * 3 + 2] = brightness * 0.95;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 16,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    this.scene.add(pts);
    return pts;
  }

  private buildSunCorona(): THREE.Sprite {
    const spriteMat = new THREE.SpriteMaterial({
      map: this.textures.sunCoronaMap,
      color: 0xfff4d6,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(950, 950, 1);
    sprite.position.copy(this.sunDirection).multiplyScalar(5800);
    this.scene.add(sprite);
    return sprite;
  }

  private buildEarthAndAtmosphere(): { earth: THREE.Mesh; clouds: THREE.Mesh } {
    // Realistic Smooth Spherical Earth with Cloud Deck, Night City Lights & Rayleigh Limb Glow
    const earthRadius = 1120;
    const earthGeo = new THREE.SphereGeometry(earthRadius, 64, 48);
    const nightTex = this.textures.earthNightMap;
    const sunUniform = this.earthNightShaderUniform;

    const earthMat = new THREE.MeshStandardMaterial({
      map: this.textures.earthGlobeMap,
      roughnessMap: this.textures.earthRoughnessMap,
      roughness: 0.84,
      metalness: 0.04,
    });

    earthMat.onBeforeCompile = (shader) => {
      shader.uniforms.uNightMap = { value: nightTex };
      shader.uniforms.uSunDirWorld = sunUniform;
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
           varying vec3 vEarthWorldNormal;`,
        )
        .replace(
          '#include <beginnormal_vertex>',
          `#include <beginnormal_vertex>
           vEarthWorldNormal = normalize(mat3(modelMatrix) * objectNormal);`,
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           uniform sampler2D uNightMap;
           uniform vec3 uSunDirWorld;
           varying vec3 vEarthWorldNormal;`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
           float sunLit = dot(normalize(vEarthWorldNormal), normalize(uSunDirWorld));
           float nightFactor = smoothstep(0.12, -0.22, sunLit);
           vec3 nightLights = texture2D(uNightMap, vMapUv).rgb;
           totalEmissiveRadiance += nightLights * nightFactor * 1.25;`,
        );
    };

    const earth = new THREE.Mesh(earthGeo, earthMat);
    earth.position.set(0, -earthRadius - 32, 0);
    earth.rotation.set(0.14, 0.72, 0.05);
    this.spaceEnvGroup.add(earth);

    const cloudGeo = new THREE.SphereGeometry(earthRadius * 1.014, 64, 48);
    const cloudMat = new THREE.MeshStandardMaterial({
      map: this.textures.earthCloudsMap,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      roughness: 0.94,
    });
    const clouds = new THREE.Mesh(cloudGeo, cloudMat);
    earth.add(clouds);

    // Spherical Rayleigh-Blue Atmospheric Scattering Limb
    const atmoGeo = new THREE.SphereGeometry(earthRadius * 1.045, 48, 36);
    this.earthAtmoMat = new THREE.ShaderMaterial({
      uniforms: {
        uSunDirWorld: sunUniform,
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vWorldNormal;
        varying vec3 vViewPos;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vViewPos = -mvPos.xyz;
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform vec3 uSunDirWorld;
        varying vec3 vNormal;
        varying vec3 vWorldNormal;
        varying vec3 vViewPos;
        void main() {
          float fresnel = pow(1.0 - max(0.0, dot(vNormal, normalize(vViewPos))), 2.8);
          float sunDot = dot(normalize(vWorldNormal), normalize(uSunDirWorld));
          float dayMask = smoothstep(-0.35, 0.3, sunDot);
          vec3 limbBlue = vec3(0.28, 0.66, 1.0);
          gl_FragColor = vec4(limbBlue, fresnel * (0.18 + 0.65 * dayMask));
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      depthWrite: false,
    });
    const atmo = new THREE.Mesh(atmoGeo, this.earthAtmoMat);
    earth.add(atmo);

    return { earth, clouds };
  }

  private buildDistantMoon(): THREE.Mesh {
    const geo = new THREE.SphereGeometry(92, 48, 36);
    const mat = new THREE.MeshStandardMaterial({
      map: this.textures.moonGlobeMap,
      bumpMap: this.textures.moonGlobeBump,
      bumpScale: 1.6,
      roughness: 0.94,
      metalness: 0.02,
    });
    const moon = new THREE.Mesh(geo, mat);
    moon.position.set(950, 1450, -2400);
    moon.rotation.set(0.25, 0.5, 0.15);
    this.spaceEnvGroup.add(moon);
    return moon;
  }

  private buildMachCone(): THREE.Mesh {
    const coneGeo = new THREE.ConeGeometry(8.5, 16, 32, 1, true);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.visible = false;
    this.scene.add(cone);
    return cone;
  }

  private buildReentryAndSplashdown(): {
    group: THREE.Group;
    plasma: THREE.Mesh;
    chutes: THREE.Group;
    ocean: THREE.Mesh;
  } {
    const group = new THREE.Group();

    // Glowing fiery atmospheric plasma bow-shock cone around heatshield
    const plasmaGeo = new THREE.ConeGeometry(3.2, 5.2, 28, 1, true);
    const plasmaMat = new THREE.MeshBasicMaterial({
      color: 0xff7b29,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const plasma = new THREE.Mesh(plasmaGeo, plasmaMat);
    plasma.rotation.x = Math.PI;
    group.add(plasma);

    // 3 Orange-and-White Ring-Sail Main Parachutes
    const chutes = new THREE.Group();
    const chuteMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      roughness: 0.75,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });
    const bandMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.75,
      side: THREE.DoubleSide,
    });
    const lineMat = new THREE.LineBasicMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.85 });

    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3;
      const offsetX = Math.cos(a) * 3.2;
      const offsetZ = Math.sin(a) * 3.2;
      const canopyGrp = new THREE.Group();
      canopyGrp.position.set(offsetX, 11.5, offsetZ);
      canopyGrp.rotation.z = -Math.cos(a) * 0.22;
      canopyGrp.rotation.x = Math.sin(a) * 0.22;

      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(2.8, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.52),
        chuteMat,
      );
      const whiteRing = new THREE.Mesh(
        new THREE.CylinderGeometry(2.65, 2.8, 0.55, 20, 1, true),
        bandMat,
      );
      whiteRing.position.y = 0.25;
      canopyGrp.add(dome, whiteRing);

      // Suspension shroud lines
      for (let s = 0; s < 4; s++) {
        const sa = (s * Math.PI) / 2;
        const pts = [
          new THREE.Vector3(-offsetX, -11.5, -offsetZ),
          new THREE.Vector3(Math.cos(sa) * 2.5, 0, Math.sin(sa) * 2.5),
        ];
        const lGeo = new THREE.BufferGeometry().setFromPoints(pts);
        canopyGrp.add(new THREE.Line(lGeo, lineMat));
      }
      chutes.add(canopyGrp);
    }
    chutes.scale.setScalar(0.01);
    chutes.visible = false;
    group.add(chutes);

    // Pacific Ocean Splashdown Surface
    const oceanGeo = new THREE.PlaneGeometry(1800, 1800);
    const oceanMat = new THREE.MeshStandardMaterial({
      color: 0x0c4a6e,
      map: this.textures.oceanWaterMap,
      roughness: 0.22,
      metalness: 0.45,
      transparent: true,
      opacity: 0.94,
    });
    const ocean = new THREE.Mesh(oceanGeo, oceanMat);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = 8;
    ocean.visible = false;
    group.add(ocean);

    return { group, plasma, chutes, ocean };
  }

  private buildNavTrajectoryOverlay(): void {
    const plannedPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      plannedPts.push(new THREE.Vector3(t * 950, t * 1300 + Math.sin(t * Math.PI) * 260, -t * 2200));
    }
    const plannedGeo = new THREE.BufferGeometry().setFromPoints(plannedPts);
    const plannedMat = new THREE.LineBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.78,
    });
    this.plannedTrajLine = new THREE.Line(plannedGeo, plannedMat);
    this.navTrajectoryGroup.add(this.plannedTrajLine);

    const actualGeo = new THREE.BufferGeometry().setFromPoints(plannedPts);
    const actualMat = new THREE.LineBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.88,
    });
    this.actualTrajLine = new THREE.Line(actualGeo, actualMat);
    this.navTrajectoryGroup.add(this.actualTrajLine);

    this.trajMarkerMesh = new THREE.Mesh(
      new THREE.SphereGeometry(18, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0x34d399 }),
    );
    this.navTrajectoryGroup.add(this.trajMarkerMesh);

    // 4 Interactive Cislunar Alignment Booster Gates along the translunar corridor
    this.cislunarGates = [];
    const gateFractions = [0.22, 0.45, 0.68, 0.88];
    for (const frac of gateFractions) {
      const gateGrp = new THREE.Group();
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.75,
      });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(13, 0.65, 12, 36), ringMat);
      const innerRing = new THREE.Mesh(
        new THREE.TorusGeometry(10.5, 0.25, 8, 32),
        new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.55 }),
      );
      gateGrp.add(ring, innerRing);
      this.navTrajectoryGroup.add(gateGrp);
      this.cislunarGates.push({ mesh: gateGrp, ring, passed: false, tFraction: frac });
    }
  }

  private updateNavTrajectoryLines(cruiseProgress: number): void {
    if (!this.rocket || !this.plannedTrajLine || !this.actualTrajLine || !this.trajMarkerMesh) return;
    const origin = this.rocket.root.position;
    const target = this.distantMoon.position;

    const plannedArr = this.plannedTrajLine.geometry.attributes.position as THREE.BufferAttribute;
    const actualArr = this.actualTrajLine.geometry.attributes.position as THREE.BufferAttribute;
    const errScale = this.trajectoryErrorDeg * 45;

    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const px = THREE.MathUtils.lerp(origin.x, target.x, t) + Math.sin(t * Math.PI) * 140;
      const py = THREE.MathUtils.lerp(origin.y, target.y, t) + Math.sin(t * Math.PI) * 260;
      const pz = THREE.MathUtils.lerp(origin.z, target.z, t);
      plannedArr.setXYZ(i, px, py, pz);

      const drift = Math.sin(t * Math.PI * 0.85) * errScale;
      actualArr.setXYZ(i, px + drift, py - drift * 0.45, pz + drift * 0.35);
    }
    plannedArr.needsUpdate = true;
    actualArr.needsUpdate = true;

    (this.actualTrajLine.material as THREE.LineBasicMaterial).color.setHex(
      this.trajectoryErrorDeg <= 0.75 ? 0x10b981 : 0xf59e0b,
    );

    this.trajMarkerMesh.position.copy(origin);
    this.navTrajectoryGroup.visible =
      this.phase === 'TRANSLUNAR_CRUISE' || this.phase === 'EARTH_DEPARTURE';

    // Position the 4 holographic cislunar gates along the live vector ahead of the spacecraft
    for (let i = 0; i < this.cislunarGates.length; i++) {
      const gate = this.cislunarGates[i];
      const rel = gate.tFraction - cruiseProgress;
      if (this.phase === 'TRANSLUNAR_CRUISE' && rel > -0.05 && rel < 0.65) {
        gate.mesh.visible = true;
        const aheadDist = Math.max(-18, rel * 260);
        const lateralJitter = Math.sin(i * 2.1 + 1.0) * (gate.passed ? 0 : 7.5);
        gate.mesh.position.set(
          origin.x + aheadDist * 0.82 + lateralJitter * 0.4,
          origin.y + aheadDist * 0.55 + (i % 2 === 0 ? 4 : -4) * (gate.passed ? 0 : 1),
          origin.z + lateralJitter,
        );
        gate.mesh.lookAt(origin);
        gate.ring.rotation.z += 0.02;

        if (!gate.passed && origin.distanceTo(gate.mesh.position) < 19) {
          gate.passed = true;
          this.gatesPassed++;
          this.bonusScienceEarned += 15;
          this.dataQueuedMb += 8;
          this.trajectoryErrorDeg = Math.max(0.15, this.trajectoryErrorDeg - 0.35);
          (gate.ring.material as THREE.MeshBasicMaterial).color.setHex(0x10b981);
          this.audio.playQuindarBeep(true);
          for (let s = 0; s < 18; s++) {
            this.spawnParticle(
              gate.mesh.position,
              _vec3d.set((Math.random() - 0.5) * 24, (Math.random() - 0.5) * 24, (Math.random() - 0.5) * 24),
              0.7,
              1.6,
              3.2,
              0x34d399,
              0x22d3ee,
              'spark',
            );
          }
        }
      } else {
        gate.mesh.visible = false;
      }
    }
  }

  private buildEarthPadTerrain(): void {
    this.cryoTankPositions = [];
    this.padSearchlights = [];

    // 1. Continuous Smooth Coastal Cape Canaveral Terrain (1800x1800)
    const size = 1800;
    const segs = 136;
    const geo = new THREE.PlaneGeometry(size, size, segs, segs);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const treePositions: Array<{ x: number; y: number; z: number; scale: number }> = [];

    for (let i = 0; i < pos.count; i++) {
      const wx = pos.getX(i);
      const wz = pos.getZ(i);
      const dist = Math.hypot(wx, wz);

      const rawDune = (fbm2D(wx * 0.007 + 5, wz * 0.007 + 5, 4, 12) - 0.44) * 20;
      const flatMask = THREE.MathUtils.smoothstep(dist, 36, 125);
      let y = rawDune * flatMask;

      const isPad = dist < 36;
      const isRoad = wx < 0 && wx > -260 && Math.abs(wz) < 11;
      const isOceanBed = wx > 175;
      const isBeach = !isOceanBed && wx > 142;

      if (isPad || isRoad) {
        y = 0;
      } else if (isOceanBed) {
        y = -THREE.MathUtils.smoothstep(wx, 175, 290) * 6.5 - 0.8;
      } else if (isBeach) {
        y = THREE.MathUtils.lerp(y, 0.2, THREE.MathUtils.smoothstep(wx, 142, 175));
      }

      pos.setY(i, y);

      if (isPad) {
        colors[i * 3] = 0.52;
        colors[i * 3 + 1] = 0.55;
        colors[i * 3 + 2] = 0.59;
      } else if (isRoad) {
        colors[i * 3] = 0.34;
        colors[i * 3 + 1] = 0.36;
        colors[i * 3 + 2] = 0.4;
      } else if (isOceanBed) {
        colors[i * 3] = 0.62;
        colors[i * 3 + 1] = 0.58;
        colors[i * 3 + 2] = 0.46;
      } else if (isBeach) {
        colors[i * 3] = 0.86;
        colors[i * 3 + 1] = 0.8;
        colors[i * 3 + 2] = 0.62;
      } else {
        const biome = fbm2D(wx * 0.025, wz * 0.025, 3, 4);
        colors[i * 3] = 0.16 + biome * 0.14;
        colors[i * 3 + 1] = 0.36 + biome * 0.18;
        colors[i * 3 + 2] = 0.14 + biome * 0.08;

        if (dist > 58 && wx < 135 && Math.abs(wz) > 18 && i % 17 === 0 && treePositions.length < 220) {
          treePositions.push({ x: wx, y, z: wz, scale: 0.85 + (i % 5) * 0.18 });
        }
      }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9,
      metalness: 0.03,
    });
    const terrainMesh = new THREE.Mesh(geo, terrainMat);
    terrainMesh.receiveShadow = true;
    this.earthEnvGroup.add(terrainMesh);

    // 2. Animated Shimmering Atlantic Ocean Plane
    const oceanGeo = new THREE.PlaneGeometry(1400, 1800);
    oceanGeo.rotateX(-Math.PI / 2);
    const oceanMat = new THREE.MeshStandardMaterial({
      color: 0x0e5a8a,
      map: this.textures.oceanWaterMap,
      roughness: 0.18,
      metalness: 0.48,
      transparent: true,
      opacity: 0.9,
    });
    this.oceanWaterMesh = new THREE.Mesh(oceanGeo, oceanMat);
    this.oceanWaterMesh.position.set(855, -0.35, 0);
    this.oceanWaterMesh.receiveShadow = true;
    this.earthEnvGroup.add(this.oceanWaterMesh);

    // 3. NASA Landmarks: Vehicle Assembly Building (VAB), Crawler-Transporter & Cryo Spheres
    this.padVabGroup.position.set(-220, 0, -45);
    this.earthEnvGroup.add(this.padVabGroup);
    this.padCrawlerGroup.position.set(-64, 0, 0);
    this.earthEnvGroup.add(this.padCrawlerGroup);
    this.populatePadLandmarks();

    // Twin Cryogenic LH2 / LOX Storage Spheres with continuous boil-off venting
    const sphereMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.32, metalness: 0.45 });
    const cryoCoords: Array<[number, number, number]> = [
      [48, 7.5, -42],
      [64, 6.2, -32],
    ];
    for (const [cx, cy, cz] of cryoCoords) {
      const tank = new THREE.Mesh(new THREE.SphereGeometry(cy * 0.85, 24, 18), sphereMat);
      tank.position.set(cx, cy, cz);
      tank.castShadow = true;
      this.earthEnvGroup.add(tank);
      const legCol = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.55, cy, 10),
        new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.6 }),
      );
      legCol.position.set(cx, cy * 0.5, cz);
      this.earthEnvGroup.add(legCol);
      this.cryoTankPositions.push(new THREE.Vector3(cx, cy + cy * 0.9, cz));
    }

    // Sweeping Pad Xenon Searchlight Beams
    const beamGeo = new THREE.ConeGeometry(7.5, 95, 16, 1, true);
    beamGeo.translate(0, 47.5, 0);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xbae6fd,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const beamCoords: Array<[number, number]> = [
      [34, 34],
      [-34, -34],
      [34, -34],
    ];
    for (const [bx, bz] of beamCoords) {
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.set(bx, 0.5, bz);
      beam.lookAt(0, 42, 0);
      beam.rotateX(Math.PI / 2);
      this.earthEnvGroup.add(beam);
      this.padSearchlights.push(beam);
    }

    this.launchTower = buildLaunchTower(this.textures);
    this.earthEnvGroup.add(this.launchTower.root);

    // 5. Multi-Layer Puffy Volumetric Clouds overhead
    const dummy = new THREE.Object3D();
    const cloudCount = 62;
    const cGeo = new THREE.SphereGeometry(22, 20, 14);
    const cMat = new THREE.MeshStandardMaterial({
      color: 0xeaf1f5,
      roughness: 0.96,
      metalness: 0,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
    });
    const clouds = new THREE.InstancedMesh(cGeo, cMat, cloudCount);
    for (let i = 0; i < cloudCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 260 + Math.random() * 820;
      dummy.position.set(Math.cos(angle) * radius, 250 + Math.random() * 150, Math.sin(angle) * radius);
      const s = 0.55 + Math.random() * 1.1;
      dummy.scale.set(s * 2.1, s * 0.42, s * 1.5);
      dummy.rotation.set(0, Math.random() * Math.PI, 0);
      dummy.updateMatrix();
      clouds.setMatrixAt(i, dummy.matrix);
    }
    clouds.instanceMatrix.needsUpdate = true;
    clouds.computeBoundingSphere();
    this.cloudBankMesh = clouds;
    this.earthEnvGroup.add(clouds);
  }

  private populatePadLandmarks(): void {
    while (this.padVabGroup.children.length > 0) {
      const c = this.padVabGroup.children[0];
      this.padVabGroup.remove(c);
      this.disposeObject(c);
    }
    while (this.padCrawlerGroup.children.length > 0) {
      const c = this.padCrawlerGroup.children[0];
      this.padCrawlerGroup.remove(c);
      this.disposeObject(c);
    }
    const { vab, crawler } = buildNasaPadLandmarks();
    if (vab) {
      this.padVabGroup.add(vab);
    } else {
      const vabBody = new THREE.Mesh(
        new THREE.BoxGeometry(44, 52, 54),
        new THREE.MeshStandardMaterial({ color: 0xdbe2ea, roughness: 0.65, metalness: 0.15 }),
      );
      vabBody.position.y = 26;
      vabBody.castShadow = true;
      vabBody.receiveShadow = true;
      this.padVabGroup.add(vabBody);
    }
    if (crawler) {
      this.padCrawlerGroup.add(crawler);
    } else {
      const cDeck = new THREE.Mesh(
        new THREE.BoxGeometry(14, 2.2, 12),
        new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.5, metalness: 0.6 }),
      );
      cDeck.position.y = 2.4;
      this.padCrawlerGroup.add(cDeck);
    }
  }

  private upgradeSceneWithNasaModels(): void {
    // Upgrade Launch Tower with official NASA Mobile Launcher GLB
    if (this.launchTower) {
      this.earthEnvGroup.remove(this.launchTower.root);
      this.disposeObject(this.launchTower.root);
      this.launchTower = buildLaunchTower(this.textures);
      this.earthEnvGroup.add(this.launchTower.root);
    }

    // Upgrade Pad VAB & Crawler with official NASA GLBs
    this.populatePadLandmarks();

    // Upgrade active vehicle preserving exact transform, visibility, and stage states
    if (this.rocket) {
      const old = this.rocket;
      const pos = old.root.position.clone();
      const rot = old.root.rotation.clone();
      const s1Vis = old.stage1.visible && Boolean(old.stage1.parent);
      const s2Vis = old.stage2.visible && Boolean(old.stage2.parent);
      const s3Vis = old.stage3.visible && Boolean(old.stage3.parent);
      const csmVis = old.csm ? old.csm.visible && Boolean(old.csm.parent) : false;
      const csmPos = old.csm?.position.clone();
      const csmRot = old.csm?.rotation.clone();
      const csmScale = old.csm?.scale.clone();
      const landerVis = old.lander.visible && Boolean(old.lander.parent);
      const landerPos = old.lander.position.clone();
      const landerRot = old.lander.rotation.clone();
      const landerScale = old.lander.scale.clone();
      const lesExists = Boolean(old.lesTower?.parent);
      const fairExists = Boolean(old.fairingLeft?.parent);
      const smExists = Boolean(old.csmServiceModule?.parent);

      this.scene.remove(old.root);
      this.disposeObject(old.root);

      const next = buildRocketAssembly(this.mission, this.textures);
      next.root.position.copy(pos);
      next.root.rotation.copy(rot);
      next.stage1.visible = s1Vis;
      next.stage2.visible = s2Vis;
      next.stage3.visible = s3Vis;
      if (!lesExists && next.lesTower) {
        next.lesTower.parent?.remove(next.lesTower);
        next.lesTower = null;
      }
      if (!fairExists && next.fairingLeft && next.fairingRight) {
        next.fairingLeft.parent?.remove(next.fairingLeft);
        next.fairingRight.parent?.remove(next.fairingRight);
        next.fairingLeft = null;
        next.fairingRight = null;
      }
      if (next.csm) {
        next.csm.visible = csmVis;
        if (csmPos) next.csm.position.copy(csmPos);
        if (csmRot) next.csm.rotation.copy(csmRot);
        if (csmScale) next.csm.scale.copy(csmScale);
        if (!smExists && next.csmServiceModule) {
          next.csmServiceModule.parent?.remove(next.csmServiceModule);
          next.csmServiceModule = null;
        }
      }
      next.lander.visible = landerVis;
      next.lander.position.copy(landerPos);
      next.lander.rotation.copy(landerRot);
      next.lander.scale.copy(landerScale);

      this.rocket = next;
      this.scene.add(next.root);
    }

    // Upgrade Orbiting CSM in lunar orbit if currently present
    if (this.orbitingCsmBeacon) {
      const nasaCsm = buildNasaOrbitingCsm();
      if (nasaCsm) {
        while (this.orbitingCsmBeacon.children.length > 0) {
          const ch = this.orbitingCsmBeacon.children[0];
          this.orbitingCsmBeacon.remove(ch);
          this.disposeObject(ch);
        }
        this.orbitingCsmBeacon.add(nasaCsm);
      }
    }
  }

  private getSelectedLandingSiteOffset(): { x: number; z: number; roughness: number } {
    const site = this.mission.landingSites?.find((s) => s.id === this.design.selectedSiteId)
      ?? this.mission.landingSites?.[0];
    return {
      x: site?.offsetX ?? 0,
      z: site?.offsetZ ?? 0,
      roughness: site?.roughnessFactor ?? 1.0,
    };
  }

  private buildLunarTerrain(): void {
    while (this.lunarEnvGroup.children.length > 0) {
      const child = this.lunarEnvGroup.children[0];
      this.lunarEnvGroup.remove(child);
      child.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry.dispose();
          if (Array.isArray(m.material)) m.material.forEach((mt) => mt.dispose());
          else m.material.dispose();
        }
      });
    }
    this.lunarCraters = [];
    this.surfaceScienceGroup = new THREE.Group();
    this.orbitingCsmBeacon = null;
    this.surfaceRover = null;
    this.surfaceEva = null;
    this.evaAstronautArm = null;
    this.surfaceFlagBanner = null;
    this.targetHologramRing = null;
    this.descentLaserRing = null;
    this.sampleNodes = [];

    const siteInfo = this.getSelectedLandingSiteOffset();
    const seed = this.mission.lunarTerrainSeed;
    const density = this.mission.craterDensity * siteInfo.roughness;

    const craterCount = Math.round(44 * density);
    for (let i = 0; i < craterCount; i++) {
      const angle = ((i * 137.5 + seed * 31) % 360) * (Math.PI / 180);
      const dist = 30 + ((i * 29 + seed * 17) % 390);
      const cx = siteInfo.x + Math.cos(angle) * dist;
      const cz = siteInfo.z + Math.sin(angle) * dist;
      const r = 7 + ((i * 13 + seed * 7) % 38);
      const depth = r * (0.18 + ((i * 3) % 5) * 0.032);
      this.lunarCraters.push({ x: cx, z: cz, r, depth });
    }

    // 1. High-Resolution Smooth Displaced Lunar Terrain (440x440, 144x144 grid)
    const innerSpan = 440;
    const innerGeo = new THREE.PlaneGeometry(innerSpan, innerSpan, 144, 144);
    innerGeo.rotateX(-Math.PI / 2);
    const pos = innerGeo.attributes.position as THREE.BufferAttribute;
    const vColors = new Float32Array(pos.count * 3);
    const tintColor = new THREE.Color(this.mission.surfaceTint);

    for (let i = 0; i < pos.count; i++) {
      const wx = pos.getX(i) + siteInfo.x;
      const wz = pos.getZ(i) + siteInfo.z;
      const h = this.sampleLunarHeight(wx, wz);
      pos.setX(i, wx);
      pos.setY(i, h);
      pos.setZ(i, wz);

      // Subtle mineral & elevation contrast: brighter highlands, darker basalt crater bowls
      const elevShade = THREE.MathUtils.clamp(0.88 + h * 0.02, 0.68, 1.18);
      vColors[i * 3] = tintColor.r * elevShade;
      vColors[i * 3 + 1] = tintColor.g * elevShade;
      vColors[i * 3 + 2] = tintColor.b * elevShade;
    }
    innerGeo.setAttribute('color', new THREE.BufferAttribute(vColors, 3));
    innerGeo.computeVertexNormals();

    const lunarMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: this.textures.lunarGroundMap,
      bumpMap: this.textures.lunarGroundBump,
      bumpScale: 0.45,
      roughness: 0.94,
      metalness: 0.02,
    });

    const terrainMesh = new THREE.Mesh(innerGeo, lunarMat);
    terrainMesh.receiveShadow = true;
    this.lunarTerrainMesh = terrainMesh;
    this.lunarEnvGroup.add(terrainMesh);

    // Outer Horizon Massifs Skirt (1900x1900)
    const outerGeo = new THREE.PlaneGeometry(1900, 1900, 72, 72);
    outerGeo.rotateX(-Math.PI / 2);
    const oPos = outerGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < oPos.count; i++) {
      const wx = oPos.getX(i) + siteInfo.x;
      const wz = oPos.getZ(i) + siteInfo.z;
      const dist = Math.hypot(wx - siteInfo.x, wz - siteInfo.z);
      const baseH = this.sampleLunarHeight(wx, wz) - (dist < 220 ? 1.5 : 0);
      const ridgeBoost = dist > 260 ? Math.max(0, (fbm2D(wx * 0.004, wz * 0.004, 3, seed) - 0.45) * 95) : 0;
      oPos.setX(i, wx);
      oPos.setY(i, baseH + ridgeBoost - 0.6);
      oPos.setZ(i, wz);
    }
    outerGeo.computeVertexNormals();
    const outerMesh = new THREE.Mesh(
      outerGeo,
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(this.mission.surfaceTint).multiplyScalar(0.85),
        map: this.textures.lunarGroundMap,
        roughness: 0.96,
        metalness: 0.02,
      }),
    );
    outerMesh.receiveShadow = true;
    this.lunarEnvGroup.add(outerMesh);

    // 2. Smooth Faceted Lunar Boulders & Rocks
    const dummy = new THREE.Object3D();
    const boulderCount = 170;
    const bGeo = new THREE.DodecahedronGeometry(0.95, 1);
    const bMat = new THREE.MeshStandardMaterial({
      color: 0x8d9199,
      bumpMap: this.textures.lunarGroundBump,
      bumpScale: 0.25,
      roughness: 0.92,
      metalness: 0.04,
    });
    const boulders = new THREE.InstancedMesh(bGeo, bMat, boulderCount);
    boulders.castShadow = true;
    boulders.receiveShadow = true;

    for (let i = 0; i < boulderCount; i++) {
      const angle = ((i * 73.1 + seed * 19) % 360) * (Math.PI / 180);
      const dist = 22 + ((i * 41 + seed * 13) % 165);
      const bx = siteInfo.x + Math.cos(angle) * dist;
      const bz = siteInfo.z + Math.sin(angle) * dist;
      const by = this.sampleLunarHeight(bx, bz);
      const scale = 0.55 + ((i * 7) % 8) * 0.24;
      dummy.position.set(bx, by + scale * 0.42, bz);
      dummy.rotation.set(i * 0.5, i * 1.1, i * 0.3);
      dummy.scale.set(scale * 1.25, scale * 0.78, scale);
      dummy.updateMatrix();
      boulders.setMatrixAt(i, dummy.matrix);
    }
    boulders.instanceMatrix.needsUpdate = true;
    boulders.computeBoundingSphere();
    this.lunarEnvGroup.add(boulders);

    // 3. Target Landing Beacon Ring + Laser Altimeter Ground Crosshair
    this.targetZonePos.set(siteInfo.x, this.sampleLunarHeight(siteInfo.x, siteInfo.z), siteInfo.z);
    if (this.mission.hasLunarLanding) {
      const ringGeo = new THREE.RingGeometry(10.2, 11.4, 48);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.72,
        side: THREE.DoubleSide,
      });
      this.targetHologramRing = new THREE.Mesh(ringGeo, ringMat);
      this.targetHologramRing.position.set(siteInfo.x, this.targetZonePos.y + 0.14, siteInfo.z);
      this.lunarEnvGroup.add(this.targetHologramRing);

      const laserGeo = new THREE.RingGeometry(2.8, 3.4, 32);
      laserGeo.rotateX(-Math.PI / 2);
      this.descentLaserRing = new THREE.Mesh(
        laserGeo,
        new THREE.MeshBasicMaterial({
          color: 0x22d3ee,
          transparent: true,
          opacity: 0.85,
          side: THREE.DoubleSide,
        }),
      );
      this.descentLaserRing.visible = false;
      this.lunarEnvGroup.add(this.descentLaserRing);
    }

    // 4. Spherical Earthrise above the lunar horizon!
    const earthInMoonSky = new THREE.Mesh(
      new THREE.SphereGeometry(36, 48, 36),
      new THREE.MeshStandardMaterial({
        map: this.textures.earthGlobeMap,
        roughness: 0.65,
        metalness: 0.05,
      }),
    );
    earthInMoonSky.position.set(-340, 215, -760);
    earthInMoonSky.rotation.set(0.18, 1.35, 0.1);
    this.lunarEnvGroup.add(earthInMoonSky);

    const earthCloudsInSky = new THREE.Mesh(
      new THREE.SphereGeometry(36.7, 40, 30),
      new THREE.MeshStandardMaterial({
        map: this.textures.earthCloudsMap,
        transparent: true,
        opacity: 0.88,
        depthWrite: false,
      }),
    );
    earthInMoonSky.add(earthCloudsInSky);

    // 5. Orbiting CSM overhead for crewed landing missions
    if (this.mission.category === 'crewed' && this.mission.hasLunarLanding) {
      const csmOrbitGrp = new THREE.Group();
      const nasaOrbCsm = buildNasaOrbitingCsm();
      if (nasaOrbCsm) {
        csmOrbitGrp.add(nasaOrbCsm);
      } else {
        const smMat = new THREE.MeshStandardMaterial({ color: 0xd1dae6, roughness: 0.3, metalness: 0.82 });
        const cmMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.45, metalness: 0.65 });
        const sm = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 2.5, 20), smMat);
        const cm = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.3, 20), cmMat);
        cm.position.y = 1.9;
        csmOrbitGrp.add(sm, cm);
      }
      csmOrbitGrp.position.set(-120, 215, -90);
      csmOrbitGrp.rotation.z = Math.PI / 2;
      this.orbitingCsmBeacon = csmOrbitGrp;
      this.lunarEnvGroup.add(csmOrbitGrp);
    }

    this.lunarEnvGroup.add(this.surfaceScienceGroup);
    this.lunarTerrainBuilt = true;
  }

  public sampleLunarHeight(x: number, z: number): number {
    const seed = this.mission?.lunarTerrainSeed || 11;
    const siteInfo = this.mission ? this.getSelectedLandingSiteOffset() : { x: 0, z: 0, roughness: 1 };
    const distFromTarget = Math.hypot(x - siteInfo.x, z - siteInfo.z);
    const padFlatten = this.mission?.hasLunarLanding
      ? THREE.MathUtils.smoothstep(distFromTarget, 11, 34)
      : 1.0;

    const hills = (fbm2D(x * 0.0055 + seed, z * 0.0055 + seed, 4, seed) - 0.5) * 32;
    const ripples = (fbm2D(x * 0.03 + seed, z * 0.03 + seed, 3, seed + 5) - 0.5) * 2.8;
    let h = (hills + ripples) * padFlatten;

    for (const c of this.lunarCraters) {
      const dx = x - c.x;
      const dz = z - c.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < c.r * 1.45) {
        const norm = d / c.r;
        if (norm < 1.0) {
          h -= c.depth * (1 - norm * norm);
        } else {
          const rimT = 1 - (norm - 1.0) / 0.45;
          h += c.depth * 0.3 * Math.sin(rimT * Math.PI * 0.5);
        }
      }
    }
    return h;
  }

  private computeLunarNormal(x: number, z: number, out: THREE.Vector3): THREE.Vector3 {
    const eps = 0.65;
    const hL = this.sampleLunarHeight(x - eps, z);
    const hR = this.sampleLunarHeight(x + eps, z);
    const hD = this.sampleLunarHeight(x, z - eps);
    const hU = this.sampleLunarHeight(x, z + eps);
    return out.set(hL - hR, 2 * eps, hD - hU).normalize();
  }

  public loadMission(
    mission: MissionConfig,
    design: MissionDesignState,
    metrics: ComputedMissionMetrics,
  ): void {
    this.mission = mission;
    this.design = design;
    this.metrics = metrics;

    if (this.rocket) {
      this.scene.remove(this.rocket.root);
      this.disposeObject(this.rocket.root);
    }
    for (const d of this.detachedStages) {
      this.scene.remove(d.object);
      this.disposeObject(d.object);
    }
    this.detachedStages = [];

    for (const p of this.particles) p.active = false;
    this.syncParticleBuffers();

    this.rocket = buildRocketAssembly(mission, this.textures);
    this.rocket.root.position.set(0, 7.6, 0);
    this.scene.add(this.rocket.root);

    this.lunarTerrainBuilt = false;
    this.lunarEnvGroup.visible = false;
    this.navTrajectoryGroup.visible = false;
    this.reentryGroup.visible = false;
    this.machConeMesh.visible = false;
    this.earthEnvGroup.visible = true;
    this.spaceEnvGroup.visible = true;
    this.earthGlobe.position.set(0, -1080 - 32, 0);
    this.earthGlobe.scale.setScalar(1);
    this.distantMoon.position.set(950, 1450, -2400);
    this.distantMoon.scale.setScalar(1);

    if (this.launchTower) {
      for (const arm of this.launchTower.swingArms) {
        arm.rotation.y = 0;
      }
    }

    for (const g of this.cislunarGates) {
      g.passed = false;
      (g.ring.material as THREE.MeshBasicMaterial).color.setHex(0x22d3ee);
    }
    this.gatesPassed = 0;

    this.phase = 'PRELAUNCH';
    this.phaseTimer = 0;
    this.missionTime = 0;
    this.countdownSec = 5;
    this.lastCountdownWhole = 6;
    this.isPaused = false;
    this.activeStageName = `${mission.launchVehicle} Ready`;
    this.altitudeKm = 0;
    this.altitudeReference = 'EARTH';
    this.earthDistanceKm = 0;
    this.moonDistanceKm = mission.targetDistanceKm ?? 384400;
    this.velocityMs = 0;
    this.downrangeKm = 0;
    this.machNumber = 0;
    this.stageFuelPct = 100;
    this.pitchRad = 0;
    this.yawRad = 0;
    this.rollRad = 0;
    this.throttle = 0;
    this.accelerationMs2 = 0;
    this.gForce = 1.0;

    this.powerBusPct = 100;
    this.commsSignalPct = 98;
    this.trajectoryErrorDeg = design.difficulty === 'challenge' ? 2.1 : design.difficulty === 'practice' ? 0.5 : 1.2;
    this.rcsActive = false;
    this.systemsStatus = {
      propulsion: metrics.deltaVMargin >= 0 && metrics.twr >= 1.12 ? 'GO' : 'RED',
      power: metrics.powerUsedW <= metrics.powerBusW ? 'GO' : 'RED',
      guidance: 'GO',
      comms: 'GO',
      lifeSupport: 'GO',
    };
    this.maneuverPending = null;
    this.mccExecuted = false;
    this.loiExecuted = false;
    this.teiExecuted = false;
    this.orbitTasksDone = [false, false, false];
    this.bonusScienceEarned = 0;
    this.safetyScore = Math.min(100, 94 + (metrics.trajectorySafetyBonus ?? 0));
    this.landingScore = mission.hasLunarLanding ? 0 : 100;

    this.landerFuelPct = Math.min(100, Math.round(100 * metrics.landerFuelScale));
    this.gearDeployed = false;
    this.autopilotEnabled = DIFFICULTY_INFO[design.difficulty ?? 'historical'].autoAssistDefault;
    this.surfaceOpsProgress = 0;
    this.surfaceSamplesCollected = 0;
    this.surfaceTasksDone = [false, false, false];
    this.surfaceInstrumentsDeployed = false;
    this.latestDiscovery = null;
    this.dataQueuedMb = 0;
    this.dataTransmittedMb = 0;
    this.roverDistanceM = 0;
    this.roverJumpBonusAwarded = false;
    this.roverVelY = 0;
    this.roverGrounded = true;
    this.sampleNodes = [];
    this.surfaceRover = null;
    this.surfaceEva = null;
    this.outcomeMessage = '';
    this.landingGrade = undefined;
    this.lmDescentLeftOnSurface = false;
    this.userCameraActive = false;
    this.cameraPreset = 'chase';

    this.scene.fog = new THREE.FogExp2(0x7fa9c8, 0.00024);
    this.sunLight.position.set(140, 180, 120);
    this.sunDirection.copy(this.sunLight.position).normalize();
    this.earthNightShaderUniform.value.copy(this.sunDirection);
    this.sunLight.intensity = 2.45;
    this.hemiLight.intensity = 0.58;
    this.enginePointLight.intensity = 0;
    this.skyDomeMat.uniforms.uAtmosAlpha.value = 1.0;
    (this.starsPoints.material as THREE.PointsMaterial).opacity = 0;

    this.camera.position.set(44, 26, 58);
    this.controls.target.set(0, 22, 0);
    this.controls.update();

    this.emitTelemetry();
  }

  public startCountdown(): void {
    if (this.phase !== 'PRELAUNCH') return;
    this.audio.init();
    this.isPaused = false;
    this.countdownSec = 5.0;
    this.lastCountdownWhole = 6;
    this.transitionPhase('COUNTDOWN');
    this.activeStageName = `${this.mission.launchVehicle} Terminal Count`;
    this.userCameraActive = false;
    this.cameraPreset = 'chase';
    this.emitTelemetry();
  }

  public startLaunch(): void {
    if (this.phase !== 'PRELAUNCH' && this.phase !== 'COUNTDOWN') return;
    this.audio.init();
    this.audio.playQuindarBeep(false);
    this.isPaused = false;
    this.transitionPhase('IGNITION');
    this.throttle = 1.0;
    this.activeStageName = this.mission.architecture === 'saturn-v' ? 'S-IC Ignition' : 'Stage 1 Ignition';
    this.userCameraActive = false;
    this.cameraPreset = 'chase';
    this.emitTelemetry();
  }

  public skipToLunarApproach(): void {
    if (this.phase === 'MISSION_COMPLETE' || this.phase === 'MISSION_FAILED') {
      this.loadMission(this.mission, this.design, this.metrics);
    }
    this.audio.init();
    this.audio.playQuindarBeep(false);
    this.isPaused = false;
    this.machConeMesh.visible = false;
    this.reentryGroup.visible = false;

    this.missionTime = Math.max(this.missionTime, 62.0);
    if (this.mission.isDeepSpaceL2) {
      this.altitudeReference = 'EARTH';
      this.altitudeKm = 1495000;
      this.earthDistanceKm = 1495000;
      this.moonDistanceKm = 1110600;
      this.velocityMs = 1080;
    } else {
      this.altitudeReference = 'MOON';
      this.altitudeKm = 180;
      this.earthDistanceKm = 384220;
      this.moonDistanceKm = 180;
      this.velocityMs = 1920;
    }
    this.machNumber = 0;
    this.stageFuelPct = Math.max(72, this.stageFuelPct);
    this.mccExecuted = true;
    this.trajectoryErrorDeg = 0.3;
    this.enterLunarEnvironment('LUNAR_APPROACH');
    this.emitTelemetry();
  }

  public executeManeuverBurn(type: ManeuverPlan['type']): void {
    this.audio.init();
    if (!this.maneuverPending || this.maneuverPending.type !== type || this.maneuverPending.executed) return;

    const cost = this.maneuverPending.fuelCostPct;
    this.stageFuelPct = Math.max(5, this.stageFuelPct - cost);
    this.maneuverPending.executed = true;
    this.audio.playQuindarBeep(false);

    if (type === 'MCC') {
      this.mccExecuted = true;
      this.trajectoryErrorDeg = 0.2;
      this.bonusScienceEarned += 10;
      this.systemsStatus.guidance = 'GO';
      this.maneuverPending = null;
    } else if (type === 'LOI') {
      this.loiExecuted = true;
      this.maneuverPending = null;
      this.transitionPhase('LUNAR_ORBIT');
      this.throttle = 0;
      this.accelerationMs2 = 0;
      this.gForce = 0;
      this.audio.updateThrust(0, 0);
    } else if (type === 'TEI') {
      this.teiExecuted = true;
      this.maneuverPending = null;
      this.startReturnJourney();
    }
    this.emitTelemetry();
  }

  public completeOrbitTask(taskIndex: number): void {
    if (this.phase !== 'LUNAR_ORBIT_SURVEY') return;
    if (taskIndex < 0 || taskIndex >= this.orbitTasksDone.length) return;
    if (!this.orbitTasksDone[taskIndex]) {
      this.orbitTasksDone[taskIndex] = true;
      this.bonusScienceEarned += 15;
      this.dataQueuedMb += 18;
      this.audio.playQuindarBeep(true);
      this.emitTelemetry();
    }
  }

  public finishOrbitalSurvey(): void {
    if (this.phase !== 'LUNAR_ORBIT_SURVEY' || this.mission.hasReturnJourney) return;
    const doneCount = this.orbitTasksDone.filter(Boolean).length;
    this.landingScore = Math.max(75, Math.round((doneCount / 3) * 100));
    this.landingGrade = 'NOMINAL';
    this.finalizeMissionComplete();
  }

  public triggerSurfaceDeploy(): void {
    if (this.phase !== 'SURFACE_OPS') return;
    if (!this.surfaceInstrumentsDeployed) {
      this.surfaceInstrumentsDeployed = true;
      this.bonusScienceEarned += 20;
      this.dataQueuedMb += 22;
      this.audio.playQuindarBeep(true);
      this.emitTelemetry();
    }
  }

  public completeSurveyorSurfaceTask(taskIndex: number): void {
    if (
      this.phase !== 'SURFACE_OPS' ||
      this.mission.id !== 'surveyor-3' ||
      !this.surfaceInstrumentsDeployed ||
      taskIndex < 0 ||
      taskIndex >= SURVEYOR_SURFACE_TASKS.length ||
      this.surfaceTasksDone[taskIndex]
    ) return;

    this.surfaceTasksDone[taskIndex] = true;
    this.surfaceSamplesCollected = this.surfaceTasksDone.filter(Boolean).length;
    this.bonusScienceEarned += 22;
    this.dataQueuedMb += 24;
    const task = SURVEYOR_SURFACE_TASKS[taskIndex];
    this.latestDiscovery = {
      id: `surveyor-task-${taskIndex}`,
      title: task.title,
      fact: task.fact,
      points: 22,
    };
    const samplerArm = this.rocket?.lander.getObjectByName('surveyor-sampler-arm');
    if (samplerArm) samplerArm.rotation.z = [-0.05, 0.42, -0.18][taskIndex];
    this.audio.playQuindarBeep(true);
    this.surfaceOpsProgress = 20 + (this.surfaceSamplesCollected / SURVEYOR_SURFACE_TASKS.length) * 80;
    this.emitTelemetry();
  }

  public triggerEvaHop(): void {
    if (this.phase === 'SURFACE_OPS' && this.surfaceEva && this.roverGrounded) {
      this.roverVelY = 2.2;
      this.roverGrounded = false;
      if (!this.roverJumpBonusAwarded) {
        this.roverJumpBonusAwarded = true;
        this.latestDiscovery = {
          id: 'apollo-eva-hop',
          title: 'Lunar EVA movement',
          fact: 'The crew moved across the surface in pressurized suits; Apollo 11 did not carry a lunar rover.',
          points: 0,
        };
      }
      this.audio.playQuindarBeep(false);
    }
  }

  public dismissDiscovery(): void {
    this.latestDiscovery = null;
    this.emitTelemetry();
  }

  public triggerNextPhaseFromSurface(): void {
    if (this.phase !== 'SURFACE_OPS' || !this.rocket) return;
    if (
      this.mission.id === 'surveyor-3' &&
      !this.surfaceTasksDone.every(Boolean)
    ) return;
    this.isPaused = false;
    if (!this.surfaceInstrumentsDeployed) {
      this.surfaceInstrumentsDeployed = true;
      this.bonusScienceEarned += 15;
    }
    if (this.mission.category === 'crewed' && this.mission.hasLunarLanding && this.mission.hasReturnJourney) {
      this.startLunarAscent();
    } else {
      this.finalizeMissionComplete();
    }
    this.emitTelemetry();
  }

  public applyEventConsequence(effects: EventConsequence): void {
    if (effects.fuelDeltaPct) {
      if (this.phase === 'LUNAR_DESCENT' || this.phase === 'LUNAR_ASCENT') {
        this.landerFuelPct = THREE.MathUtils.clamp(this.landerFuelPct + effects.fuelDeltaPct, 4, 100);
      } else {
        this.stageFuelPct = THREE.MathUtils.clamp(this.stageFuelPct + effects.fuelDeltaPct, 5, 100);
      }
    }
    if (effects.powerDeltaPct) {
      this.powerBusPct = THREE.MathUtils.clamp(this.powerBusPct + effects.powerDeltaPct, 12, 100);
    }
    if (effects.commsDeltaPct) {
      this.commsSignalPct = THREE.MathUtils.clamp(this.commsSignalPct + effects.commsDeltaPct, 25, 100);
    }
    if (effects.trajectoryErrDeltaDeg) {
      this.trajectoryErrorDeg = Math.max(0.1, this.trajectoryErrorDeg + effects.trajectoryErrDeltaDeg);
    }
    if (effects.scienceDelta) {
      this.bonusScienceEarned = Math.max(0, this.bonusScienceEarned + effects.scienceDelta);
    }
    if (effects.safetyDelta) {
      this.safetyScore = THREE.MathUtils.clamp(this.safetyScore + effects.safetyDelta, 40, 100);
    }
    if (effects.systemKey && effects.newSystemState) {
      this.systemsStatus[effects.systemKey] = effects.newSystemState;
    }
    this.emitTelemetry();
  }

  public setVirtualInput(code: string, pressed: boolean): void {
    this.virtualInput[code] = pressed;
  }

  public setPaused(paused: boolean): void {
    this.isPaused = paused;
    if (paused) {
      this.audio.updateThrust(0, 0);
      this.audio.updateRcsHiss(false);
    }
    this.emitTelemetry();
  }

  public togglePause(): void {
    this.setPaused(!this.isPaused);
  }

  public setCameraPreset(preset: CameraPreset): void {
    this.cameraPreset = preset;
    if (preset !== 'free') {
      this.userCameraActive = false;
    }
  }

  public setTimeWarp(warp: number): void {
    this.timeWarp = warp;
  }

  public setAutopilot(enabled: boolean): void {
    this.autopilotEnabled = enabled;
    this.emitTelemetry();
  }

  public toggleGear(): void {
    if (this.phase === 'LUNAR_DESCENT' || this.phase === 'LUNAR_ORBIT') {
      this.gearDeployed = !this.gearDeployed;
      this.emitTelemetry();
    }
  }

  public setThrottle(value: number): void {
    this.throttle = THREE.MathUtils.clamp(value, 0, 1);
  }

  public setMuted(muted: boolean): void {
    this.audio.setMuted(muted);
  }

  public setVolume(vol: number): void {
    this.audio.setVolume(vol);
  }

  public setSpeechEnabled(enabled: boolean): void {
    this.audio.setSpeechEnabled(enabled);
  }

  public speakCallout(text: string): void {
    this.audio.speakCallout(text);
  }

  public playWarningChime(): void {
    this.audio.playWarningChime();
  }

  private isKeyHeld(code: string): boolean {
    return Boolean(this.keysPressed[code] || this.virtualInput[code]);
  }

  private spawnParticle(
    pos: THREE.Vector3,
    vel: THREE.Vector3,
    maxAge: number,
    sizeStart: number,
    sizeEnd: number,
    colorStart: number,
    colorEnd: number,
    kind: Particle['kind'],
  ): void {
    for (let i = 0; i < this.MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) {
        p.active = true;
        p.pos.copy(pos);
        p.vel.copy(vel);
        p.age = 0;
        p.maxAge = maxAge;
        p.sizeStart = sizeStart;
        p.sizeEnd = sizeEnd;
        p.colorStart.setHex(colorStart);
        p.colorEnd.setHex(colorEnd);
        p.kind = kind;
        return;
      }
    }
  }

  private emitRcsPuffs(sideOffset: THREE.Vector3, pushDir: THREE.Vector3): void {
    if (!this.rocket) return;
    this.rocket.root.updateMatrixWorld(true);
    _vec3.copy(sideOffset).applyMatrix4(this.rocket.root.matrixWorld);
    _vec3b.copy(pushDir).applyQuaternion(this.rocket.root.quaternion).normalize().multiplyScalar(12);
    this.spawnParticle(_vec3, _vec3b, 0.22, 0.7, 2.5, 0xe0f2fe, 0x94a3b8, 'rcs');
  }

  private detachObject(obj: THREE.Object3D | null, sepImpulse: THREE.Vector3, angVel: THREE.Vector3): void {
    if (!obj || !this.rocket) return;
    this.rocket.root.updateMatrixWorld(true);
    const worldPos = new THREE.Vector3();
    const worldQuat = new THREE.Quaternion();
    const worldScale = new THREE.Vector3();
    obj.getWorldPosition(worldPos);
    obj.getWorldQuaternion(worldQuat);
    obj.getWorldScale(worldScale);

    obj.parent?.remove(obj);
    obj.position.copy(worldPos);
    obj.quaternion.copy(worldQuat);
    obj.scale.copy(worldScale);
    this.scene.add(obj);

    this.detachedStages.push({
      object: obj,
      velocity: sepImpulse.clone(),
      angularVel: angVel.clone(),
      age: 0,
    });
  }

  private enterLunarEnvironment(targetPhase: 'LUNAR_APPROACH' | 'LUNAR_ORBIT'): void {
    const isL2 = Boolean(this.mission.isDeepSpaceL2);
    if (!isL2 && !this.lunarTerrainBuilt) {
      this.buildLunarTerrain();
    }
    this.earthEnvGroup.visible = false;
    this.navTrajectoryGroup.visible = false;
    this.spaceEnvGroup.visible = isL2;
    this.reentryGroup.visible = false;
    this.machConeMesh.visible = false;
    this.lunarEnvGroup.visible = !isL2;

    if (isL2) {
      this.earthGlobe.scale.setScalar(0.16);
      this.earthGlobe.position.set(-480, -210, -980);
      this.distantMoon.scale.setScalar(0.45);
      this.distantMoon.position.set(540, -260, -1180);
    }

    for (const d of this.detachedStages) {
      this.scene.remove(d.object);
      this.disposeObject(d.object);
    }
    this.detachedStages = [];

    if (this.rocket) {
      this.rocket.stage1.visible = false;
      this.rocket.stage2.visible = false;
      this.rocket.stage3.visible = false;
      if (this.rocket.lesTower) this.rocket.lesTower.visible = false;
      if (this.rocket.fairingLeft) this.rocket.fairingLeft.visible = false;
      if (this.rocket.fairingRight) this.rocket.fairingRight.visible = false;

      if (this.mission.id === 'apollo-8') {
        this.rocket.lander.visible = false;
        if (this.rocket.csm) {
          this.rocket.csm.visible = true;
          this.rocket.csm.position.set(0, 0, 0);
          this.rocket.csm.rotation.set(0, 0, 0);
          this.rocket.csm.scale.setScalar(1.35);
        }
        this.activeStageName = this.mission.csmName ?? 'CSM-103';
      } else {
        if (this.rocket.csm) this.rocket.csm.visible = false;
        this.rocket.lander.visible = true;
        this.rocket.lander.position.set(0, 0, 0);
        this.rocket.lander.rotation.set(0, 0, 0);
        this.rocket.lander.scale.setScalar(isL2 ? 1.65 : 1.35);
        this.activeStageName = this.mission.landerName;
      }
      this.rocket.root.rotation.set(0, 0, 0);
    }

    this.scene.fog = null;
    this.skyDomeMat.uniforms.uAtmosAlpha.value = 0.0;
    (this.starsPoints.material as THREE.PointsMaterial).opacity = 1.0;
    this.sunLight.position.set(160, 120, 95);
    this.sunLight.intensity = 3.2;
    this.hemiLight.intensity = isL2 ? 0.36 : 0.24;

    this.altitudeReference = isL2 ? 'EARTH' : 'MOON';
    this.transitionPhase(targetPhase);

    if (targetPhase === 'LUNAR_APPROACH') {
      const siteInfo = this.getSelectedLandingSiteOffset();
      this.landerPos.set(siteInfo.x - 140, 155, siteInfo.z - 75);
      this.landerVel.set(18, -2.5, 7);
      this.throttle = 0.55;
      this.cameraPreset = this.mission.hasLunarLanding ? 'lander' : 'orbital';
      this.userCameraActive = false;

      this.maneuverPending = isL2
        ? {
            type: 'LOI',
            title: 'Sun-Earth L2 Halo Orbit Insertion (HOI)',
            requiredDeltaVMs: 140,
            fuelCostPct: 9,
            feasible: this.stageFuelPct >= 12,
            predictedOutcome: 'Stabilizes JWST in a 1.5M km Sun-Earth L2 halo orbit preserving 20+ years of fuel.',
            executed: false,
          }
        : {
            type: 'LOI',
            title: 'Lunar Orbit Insertion (LOI) Retrograde Burn',
            requiredDeltaVMs: 890,
            fuelCostPct: 16,
            feasible: this.stageFuelPct >= 18,
            predictedOutcome: 'Captures spacecraft into stable 112 km lunar parking orbit.',
            executed: false,
          };
    }
  }

  private startLunarAscent(): void {
    if (!this.rocket) return;
    this.transitionPhase('LUNAR_ASCENT');
    this.throttle = 1.0;
    this.audio.playStageSeparation();
    if (this.descentLaserRing) this.descentLaserRing.visible = false;

    if (this.rocket.lmDescentStage && !this.lmDescentLeftOnSurface) {
      this.rocket.root.updateMatrixWorld(true);
      const descWorldPos = new THREE.Vector3();
      const descWorldQuat = new THREE.Quaternion();
      const descWorldScale = new THREE.Vector3();
      this.rocket.lmDescentStage.getWorldPosition(descWorldPos);
      this.rocket.lmDescentStage.getWorldQuaternion(descWorldQuat);
      this.rocket.lmDescentStage.getWorldScale(descWorldScale);

      this.rocket.lmDescentStage.parent?.remove(this.rocket.lmDescentStage);
      this.rocket.lmDescentStage.position.copy(descWorldPos);
      this.rocket.lmDescentStage.quaternion.copy(descWorldQuat);
      this.rocket.lmDescentStage.scale.copy(descWorldScale);
      this.lunarEnvGroup.add(this.rocket.lmDescentStage);
      this.lmDescentLeftOnSurface = true;
    }

    this.activeStageName = `${this.mission.landerName} Ascent Stage`;
    this.landerVel.set(0, 2.0, 0);
    this.cameraPreset = 'lander';
    this.userCameraActive = false;
  }

  private startReturnJourney(): void {
    if (!this.rocket) return;
    this.transitionPhase('RETURN_JOURNEY');
    this.throttle = 0.85;
    this.stageFuelPct = Math.max(22, this.stageFuelPct - 18);
    this.audio.playQuindarBeep(false);

    if (this.rocket.csm) {
      this.rocket.lander.visible = false;
      this.rocket.csm.visible = true;
      this.rocket.csm.position.set(0, 0, 0);
      this.rocket.csm.rotation.set(0, 0, 0);
      this.rocket.csm.scale.setScalar(1.35);
    }

    this.activeStageName = `${this.mission.csmName ?? 'CSM'} SPS (TEI)`;
    this.landerPos.set(-40, 128, -20);
    this.landerVel.set(-22, 11, -18);
    this.rocket.root.position.copy(this.landerPos);
    this.rocket.root.rotation.set(-0.35, 0.5, 0.45);
    this.cameraPreset = 'orbital';
    this.userCameraActive = false;
  }

  private enterEarthReentry(): void {
    this.transitionPhase('EARTH_REENTRY');
    this.lunarEnvGroup.visible = false;
    this.spaceEnvGroup.visible = true;
    this.earthEnvGroup.visible = false;
    this.reentryGroup.visible = true;
    this.reentryPlasmaMesh.visible = true;
    this.parachuteGroup.visible = false;
    this.parachuteGroup.scale.setScalar(0.01);
    this.splashdownOcean.visible = false;

    this.altitudeReference = 'EARTH';
    this.altitudeKm = 120;
    this.earthDistanceKm = 120;
    this.moonDistanceKm = 384280;
    this.velocityMs = 11020;
    this.activeStageName = `${this.mission.csmName ?? 'CM'} Heatshield Entry`;
    if (this.rocket) {
      if (this.rocket.csmServiceModule) {
        // Jettison Apollo Service Module prior to Entry Interface so only Command Module capsule re-enters
        this.rocket.csmServiceModule.parent?.remove(this.rocket.csmServiceModule);
        this.disposeObject(this.rocket.csmServiceModule);
        this.rocket.csmServiceModule = null;
      }
      this.rocket.root.position.set(0, 360, 0);
      this.rocket.root.rotation.set(0.12, 0.2, 2.85);
      if (this.rocket.csmCommandModule) {
        this.rocket.root.updateMatrixWorld(true);
        const cmBox = new THREE.Box3().setFromObject(this.rocket.csmCommandModule);
        const csmScale = this.rocket.csm?.scale.y || 1;
        this.rocket.csmCommandModule.position.y -= (cmBox.min.y - 360) / csmScale;
      }
    }
    this.skyDomeMat.uniforms.uAtmosAlpha.value = 0.25;
    (this.starsPoints.material as THREE.PointsMaterial).opacity = 0.8;
    this.cameraPreset = 'chase';
    this.userCameraActive = false;
  }

  private finalizeMissionComplete(): void {
    this.transitionPhase('MISSION_COMPLETE');
    this.throttle = 0;
    this.accelerationMs2 = 0;
    this.gForce = this.mission.hasReturnJourney ? 1.0 : this.mission.hasLunarLanding ? 0.165 : 0.0;
    this.reentryPlasmaMesh.visible = false;
    this.audio.updateThrust(0, 0);
    this.audio.playMissionComplete();

    const surveyDoneCount = this.orbitTasksDone.filter(Boolean).length;
    if (this.mission.id === 'apollo-8') {
      this.landingGrade = 'ORBITAL_RETURN';
      this.outcomeMessage = `Apollo 8 CSM-103 completed lunar orbital reconnaissance (${surveyDoneCount}/3 observations), Trans-Earth Injection, and Pacific splashdown under 3 main parachutes!`;
    } else if (this.mission.isDeepSpaceL2) {
      this.landingGrade = 'NOMINAL';
      this.outcomeMessage = `${this.mission.name} stabilized in Sun-Earth L2 Halo Orbit (1,500,000 km), deployed its 5-layer Kapton sunshield & 18 gold mirrors (${surveyDoneCount}/3 tasks), and streamed infrared deep-field telemetry at ${this.metrics.dataRateKbps} kbps.`;
    } else if (this.mission.id === 'lunar-orbiter-1') {
      this.landingGrade = 'NOMINAL';
      this.outcomeMessage = `Lunar Orbiter 1 completed its photographic and tracking survey (${surveyDoneCount}/3 observations) and returned the data to Earth. Historically, controllers later commanded a lunar impact on Oct. 29, 1966; that end-of-life disposal is documented here but not animated in this simulation.`;
    } else if (!this.mission.hasLunarLanding && !this.mission.hasReturnJourney) {
      this.landingGrade = 'NOMINAL';
      this.outcomeMessage = `${this.mission.name} completed equatorial lunar orbit photography (${surveyDoneCount}/3 mapping passes) and transmitted Apollo landing site imagery to the Deep Space Network at ${this.metrics.dataRateKbps} kbps.`;
    } else if (this.mission.hasReturnJourney) {
      this.outcomeMessage = `${this.mission.name} completed ${this.mission.targetSite} surface exploration (${this.surfaceSamplesCollected}/${this.sampleNodes.length || 0} discoveries), LM ascent rendezvous, and Command Module Pacific splashdown!`;
    } else {
      this.outcomeMessage = `${this.mission.name} (${this.mission.landerName}) completed lunar surface deployment & science transmission at ${this.metrics.dataRateKbps} kbps.`;
    }
    this.emitTelemetry();
  }

  private deploySurfaceScience(): void {
    if (!this.lunarTerrainBuilt) return;
    const goldMat = new THREE.MeshStandardMaterial({
      map: this.textures.goldFoilMap,
      bumpMap: this.textures.goldFoilBump,
      bumpScale: 0.04,
      roughness: 0.3,
      metalness: 0.85,
    });
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0xdbe2ea,
      roughness: 0.35,
      metalness: 0.78,
    });

    // Surface traversal follows the hardware actually carried: Apollo 17's
    // LRV, Apollo 11's suited crew on foot, or Surveyor 3's stationary robot.
    this.surfaceRover = null;
    this.surfaceEva = null;
    if (this.mission.hasRoverOps && this.design.selectedPayloadIds.includes('lrv-rover')) {
      const roverAsm = buildSurfaceRoverMesh(this.textures);
      const rx = this.landerPos.x + 5.6;
      const rz = this.landerPos.z + 3.4;
      this.roverPos.set(rx, this.sampleLunarHeight(rx, rz), rz);
      this.roverHeading = 0.65;
      this.roverSpeed = 0;
      this.roverVelY = 0;
      this.roverGrounded = true;
      roverAsm.root.position.copy(this.roverPos);
      roverAsm.root.rotation.y = this.roverHeading;
      this.surfaceRover = roverAsm;
      this.surfaceScienceGroup.add(roverAsm.root);
    }

    // Surveyor 3 is a stationary robot: its camera and soil sampler are
    // operated from the control panel rather than by inventing a rover.
    this.sampleNodes = [];
    const surfacePresets = this.mission.id === 'apollo-11'
      ? APOLLO_11_SURFACE_PRESETS
      : this.mission.id === 'apollo-17'
        ? APOLLO_17_SURFACE_PRESETS
        : this.mission.id === 'surveyor-3'
          ? []
          : DISCOVERY_PRESETS;
    for (let i = 0; i < surfacePresets.length; i++) {
      const preset = surfacePresets[i];
      const wx = this.landerPos.x + preset.offset[0];
      const wz = this.landerPos.z + preset.offset[1];
      const wy = this.sampleLunarHeight(wx, wz);

      const sampleGrp = new THREE.Group();
      const rockMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(preset.color).lerp(new THREE.Color(0x777a7d), 0.68),
        roughness: 0.94,
        metalness: 0.02,
      });
      const sampleRock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7, 1), rockMat);
      sampleRock.scale.set(1.25, 0.72, 1.05);
      sampleRock.position.y = 0.45;
      sampleRock.rotation.set(0.13 * i, 0.42 * i, 0.21 * i);
      sampleRock.castShadow = true;
      const smallerRock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.34, 0), rockMat);
      smallerRock.position.set(0.78, 0.22, -0.3);
      const sampleMarker = new THREE.Group();
      sampleMarker.add(sampleRock, smallerRock);
      sampleGrp.add(sampleMarker);
      const crystal = sampleMarker;

      const ringGeo = new THREE.RingGeometry(1.75, 2.25, 28);
      ringGeo.rotateX(-Math.PI / 2);
      const ring = new THREE.Mesh(
        ringGeo,
        new THREE.MeshBasicMaterial({
          color: preset.color,
          transparent: true,
          opacity: 0.65,
          side: THREE.DoubleSide,
        }),
      );
      ring.position.y = 0.12;
      sampleGrp.add(ring);

      const beamMat = new THREE.MeshBasicMaterial({
        color: preset.color,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const beaconBeam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.55, 22, 10, 1, true),
        beamMat,
      );
      beaconBeam.position.y = 11.2;
      sampleGrp.add(beaconBeam);

      sampleGrp.position.set(wx, wy, wz);
      this.surfaceScienceGroup.add(sampleGrp);
      this.sampleNodes.push({
        id: preset.id,
        title: preset.title,
        fact: preset.fact,
        points: 20,
        mesh: sampleGrp,
        crystal,
        ring,
        beaconBeam,
        x: wx,
        z: wz,
        collected: false,
      });
    }

    if (this.mission.category === 'crewed') {
      // ALSEP/EASEP equipment belongs to the crewed Apollo surface missions,
      // not to Surveyor's remote TV-camera and soil-sampler operations.
      const alsep = new THREE.Group();
      const box = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, 0.52, 8), goldMat);
      box.position.y = 0.26;
      box.castShadow = true;
      alsep.add(box);
      const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.25, 8), metalMat);
      antenna.position.set(0, 0.9, 0);
      alsep.add(antenna);
      const dishMat = metalMat.clone();
      dishMat.side = THREE.DoubleSide;
      const alsepDish = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.06, 0.14, 14, 1, true), dishMat);
      alsepDish.position.set(0.15, 1.45, 0);
      alsepDish.rotation.z = -0.5;
      alsep.add(alsepDish);
      const ax = this.landerPos.x - 4.4;
      const az = this.landerPos.z + 2.8;
      alsep.position.set(ax, this.sampleLunarHeight(ax, az), az);
      this.surfaceScienceGroup.add(alsep);
    }

    if (this.mission.category === 'crewed') {
      // Flag assembly with softly waving cloth banner
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.25, 8), metalMat);
      pole.position.y = 1.12;
      const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.25, 8), metalMat);
      crossbar.rotation.z = Math.PI / 2;
      crossbar.position.set(0.62, 2.15, 0);
      const banner = new THREE.Mesh(
        new THREE.PlaneGeometry(1.18, 0.68, 8, 4),
        new THREE.MeshStandardMaterial({
          color: 0x1e3a8a,
          roughness: 0.72,
          side: THREE.DoubleSide,
        }),
      );
      banner.position.set(0.62, 1.78, 0);
      this.surfaceFlagBanner = banner;

      const flagGrp = new THREE.Group();
      flagGrp.add(pole, crossbar, banner);
      const fx = this.landerPos.x + 3.2;
      const fz = this.landerPos.z - 3.6;
      flagGrp.position.set(fx, this.sampleLunarHeight(fx, fz), fz);
      this.surfaceScienceGroup.add(flagGrp);

      const nasaAstro = buildNasaEvaAstronaut();
      if (nasaAstro) {
        nasaAstro.position.set(fx - 1.45, this.sampleLunarHeight(fx - 1.45, fz + 0.6), fz + 0.6);
        nasaAstro.rotation.y = 0.4;
        this.evaAstronautArm = null;
        this.surfaceScienceGroup.add(nasaAstro);
      } else {
        // Fallback procedural Apollo A7L EVA Astronaut beside the flag
        const suitMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.72, metalness: 0.06 });
        const visorMat = new THREE.MeshStandardMaterial({
          color: 0xf59e0b,
          emissive: 0x78350f,
          emissiveIntensity: 0.25,
          roughness: 0.14,
          metalness: 0.9,
        });
        const astro = new THREE.Group();
        for (const sx of [-0.14, 0.14]) {
          const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.45, 6, 10), suitMat);
          leg.position.set(sx, 0.34, 0);
          astro.add(leg);
        }

        const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.36, 6, 12), suitMat);
        torso.position.y = 0.96;
        astro.add(torso);

        const plss = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.56, 0.24), suitMat);
        plss.position.set(0, 1.02, -0.25);
        astro.add(plss);

        const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.38, 6, 8), suitMat);
        armL.position.set(-0.34, 0.96, 0);
        armL.rotation.z = 0.22;
        astro.add(armL);

        const armR = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.38, 6, 8), suitMat);
        armR.position.set(0.34, 1.15, 0.12);
        armR.rotation.z = -2.35;
        astro.add(armR);
        this.evaAstronautArm = armR;

        const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 14), suitMat);
        helmet.position.set(0, 1.48, 0);
        astro.add(helmet);

        const visor = new THREE.Mesh(
          new THREE.SphereGeometry(0.2, 16, 12, -Math.PI * 0.38, Math.PI * 0.76, Math.PI * 0.2, Math.PI * 0.55),
          visorMat,
        );
        visor.position.set(0, 1.48, 0.04);
        visor.rotation.y = Math.PI / 2;
        astro.add(visor);

        astro.position.set(fx - 1.45, this.sampleLunarHeight(fx - 1.45, fz + 0.6), fz + 0.6);
        astro.rotation.y = 0.4;
        this.surfaceScienceGroup.add(astro);
      }

      if (this.mission.hasLunarLanding && !this.mission.hasRoverOps) {
        const explorer = buildSurfaceEVAExplorer();
        const ex = this.landerPos.x + 5.6;
        const ez = this.landerPos.z + 3.4;
        this.roverPos.set(ex, this.sampleLunarHeight(ex, ez), ez);
        this.roverHeading = 0.65;
        this.roverSpeed = 0;
        this.roverVelY = 0;
        this.roverGrounded = true;
        explorer.position.copy(this.roverPos);
        explorer.rotation.y = this.roverHeading;
        this.surfaceEva = explorer;
        this.surfaceScienceGroup.add(explorer);
      }
    }
  }

  private updateAscentAtmosphere(): void {
    const alt = this.altitudeKm;
    const atmosAlpha = Math.max(0, 1 - THREE.MathUtils.smoothstep(alt, 8, 72));
    this.skyDomeMat.uniforms.uAtmosAlpha.value = atmosAlpha;

    const starOpacity = THREE.MathUtils.smoothstep(alt, 22, 78);
    (this.starsPoints.material as THREE.PointsMaterial).opacity = starOpacity;

    const padFade = 1 - THREE.MathUtils.smoothstep(alt, 25, 65);
    this.earthEnvGroup.visible = padFade > 0.02;
    if (this.scene.fog && this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.density = 0.00024 * padFade;
    }

    const earthDist = 1150 + alt * 5.2;
    if (this.rocket) {
      this.earthGlobe.position.set(
        this.rocket.root.position.x - this.downrangeKm * 0.6,
        this.rocket.root.position.y - earthDist,
        this.rocket.root.position.z,
      );
      this.earthGlobe.rotation.y += 0.00004;
      this.earthClouds.rotation.y += 0.00018;
      this.distantMoon.position.set(
        this.rocket.root.position.x + 950 - this.downrangeKm * 0.4,
        this.rocket.root.position.y + 1300,
        this.rocket.root.position.z - 2200,
      );
    }

    // Mach 1 Prandtl-Glauert Vapor Condensation Shockwave Cone
    this.machNumber = alt < 65 ? this.velocityMs / 340 : 0;
    const showMach =
      (this.phase === 'LIFTOFF' || this.phase === 'STAGE_2_ASCENT') &&
      alt < 32 &&
      this.machNumber >= 0.9 &&
      this.machNumber <= 1.85 &&
      this.rocket;
    if (showMach && this.rocket) {
      const coneFade = Math.sin(((this.machNumber - 0.9) / 0.95) * Math.PI);
      this.machConeMesh.visible = true;
      this.machConeMesh.position.copy(this.rocket.root.position);
      _vec3.set(0, 31, 0).applyQuaternion(this.rocket.root.quaternion);
      this.machConeMesh.position.add(_vec3);
      this.machConeMesh.quaternion.copy(this.rocket.root.quaternion);
      const pulse = 1 + Math.sin(this.missionTime * 28) * 0.06;
      this.machConeMesh.scale.set(pulse, 1, pulse);
      (this.machConeMesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, coneFade * 0.42);
    } else {
      this.machConeMesh.visible = false;
    }
  }

  private emitExhaust(nozzleLocal: THREE.Vector3, count: number, isVacuum: boolean, isKerosene: boolean): void {
    if (!this.rocket) return;
    this.rocket.root.updateMatrixWorld(true);

    const nozzleWorld = _vec3.copy(nozzleLocal).applyMatrix4(this.rocket.root.matrixWorld);
    const downDir = _vec3b.set(0, -1, 0).applyQuaternion(this.rocket.root.quaternion).normalize();

    for (let i = 0; i < count; i++) {
      const spread = isVacuum ? 0.35 : 0.16;
      const v = _vec3c
        .copy(downDir)
        .multiplyScalar(isVacuum ? 26 : 36)
        .addScaledVector(
          _vec3d.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5),
          spread * 28,
        );

      const cStart = isKerosene ? 0xfff3d1 : isVacuum ? 0xdbeafe : 0xffedd5;
      const cEnd = isKerosene ? 0xff5a1f : isVacuum ? 0x3b82f6 : 0xf97316;

      this.spawnParticle(
        nozzleWorld,
        v,
        isVacuum ? 0.24 : 0.36,
        isVacuum ? 4.2 : 3.2,
        isVacuum ? 9.0 : 5.2,
        cStart,
        cEnd,
        'flame',
      );
    }

    // Water-Deluge Steam Clouds erupting out of the Flame Trench
    if (this.altitudeReference === 'EARTH' && this.altitudeKm < 0.28 && Math.random() < 0.92) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const steamVel = _vec3c.set(
        (Math.random() - 0.5) * 14,
        2.5 + Math.random() * 6.5,
        side * (16 + Math.random() * 14),
      );
      this.spawnParticle(
        _vec3d.set((Math.random() - 0.5) * 5, 3.8, side * 4.5),
        steamVel,
        2.1,
        8.0,
        26,
        0xf8fafc,
        0x94a3b8,
        'smoke',
      );
    }
  }

  private applyAttitudeControls(dt: number, allowManualSteering: boolean): void {
    let steering = false;
    if (allowManualSteering) {
      const rate = 0.72;
      if (this.isKeyHeld('KeyW') || this.isKeyHeld('ArrowUp')) {
        this.pitchRad = THREE.MathUtils.clamp(this.pitchRad + rate * dt, -1.65, 1.65);
        this.emitRcsPuffs(_vec3d.set(0, 12, 1.4), _vec3c.set(0, 0, 1));
        steering = true;
      }
      if (this.isKeyHeld('KeyS') || this.isKeyHeld('ArrowDown')) {
        this.pitchRad = THREE.MathUtils.clamp(this.pitchRad - rate * dt, -1.65, 1.65);
        this.emitRcsPuffs(_vec3d.set(0, 12, -1.4), _vec3c.set(0, 0, -1));
        steering = true;
      }
      if (this.isKeyHeld('KeyA') || this.isKeyHeld('ArrowLeft')) {
        this.yawRad = THREE.MathUtils.clamp(this.yawRad + rate * dt, -1.2, 1.2);
        this.emitRcsPuffs(_vec3d.set(1.4, 12, 0), _vec3c.set(1, 0, 0));
        steering = true;
      }
      if (this.isKeyHeld('KeyD') || this.isKeyHeld('ArrowRight')) {
        this.yawRad = THREE.MathUtils.clamp(this.yawRad - rate * dt, -1.2, 1.2);
        this.emitRcsPuffs(_vec3d.set(-1.4, 12, 0), _vec3c.set(-1, 0, 0));
        steering = true;
      }
      if (this.isKeyHeld('KeyQ')) {
        this.rollRad += rate * 1.1 * dt;
        steering = true;
      }
      if (this.isKeyHeld('KeyE')) {
        this.rollRad -= rate * 1.1 * dt;
        steering = true;
      }
      if (this.isKeyHeld('KeyR') || this.isKeyHeld('ShiftLeft')) {
        this.throttle = Math.min(1, this.throttle + 0.55 * dt);
      }
      if (this.isKeyHeld('KeyF') || this.isKeyHeld('ControlLeft')) {
        this.throttle = Math.max(0.15, this.throttle - 0.55 * dt);
      }
    }

    if (steering) {
      this.trajectoryErrorDeg = Math.min(8.0, this.trajectoryErrorDeg + 0.22 * dt);
    } else if (this.autopilotEnabled) {
      this.yawRad = THREE.MathUtils.damp(this.yawRad, 0, 2.5, dt);
    }
    this.rcsActive = steering;
    this.audio.updateRcsHiss(steering);
  }

  private updateEarthEnvironmentAnimations(dt: number, elapsedTime: number): void {
    if (!this.earthEnvGroup.visible) return;

    if (this.oceanWaterMesh) {
      this.textures.oceanWaterMap.offset.x = (this.textures.oceanWaterMap.offset.x + dt * 0.03) % 1;
      this.textures.oceanWaterMap.offset.y = (this.textures.oceanWaterMap.offset.y + dt * 0.018) % 1;
    }

    if (this.launchTower) {
      const blink = Math.sin(elapsedTime * 3.8) > 0 ? 2.4 : 0.25;
      (this.launchTower.beaconLight.material as THREE.MeshStandardMaterial).emissiveIntensity = blink;
    }

    for (let i = 0; i < this.padSearchlights.length; i++) {
      const beam = this.padSearchlights[i];
      beam.rotation.z = Math.sin(elapsedTime * 0.65 + i * 2.1) * 0.24;
    }

    // Gentle cryo boil-off wisps venting from LOX/LH2 tanks on pad
    if (Math.random() < 0.25 && this.cryoTankPositions.length > 0) {
      const tankPos = this.cryoTankPositions[Math.floor(Math.random() * this.cryoTankPositions.length)];
      this.spawnParticle(
        tankPos,
        _vec3c.set(1.5 + Math.random() * 2, 2.5 + Math.random() * 2, (Math.random() - 0.5) * 2),
        1.4,
        1.4,
        4.6,
        0xf1f5f9,
        0xcbd5e1,
        'smoke',
      );
    }
  }

  private updateSimulation(rawDt: number): void {
    const rocket = this.rocket;
    if (!rocket) return;

    if (this.isPaused) {
      this.audio.updateRcsHiss(false);
      this.updateCamera(rawDt);
      return;
    }

    const warp =
      this.phase === 'LUNAR_DESCENT' ||
      this.phase === 'SURFACE_OPS' ||
      this.phase === 'PRELAUNCH' ||
      this.phase === 'COUNTDOWN'
        ? 1
        : this.timeWarp;
    const dt = Math.min(rawDt, 0.05) * warp;
    this.phaseTimer += dt;
    if (
      this.phase !== 'PRELAUNCH' &&
      this.phase !== 'COUNTDOWN' &&
      this.phase !== 'MISSION_COMPLETE' &&
      this.phase !== 'MISSION_FAILED'
    ) {
      this.missionTime += dt;
    }

    this.updateEarthEnvironmentAnimations(dt, performance.now() * 0.001);

    // Update orbital CSM beacon overhead
    if (this.orbitingCsmBeacon && this.lunarEnvGroup.visible) {
      this.orbitingCsmBeacon.position.x = Math.sin(this.missionTime * 0.06) * 260;
      this.orbitingCsmBeacon.position.z = -120 + Math.cos(this.missionTime * 0.06) * 90;
    }

    // Subtle animations on lunar surface landmarks, flag & astronaut
    if (this.lunarEnvGroup.visible) {
      const nowSec = performance.now() * 0.001;
      for (const node of this.sampleNodes) {
        if (!node.collected) {
          node.crystal.rotation.y += dt * 1.1;
          node.ring.rotation.z -= dt * 0.9;
        }
      }
      if (this.targetHologramRing) {
        this.targetHologramRing.rotation.z += dt * 0.45;
      }
      if (this.evaAstronautArm) {
        this.evaAstronautArm.rotation.z = -2.35 + Math.sin(nowSec * 3.5) * 0.25;
      }
      if (this.surfaceFlagBanner) {
        this.surfaceFlagBanner.rotation.y = Math.sin(nowSec * 2.2) * 0.08;
      }
    }

    for (let i = this.detachedStages.length - 1; i >= 0; i--) {
      const d = this.detachedStages[i];
      d.age += dt;
      d.object.position.addScaledVector(d.velocity, dt);
      d.object.rotation.x += d.angularVel.x * dt;
      d.object.rotation.y += d.angularVel.y * dt;
      d.object.rotation.z += d.angularVel.z * dt;
      if (d.age > 35) {
        this.scene.remove(d.object);
        this.disposeObject(d.object);
        this.detachedStages.splice(i, 1);
      }
    }

    if (this.mission.isDeepSpaceL2) {
      this.earthDistanceKm = this.altitudeKm;
      this.moonDistanceKm = Math.abs(384400 - this.altitudeKm);
    } else if (this.altitudeReference === 'EARTH') {
      this.earthDistanceKm = this.altitudeKm;
      this.moonDistanceKm = Math.max(0, 384400 - this.altitudeKm);
    } else {
      this.moonDistanceKm = this.altitudeKm;
      this.earthDistanceKm = Math.max(0, 384400 - this.altitudeKm);
    }

    const isTwoStageStack =
      this.mission.architecture === 'atlas-agena' ||
      this.mission.architecture === 'atlas-centaur' ||
      this.mission.architecture === 'ariane-5' ||
      this.mission.architecture === 'lvm3' ||
      this.mission.architecture === 'sls-robotic';

    switch (this.phase) {
      case 'PRELAUNCH': {
        this.audio.updateThrust(0, 1);
        this.audio.updateRcsHiss(false);
        this.enginePointLight.intensity = 0;
        this.accelerationMs2 = 0;
        this.gForce = 1.0;
        this.machNumber = 0;
        break;
      }

      case 'COUNTDOWN': {
        this.countdownSec = Math.max(0, 5.0 - this.phaseTimer);
        const whole = Math.ceil(this.countdownSec);
        if (whole < this.lastCountdownWhole && whole > 0) {
          this.lastCountdownWhole = whole;
          this.audio.playCountdownBeep(false);
        }
        if (this.countdownSec <= 0) {
          this.audio.playCountdownBeep(true);
          this.startLaunch();
        }
        break;
      }

      case 'IGNITION': {
        const t = Math.min(1, this.phaseTimer / 3.0);
        this.activeStageName = this.mission.architecture === 'saturn-v' ? 'S-IC Ignition' : 'Stage 1 Ignition';
        if (this.launchTower) {
          for (let i = 0; i < this.launchTower.swingArms.length; i++) {
            this.launchTower.swingArms[i].rotation.y = -t * (0.95 + i * 0.15);
          }
        }
        rocket.root.position.x = (Math.random() - 0.5) * 0.08 * t;
        rocket.root.position.z = (Math.random() - 0.5) * 0.08 * t;
        this.accelerationMs2 = 0;
        this.gForce = Number((1.0 + 0.15 * t).toFixed(2));

        for (const n of rocket.stage1Nozzles) {
          this.emitExhaust(n, 2, false, true);
        }
        this.enginePointLight.position.copy(rocket.root.position).add(_vec3d.set(0, -1, 0));
        this.enginePointLight.intensity = 20 * t;
        this.audio.updateThrust(0.85 * t, 1.0);

        if (this.phaseTimer >= 3.0) {
          rocket.root.position.x = 0;
          rocket.root.position.z = 0;
          this.transitionPhase('LIFTOFF');
          this.audio.playQuindarBeep(true);
        }
        break;
      }

      case 'LIFTOFF': {
        const duration = 16;
        const progress = Math.min(1, this.phaseTimer / duration);
        this.activeStageName = this.mission.architecture === 'saturn-v'
          ? 'S-IC · 5 × F-1 Engines'
          : this.mission.id === 'surveyor-3'
            ? 'Atlas LV-3C Booster / Sustainer'
            : this.mission.architecture === 'ariane-5'
              ? 'Ariane 5 ECA · Boosters + Vulcain 2 Core'
              : 'Stage 1 Booster';
        this.stageFuelPct = Math.max(0, 100 * (1 - progress));
        this.applyAttitudeControls(dt, true);

        const thrustScale = Math.max(0.45, this.throttle) * this.metrics.engineThrustMultiplier;
        const accel = (12 + progress * 24) * 3.6 * thrustScale;
        this.accelerationMs2 = accel;
        this.gForce = Number((1.0 + accel / 9.80665).toFixed(2));
        this.velocityMs += accel * dt;

        if (this.autopilotEnabled && this.phaseTimer > 3.0 && !this.rcsActive) {
          const targetPitch = THREE.MathUtils.lerp(0, 0.54, (this.phaseTimer - 3.0) / (duration - 3.0));
          this.pitchRad = THREE.MathUtils.damp(this.pitchRad, targetPitch, 2.2, dt);
        }

        const verticalRate = Math.cos(this.pitchRad);
        const horizRate = Math.sin(this.pitchRad);
        this.altitudeKm += (this.velocityMs * verticalRate * dt) / 1000 * 3.1;
        this.downrangeKm += (this.velocityMs * horizRate * dt) / 1000 * 2.5;

        rocket.root.position.y = 7.6 + this.altitudeKm * 22;
        rocket.root.position.x = this.downrangeKm * 18;
        rocket.root.rotation.set(0, this.yawRad, -this.pitchRad);

        for (const n of rocket.stage1Nozzles) {
          this.emitExhaust(n, 2, false, true);
        }
        this.enginePointLight.position.copy(rocket.root.position);
        this.enginePointLight.intensity = 22 * thrustScale;
        const density = Math.max(0.05, 1 - this.altitudeKm / 45);
        this.audio.updateThrust(thrustScale, density);
        this.updateAscentAtmosphere();

        if (this.phaseTimer >= duration) {
          this.transitionPhase('STAGE_1_SEP');
          this.throttle = 0;
          this.accelerationMs2 = 0;
          this.audio.playStageSeparation();
          this.detachObject(
            rocket.stage1,
            _vec3d.set(-4, -12, 1.5),
            _vec3c.set(0.18, 0.06, 0.25),
          );
          if (!this.userCameraActive) {
            this.cameraPreset = 'stage';
          }
        }
        break;
      }

      case 'STAGE_1_SEP': {
        this.activeStageName = 'Interstage Separation';
        this.applyAttitudeControls(dt, true);
        this.accelerationMs2 = -0.5;
        this.gForce = 0.05;
        this.altitudeKm += (this.velocityMs * Math.cos(this.pitchRad) * dt) / 1000 * 1.4;
        this.downrangeKm += (this.velocityMs * Math.sin(this.pitchRad) * dt) / 1000 * 1.6;
        rocket.root.position.y = 7.6 + this.altitudeKm * 22;
        rocket.root.position.x = this.downrangeKm * 18;
        rocket.root.rotation.set(0, this.yawRad, -this.pitchRad);
        this.enginePointLight.intensity = 0;
        this.audio.updateThrust(0, 0.05);
        this.updateAscentAtmosphere();

        if (this.phaseTimer >= 2.8) {
          this.transitionPhase('STAGE_2_ASCENT');
          this.throttle = 1.0;
          this.stageFuelPct = 100;
          if (!this.userCameraActive) {
            this.cameraPreset = 'chase';
          }
        }
        break;
      }

      case 'STAGE_2_ASCENT': {
        const duration = 12;
        const progress = Math.min(1, this.phaseTimer / duration);
        this.activeStageName = this.mission.architecture === 'saturn-v'
          ? 'S-II · 5 × J-2 Engines'
          : this.mission.architecture === 'atlas-agena'
            ? 'Agena D · Restartable Upper Stage'
            : this.mission.architecture === 'atlas-centaur'
              ? 'Centaur D · Twin RL-10 Engines'
              : this.mission.architecture === 'ariane-5'
                ? 'ESC-A · HM7B Upper Stage'
                : 'Stage 2 Upper Stage';
        this.stageFuelPct = Math.max(0, 100 * (1 - progress));
        this.applyAttitudeControls(dt, true);

        const accel =
          (15 + progress * 22) * 8.5 * Math.max(0.5, this.throttle) * this.metrics.engineThrustMultiplier;
        this.accelerationMs2 = accel;
        this.gForce = Number((accel / 9.80665).toFixed(2));
        this.velocityMs += accel * dt * 1.25;

        if (this.autopilotEnabled && !this.rcsActive) {
          this.pitchRad = THREE.MathUtils.damp(this.pitchRad, THREE.MathUtils.lerp(0.54, 1.18, progress), 2.5, dt);
        }
        this.altitudeKm += (this.velocityMs * Math.cos(this.pitchRad) * dt) / 1000 * 2.1;
        this.downrangeKm += (this.velocityMs * Math.sin(this.pitchRad) * dt) / 1000 * 2.8;

        rocket.root.position.y = 7.6 + this.altitudeKm * 22;
        rocket.root.position.x = this.downrangeKm * 18;
        rocket.root.rotation.set(this.rollRad * 0.2, this.yawRad, -this.pitchRad);

        if (rocket.lesTower && this.phaseTimer > 2.0) {
          this.audio.playStageSeparation();
          this.detachObject(
            rocket.lesTower,
            _vec3d.set(14, 18, -4),
            _vec3c.set(0.4, 0.2, -0.5),
          );
          rocket.lesTower = null;
        }

        for (const n of rocket.stage2Nozzles) {
          this.emitExhaust(n, 2, true, false);
        }
        this.enginePointLight.position.copy(rocket.root.position);
        this.enginePointLight.intensity = 10;
        this.audio.updateThrust(0.85, 0.02);
        this.updateAscentAtmosphere();

        if (this.phaseTimer >= duration) {
          this.transitionPhase('STAGE_2_SEP');
          this.throttle = 0;
          this.accelerationMs2 = 0;
          this.audio.playStageSeparation();
          if (!isTwoStageStack) {
            this.detachObject(
              rocket.stage2,
              _vec3d.set(-9, -6, -2),
              _vec3c.set(-0.14, 0.1, 0.22),
            );
          }
          if (!this.userCameraActive) {
            this.cameraPreset = 'stage';
          }
        }
        break;
      }

      case 'STAGE_2_SEP': {
        this.activeStageName = this.mission.architecture === 'saturn-v'
          ? 'S-IVB Coast · Prepare J-2 Restart'
          : this.mission.architecture === 'ariane-5'
            ? 'ESC-A Cryogenic Upper-Stage Coast'
          : `${this.mission.launchVehicle} Upper-Stage Coast`;
        this.applyAttitudeControls(dt, true);
        this.accelerationMs2 = 0;
        this.gForce = 0.0;
        this.altitudeKm += 1.4 * dt;
        this.downrangeKm += 5.5 * dt;
        rocket.root.position.y = 7.6 + this.altitudeKm * 22;
        rocket.root.position.x = this.downrangeKm * 18;
        this.enginePointLight.intensity = 0;
        this.audio.updateThrust(0, 0);
        this.updateAscentAtmosphere();

        if (this.phaseTimer >= 2.4) {
          this.transitionPhase('EARTH_DEPARTURE');
          this.throttle = 1.0;
          this.stageFuelPct = 100;
          if (!this.userCameraActive) {
            this.cameraPreset = 'orbital';
          }
        }
        break;
      }

      case 'EARTH_DEPARTURE': {
        const duration = 8.5;
        const progress = Math.min(1, this.phaseTimer / duration);
        this.activeStageName = this.mission.architecture === 'saturn-v'
          ? 'S-IVB · Restartable J-2 TLI Burn'
          : this.mission.architecture === 'atlas-agena'
            ? 'Agena D · Translunar Injection Burn'
            : this.mission.architecture === 'atlas-centaur'
              ? 'Centaur D · Translunar Injection Burn'
              : this.mission.architecture === 'ariane-5'
                ? 'ESC-A · HM7B Upper-Stage Injection'
                : `${this.mission.launchVehicle} Upper-Stage Injection Burn`;
        this.stageFuelPct = Math.max(12, 100 * (1 - progress * 0.85));
        this.applyAttitudeControls(dt, true);

        const accel = 280 * this.metrics.engineThrustMultiplier;
        this.accelerationMs2 = accel;
        this.gForce = Number((0.7 + progress * 0.65).toFixed(2));
        this.velocityMs += accel * dt;
        this.altitudeKm += 24 * dt;
        this.downrangeKm += 55 * dt;
        if (this.autopilotEnabled && !this.rcsActive) {
          this.pitchRad = THREE.MathUtils.lerp(1.18, 1.42, progress);
        }

        rocket.root.position.y = 7.6 + this.altitudeKm * 22;
        rocket.root.position.x = this.downrangeKm * 18;
        rocket.root.rotation.set(this.rollRad * 0.3, this.yawRad, -this.pitchRad);

        const injectionNozzles = isTwoStageStack ? rocket.stage2Nozzles : rocket.stage3Nozzles;
        for (const n of injectionNozzles) {
          this.emitExhaust(n, 2, true, false);
        }
        this.enginePointLight.position.copy(rocket.root.position);
        this.enginePointLight.intensity = 9;
        this.audio.updateThrust(0.7, 0);
        this.updateAscentAtmosphere();
        this.updateNavTrajectoryLines(0);

        if (this.phaseTimer >= duration) {
          this.transitionPhase('TRANSLUNAR_CRUISE');
          this.throttle = 0;
          this.accelerationMs2 = 0;
          this.stageFuelPct = 86;
          this.audio.playStageSeparation();
          this.audio.playQuindarBeep(false);
          if (isTwoStageStack) {
            this.detachObject(rocket.stage2, _vec3d.set(-8, -5, -2), _vec3c.set(-0.12, 0.08, 0.18));
            if (rocket.stage3.parent) {
              this.detachObject(rocket.stage3, _vec3d.set(-6, -3, 1), _vec3c.set(-0.1, 0.08, 0.14));
            }
          }
          if (!this.userCameraActive) {
            this.cameraPreset = 'orbital';
          }

          if (rocket.fairingLeft && rocket.fairingRight) {
            this.detachObject(rocket.fairingLeft, _vec3d.set(-4, 2, 8), _vec3c.set(0.3, 0.1, 0.2));
            this.detachObject(rocket.fairingRight, _vec3d.set(4, -2, -8), _vec3c.set(-0.3, -0.1, -0.2));
            rocket.fairingLeft = null;
            rocket.fairingRight = null;
            rocket.lander.scale.setScalar(this.mission.isDeepSpaceL2 ? 1.25 : 1.0);
          }

          const reqDv = Math.round(14 + this.trajectoryErrorDeg * 38);
          const fuelCost = Number((2.5 + this.trajectoryErrorDeg * 2.2).toFixed(1));
          this.maneuverPending = {
            type: 'MCC',
            title: this.mission.isDeepSpaceL2
              ? 'L2 Mid-Course Correction (MCC-2)'
              : 'Translunar Mid-Course Correction (MCC-2)',
            requiredDeltaVMs: reqDv,
            fuelCostPct: fuelCost,
            feasible: this.stageFuelPct >= fuelCost + 15,
            predictedOutcome: this.mission.isDeepSpaceL2
              ? 'Trims Ariane 5 hyperbolic trajectory toward Sun-Earth L2 while preserving 20+ years of fuel.'
              : this.trajectoryErrorDeg > 1.0
                ? 'Aligns intercept corridor to 112 km lunar pericynthion (avoids high-cost LOI).'
                : 'Fine-tunes lunar capture trajectory for optimal propellant efficiency.',
            executed: false,
          };
        }
        break;
      }

      case 'TRANSLUNAR_CRUISE': {
        const duration = 12.5 * (this.metrics.transitTimeScale || 1.0);
        const t = Math.min(1, this.phaseTimer / duration);
        this.applyAttitudeControls(dt, true);
        this.gForce = 0;
        this.accelerationMs2 = -120;
        this.enginePointLight.intensity = 0;
        this.audio.updateThrust(0, 0);

        this.velocityMs = Math.max(this.mission.isDeepSpaceL2 ? 1280 : 1950, this.velocityMs - 850 * dt);
        this.altitudeKm = 320 + t * (this.mission.isDeepSpaceL2 ? 1495000 : 192000);
        this.earthDistanceKm = this.altitudeKm;
        this.moonDistanceKm = this.mission.isDeepSpaceL2
          ? Math.abs(384400 - this.altitudeKm)
          : Math.max(4800, 384400 - this.altitudeKm);
        this.downrangeKm += 95 * dt;
        rocket.root.position.y = 7.6 + 320 * 22 + t * 800;
        rocket.root.position.x = this.downrangeKm * 18;
        rocket.root.position.z = this.yawRad * 18;
        rocket.root.rotation.set(this.rollRad, this.yawRad, -this.pitchRad);

        const petalT = Math.min(1, t * 2.8);
        for (const petal of rocket.slaPetals) {
          petal.rotation.z = -petalT * 0.95;
        }

        if (this.mission.id === 'apollo-8') {
          this.activeStageName = `${this.mission.csmName ?? 'CSM-103'} Coast`;
          if (rocket.csm && t > 0.22 && rocket.stage3.parent) {
            this.audio.playStageSeparation();
            this.detachObject(rocket.lander, _vec3d.set(-5, -3, 0), _vec3c.set(0.04, 0.04, 0.06));
            this.detachObject(rocket.stage3, _vec3d.set(-6, -4, 0), _vec3c.set(0.05, 0.04, 0.08));
          }
        } else {
          this.activeStageName =
            this.mission.category === 'crewed'
              ? `${this.mission.csmName} + ${this.mission.landerName}`
              : `${this.mission.landerName} Cruise`;
          if (rocket.csm && t > 0.25 && t < 0.55) {
            const pull = (t - 0.25) / 0.3;
            rocket.csm.position.y = 40.1 + pull * 5.2;
          }
          if (t >= 0.55 && rocket.stage3.parent) {
            this.audio.playStageSeparation();
            this.detachObject(rocket.stage3, _vec3d.set(-6, -4, 0), _vec3c.set(0.05, 0.04, 0.08));
            if (rocket.csm) {
              this.detachObject(rocket.csm, _vec3d.set(5, 4, 2), _vec3c.set(0.02, 0.05, -0.03));
            }
          }
        }

        if (!this.mission.isDeepSpaceL2) {
          this.distantMoon.scale.setScalar(1 + t * 5.8);
        }
        this.updateAscentAtmosphere();
        this.updateNavTrajectoryLines(t);

        if (this.phaseTimer >= duration) {
          if (!this.mccExecuted && this.design.difficulty !== 'practice' && this.phaseTimer < duration + 5) {
            this.activeStageName = 'Awaiting MCC-2 Confirmation';
          } else {
            if (!this.mccExecuted) {
              this.trajectoryErrorDeg = Math.max(this.trajectoryErrorDeg, 2.2);
            }
            this.maneuverPending = null;
            this.enterLunarEnvironment('LUNAR_APPROACH');
            this.altitudeKm = this.mission.isDeepSpaceL2 ? 1495000 : 180;
          }
        }
        break;
      }

      case 'LUNAR_APPROACH': {
        const isL2 = Boolean(this.mission.isDeepSpaceL2);
        this.altitudeReference = isL2 ? 'EARTH' : 'MOON';
        this.activeStageName =
          this.mission.id === 'apollo-8'
            ? `${this.mission.csmName} Approach`
            : isL2
              ? 'JWST L2 Halo Approach'
              : `${this.mission.landerName} Approach`;
        this.applyAttitudeControls(dt, true);

        const autoBurn = this.design.difficulty === 'practice' && this.phaseTimer > 2.0;
        if (autoBurn && !this.loiExecuted) {
          this.executeManeuverBurn('LOI');
          break;
        }

        const t = Math.min(1, this.phaseTimer / 7.5);
        this.velocityMs = isL2 ? THREE.MathUtils.lerp(1280, 1020, t) : THREE.MathUtils.lerp(1920, 1680, t);
        this.altitudeKm = isL2 ? THREE.MathUtils.lerp(1495000, 1500000, t) : THREE.MathUtils.lerp(180, 118, t);
        this.landerPos.x = THREE.MathUtils.lerp(-140, -70, t);
        this.landerPos.y = THREE.MathUtils.lerp(155, 130, t);
        this.landerPos.z = THREE.MathUtils.lerp(-75, -35, t);
        rocket.root.position.copy(this.landerPos);
        rocket.root.rotation.set(0.1 + this.pitchRad * 0.3, t * 0.3 + this.yawRad, -0.25 + this.rollRad * 0.3);

        const nozzle = this.mission.id === 'apollo-8' ? rocket.csmNozzleLocal : rocket.landerNozzleLocal;
        this.emitExhaust(nozzle, 2, true, false);
        this.audio.updateThrust(0.5, 0.02);

        if (this.phaseTimer >= 9.0 && !this.loiExecuted) {
          this.executeManeuverBurn('LOI');
        }
        break;
      }

      case 'LUNAR_ORBIT': {
        const duration = 3.5;
        const t = Math.min(1, this.phaseTimer / duration);
        const isL2 = Boolean(this.mission.isDeepSpaceL2);
        this.altitudeReference = isL2 ? 'EARTH' : 'MOON';
        this.gForce = 0;
        this.accelerationMs2 = 0;
        this.audio.updateThrust(0, 0);
        this.applyAttitudeControls(dt, true);

        if (this.mission.hasLunarLanding) {
          this.activeStageName = `${this.mission.landerName} Undock & DOI`;
          this.altitudeKm = THREE.MathUtils.lerp(112, 0.175, t * t);
          this.velocityMs = THREE.MathUtils.lerp(1630, 8.2, t);
          const siteInfo = this.getSelectedLandingSiteOffset();
          this.landerPos.x = THREE.MathUtils.lerp(-70, siteInfo.x - 42, t);
          this.landerPos.y = THREE.MathUtils.lerp(130, 175, t);
          this.landerPos.z = THREE.MathUtils.lerp(-35, siteInfo.z - 22, t);
          rocket.root.position.copy(this.landerPos);
          rocket.root.rotation.set(0, 0, 0);

          if (this.phaseTimer >= duration) {
            this.transitionPhase('LUNAR_DESCENT');
            this.landerVel.set(4.5, -5.8, 2.2);
            this.landerPitch = 0;
            this.landerRoll = 0;
            this.landerFuelPct = Math.min(100, Math.round(100 * this.metrics.landerFuelScale));
            this.gearDeployed = false;
            this.throttle = 0.48;
            this.cameraPreset = 'lander';
            this.userCameraActive = false;
          }
        } else {
          this.activeStageName = isL2
            ? 'JWST L2 Halo Insertion'
            : this.mission.id === 'apollo-8'
              ? (this.mission.csmName ?? 'CSM-103')
              : this.mission.landerName;
          this.altitudeKm = isL2 ? 1500000 : 112;
          this.velocityMs = isL2 ? 1020 : 1630;
          this.landerPos.x += 12 * dt;
          rocket.root.position.copy(this.landerPos);
          if (this.phaseTimer >= 2.0) {
            this.transitionPhase('LUNAR_ORBIT_SURVEY');
            this.cameraPreset = 'orbital';
            this.userCameraActive = false;
          }
        }
        break;
      }

      case 'LUNAR_ORBIT_SURVEY': {
        const duration = 14.0;
        const t = Math.min(1, this.phaseTimer / duration);
        const isL2 = Boolean(this.mission.isDeepSpaceL2);
        this.altitudeReference = isL2 ? 'EARTH' : 'MOON';
        this.activeStageName = isL2
          ? 'JWST L2 Observatory'
          : this.mission.id === 'apollo-8'
            ? `${this.mission.csmName ?? 'CSM-103'} Orbital Survey`
            : `${this.mission.landerName} Survey`;
        this.applyAttitudeControls(dt, true);

        const doneCount = this.orbitTasksDone.filter(Boolean).length;
        this.surfaceOpsProgress = Math.max(t * 100, (doneCount / 3) * 100);

        this.landerPos.x = -65 + t * 145;
        this.landerPos.y = 128 + Math.sin(this.phaseTimer * 0.4) * 3;
        this.landerPos.z = -30 + t * 25;
        this.velocityMs = isL2 ? 1020 : 1630;
        this.altitudeKm = isL2 ? 1500000 : 112;
        this.accelerationMs2 = 0;
        this.gForce = 0;
        this.audio.updateThrust(0, 0);

        rocket.root.position.copy(this.landerPos);
        rocket.root.rotation.set(
          (isL2 ? 0.25 : 0.18) + this.pitchRad * 0.4,
          this.phaseTimer * (isL2 ? 0.24 : 0.06) + this.yawRad,
          -0.1 + this.rollRad,
        );

        if (this.mission.hasReturnJourney) {
          if (!this.maneuverPending && !this.teiExecuted && (doneCount === 3 || this.phaseTimer >= 9.0)) {
            this.maneuverPending = {
              type: 'TEI',
              title: 'Trans-Earth Injection (TEI) SPS Burn',
              requiredDeltaVMs: 980,
              fuelCostPct: 18,
              feasible: this.stageFuelPct >= 20,
              predictedOutcome: 'Breaks lunar orbit for return corridor to Earth splashdown.',
              executed: false,
            };
          }

          if (this.phaseTimer >= duration && !this.teiExecuted && this.design.difficulty === 'practice') {
            this.executeManeuverBurn('TEI');
          }
        } else if ((doneCount === 3 && this.phaseTimer >= 3.2) || this.phaseTimer >= duration) {
          this.landingScore = Math.max(75, Math.round((doneCount / 3) * 100));
          this.landingGrade = 'NOMINAL';
          this.finalizeMissionComplete();
        }
        break;
      }

      case 'LUNAR_DESCENT': {
        this.activeStageName = `${this.mission.landerName} Descent`;
        this.updateLunarDescent(dt);
        break;
      }

      case 'SURFACE_OPS': {
        this.altitudeReference = 'MOON';
        this.altitudeKm = 0;
        this.accelerationMs2 = 0;
        this.gForce = 0.165;
        this.audio.updateThrust(0, 0);
        this.audio.updateRcsHiss(false);
        this.enginePointLight.intensity = 0;

        if (this.surfaceRover || this.surfaceEva) {
          const isRover = Boolean(this.surfaceRover);
          const driveSpeed = isRover ? 3.6 : 1.45;
          const turnRate = isRover ? 0.9 : 1.15;

          if (this.isKeyHeld('KeyA') || this.isKeyHeld('ArrowLeft')) {
            this.roverHeading += turnRate * dt;
          }
          if (this.isKeyHeld('KeyD') || this.isKeyHeld('ArrowRight')) {
            this.roverHeading -= turnRate * dt;
          }

          let fwd = 0;
          if (this.isKeyHeld('KeyW') || this.isKeyHeld('ArrowUp')) fwd += 1;
          if (this.isKeyHeld('KeyS') || this.isKeyHeld('ArrowDown')) fwd -= 1;

          const targetSpeed = fwd * driveSpeed;
          this.roverSpeed = THREE.MathUtils.damp(this.roverSpeed, targetSpeed, 6.5, dt);
          this.velocityMs = Math.abs(this.roverSpeed);

          if (this.isKeyHeld('Space') && this.surfaceEva && this.roverGrounded) {
            this.triggerEvaHop();
          }

          // EVA and LRV motion use lunar surface gravity; the rover has no
          // fictional rocket boost and stays below its historical road speed.
          const stepDx = Math.sin(this.roverHeading) * this.roverSpeed * dt;
          const stepDz = Math.cos(this.roverHeading) * this.roverSpeed * dt;
          this.roverPos.x += stepDx;
          this.roverPos.z += stepDz;
          this.roverDistanceM += Math.hypot(stepDx, stepDz);

          const groundH = this.sampleLunarHeight(this.roverPos.x, this.roverPos.z);
          if (!this.roverGrounded || this.roverVelY > 0) {
            this.roverVelY -= 1.62 * dt;
            this.roverPos.y += this.roverVelY * dt;
            if (this.roverPos.y <= groundH) {
              this.roverPos.y = groundH;
              this.roverVelY = 0;
              this.roverGrounded = true;
              // Soft landing dust puff
              for (let d = 0; d < 6; d++) {
                const a = (d * Math.PI) / 3;
                this.spawnParticle(
                  _vec3d.set(this.roverPos.x + Math.cos(a), groundH + 0.2, this.roverPos.z + Math.sin(a)),
                  _vec3c.set(Math.cos(a) * 4, 1.4, Math.sin(a) * 4),
                  0.55,
                  0.9,
                  2.6,
                  0x9ca3af,
                  0x475569,
                  'dust',
                );
              }
            }
          } else {
            this.roverPos.y = groundH;
          }

          // Keep the LRV aligned to the terrain; suit explorers remain upright.
          const nrm = this.computeLunarNormal(this.roverPos.x, this.roverPos.z, _vec3);
          const yawQuat = _quat.setFromAxisAngle(_vec3b.set(0, 1, 0), this.roverHeading);
          const slopeQuat = this.roverPitchQuat.setFromUnitVectors(_vec3c.set(0, 1, 0), nrm);
          const mobileUnit = this.surfaceRover?.root ?? this.surfaceEva;
          if (mobileUnit) {
            mobileUnit.position.copy(this.roverPos);
            if (this.surfaceRover) mobileUnit.quaternion.copy(slopeQuat).multiply(yawQuat);
            else mobileUnit.rotation.y = this.roverHeading;
          }

          // Spin LRV wheels and show a small regolith disturbance while moving.
          if (this.surfaceRover && Math.abs(this.roverSpeed) > 0.6 && this.roverGrounded) {
            for (const w of this.surfaceRover.wheels) {
              w.rotation.x += (this.roverSpeed * dt) / 0.32;
            }
            if (Math.random() < 0.55) {
              this.spawnParticle(
                _vec3d.set(this.roverPos.x, groundH + 0.15, this.roverPos.z),
                _vec3c.set((Math.random() - 0.5) * 2.5, 1.2 + Math.random() * 1.4, (Math.random() - 0.5) * 2.5),
                0.55,
                0.65,
                2.0,
                0x94a3b8,
                0x475569,
                'dust',
              );
            }
          }

          // Scan proximity to Discovery Landmarks
          for (const node of this.sampleNodes) {
            if (!node.collected && Math.hypot(this.roverPos.x - node.x, this.roverPos.z - node.z) < 4.4) {
              node.collected = true;
              node.crystal.visible = false;
              if (node.beaconBeam) node.beaconBeam.visible = false;
              (node.ring.material as THREE.MeshBasicMaterial).color.setHex(0x10b981);
              (node.ring.material as THREE.MeshBasicMaterial).opacity = 0.28;
              this.surfaceSamplesCollected++;
              const sciGain = Math.round(node.points * (this.metrics.scienceMultiplier || 1.0));
              this.bonusScienceEarned += sciGain;
              this.dataQueuedMb += 18;
              this.latestDiscovery = {
                id: node.id,
                title: node.title,
                fact: node.fact,
                points: sciGain,
              };
              this.audio.playQuindarBeep(true);
              for (let s = 0; s < 20; s++) {
                this.spawnParticle(
                  _vec3d.set(node.x, this.roverPos.y + 1.2, node.z),
                  _vec3c.set((Math.random() - 0.5) * 9, 3 + Math.random() * 6, (Math.random() - 0.5) * 9),
                  0.85,
                  0.8,
                  2.2,
                  0x38bdf8,
                  0xfacc15,
                  'spark',
                );
              }
            }
          }
        }

        // Power Source Physics during Surface Ops
        if (this.design.powerSource === 'rtg') {
          this.powerBusPct = Math.min(100, this.powerBusPct + 1.8 * dt);
        } else if (this.metrics.isPolarShadowed && (this.design.powerSource ?? 'solar') === 'solar') {
          this.powerBusPct = Math.max(28, this.powerBusPct - 1.1 * dt);
        }

        const isSurveyor = this.mission.id === 'surveyor-3';
        const totalSamples = isSurveyor ? SURVEYOR_SURFACE_TASKS.length : this.sampleNodes.length || 5;
        const samplePct = isSurveyor
          ? (this.surfaceTasksDone.filter(Boolean).length / totalSamples) * 80
          : (this.surfaceSamplesCollected / totalSamples) * 55;
        const deployPct = isSurveyor
          ? this.surfaceInstrumentsDeployed ? 20 : Math.min(18, (this.phaseTimer / 8.0) * 18)
          : this.surfaceInstrumentsDeployed ? 45 : Math.min(40, (this.phaseTimer / 8.0) * 40);
        this.surfaceOpsProgress = Math.min(100, deployPct + samplePct);

        if (this.phaseTimer >= 6.5 && !this.surfaceInstrumentsDeployed) {
          this.surfaceInstrumentsDeployed = true;
          this.bonusScienceEarned += 15;
          this.dataQueuedMb += 16;
        }
        break;
      }

      case 'LUNAR_ASCENT': {
        const duration = 7.5;
        const t = Math.min(1, this.phaseTimer / duration);
        this.altitudeReference = 'MOON';
        this.activeStageName = `${this.mission.landerName} Ascent Stage`;
        this.throttle = 1.0;
        this.landerFuelPct = Math.max(12, 80 - t * 65);
        this.accelerationMs2 = 4.8;
        this.gForce = 0.49;

        this.landerVel.y = 4 + t * 28;
        this.landerVel.x = t * 18;
        this.landerPos.addScaledVector(this.landerVel, dt);
        this.altitudeKm = THREE.MathUtils.lerp(0, 112, t * t);
        this.velocityMs = THREE.MathUtils.lerp(0, 1630, t);

        rocket.root.position.copy(this.landerPos);
        rocket.root.rotation.z = -t * 0.65;

        this.emitExhaust(rocket.lmAscentNozzleLocal, 2, true, false);
        this.enginePointLight.position.copy(this.landerPos);
        this.enginePointLight.intensity = 8;
        this.audio.updateThrust(0.75, 0.02);

        if (this.phaseTimer >= duration) {
          this.transitionPhase('LUNAR_RENDEZVOUS');
          this.throttle = 0;
          this.enginePointLight.intensity = 0;
          this.audio.updateThrust(0, 0);
          this.activeStageName = `${this.mission.csmName} Docking`;
        }
        break;
      }

      case 'LUNAR_RENDEZVOUS': {
        const duration = 4.0;
        this.altitudeReference = 'MOON';
        this.altitudeKm = 112;
        this.velocityMs = 1630;
        this.gForce = 0;
        this.accelerationMs2 = 0;
        this.applyAttitudeControls(dt, true);

        if (!this.maneuverPending && !this.teiExecuted && this.phaseTimer >= 1.5) {
          this.maneuverPending = {
            type: 'TEI',
            title: 'Trans-Earth Injection (TEI) SPS Burn',
            requiredDeltaVMs: 980,
            fuelCostPct: 18,
            feasible: this.stageFuelPct >= 20,
            predictedOutcome: 'Breaks lunar orbit for crewed return corridor to Earth.',
            executed: false,
          };
        }
        if (this.phaseTimer >= duration + 2.5 && !this.teiExecuted && this.design.difficulty === 'practice') {
          this.executeManeuverBurn('TEI');
        }
        break;
      }

      case 'RETURN_JOURNEY': {
        const duration = 6.5;
        const t = Math.min(1, this.phaseTimer / duration);
        this.altitudeReference = 'MOON';
        this.activeStageName = `${this.mission.csmName ?? 'CSM'} SPS (TEI)`;
        this.throttle = t < 0.65 ? 0.9 : 0;
        this.velocityMs = THREE.MathUtils.lerp(1630, 2680, Math.min(1, t / 0.65));
        this.altitudeKm = 112 + t * 1450;
        this.accelerationMs2 = t < 0.65 ? 8.5 : 0;
        this.gForce = t < 0.65 ? 0.87 : 0.0;

        this.landerPos.addScaledVector(this.landerVel, dt);
        rocket.root.position.copy(this.landerPos);

        if (t < 0.65) {
          this.emitExhaust(rocket.csmNozzleLocal, 2, true, false);
          this.enginePointLight.position.copy(this.landerPos);
          this.enginePointLight.intensity = 8;
          this.audio.updateThrust(0.7, 0);
        } else {
          this.enginePointLight.intensity = 0;
          this.audio.updateThrust(0, 0);
        }

        if (this.phaseTimer >= duration) {
          this.enterEarthReentry();
        }
        break;
      }

      case 'EARTH_REENTRY': {
        const duration = 8.0;
        const t = Math.min(1, this.phaseTimer / duration);
        this.altitudeReference = 'EARTH';
        this.altitudeKm = THREE.MathUtils.lerp(120, 0.0, t);
        this.velocityMs = THREE.MathUtils.lerp(11020, 8.2, Math.pow(t, 0.65));
        const peakG = t < 0.65 ? Math.sin((t / 0.65) * Math.PI) * 4.2 : 0.4;
        this.gForce = Number((1.0 + peakG).toFixed(2));
        this.accelerationMs2 = -peakG * 9.81;
        this.skyDomeMat.uniforms.uAtmosAlpha.value = THREE.MathUtils.lerp(0.25, 1.0, Math.min(1, t * 1.3));
        (this.starsPoints.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - t * 1.6);

        // Capsule descends smoothly from 360u down to Pacific Ocean surface at y = 10u
        rocket.root.position.y = THREE.MathUtils.lerp(360, 10, t);
        this.reentryGroup.position.set(rocket.root.position.x, 0, rocket.root.position.z);

        if (t < 0.62) {
          // Peak Heating Plasma Bow-Shock Phase
          this.activeStageName = `${this.mission.csmName ?? 'CM'} Heatshield Plasma`;
          rocket.root.rotation.set(0.12, t * 0.4, 2.85 - t * 0.3);
          this.reentryPlasmaMesh.visible = true;
          this.reentryPlasmaMesh.position.copy(rocket.root.position).add(_vec3c.set(0, -1.6, 0));
          (this.reentryPlasmaMesh.material as THREE.MeshBasicMaterial).opacity =
            Math.sin((t / 0.62) * Math.PI) * 0.78;
          this.parachuteGroup.visible = false;

          this.spawnParticle(
            _vec3d.copy(rocket.root.position).add(_vec3c.set(0, -1.5, 0)),
            _vec3c.set((Math.random() - 0.5) * 6, 14, (Math.random() - 0.5) * 6),
            0.25,
            3.6,
            7.2,
            0xffedd5,
            0xf97316,
            'flame',
          );
          this.enginePointLight.position.copy(rocket.root.position);
          this.enginePointLight.intensity = 12 * Math.sin((t / 0.62) * Math.PI);
          this.audio.updateThrust(0.55, 0.65);
        } else {
          // 3 Main Ring-Sail Parachutes Unfurl + Splashdown Ocean Reveal!
          this.activeStageName = `${this.mission.csmName ?? 'CM'} Main Chutes`;
          this.reentryPlasmaMesh.visible = false;
          this.enginePointLight.intensity = 0;
          this.audio.updateThrust(0, 0.15);

          rocket.root.rotation.set(0, t * 0.25, Math.sin(t * 14) * 0.06);
          this.parachuteGroup.visible = true;
          this.parachuteGroup.position.copy(rocket.root.position).add(_vec3c.set(0, 3.2, 0));
          const chuteOpen = Math.min(1, (t - 0.62) / 0.12);
          this.parachuteGroup.scale.setScalar(chuteOpen);

          this.splashdownOcean.visible = true;
          this.earthGlobe.position.y = -1120 - 300 * (1 - t);
          this.textures.oceanWaterMap.offset.x = (this.textures.oceanWaterMap.offset.x + dt * 0.04) % 1;

          if (t > 0.94) {
            for (let w = 0; w < 3; w++) {
              const a = Math.random() * Math.PI * 2;
              this.spawnParticle(
                _vec3d.set(rocket.root.position.x + Math.cos(a) * 2.5, 8.6, rocket.root.position.z + Math.sin(a) * 2.5),
                _vec3c.set(Math.cos(a) * 7, 5 + Math.random() * 5, Math.sin(a) * 7),
                0.7,
                1.8,
                5.2,
                0xffffff,
                0xbae6fd,
                'smoke',
              );
            }
          }
        }

        if (this.phaseTimer >= duration) {
          this.finalizeMissionComplete();
        }
        break;
      }

      case 'MISSION_COMPLETE':
      case 'MISSION_FAILED': {
        this.audio.updateThrust(0, 0);
        this.audio.updateRcsHiss(false);
        this.enginePointLight.intensity = 0;
        this.throttle = 0;
        this.accelerationMs2 = 0;
        break;
      }
    }

    // Active Deep Space Network Downlink Stream (powered by configured dataRateKbps)
    if (this.dataQueuedMb > 0 && this.commsSignalPct > 25) {
      const txMb = Math.min(this.dataQueuedMb, (this.metrics.dataRateKbps / 42) * dt);
      this.dataQueuedMb -= txMb;
      this.dataTransmittedMb += txMb;
    }

    this.updateParticles(dt);
    this.updateCamera(rawDt);

    const now = performance.now();
    if (now - this.lastTelemetryEmit > 55) {
      this.emitTelemetry();
      this.lastTelemetryEmit = now;
    }
  }

  private updateLunarDescent(dt: number): void {
    const rocket = this.rocket;
    if (!rocket) return;

    this.altitudeReference = 'MOON';
    const groundY = this.sampleLunarHeight(this.landerPos.x, this.landerPos.z);
    const radarAlt = Math.max(0, this.landerPos.y - groundY - 0.5);

    if (this.descentLaserRing) {
      this.descentLaserRing.visible = true;
      this.descentLaserRing.position.set(this.landerPos.x, groundY + 0.16, this.landerPos.z);
      this.descentLaserRing.rotation.z -= dt * 2.2;
    }

    if (radarAlt < 65 && !this.gearDeployed && this.autopilotEnabled) {
      this.gearDeployed = true;
    }
    for (const leg of rocket.landerLegs) {
      const targetFold = this.gearDeployed ? 0 : 0.45;
      leg.rotation.z = THREE.MathUtils.damp(leg.rotation.z, targetFold, 5, dt);
    }

    const manualSteer =
      this.isKeyHeld('KeyW') ||
      this.isKeyHeld('KeyS') ||
      this.isKeyHeld('KeyA') ||
      this.isKeyHeld('KeyD') ||
      this.isKeyHeld('KeyQ') ||
      this.isKeyHeld('KeyE') ||
      this.isKeyHeld('ArrowUp') ||
      this.isKeyHeld('ArrowDown') ||
      this.isKeyHeld('ArrowLeft') ||
      this.isKeyHeld('ArrowRight');

    if (this.isKeyHeld('KeyR') || this.isKeyHeld('ShiftLeft')) {
      this.throttle = Math.min(1, this.throttle + 0.68 * dt);
    }
    if (this.isKeyHeld('KeyF') || this.isKeyHeld('ControlLeft')) {
      this.throttle = Math.max(0, this.throttle - 0.68 * dt);
    }

    if (this.isKeyHeld('KeyA') || this.isKeyHeld('ArrowLeft')) {
      this.landerRoll = Math.min(0.45, this.landerRoll + 0.85 * dt);
    } else if (this.isKeyHeld('KeyD') || this.isKeyHeld('ArrowRight')) {
      this.landerRoll = Math.max(-0.45, this.landerRoll - 0.85 * dt);
    } else if (this.isKeyHeld('KeyW') || this.isKeyHeld('ArrowUp')) {
      this.landerPitch = Math.min(0.45, this.landerPitch + 0.85 * dt);
    } else if (this.isKeyHeld('KeyS') || this.isKeyHeld('ArrowDown')) {
      this.landerPitch = Math.max(-0.45, this.landerPitch - 0.85 * dt);
    } else if (this.autopilotEnabled) {
      const dx = this.targetZonePos.x - this.landerPos.x;
      const dz = this.targetZonePos.z - this.landerPos.z;
      const desiredVx = THREE.MathUtils.clamp(dx * 0.16, -6, 6);
      const desiredVz = THREE.MathUtils.clamp(dz * 0.16, -6, 6);
      this.landerRoll = THREE.MathUtils.clamp((this.landerVel.x - desiredVx) * 0.08, -0.32, 0.32);
      this.landerPitch = THREE.MathUtils.clamp(-(this.landerVel.z - desiredVz) * 0.08, -0.32, 0.32);
    } else {
      this.landerRoll = THREE.MathUtils.damp(this.landerRoll, 0, 2.0, dt);
      this.landerPitch = THREE.MathUtils.damp(this.landerPitch, 0, 2.0, dt);
    }

    this.rcsActive = manualSteer;
    this.audio.updateRcsHiss(manualSteer);

    if (this.autopilotEnabled && !this.isKeyHeld('KeyR') && !this.isKeyHeld('KeyF') && !this.isKeyHeld('ShiftLeft') && !this.isKeyHeld('ControlLeft')) {
      const targetSink = radarAlt > 60 ? -5.8 : radarAlt > 22 ? -3.0 : radarAlt > 6 ? -1.7 : -1.05;
      const err = targetSink - this.landerVel.y;
      const hoverThrottle = 1.62 / 4.4;
      this.throttle = THREE.MathUtils.clamp(hoverThrottle + err * 0.24, 0.08, 1.0);
    }

    if (this.landerFuelPct <= 0.1) {
      this.landerFuelPct = 0;
      this.throttle = 0;
    } else {
      this.landerFuelPct = Math.max(0, this.landerFuelPct - this.throttle * 2.1 * dt);
    }

    const thrustAccel = this.throttle * 4.4;
    _euler.set(this.landerPitch, 0, this.landerRoll, 'YXZ');
    _quat.setFromEuler(_euler);
    _vec3.set(0, 1, 0).applyQuaternion(_quat).multiplyScalar(thrustAccel);

    this.landerVel.x += _vec3.x * dt;
    this.landerVel.z += _vec3.z * dt;
    this.landerVel.y += (_vec3.y - 1.62) * dt;
    this.landerPos.addScaledVector(this.landerVel, dt);

    rocket.root.position.copy(this.landerPos);
    rocket.root.quaternion.copy(_quat);

    this.altitudeKm = radarAlt / 1000;
    this.velocityMs = this.landerVel.length();
    this.accelerationMs2 = thrustAccel - 1.62;
    this.gForce = Number((thrustAccel / 9.80665).toFixed(2));
    this.pitchRad = this.landerPitch;
    this.rollRad = this.landerRoll;

    if (this.throttle > 0.06) {
      this.emitExhaust(rocket.landerNozzleLocal, 2, true, false);
      this.enginePointLight.position.copy(this.landerPos);
      this.enginePointLight.intensity = 10 * this.throttle;

      if (radarAlt < 42) {
        const dustStrength = (1 - radarAlt / 42) * this.throttle;
        const dustCount = Math.ceil(dustStrength * 4);
        for (let i = 0; i < dustCount; i++) {
          const a = Math.random() * Math.PI * 2;
          const speed = (6 + Math.random() * 15) * dustStrength;
          this.spawnParticle(
            _vec3d.set(this.landerPos.x + Math.cos(a) * 1.4, groundY + 0.35, this.landerPos.z + Math.sin(a) * 1.4),
            _vec3c.set(Math.cos(a) * speed, 0.8 + Math.random() * 2.4, Math.sin(a) * speed),
            0.85,
            2.4,
            8.2,
            0x9ca3af,
            0x4b5563,
            'dust',
          );
        }
      }
    } else {
      this.enginePointLight.intensity = 0;
    }

    this.audio.updateThrust(this.throttle, 0.03);

    if (this.landerPos.y <= groundY + 0.52) {
      this.landerPos.y = groundY + 0.52;
      rocket.root.position.copy(this.landerPos);
      if (this.descentLaserRing) this.descentLaserRing.visible = false;

      const vSpeed = Math.abs(this.landerVel.y);
      const hSpeed = Math.hypot(this.landerVel.x, this.landerVel.z);
      const tiltDeg = THREE.MathUtils.radToDeg(Math.max(Math.abs(this.landerPitch), Math.abs(this.landerRoll)));
      const distTarget = Math.hypot(this.landerPos.x - this.targetZonePos.x, this.landerPos.z - this.targetZonePos.z);

      this.throttle = 0;
      this.enginePointLight.intensity = 0;
      this.audio.updateThrust(0, 0);
      this.audio.updateRcsHiss(false);

      if (vSpeed > 4.6 || hSpeed > 3.5 || tiltDeg > 18 || (!this.gearDeployed && vSpeed > 1.8)) {
        this.transitionPhase('MISSION_FAILED');
        this.landingGrade = 'CRASH';
        this.landingScore = 0;
        this.safetyScore = 15;
        this.audio.playTouchdown(true);
        this.outcomeMessage = `Hard impact on lunar regolith (Sink ${vSpeed.toFixed(1)} m/s, Tilt ${tiltDeg.toFixed(1)}°). Structural failure.`;
      } else {
        this.transitionPhase('SURFACE_OPS');
        this.surfaceOpsProgress = 0;
        this.landerVel.set(0, 0, 0);
        this.velocityMs = 0;
        this.altitudeKm = 0;
        rocket.root.rotation.set(0, 0, 0);
        this.audio.playTouchdown(false);
        this.audio.playQuindarBeep(true);
        this.deploySurfaceScience();
        this.cameraPreset = 'chase';
        this.userCameraActive = false;
        const surfaceOpsHint = this.mission.id === 'surveyor-3'
          ? 'Use the Surveyor operations panel to pan the TV camera and command the soil sampler.'
          : this.surfaceRover
            ? 'Drive the Apollo 17 Lunar Roving Vehicle to the geology waypoints (WASD).'
            : 'Walk the Apollo 11 EVA route (WASD), collect sample stops, and deploy the EASEP.';

        if (vSpeed <= 2.1 && distTarget <= 18) {
          this.landingGrade = 'PRECISION';
          this.landingScore = 98;
          this.outcomeMessage = `${this.mission.landerName} touched down ${distTarget.toFixed(0)}m from the target. ${surfaceOpsHint}`;
        } else if (vSpeed <= 3.3) {
          this.landingGrade = 'NOMINAL';
          this.landingScore = 84;
          this.outcomeMessage = `Nominal lunar touchdown (${distTarget.toFixed(0)}m from target). ${surfaceOpsHint}`;
        } else {
          this.landingGrade = 'HARD';
          this.landingScore = 66;
          this.safetyScore = Math.max(60, this.safetyScore - 15);
          this.outcomeMessage = `Firm touchdown (${vSpeed.toFixed(1)} m/s sink). Lander upright. ${surfaceOpsHint}`;
        }
      }
      this.emitTelemetry();
    }
  }

  private updateParticles(dt: number): void {
    for (let i = 0; i < this.MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) {
        this.pSizes[i] = 0;
        continue;
      }
      p.age += dt;
      if (p.age >= p.maxAge) {
        p.active = false;
        this.pSizes[i] = 0;
        continue;
      }
      p.pos.addScaledVector(p.vel, dt);
      const t = p.age / p.maxAge;
      this.pPositions[i * 3] = p.pos.x;
      this.pPositions[i * 3 + 1] = p.pos.y;
      this.pPositions[i * 3 + 2] = p.pos.z;

      _color.copy(p.colorStart).lerp(p.colorEnd, t);
      const fade = p.kind === 'flame' || p.kind === 'rcs' || p.kind === 'spark' ? 1 - t : Math.sin((1 - t) * Math.PI * 0.5);
      this.pColors[i * 3] = _color.r * fade;
      this.pColors[i * 3 + 1] = _color.g * fade;
      this.pColors[i * 3 + 2] = _color.b * fade;
      this.pSizes[i] = THREE.MathUtils.lerp(p.sizeStart, p.sizeEnd, t);
    }
    this.syncParticleBuffers();
  }

  private syncParticleBuffers(): void {
    this.particleGeo.attributes.position.needsUpdate = true;
    this.particleGeo.attributes.color.needsUpdate = true;
    this.particleGeo.attributes.size.needsUpdate = true;
  }

  private updateCamera(dt: number): void {
    if (!this.rocket || this.userCameraActive || this.cameraPreset === 'free') {
      this.controls.update();
      return;
    }

    const isSurfaceExplorer =
      this.phase === 'SURFACE_OPS' && Boolean(this.surfaceRover || this.surfaceEva);
    const rPos = isSurfaceExplorer ? this.roverPos : this.rocket.root.position;
    const targetPos = _vec3.copy(rPos);
    const camGoal = _vec3b.copy(rPos);

    const isLunarOrbitalPhase =
      this.phase === 'LUNAR_APPROACH' ||
      this.phase === 'LUNAR_ORBIT' ||
      this.phase === 'LUNAR_ORBIT_SURVEY' ||
      this.phase === 'LUNAR_RENDEZVOUS' ||
      this.phase === 'RETURN_JOURNEY';

    const isLunarSurfaceOrTerminalPhase =
      this.phase === 'LUNAR_DESCENT' ||
      this.phase === 'SURFACE_OPS' ||
      this.phase === 'LUNAR_ASCENT' ||
      this.phase === 'MISSION_COMPLETE' ||
      this.phase === 'MISSION_FAILED';

    if (this.cameraPreset === 'cockpit') {
      if (isSurfaceExplorer && this.surfaceRover) {
        const fwdX = Math.sin(this.roverHeading);
        const fwdZ = Math.cos(this.roverHeading);
        targetPos.set(rPos.x + fwdX * 14, rPos.y + 1.2, rPos.z + fwdZ * 14);
        camGoal.set(rPos.x - fwdX * 0.4, rPos.y + 2.0, rPos.z - fwdZ * 0.4);
      } else if (isSurfaceExplorer && this.surfaceEva) {
        const fwdX = Math.sin(this.roverHeading);
        const fwdZ = Math.cos(this.roverHeading);
        targetPos.set(rPos.x + fwdX * 3.5, rPos.y + 1.1, rPos.z + fwdZ * 3.5);
        camGoal.set(rPos.x - fwdX * 0.15, rPos.y + 1.65, rPos.z - fwdZ * 0.15);
      } else if (isLunarSurfaceOrTerminalPhase) {
        targetPos.set(rPos.x + 2, rPos.y - 12, rPos.z + 10);
        camGoal.set(rPos.x, rPos.y + 3.2, rPos.z + 1.8);
      } else {
        targetPos.set(rPos.x + 12, rPos.y + 36, rPos.z - 8);
        camGoal.set(rPos.x, rPos.y + 42, rPos.z + 2.2);
      }
    } else if (this.cameraPreset === 'cinematic') {
      const swing = this.missionTime * 0.16;
      const dist = isSurfaceExplorer ? (this.surfaceRover ? 14 : 7) : isLunarOrbitalPhase || isLunarSurfaceOrTerminalPhase ? 26 : 58;
      targetPos.y += isLunarOrbitalPhase || isLunarSurfaceOrTerminalPhase ? 1.5 : 20;
      camGoal.set(
        rPos.x + Math.cos(swing) * dist,
        rPos.y + (isSurfaceExplorer ? (this.surfaceRover ? 5.5 : 3) : isLunarOrbitalPhase ? 10 : 28),
        rPos.z + Math.sin(swing) * dist,
      );
    } else if (this.phase === 'PRELAUNCH' || this.phase === 'COUNTDOWN') {
      targetPos.y += 20;
      if (this.cameraPreset === 'orbital') camGoal.set(95, 58, 120);
      else if (this.cameraPreset === 'stage') {
        targetPos.y += 12;
        camGoal.set(22, 34, 28);
      } else if (this.cameraPreset === 'lander') {
        targetPos.y += 24;
        camGoal.set(16, 46, 22);
      } else camGoal.set(42, 24, 54);
    } else if (isSurfaceExplorer) {
      const backX = Math.sin(this.roverHeading);
      const backZ = Math.cos(this.roverHeading);
      if (this.cameraPreset === 'orbital') {
        targetPos.y += 1.2;
        camGoal.set(rPos.x + 26, rPos.y + 18, rPos.z + 28);
      } else {
        const cameraDistance = this.surfaceRover ? 4 : 1.7;
        const cameraHeight = this.surfaceRover ? 1.4 : 1.35;
        const lookAhead = this.surfaceRover ? 9.5 : 4.2;
        const lookHeight = this.surfaceRover ? 4.4 : 2.4;
        targetPos.set(rPos.x + backX * cameraDistance, rPos.y + cameraHeight, rPos.z + backZ * cameraDistance);
        camGoal.set(rPos.x - backX * lookAhead, rPos.y + lookHeight, rPos.z - backZ * lookAhead);
      }
    } else if (isLunarOrbitalPhase) {
      targetPos.y += 1.5;
      if (this.cameraPreset === 'orbital') camGoal.set(rPos.x + 34, rPos.y + 14, rPos.z + 48);
      else if (this.cameraPreset === 'stage') camGoal.set(rPos.x - 12, rPos.y + 4, rPos.z + 15);
      else if (this.cameraPreset === 'chase') camGoal.set(rPos.x - 20, rPos.y + 6, rPos.z + 18);
      else camGoal.set(rPos.x + 16, rPos.y + 7, rPos.z + 24);
    } else if (isLunarSurfaceOrTerminalPhase) {
      targetPos.y += 1.5;
      if (this.cameraPreset === 'orbital') camGoal.set(rPos.x + 36, rPos.y + 22, rPos.z + 44);
      else if (this.cameraPreset === 'stage') camGoal.set(rPos.x - 11, rPos.y + 5, rPos.z + 13);
      else if (this.cameraPreset === 'chase') camGoal.set(rPos.x + 18, rPos.y + 12, rPos.z - 16);
      else camGoal.set(rPos.x + 15, rPos.y + 8.5, rPos.z + 20);
    } else if (this.phase === 'EARTH_REENTRY') {
      targetPos.y += 1.5;
      camGoal.set(rPos.x + 16, rPos.y + 6, rPos.z + 22);
    } else if (this.cameraPreset === 'stage') {
      targetPos.y += 22;
      camGoal.set(rPos.x - 24, rPos.y + 10, rPos.z + 44);
    } else if (this.cameraPreset === 'orbital') {
      targetPos.y += 18;
      camGoal.set(rPos.x + 65, rPos.y + 28, rPos.z + 78);
    } else if (this.cameraPreset === 'lander') {
      targetPos.y += 32;
      camGoal.set(rPos.x + 16, rPos.y + 34, rPos.z + 26);
    } else {
      targetPos.y += 18;
      camGoal.set(rPos.x + 36, rPos.y + 12, rPos.z + 48);
    }

    this.controls.target.x = THREE.MathUtils.damp(this.controls.target.x, targetPos.x, 7, dt);
    this.controls.target.y = THREE.MathUtils.damp(this.controls.target.y, targetPos.y, 7, dt);
    this.controls.target.z = THREE.MathUtils.damp(this.controls.target.z, targetPos.z, 7, dt);

    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, camGoal.x, 5.2, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, camGoal.y, 5.2, dt);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, camGoal.z, 5.2, dt);

    this.controls.update();
  }

  private computeSubScores(): {
    fuelScore: number;
    navScore: number;
    scienceTotalScore: number;
    overallScore: number;
    missionAwardRank: string;
  } {
    const fuelRef = this.mission.hasLunarLanding ? (this.stageFuelPct * 0.5 + this.landerFuelPct * 0.5) : this.stageFuelPct;
    const fuelScore = Math.round(THREE.MathUtils.clamp(fuelRef * 1.15, 25, 100));
    const navScore = Math.round(
      THREE.MathUtils.clamp(100 - this.trajectoryErrorDeg * 16 + (this.mccExecuted ? 10 : 0), 35, 100),
    );
    const scienceTotalScore = this.metrics.scienceScore + this.bonusScienceEarned;
    const landPart = this.mission.hasLunarLanding ? this.landingScore : Math.round((this.orbitTasksDone.filter(Boolean).length / 3) * 100);
    const overallScore = Math.round(
      fuelScore * 0.25 + navScore * 0.25 + landPart * 0.25 + this.safetyScore * 0.25,
    );
    const missionAwardRank =
      this.landingGrade === 'CRASH'
        ? 'Flight Review Required'
        : overallScore >= 90
          ? 'NASA Gold Wing'
          : overallScore >= 78
            ? 'Flight Director Distinction'
            : overallScore >= 62
              ? 'Mission Qualified'
              : 'Flight Review Required';
    return { fuelScore, navScore, scienceTotalScore, overallScore, missionAwardRank };
  }

  private emitTelemetry(): void {
    const groundY = this.lunarTerrainBuilt ? this.sampleLunarHeight(this.landerPos.x, this.landerPos.z) : 0;
    const lunarAlt = this.lunarTerrainBuilt ? Math.max(0, this.landerPos.y - groundY - 0.52) : 0;
    const distTarget = this.lunarTerrainBuilt
      ? Math.hypot(this.landerPos.x - this.targetZonePos.x, this.landerPos.z - this.targetZonePos.z)
      : 0;

    let nearestDist = 0;
    let nearestBearingDeg = 0;
    if (this.phase === 'SURFACE_OPS' && (this.surfaceRover || this.surfaceEva) && this.sampleNodes.length > 0) {
      let bestDist = Infinity;
      let bestNode: SurfaceSampleNode | null = null;
      for (const n of this.sampleNodes) {
        if (n.collected) continue;
        const d = Math.hypot(n.x - this.roverPos.x, n.z - this.roverPos.z);
        if (d < bestDist) {
          bestDist = d;
          bestNode = n;
        }
      }
      if (bestNode) {
        nearestDist = bestDist;
        const worldAngle = Math.atan2(bestNode.x - this.roverPos.x, bestNode.z - this.roverPos.z);
        let rel = THREE.MathUtils.radToDeg(worldAngle - this.roverHeading);
        while (rel > 180) rel -= 360;
        while (rel < -180) rel += 360;
        nearestBearingDeg = Math.round(-rel);
      }
    }

    const deltaVRemainingMs = Math.round(
      (this.metrics.availableDeltaV * (this.stageFuelPct / 100)) * 0.72 +
        (this.landerFuelPct / 100) * 1400,
    );
    const scores = this.computeSubScores();
    let dynamicPhaseLabel = PHASE_LABELS[this.phase];
    if (this.mission?.isDeepSpaceL2) {
      if (this.phase === 'EARTH_DEPARTURE') dynamicPhaseLabel = 'Earth Departure & L2 Injection';
      else if (this.phase === 'TRANSLUNAR_CRUISE') dynamicPhaseLabel = 'Deep Space L2 Transfer & Nav';
      else if (this.phase === 'LUNAR_APPROACH') dynamicPhaseLabel = 'Sun-Earth L2 Halo Approach';
      else if (this.phase === 'LUNAR_ORBIT') dynamicPhaseLabel = 'Sun-Earth L2 Halo Orbit (1.5M km)';
      else if (this.phase === 'LUNAR_ORBIT_SURVEY') dynamicPhaseLabel = 'Sunshield & 18-Mirror Calibration';
    } else if (this.mission?.id === 'lunar-orbiter-1' && this.phase === 'LUNAR_ORBIT_SURVEY') {
      dynamicPhaseLabel = 'Equatorial Lunar Mapping & Photo Survey';
    }

    this.onTelemetry({
      phase: this.phase,
      phaseLabel: dynamicPhaseLabel,
      activeStageName: this.activeStageName,
      missionTimeSec: this.missionTime,
      countdownSec: this.countdownSec,
      altitudeKm: this.altitudeKm,
      altitudeReference: this.altitudeReference,
      lunarAltitudeM: lunarAlt,
      earthDistanceKm: this.earthDistanceKm,
      moonDistanceKm: this.moonDistanceKm,
      velocityMs: this.velocityMs,
      verticalSpeedMs: this.landerVel.y,
      horizontalSpeedMs: Math.hypot(this.landerVel.x, this.landerVel.z),
      downrangeKm: this.downrangeKm,
      machNumber: this.machNumber,
      stageFuelPct: this.stageFuelPct,
      landerFuelPct: this.landerFuelPct,
      deltaVRemainingMs,
      powerBusPct: this.powerBusPct,
      commsSignalPct: this.commsSignalPct,
      trajectoryErrorDeg: Number(this.trajectoryErrorDeg.toFixed(2)),
      throttle: this.throttle,
      pitchDeg: Math.round(THREE.MathUtils.radToDeg(this.pitchRad)),
      yawDeg: Math.round(THREE.MathUtils.radToDeg(this.yawRad)),
      rollDeg: Math.round(THREE.MathUtils.radToDeg(this.rollRad)),
      gearDeployed: this.gearDeployed,
      autopilotEnabled: this.autopilotEnabled,
      rcsActive: this.rcsActive,
      isPaused: this.isPaused,
      accelerationMs2: this.accelerationMs2,
      gForce: this.gForce,
      distanceToTargetM: distTarget,
      surfaceOpsProgress: this.surfaceOpsProgress,
      surfaceSamplesCollected: this.surfaceSamplesCollected,
      surfaceSamplesTotal: this.mission.id === 'surveyor-3'
        ? SURVEYOR_SURFACE_TASKS.length
        : this.sampleNodes.length || 5,
      surfaceTasksDone: [...this.surfaceTasksDone],
      surfaceInstrumentsDeployed: this.surfaceInstrumentsDeployed,
      roverDistanceM: Math.round(this.roverDistanceM),
      nearestDiscoveryDistM: Math.round(nearestDist),
      nearestDiscoveryBearingDeg: nearestBearingDeg,
      dataQueuedMb: Number(this.dataQueuedMb.toFixed(1)),
      dataTransmittedMb: Number(this.dataTransmittedMb.toFixed(1)),
      downlinkRateKbps: this.metrics.dataRateKbps,
      gatesPassed: this.gatesPassed,
      gatesTotal: this.cislunarGates.length,
      latestDiscovery: this.latestDiscovery,
      orbitTasksDone: [...this.orbitTasksDone],
      systemsStatus: { ...this.systemsStatus },
      maneuverPending: this.maneuverPending ? { ...this.maneuverPending } : null,
      fuelScore: scores.fuelScore,
      navScore: scores.navScore,
      landingScore: this.landingScore,
      scienceTotalScore: scores.scienceTotalScore,
      safetyScore: this.safetyScore,
      overallScore: scores.overallScore,
      missionAwardRank: scores.missionAwardRank,
      outcomeMessage: this.outcomeMessage,
      landingGrade: this.landingGrade,
    });
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick = (): void => {
    if (this.disposed) return;
    const dt = this.clock.getDelta();
    this.updateSimulation(dt);
    if (this.composer && !this.isSoftwareGl) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private handleResize = (): void => {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    if (this.composer) {
      this.composer.setSize(width, height);
    }
    if (this.bloomPass) {
      this.bloomPass.resolution.set(width, height);
    }
  };

  private disposeObject(obj: THREE.Object3D): void {
    obj.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        m.geometry?.dispose();
        if (Array.isArray(m.material)) {
          m.material.forEach((mt) => mt.dispose());
        } else {
          m.material?.dispose();
        }
      }
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.removeEventListener('resize', this.handleResize);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.handleContextRestored);
    this.controls.dispose();
    this.audio.dispose();
    this.textures.dispose();
    this.particleGeo.dispose();
    if (this.cloudBankMesh) {
      this.cloudBankMesh.geometry.dispose();
    }
    this.composer?.dispose();
    this.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.geometry?.dispose();
        if (Array.isArray(m.material)) m.material.forEach((mt) => mt.dispose());
        else m.material?.dispose();
      }
    });
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
