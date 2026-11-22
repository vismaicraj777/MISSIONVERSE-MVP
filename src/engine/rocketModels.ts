import * as THREE from 'three';
import { MissionConfig } from '../data/missions';
import {
  areNasaModelsLoaded,
  getNasaModelClone,
  normalizeNasaGroup,
  splitObjectTriangles,
} from './nasaModelLoader';
import { ProceduralTextureSet } from './proceduralTextures';

export interface RocketAssembly {
  root: THREE.Group;
  stage1: THREE.Group;
  stage2: THREE.Group;
  stage3: THREE.Group;
  lesTower: THREE.Group | null;
  fairingLeft: THREE.Group | null;
  fairingRight: THREE.Group | null;
  slaPetals: THREE.Group[];
  csm: THREE.Group | null;
  csmServiceModule: THREE.Group | null;
  csmCommandModule: THREE.Group | null;
  lander: THREE.Group;
  lmDescentStage: THREE.Group | null;
  lmAscentStage: THREE.Group | null;
  landerLegs: THREE.Group[];
  stage1Nozzles: THREE.Vector3[];
  stage2Nozzles: THREE.Vector3[];
  stage3Nozzles: THREE.Vector3[];
  landerNozzleLocal: THREE.Vector3;
  lmAscentNozzleLocal: THREE.Vector3;
  csmNozzleLocal: THREE.Vector3;
  isBallastOnly: boolean;
  totalHeight: number;
  landerHeightOffset: number;
}

export interface LaunchTowerAssembly {
  root: THREE.Group;
  swingArms: THREE.Group[];
  beaconLight: THREE.Mesh;
}

/**
 * Contoured parabolic aerospace rocket engine bell using LatheGeometry.
 */
function createEngineBell(
  topRadius: number,
  bottomRadius: number,
  height: number,
  material: THREE.Material,
): THREE.Group {
  const grp = new THREE.Group();
  const points: THREE.Vector2[] = [];
  const steps = 10;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps; // 0 = bottom lip, 1 = top throat
    const y = t * height;
    // Parabolic bell expansion curve
    const flare = Math.pow(1 - t, 0.72);
    const r = topRadius * 0.65 + (bottomRadius - topRadius * 0.65) * flare;
    points.push(new THREE.Vector2(r, y));
  }
  const bellGeo = new THREE.LatheGeometry(points, 20);
  const bell = new THREE.Mesh(bellGeo, material);
  bell.castShadow = true;
  bell.receiveShadow = true;
  grp.add(bell);

  // Inner combustion throat glow collar
  const throatGeo = new THREE.CylinderGeometry(topRadius * 0.62, topRadius * 0.85, height * 0.25, 16);
  const throatMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.5,
    metalness: 0.7,
  });
  const throat = new THREE.Mesh(throatGeo, throatMat);
  throat.position.y = height * 0.85;
  grp.add(throat);

  return grp;
}

export function buildLaunchTower(textures: ProceduralTextureSet): LaunchTowerAssembly {
  const root = new THREE.Group();

  const mlRaw = areNasaModelsLoaded() ? getNasaModelClone('mobileLauncher') : null;
  if (mlRaw) {
    const mlNorm = normalizeNasaGroup(mlRaw, {
      targetHeight: 62,
      baseY: 0,
      centerXZ: false,
      euler: new THREE.Euler(0, Math.PI, 0),
    });
    // Align Mobile Launcher deck height (~7.5u) & tower clearance beside rocket centerline (0,0,0)
    const box = new THREE.Box3().setFromObject(mlNorm);
    const center = new THREE.Vector3();
    box.getCenter(center);
    mlNorm.position.set(-center.x - 4.2, 0, -center.z);
    root.add(mlNorm);

    const concreteMat = new THREE.MeshStandardMaterial({
      color: 0x949ba5,
      roughness: 0.9,
      metalness: 0.05,
      map: textures.padGroundMap,
    });
    const mound = new THREE.Mesh(new THREE.CylinderGeometry(22, 28, 3.8, 8), concreteMat);
    mound.position.set(0, 1.9, 0);
    mound.receiveShadow = true;
    root.add(mound);

    const beaconMat = new THREE.MeshStandardMaterial({
      color: 0xff2a2a,
      emissive: 0xff1e1e,
      emissiveIntensity: 2.0,
      roughness: 0.2,
    });
    const beaconLight = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 12), beaconMat);
    beaconLight.position.set(-8.6, 62.2, 0);
    root.add(beaconLight);

    return { root, swingArms: [], beaconLight };
  }

  const concreteMat = new THREE.MeshStandardMaterial({
    color: 0x949ba5,
    roughness: 0.9,
    metalness: 0.05,
    map: textures.padGroundMap,
  });

  const steelRedMat = new THREE.MeshStandardMaterial({
    color: 0xc23b2b,
    roughness: 0.52,
    metalness: 0.45,
  });

  const darkSteelMat = new THREE.MeshStandardMaterial({
    color: 0x1e2530,
    roughness: 0.58,
    metalness: 0.65,
  });

  const platformMat = new THREE.MeshStandardMaterial({
    color: 0x525c6b,
    roughness: 0.55,
    metalness: 0.55,
  });

  // Pad concrete apron & raised octagonal pad mound
  const mound = new THREE.Mesh(new THREE.CylinderGeometry(20, 26, 4.6, 8), concreteMat);
  mound.position.set(0, 2.3, 0);
  mound.receiveShadow = true;
  mound.castShadow = true;
  root.add(mound);

  // Flame Trench channel cutting across the pad
  const trench = new THREE.Mesh(new THREE.BoxGeometry(10.5, 2.6, 46), darkSteelMat);
  trench.position.set(0, 1.3, 0);
  root.add(trench);

  // Flame Deflector Wedge directly beneath the exhaust aperture
  const deflector = new THREE.Mesh(new THREE.ConeGeometry(4.2, 3.6, 4), darkSteelMat);
  deflector.rotation.y = Math.PI / 4;
  deflector.position.set(0, 2.2, 0);
  root.add(deflector);

  // Mobile Launcher Platform (MLP)
  const mlp = new THREE.Mesh(new THREE.BoxGeometry(19, 2.7, 23), platformMat);
  mlp.position.set(-1.6, 5.9, 0);
  mlp.castShadow = true;
  mlp.receiveShadow = true;
  root.add(mlp);

  // Blast Aperture Ring
  const exhaustRing = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 4.1, 0.9, 24, 1, true), darkSteelMat);
  exhaustRing.position.set(0, 7.35, 0);
  root.add(exhaustRing);

  // 4 Hold-Down Arms
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2 + Math.PI / 4;
    const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.1, 1.1), darkSteelMat);
    clamp.position.set(Math.cos(angle) * 3.1, 7.9, Math.sin(angle) * 3.1);
    clamp.rotation.y = -angle;
    clamp.castShadow = true;
    root.add(clamp);
  }

  // Launch Umbilical Tower (LUT) Lattice Structure at x = -8.6
  const towerX = -8.6;
  const towerBaseY = 7.25;
  const towerHeight = 46;
  const levels = 11;
  const levelH = towerHeight / levels;

  const colOffsets = [
    [-2.4, -2.4],
    [2.4, -2.4],
    [-2.4, 2.4],
    [2.4, 2.4],
  ];
  for (const [cx, cz] of colOffsets) {
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.5, towerHeight, 0.5), steelRedMat);
    col.position.set(towerX + cx, towerBaseY + towerHeight / 2, cz);
    col.castShadow = true;
    root.add(col);
  }

  // Elevator shaft core
  const core = new THREE.Mesh(new THREE.BoxGeometry(1.9, towerHeight, 1.9), platformMat);
  core.position.set(towerX - 0.6, towerBaseY + towerHeight / 2, 0);
  core.castShadow = true;
  root.add(core);

  // Horizontal deck levels & diagonal steel cross-braces
  const diagLen = Math.hypot(4.8, levelH);
  const diagAngle = Math.atan2(levelH, 4.8);
  for (let i = 0; i <= levels; i++) {
    const y = towerBaseY + i * levelH;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(5.3, 0.34, 5.3), platformMat);
    deck.position.set(towerX, y, 0);
    deck.castShadow = true;
    root.add(deck);

    if (i < levels) {
      const midY = y + levelH * 0.5;
      for (const sideZ of [-2.4, 2.4]) {
        const brace = new THREE.Mesh(new THREE.BoxGeometry(diagLen, 0.16, 0.16), steelRedMat);
        brace.position.set(towerX, midY, sideZ);
        brace.rotation.z = i % 2 === 0 ? diagAngle : -diagAngle;
        root.add(brace);
      }
      for (const sideX of [-2.4, 2.4]) {
        const brace = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, diagLen), steelRedMat);
        brace.position.set(towerX + sideX, midY, 0);
        brace.rotation.x = i % 2 === 0 ? diagAngle : -diagAngle;
        root.add(brace);
      }
    }
  }

  // Hammerhead Crane & Lightning Mast
  const craneBoom = new THREE.Mesh(new THREE.BoxGeometry(9.6, 1.1, 1.5), steelRedMat);
  craneBoom.position.set(towerX + 1.6, towerBaseY + towerHeight + 0.9, 0);
  craneBoom.castShadow = true;
  root.add(craneBoom);

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.25, 8.2, 8), darkSteelMat);
  mast.position.set(towerX, towerBaseY + towerHeight + 4.8, 0);
  root.add(mast);

  // Aviation warning beacon at mast top
  const beaconMat = new THREE.MeshStandardMaterial({
    color: 0xff2a2a,
    emissive: 0xff1e1e,
    emissiveIntensity: 2.0,
    roughness: 0.2,
  });
  const beaconLight = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 12), beaconMat);
  beaconLight.position.set(towerX, towerBaseY + towerHeight + 9.0, 0);
  root.add(beaconLight);

  // Retractable Umbilical Swing Arms + White Crew Access Room
  const swingArms: THREE.Group[] = [];
  const armHeights = [19, 30, 39];
  for (let i = 0; i < armHeights.length; i++) {
    const armPivot = new THREE.Group();
    armPivot.position.set(towerX + 2.3, armHeights[i], 0.8);

    const armBeam = new THREE.Mesh(
      new THREE.BoxGeometry(5.9, 0.48, 0.56),
      i === 2
        ? new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4, metalness: 0.2 })
        : steelRedMat,
    );
    armBeam.position.set(2.95, 0, -0.4);
    armBeam.castShadow = true;
    armPivot.add(armBeam);

    if (i === 2) {
      const whiteRoom = new THREE.Mesh(
        new THREE.BoxGeometry(1.7, 1.6, 1.6),
        new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45, metalness: 0.12 }),
      );
      whiteRoom.position.set(5.45, 0, -0.7);
      armPivot.add(whiteRoom);
    }

    root.add(armPivot);
    swingArms.push(armPivot);
  }

  return { root, swingArms, beaconLight };
}

function buildDetailedLander(
  mission: MissionConfig,
  textures: ProceduralTextureSet,
): {
  lander: THREE.Group;
  lmDescentStage: THREE.Group | null;
  lmAscentStage: THREE.Group | null;
  legs: THREE.Group[];
  nozzleLocal: THREE.Vector3;
  ascentNozzleLocal: THREE.Vector3;
  isBallastOnly: boolean;
  height: number;
} {
  const lander = new THREE.Group();
  const legs: THREE.Group[] = [];

  const goldFoilMat = new THREE.MeshStandardMaterial({
    map: textures.goldFoilMap,
    bumpMap: textures.goldFoilBump,
    bumpScale: 0.06,
    roughness: 0.34,
    metalness: 0.82,
  });

  const titaniumMat = new THREE.MeshStandardMaterial({
    color: 0xd8e0ea,
    roughness: 0.38,
    metalness: 0.65,
  });

  const darkCarbonMat = new THREE.MeshStandardMaterial({
    color: 0x1e2530,
    roughness: 0.58,
    metalness: 0.5,
  });

  const solarMat = new THREE.MeshStandardMaterial({
    map: textures.solarCellMap,
    roughness: 0.22,
    metalness: 0.6,
  });

  const bellMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.4,
    metalness: 0.85,
  });

  if (areNasaModelsLoaded()) {
    if (mission.category === 'crewed' && mission.hasLunarLanding) {
      const lmRaw = getNasaModelClone('apolloLm');
      if (lmRaw) {
        const lmNorm = normalizeNasaGroup(lmRaw, { targetHeight: 4.35, baseY: -0.35 });
        const slices = splitObjectTriangles(lmNorm, [
          { id: 'descent', predicate: (_cx, cy) => cy < 1.55 },
          { id: 'ascent', predicate: (_cx, cy) => cy >= 1.55 },
        ]);
        const lmDescentStage = slices.get('descent') ?? new THREE.Group();
        const lmAscentStage = slices.get('ascent') ?? new THREE.Group();

        // Bulkhead closure between stages so separation looks solid
        const capMat = new THREE.MeshStandardMaterial({
          color: 0x1e2530,
          roughness: 0.55,
          metalness: 0.65,
        });
        const descCap = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.08, 16), capMat);
        descCap.position.y = 1.52;
        lmDescentStage.add(descCap);

        const ascBell = createEngineBell(0.2, 0.38, 0.45, bellMat);
        ascBell.position.y = 1.38;
        lmAscentStage.add(ascBell);

        lander.add(lmDescentStage, lmAscentStage);
        return {
          lander,
          lmDescentStage,
          lmAscentStage,
          legs,
          nozzleLocal: new THREE.Vector3(0, -0.35, 0),
          ascentNozzleLocal: new THREE.Vector3(0, 1.38, 0),
          isBallastOnly: false,
          height: 4.0,
        };
      }
    }

    if (mission.id === 'jwst') {
      const jwstRaw = getNasaModelClone('jwst');
      if (jwstRaw) {
        const jwstNorm = normalizeNasaGroup(jwstRaw, {
          targetMaxDim: 4.6,
          baseY: 0.05,
          euler: new THREE.Euler(0, Math.PI * 0.25, 0),
        });
        lander.add(jwstNorm);
        return {
          lander,
          lmDescentStage: null,
          lmAscentStage: null,
          legs,
          nozzleLocal: new THREE.Vector3(0, 0.15, 0),
          ascentNozzleLocal: new THREE.Vector3(0, 0.15, 0),
          isBallastOnly: false,
          height: 4.1,
        };
      }
    }

    // Lunar Orbiter 1 and Surveyor 3 intentionally use the mission-specific
    // NASA-data reconstructions below, never the unrelated modern LRO or
    // Viking lander meshes from the asset pack.
  }

  if (mission.category === 'crewed' && mission.hasLunarLanding) {
    // Realistic Apollo Lunar Module (LM) — Separate Descent & Ascent Stages
    const lmDescentStage = new THREE.Group();
    const lmAscentStage = new THREE.Group();

    // Octagonal Descent Stage wrapped in crinkled gold Kapton MLI foil
    const descentBody = new THREE.Mesh(
      new THREE.CylinderGeometry(1.62, 1.62, 1.45, 8),
      goldFoilMat,
    );
    descentBody.position.y = 0.78;
    descentBody.rotation.y = Math.PI / 8;
    descentBody.castShadow = true;
    descentBody.receiveShadow = true;
    lmDescentStage.add(descentBody);

    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const bay = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.15, 0.38), darkCarbonMat);
      bay.position.set(Math.cos(angle) * 1.48, 1.38, Math.sin(angle) * 1.48);
      bay.rotation.y = -angle + Math.PI / 2;
      lmDescentStage.add(bay);
    }

    const descentBell = createEngineBell(0.32, 0.65, 0.98, bellMat);
    descentBell.position.y = -0.35;
    lmDescentStage.add(descentBell);

    // 4 Articulated Telescoping Landing Legs + Dish Footpads + Lunar Surface Probe
    for (let i = 0; i < 4; i++) {
      const legGroup = new THREE.Group();
      const angle = (i * Math.PI) / 2 + Math.PI / 4;
      legGroup.rotation.y = angle;

      const mainStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.095, 2.38, 12), goldFoilMat);
      mainStrut.position.set(1.88, 0.66, 0);
      mainStrut.rotation.z = -0.46;
      mainStrut.castShadow = true;
      legGroup.add(mainStrut);

      const upperBrace = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.28, 10), titaniumMat);
      upperBrace.position.set(1.64, 1.4, 0);
      upperBrace.rotation.z = 0.72;
      legGroup.add(upperBrace);

      const footpad = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.13, 18), goldFoilMat);
      footpad.position.set(2.4, -0.34, 0);
      footpad.castShadow = true;
      legGroup.add(footpad);

      if (i === 0) {
        const probe = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.92, 8), titaniumMat);
        probe.position.set(2.4, -0.78, 0);
        legGroup.add(probe);
      }

      lmDescentStage.add(legGroup);
      legs.push(legGroup);
    }

    // Front EVA Porch & Ladder
    const porch = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.12, 0.62), titaniumMat);
    porch.position.set(0, 2.02, 1.5);
    lmDescentStage.add(porch);

    for (const lx of [-0.2, 0.2]) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.92, 8), titaniumMat);
      rail.position.set(lx, 1.05, 1.66);
      rail.rotation.x = -0.22;
      lmDescentStage.add(rail);
    }
    for (let r = 0; r < 6; r++) {
      const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.42, 6), titaniumMat);
      rung.rotation.z = Math.PI / 2;
      rung.position.set(0, 0.35 + r * 0.28, 1.82 - r * 0.06);
      lmDescentStage.add(rung);
    }

    if (mission.id === 'apollo-17') {
      const lrvPack = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.76, 0.34), titaniumMat);
      lrvPack.position.set(1.48, 1.4, 0.2);
      lmDescentStage.add(lrvPack);
    }

    // Faceted Titanium Ascent Stage Crew Cabin
    const ascentCore = new THREE.Mesh(
      new THREE.CylinderGeometry(1.18, 1.24, 1.48, 12),
      titaniumMat,
    );
    ascentCore.position.y = 2.18;
    ascentCore.castShadow = true;
    lmAscentStage.add(ascentCore);

    const ascentBell = createEngineBell(0.2, 0.38, 0.56, bellMat);
    ascentBell.position.y = 1.58;
    lmAscentStage.add(ascentBell);

    const cabinFace = new THREE.Mesh(new THREE.BoxGeometry(1.56, 1.22, 1.05), darkCarbonMat);
    cabinFace.position.set(0, 2.86, 0.88);
    cabinFace.castShadow = true;
    lmAscentStage.add(cabinFace);

    // 4 RCS Thruster Quads
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      const rcsBlock = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.32, 8), darkCarbonMat);
      rcsBlock.position.set(Math.cos(a) * 1.32, 3.14, Math.sin(a) * 1.32);
      rcsBlock.rotation.y = -a;
      lmAscentStage.add(rcsBlock);
    }

    // Angled Cockpit Windows + Top Docking Tunnel + S-Band Parabolic Dish
    const windowMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0c4a6e,
      emissiveIntensity: 0.45,
      roughness: 0.12,
      metalness: 0.25,
    });
    for (const sx of [-0.38, 0.38]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.32, 0.1), windowMat);
      win.position.set(sx, 3.06, 1.4);
      win.rotation.z = sx < 0 ? 0.14 : -0.14;
      lmAscentStage.add(win);
    }

    const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.52, 0.36, 16), titaniumMat);
    hatch.position.y = 3.74;
    lmAscentStage.add(hatch);

    const dish = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.08, 0.18, 18, 1, true),
      titaniumMat,
    );
    dish.material = titaniumMat.clone();
    dish.material.side = THREE.DoubleSide;
    dish.position.set(0.65, 3.92, 0.46);
    dish.rotation.x = Math.PI / 4;
    lmAscentStage.add(dish);

    lander.add(lmDescentStage, lmAscentStage);

    return {
      lander,
      lmDescentStage,
      lmAscentStage,
      legs,
      nozzleLocal: new THREE.Vector3(0, -0.35, 0),
      ascentNozzleLocal: new THREE.Vector3(0, 1.58, 0),
      isBallastOnly: false,
      height: 4.0,
    };
  }

  if (mission.id === 'apollo-8') {
    // Apollo 8 LTA-B structural ballast (no lunar lander)
    const ltaCore = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.28, 2.8, 16), darkCarbonMat);
    ltaCore.position.y = 1.6;
    lander.add(ltaCore);

    return {
      lander,
      lmDescentStage: null,
      lmAscentStage: null,
      legs,
      nozzleLocal: new THREE.Vector3(0, 0, 0),
      ascentNozzleLocal: new THREE.Vector3(0, 0, 0),
      isBallastOnly: true,
      height: 2.8,
    };
  }

  if (mission.id === 'lunar-orbiter-1') {
    // NASA Lunar Orbiter 1 (1966) — Cylindrical-conical bus, 4 solar paddles, dual-lens camera bay & dish
    const bus = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.88, 1.48, 16), goldFoilMat);
    bus.position.y = 1.25;
    bus.castShadow = true;
    lander.add(bus);

    const upperDeck = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.72, 0.36, 16), titaniumMat);
    upperDeck.position.y = 2.15;
    lander.add(upperDeck);

    // Eastman Kodak dual-lens camera housing + optical window
    const camDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.56, 16), darkCarbonMat);
    camDrum.rotation.z = Math.PI / 2;
    camDrum.position.set(0, 1.25, 0.76);
    lander.add(camDrum);

    const lensMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0c4a6e,
      emissiveIntensity: 0.45,
      roughness: 0.1,
      metalness: 0.5,
    });
    for (const lx of [-0.14, 0.14]) {
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.12, 14), lensMat);
      lens.rotation.x = Math.PI / 2;
      lens.position.set(lx, 1.25, 1.05);
      lander.add(lens);
    }

    // 4 Radial Solar Paddles
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      const wing = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.05, 0.66), solarMat);
      wing.position.set(Math.cos(a) * 1.48, 0.82, Math.sin(a) * 1.48);
      wing.rotation.y = -a;
      wing.rotation.z = -0.12;
      wing.castShadow = true;
      lander.add(wing);
    }

    // High-gain Parabolic Dish Boom + Omnidirectional Low-Gain Mast
    const dishBoom = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.35, 8), titaniumMat);
    dishBoom.position.set(0.9, 1.5, 0);
    dishBoom.rotation.z = -0.95;
    lander.add(dishBoom);

    const dishMat = titaniumMat.clone();
    dishMat.side = THREE.DoubleSide;
    const hga = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.08, 0.16, 18, 1, true), dishMat);
    hga.position.set(1.42, 1.92, 0);
    hga.rotation.z = -0.45;
    lander.add(hga);

    const omniMast = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.6, 8), titaniumMat);
    omniMast.position.set(-0.75, 2.15, 0);
    omniMast.rotation.z = 0.52;
    lander.add(omniMast);

    const engine = createEngineBell(0.16, 0.34, 0.55, bellMat);
    engine.position.y = 2.6;
    engine.rotation.x = Math.PI;
    lander.add(engine);

    return {
      lander,
      lmDescentStage: null,
      lmAscentStage: null,
      legs,
      nozzleLocal: new THREE.Vector3(0, 0.1, 0),
      ascentNozzleLocal: new THREE.Vector3(0, 0.1, 0),
      isBallastOnly: false,
      height: 2.9,
    };
  }

  if (mission.id === 'jwst') {
    // James Webb Space Telescope (JWST) — 5-Layer Diamond Sunshield + 18 Gold Hex Mirrors + Tripod
    const mirrorGoldMat = new THREE.MeshStandardMaterial({
      color: 0xf5b82e,
      emissive: 0x5c3804,
      emissiveIntensity: 0.25,
      roughness: 0.14,
      metalness: 0.96,
    });
    const kaptonSilverMat = new THREE.MeshStandardMaterial({
      color: 0xd8dee9,
      roughness: 0.25,
      metalness: 0.88,
      side: THREE.DoubleSide,
    });
    const kaptonVioletMat = new THREE.MeshStandardMaterial({
      color: 0xa78bfa,
      emissive: 0x311068,
      emissiveIntensity: 0.22,
      roughness: 0.22,
      metalness: 0.9,
      side: THREE.DoubleSide,
    });

    // Spacecraft Bus & Solar Wing below the Sunshield (Sun-facing side)
    const spacecraftBus = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.55, 1.15), darkCarbonMat);
    spacecraftBus.position.set(0, 0.45, 0);
    lander.add(spacecraftBus);

    const solarWing = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.38, 1.8), solarMat);
    solarWing.position.set(0, 0.38, -1.35);
    lander.add(solarWing);

    // 5-Layer Kite / Diamond Kapton Sunshield
    const shieldShape = new THREE.Shape();
    shieldShape.moveTo(0, 2.85);
    shieldShape.lineTo(1.82, 0.15);
    shieldShape.lineTo(0, -2.15);
    shieldShape.lineTo(-1.82, 0.15);
    shieldShape.closePath();
    const shieldGeo = new THREE.ShapeGeometry(shieldShape);
    shieldGeo.rotateX(Math.PI / 2);

    for (let layer = 0; layer < 5; layer++) {
      const layerMat = layer === 0 ? kaptonVioletMat : kaptonSilverMat;
      const membrane = new THREE.Mesh(shieldGeo, layerMat);
      const scaleF = 1 - layer * 0.035;
      membrane.scale.set(scaleF, 1, scaleF);
      membrane.position.set(0, 0.85 + layer * 0.13, 0.15);
      membrane.castShadow = true;
      lander.add(membrane);
    }

    // 18-Segment Gold Hexagonal Honeycomb Primary Mirror + Backplane + ISIM Bay
    const opticsGroup = new THREE.Group();
    opticsGroup.position.set(0, 2.72, 0.05);

    const hexRadius = 0.235;
    const hexGeo = new THREE.CylinderGeometry(hexRadius, hexRadius, 0.07, 6);
    hexGeo.rotateX(Math.PI / 2);

    const spacing = hexRadius * 1.82;
    const ringCoords: Array<[number, number]> = [];
    // Inner ring (6 segments)
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3 + Math.PI / 6;
      ringCoords.push([Math.cos(a) * spacing, Math.sin(a) * spacing]);
    }
    // Outer ring (12 segments)
    for (let i = 0; i < 6; i++) {
      const a1 = (i * Math.PI) / 3 + Math.PI / 6;
      const a2 = ((i + 1) * Math.PI) / 3 + Math.PI / 6;
      ringCoords.push([Math.cos(a1) * spacing * 2, Math.sin(a1) * spacing * 2]);
      ringCoords.push([
        (Math.cos(a1) + Math.cos(a2)) * spacing,
        (Math.sin(a1) + Math.sin(a2)) * spacing,
      ]);
    }

    for (const [mx, my] of ringCoords) {
      const seg = new THREE.Mesh(hexGeo, mirrorGoldMat);
      // Slight parabolic curvature inward
      const dist = Math.hypot(mx, my);
      seg.position.set(mx, my, -0.05 + dist * dist * 0.08);
      seg.lookAt(0, 0, 4.2);
      seg.rotateX(Math.PI / 2);
      seg.castShadow = true;
      opticsGroup.add(seg);
    }

    // Central Aft Optics Subsystem Cone & ISIM Instrument Module
    const centralBaffle = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.45, 12), darkCarbonMat);
    centralBaffle.rotation.x = Math.PI / 2;
    centralBaffle.position.set(0, 0, 0.2);
    opticsGroup.add(centralBaffle);

    const isimBay = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.05, 0.62), darkCarbonMat);
    isimBay.position.set(0, -0.05, -0.38);
    opticsGroup.add(isimBay);

    // Secondary Mirror + 3 Carbon-Composite Support Struts
    const secMirror = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.08, 16), mirrorGoldMat);
    secMirror.rotation.x = Math.PI / 2;
    secMirror.position.set(0, 0, 1.55);
    opticsGroup.add(secMirror);

    const strutAnchors: Array<[number, number]> = [
      [0, 1.02],
      [-0.86, -0.68],
      [0.86, -0.68],
    ];
    for (const [ax, ay] of strutAnchors) {
      const start = new THREE.Vector3(ax, ay, 0);
      const end = new THREE.Vector3(0, 0, 1.55);
      const len = start.distanceTo(end);
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, len, 8), darkCarbonMat);
      strut.position.copy(start).lerp(end, 0.5);
      strut.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(start).normalize());
      opticsGroup.add(strut);
    }

    lander.add(opticsGroup);

    return {
      lander,
      lmDescentStage: null,
      lmAscentStage: null,
      legs,
      nozzleLocal: new THREE.Vector3(0, 0.15, 0),
      ascentNozzleLocal: new THREE.Vector3(0, 0.15, 0),
      isBallastOnly: false,
      height: 4.1,
    };
  }

  if (mission.id === 'surveyor-3') {
    // Mission-specific Surveyor-C reconstruction from NASA/JPL drawings and
    // mission dimensions; there is no Surveyor 3 GLB in NASA's model library.
    lander.add(buildSurveyor3Reconstruction());
    return {
      lander,
      lmDescentStage: null,
      lmAscentStage: null,
      legs,
      nozzleLocal: new THREE.Vector3(0, -0.3, 0),
      ascentNozzleLocal: new THREE.Vector3(0, -0.3, 0),
      isBallastOnly: false,
      height: 3.0,
    };
  }

  // Other uncrewed robotic landers
  const busRadius = mission.id === 'artemis-prospect' ? 1.25 : 0.98;
  const busHeight = mission.id === 'luna-9' ? 1.15 : 1.05;

  const bus = new THREE.Mesh(
    mission.id === 'luna-9'
      ? new THREE.SphereGeometry(busRadius * 0.82, 20, 16)
      : new THREE.CylinderGeometry(busRadius, busRadius * 1.05, busHeight, 8),
    mission.id === 'luna-9' ? titaniumMat : goldFoilMat,
  );
  bus.position.y = 1.2;
  bus.castShadow = true;
  lander.add(bus);

  const deck = new THREE.Mesh(
    new THREE.CylinderGeometry(busRadius * 0.92, busRadius * 0.96, 0.24, 16),
    darkCarbonMat,
  );
  deck.position.y = 1.84;
  lander.add(deck);

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.15, 10), titaniumMat);
  mast.position.set(0, 2.45, 0);
  lander.add(mast);

  const dishMat = titaniumMat.clone();
  dishMat.side = THREE.DoubleSide;
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.1, 0.18, 20, 1, true), dishMat);
  dish.position.set(0.25, 2.95, 0.15);
  dish.rotation.x = Math.PI / 4;
  lander.add(dish);

  if (mission.id !== 'luna-9') {
    for (const side of [-1, 1]) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.08, 0.92), solarMat);
      panel.position.set(side * (busRadius + 0.92), 1.45, 0);
      panel.rotation.z = side * -0.16;
      panel.castShadow = true;
      lander.add(panel);
    }
  } else {
    for (let i = 0; i < 4; i++) {
      const petal = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.88, 0.08), titaniumMat);
      const a = (i * Math.PI) / 2;
      petal.position.set(Math.cos(a) * 0.85, 1.95, Math.sin(a) * 0.85);
      petal.rotation.y = -a + Math.PI / 2;
      petal.rotation.x = 0.55;
      lander.add(petal);
    }
  }

  const nozzle = createEngineBell(0.22, 0.42, 0.65, bellMat);
  nozzle.position.y = -0.05;
  lander.add(nozzle);

  if (mission.id === 'surveyor-3') {
    // Surveyor 3 iconic Pantograph Soil Mechanics Surface Sampler (SMSS) scoop arm
    const armShoulder = new THREE.Group();
    armShoulder.name = 'surveyor-sampler-arm';
    armShoulder.position.set(0, 1.48, busRadius * 0.92);
    const arm1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 1.05), titaniumMat);
    arm1.position.set(0, 0.12, 0.52);
    arm1.rotation.x = 0.25;
    const arm2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.85), titaniumMat);
    arm2.position.set(0, -0.22, 1.15);
    arm2.rotation.x = -0.68;
    const scoopClaw = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.28), darkCarbonMat);
    scoopClaw.position.set(0, -0.58, 1.46);
    armShoulder.add(arm1, arm2, scoopClaw);
    lander.add(armShoulder);
  }

  const legCount = mission.id === 'surveyor-1' || mission.id === 'surveyor-3' ? 3 : 4;
  for (let i = 0; i < legCount; i++) {
    const legGroup = new THREE.Group();
    const angle = (i * Math.PI * 2) / legCount + Math.PI / 4;
    legGroup.rotation.y = angle;

    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 1.75, 10), titaniumMat);
    strut.position.set(busRadius + 0.45, 0.52, 0);
    strut.rotation.z = -0.46;
    strut.castShadow = true;
    legGroup.add(strut);

    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.12, 16), goldFoilMat);
    pad.position.set(busRadius + 0.88, -0.24, 0);
    legGroup.add(pad);

    lander.add(legGroup);
    legs.push(legGroup);
  }

  return {
    lander,
    lmDescentStage: null,
    lmAscentStage: null,
    legs,
    nozzleLocal: new THREE.Vector3(0, -0.05, 0),
    ascentNozzleLocal: new THREE.Vector3(0, -0.05, 0),
    isBallastOnly: false,
    height: 3.1,
  };
}

export function buildRocketAssembly(
  mission: MissionConfig,
  textures: ProceduralTextureSet,
): RocketAssembly {
  const root = new THREE.Group();
  const stage1 = new THREE.Group();
  const stage2 = new THREE.Group();
  const stage3 = new THREE.Group();
  const slaPetals: THREE.Group[] = [];

  const whiteHullMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.4,
    metalness: 0.18,
  });

  const saturnHullMat = new THREE.MeshStandardMaterial({
    map: textures.saturnHullMap,
    roughness: 0.42,
    metalness: 0.22,
  });

  const blackInterstageMat = new THREE.MeshStandardMaterial({
    color: 0x151922,
    roughness: 0.55,
    metalness: 0.35,
  });

  const metallicMat = new THREE.MeshStandardMaterial({
    color: 0xd1dae6,
    roughness: 0.26,
    metalness: 0.84,
  });

  const orangeCryoMat = new THREE.MeshStandardMaterial({
    color: 0xd46322,
    roughness: 0.72,
    metalness: 0.08,
  });

  const nozzleMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.38,
    metalness: 0.86,
  });

  const {
    lander,
    lmDescentStage,
    lmAscentStage,
    legs: landerLegs,
    nozzleLocal: landerNozzleLocal,
    ascentNozzleLocal: lmAscentNozzleLocal,
    isBallastOnly,
  } = buildDetailedLander(mission, textures);

  const stage1Nozzles: THREE.Vector3[] = [];
  const stage2Nozzles: THREE.Vector3[] = [];
  const stage3Nozzles: THREE.Vector3[] = [];
  let csm: THREE.Group | null = null;
  let csmServiceModule: THREE.Group | null = null;
  let csmCommandModule: THREE.Group | null = null;
  let lesTower: THREE.Group | null = null;
  let fairingLeft: THREE.Group | null = null;
  let fairingRight: THREE.Group | null = null;
  const csmNozzleLocal = new THREE.Vector3(0, -0.8, 0);

  if (mission.architecture === 'saturn-v') {
    const saturnRaw = areNasaModelsLoaded() ? getNasaModelClone('saturnV') : null;
    if (saturnRaw) {
      const saturnNorm = normalizeNasaGroup(saturnRaw, {
        targetHeight: 49.8,
        baseY: -0.8,
      });

      const svSlices = splitObjectTriangles(saturnNorm, [
        { id: 's1', predicate: (_cx, cy) => cy < 16.2 },
        { id: 's2', predicate: (_cx, cy) => cy >= 16.2 && cy < 27.3 },
        { id: 's3', predicate: (_cx, cy) => cy >= 27.3 && cy < 34.9 },
        { id: 'sla0', predicate: (cx, cy, cz) => cy >= 34.9 && cy < 40.1 && cx >= 0 && Math.abs(cz) <= cx },
        { id: 'sla1', predicate: (cx, cy, cz) => cy >= 34.9 && cy < 40.1 && cz > 0 && Math.abs(cx) < cz },
        { id: 'sla2', predicate: (cx, cy, cz) => cy >= 34.9 && cy < 40.1 && cx < 0 && Math.abs(cz) <= -cx },
        { id: 'sla3', predicate: (cx, cy, cz) => cy >= 34.9 && cy < 40.1 && cz <= 0 && Math.abs(cx) < -cz },
        { id: 'csmFallback', predicate: (_cx, cy) => cy >= 40.1 && cy < 44.3 },
        { id: 'les', predicate: (_cx, cy) => cy >= 44.3 },
      ]);

      const s1Group = svSlices.get('s1');
      if (s1Group) stage1.add(s1Group);
      const s1Cap = new THREE.Mesh(new THREE.CylinderGeometry(2.32, 2.32, 0.14, 28), blackInterstageMat);
      s1Cap.position.y = 16.12;
      stage1.add(s1Cap);

      const f1Offsets = [
        [0, 0],
        [1.35, 0],
        [-1.35, 0],
        [0, 1.35],
        [0, -1.35],
      ];
      for (const [fx, fz] of f1Offsets) {
        stage1Nozzles.push(new THREE.Vector3(fx, -0.75, fz));
      }

      // Stage 2 (S-II)
      stage2.position.y = 16.2;
      const s2Group = svSlices.get('s2');
      if (s2Group) {
        s2Group.position.y = -16.2;
        stage2.add(s2Group);
      }
      const s2BottomCap = new THREE.Mesh(new THREE.CylinderGeometry(2.32, 2.32, 0.14, 28), blackInterstageMat);
      s2BottomCap.position.y = 0.08;
      const s2TopCap = new THREE.Mesh(new THREE.CylinderGeometry(2.32, 2.32, 0.14, 28), blackInterstageMat);
      s2TopCap.position.y = 11.02;
      stage2.add(s2BottomCap, s2TopCap);

      for (const [jx, jz] of f1Offsets) {
        const j2 = createEngineBell(0.28, 0.52, 1.0, nozzleMat);
        j2.position.set(jx * 0.78, -0.1, jz * 0.78);
        stage2.add(j2);
        stage2Nozzles.push(new THREE.Vector3(jx * 0.78, -0.1, jz * 0.78));
      }

      // Stage 3 (S-IVB)
      stage3.position.y = 27.3;
      const s3Group = svSlices.get('s3');
      if (s3Group) {
        s3Group.position.y = -27.3;
        stage3.add(s3Group);
      }
      const s3BottomCap = new THREE.Mesh(new THREE.CylinderGeometry(2.26, 2.26, 0.14, 28), blackInterstageMat);
      s3BottomCap.position.y = 0.08;
      const s3TopCap = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.14, 24), blackInterstageMat);
      s3TopCap.position.y = 7.52;
      stage3.add(s3BottomCap, s3TopCap);

      const s3J2 = createEngineBell(0.32, 0.62, 1.25, nozzleMat);
      s3J2.position.y = -0.15;
      stage3.add(s3J2);
      stage3Nozzles.push(new THREE.Vector3(0, -0.15, 0));

      // Hinged SLA Petals sliced directly from NASA Saturn V SLA fairing
      const slaBaseY = 7.6;
      const slaIds = ['sla0', 'sla1', 'sla2', 'sla3'];
      for (let i = 0; i < 4; i++) {
        const angle = (i * Math.PI) / 2;
        const petalPivot = new THREE.Group();
        petalPivot.rotation.y = angle;

        const hingeNode = new THREE.Group();
        hingeNode.position.set(1.58, slaBaseY, 0);

        const sliceGrp = svSlices.get(slaIds[i]);
        if (sliceGrp) {
          sliceGrp.position.set(0, -34.9, 0);
          const wrap = new THREE.Group();
          wrap.rotation.y = -angle;
          wrap.add(sliceGrp);
          wrap.position.set(-1.58, 0, 0);
          hingeNode.add(wrap);
        }

        petalPivot.add(hingeNode);
        stage3.add(petalPivot);
        slaPetals.push(hingeNode);
      }

      lander.position.set(0, 27.3 + 7.6, 0);
      lander.scale.setScalar(0.82);

      // Genuine NASA Apollo CSM (trimmed from Apollo-Soyuz GLB & split into SM + CM for realistic Earth Reentry)
      csm = new THREE.Group();
      csm.position.y = 40.1;
      const csmRaw = getNasaModelClone('apolloCsm');
      if (csmRaw) {
        const csmParts = splitObjectTriangles(csmRaw, [
          { id: 'sm', predicate: (cx) => cx < -3.65 },
          { id: 'cm', predicate: (cx) => cx >= -3.65 && cx < -0.55 },
        ]);
        const smSlice = csmParts.get('sm');
        const cmSlice = csmParts.get('cm');
        if (smSlice && smSlice.children.length > 0 && cmSlice && cmSlice.children.length > 0) {
          const combined = new THREE.Group();
          combined.add(smSlice, cmSlice);
          combined.rotation.set(0, 0, Math.PI / 2);
          combined.updateMatrixWorld(true);
          const rawBox = new THREE.Box3().setFromObject(combined);
          const rawSize = new THREE.Vector3();
          const rawCenter = new THREE.Vector3();
          rawBox.getSize(rawSize);
          rawBox.getCenter(rawCenter);
          const s = 4.5 / Math.max(0.01, rawSize.y);

          for (const part of [smSlice, cmSlice]) {
            part.rotation.set(0, 0, Math.PI / 2);
            part.scale.setScalar(s);
            part.position.set(-rawCenter.x * s, -0.65 - rawBox.min.y * s, -rawCenter.z * s);
          }
          csmServiceModule = smSlice;
          csmCommandModule = cmSlice;
          csm.add(smSlice, cmSlice);
        } else {
          const fb = svSlices.get('csmFallback');
          if (fb) {
            fb.position.y = -40.1;
            csm.add(fb);
          }
        }
      } else {
        const fb = svSlices.get('csmFallback');
        if (fb) {
          fb.position.y = -40.1;
          csm.add(fb);
        }
      }

      // Genuine NASA Launch Escape System (LES) Tower
      lesTower = new THREE.Group();
      lesTower.position.y = 44.3;
      const lesSlice = svSlices.get('les');
      if (lesSlice) {
        lesSlice.position.y = -44.3;
        lesTower.add(lesSlice);
      }

      root.add(stage1, stage2, stage3, lander, csm, lesTower);
      return {
        root,
        stage1,
        stage2,
        stage3,
        lesTower,
        fairingLeft: null,
        fairingRight: null,
        slaPetals,
        csm,
        csmServiceModule,
        csmCommandModule,
        lander,
        lmDescentStage,
        lmAscentStage,
        landerLegs,
        stage1Nozzles,
        stage2Nozzles,
        stage3Nozzles,
        landerNozzleLocal,
        lmAscentNozzleLocal,
        csmNozzleLocal: new THREE.Vector3(0, -0.65, 0),
        isBallastOnly,
        totalHeight: 49,
        landerHeightOffset: 34.9,
      };
    }

    // --- REALISTIC SATURN V FULL STACK (Procedural Fallback) ---
    const s1Body = new THREE.Mesh(
      new THREE.CylinderGeometry(2.38, 2.38, 15.2, 32),
      saturnHullMat,
    );
    s1Body.position.y = 8.6;
    s1Body.castShadow = true;
    s1Body.receiveShadow = true;
    stage1.add(s1Body);

    const skirt = new THREE.Mesh(
      new THREE.CylinderGeometry(2.38, 2.66, 1.85, 32),
      blackInterstageMat,
    );
    skirt.position.y = 1.65;
    skirt.castShadow = true;
    stage1.add(skirt);

    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      const fin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.6, 0.16), blackInterstageMat);
      fin.position.set(Math.cos(a) * 2.9, 1.8, Math.sin(a) * 2.9);
      fin.rotation.y = -a;
      fin.castShadow = true;
      stage1.add(fin);

      const fairing = new THREE.Mesh(new THREE.ConeGeometry(0.66, 2.4, 12), whiteHullMat);
      fairing.position.set(Math.cos(a) * 2.15, 1.5, Math.sin(a) * 2.15);
      fairing.castShadow = true;
      stage1.add(fairing);

      const cableTunnel = new THREE.Mesh(new THREE.BoxGeometry(0.28, 13.5, 0.28), whiteHullMat);
      cableTunnel.position.set(Math.cos(a) * 2.4, 8.8, Math.sin(a) * 2.4);
      stage1.add(cableTunnel);
    }

    const f1Offsets = [
      [0, 0],
      [1.45, 0],
      [-1.45, 0],
      [0, 1.45],
      [0, -1.45],
    ];
    for (const [fx, fz] of f1Offsets) {
      const bell = createEngineBell(0.42, 0.78, 1.72, nozzleMat);
      bell.position.set(fx, -0.75, fz);
      stage1.add(bell);
      stage1Nozzles.push(new THREE.Vector3(fx, -0.75, fz));
    }

    // S-II Stage 2
    stage2.position.y = 16.2;
    const interstage = new THREE.Mesh(
      new THREE.CylinderGeometry(2.38, 2.38, 2.2, 32),
      blackInterstageMat,
    );
    interstage.position.y = 1.1;
    interstage.castShadow = true;
    stage2.add(interstage);

    const s2Body = new THREE.Mesh(
      new THREE.CylinderGeometry(2.38, 2.38, 8.8, 32),
      whiteHullMat,
    );
    s2Body.position.y = 6.6;
    s2Body.castShadow = true;
    stage2.add(s2Body);

    const s2Band = new THREE.Mesh(
      new THREE.CylinderGeometry(2.39, 2.39, 0.9, 32),
      blackInterstageMat,
    );
    s2Band.position.y = 10.6;
    stage2.add(s2Band);

    for (const [jx, jz] of f1Offsets) {
      const j2 = createEngineBell(0.3, 0.54, 1.1, nozzleMat);
      j2.position.set(jx * 0.8, -0.1, jz * 0.8);
      stage2.add(j2);
      stage2Nozzles.push(new THREE.Vector3(jx * 0.8, -0.1, jz * 0.8));
    }

    // S-IVB Stage 3
    stage3.position.y = 27.3;
    const s3Taper = new THREE.Mesh(
      new THREE.CylinderGeometry(1.64, 2.38, 2.2, 32),
      blackInterstageMat,
    );
    s3Taper.position.y = 1.1;
    s3Taper.castShadow = true;
    stage3.add(s3Taper);

    const s3Body = new THREE.Mesh(
      new THREE.CylinderGeometry(1.64, 1.64, 5.2, 28),
      whiteHullMat,
    );
    s3Body.position.y = 4.8;
    s3Body.castShadow = true;
    stage3.add(s3Body);

    const s3J2 = createEngineBell(0.32, 0.62, 1.25, nozzleMat);
    s3J2.position.y = -0.15;
    stage3.add(s3J2);
    stage3Nozzles.push(new THREE.Vector3(0, -0.15, 0));

    // Spacecraft-Lunar Module Adapter (SLA) — 4 Hinged Curved Fairing Petals
    const slaBaseY = 7.4;
    const slaHeight = 5.4;
    const petalMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.42,
      metalness: 0.24,
      side: THREE.DoubleSide,
    });
    for (let i = 0; i < 4; i++) {
      const petalPivot = new THREE.Group();
      const angle = (i * Math.PI) / 2;
      petalPivot.rotation.y = angle;

      const hingeNode = new THREE.Group();
      hingeNode.position.set(1.58, slaBaseY, 0);

      const petalGeo = new THREE.CylinderGeometry(
        1.26,
        1.62,
        slaHeight,
        12,
        1,
        true,
        -Math.PI / 4,
        Math.PI / 2,
      );
      const petalMesh = new THREE.Mesh(petalGeo, petalMat);
      petalMesh.position.set(-1.58, slaHeight * 0.5, 0);
      petalMesh.rotation.y = Math.PI / 2;
      petalMesh.castShadow = true;

      hingeNode.add(petalMesh);
      petalPivot.add(hingeNode);
      stage3.add(petalPivot);
      slaPetals.push(hingeNode);
    }

    // Place Lander inside SLA
    lander.position.set(0, 27.3 + 7.6, 0);
    lander.scale.setScalar(0.82);

    // Command / Service Module (CSM)
    csm = new THREE.Group();
    csm.position.y = 40.1;

    const smBody = new THREE.Mesh(
      new THREE.CylinderGeometry(1.26, 1.26, 2.8, 28),
      metallicMat,
    );
    smBody.position.y = 1.4;
    smBody.castShadow = true;
    csm.add(smBody);

    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      const radiator = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.7, 0.08), whiteHullMat);
      radiator.position.set(Math.cos(a) * 1.28, 1.25, Math.sin(a) * 1.28);
      radiator.rotation.y = -a + Math.PI / 2;
      csm.add(radiator);

      const rcs = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.3, 8), blackInterstageMat);
      rcs.position.set(Math.cos(a + Math.PI / 4) * 1.32, 2.25, Math.sin(a + Math.PI / 4) * 1.32);
      csm.add(rcs);
    }

    const hgaBoom = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 8), metallicMat);
    hgaBoom.position.set(1.45, 0.3, 0);
    hgaBoom.rotation.z = -0.65;
    csm.add(hgaBoom);

    const hgaDishMat = whiteHullMat.clone();
    hgaDishMat.side = THREE.DoubleSide;
    const hgaDish = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.08, 0.16, 16, 1, true), hgaDishMat);
    hgaDish.position.set(1.88, 0.0, 0.12);
    hgaDish.rotation.x = Math.PI / 3;
    csm.add(hgaDish);

    const heatshield = new THREE.Mesh(
      new THREE.CylinderGeometry(1.28, 1.32, 0.24, 28),
      blackInterstageMat,
    );
    heatshield.position.y = 2.85;
    csm.add(heatshield);

    const cmCone = new THREE.Mesh(
      new THREE.ConeGeometry(1.28, 1.48, 28),
      metallicMat,
    );
    cmCone.position.y = 3.7;
    cmCone.castShadow = true;
    csm.add(cmCone);

    const cmWinMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0c4a6e,
      emissiveIntensity: 0.4,
      roughness: 0.15,
    });
    for (const side of [-0.36, 0.36]) {
      const cmWin = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.08), cmWinMat);
      cmWin.position.set(side, 3.68, 0.72);
      cmWin.rotation.x = -0.5;
      csm.add(cmWin);
    }

    const dockingProbe = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.18, 0.55, 12), metallicMat);
    dockingProbe.position.y = 4.55;
    csm.add(dockingProbe);

    const spsBell = createEngineBell(0.35, 0.74, 1.0, nozzleMat);
    spsBell.position.y = -0.95;
    csm.add(spsBell);

    // Launch Escape System (LES) Tower
    lesTower = new THREE.Group();
    lesTower.position.y = 44.3;
    const lesShroud = new THREE.Mesh(new THREE.ConeGeometry(0.68, 1.0, 16), whiteHullMat);
    lesShroud.position.y = 0.45;
    lesTower.add(lesShroud);

    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 3.5, 8), whiteHullMat);
      strut.position.set(Math.cos(a) * 0.25, 2.4, Math.sin(a) * 0.25);
      strut.rotation.z = Math.cos(a) * 0.06;
      strut.rotation.x = -Math.sin(a) * 0.06;
      lesTower.add(strut);
    }

    const lesTip = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 1.1, 12), blackInterstageMat);
    lesTip.position.y = 4.55;
    lesTower.add(lesTip);

    root.add(stage1, stage2, stage3, lander, csm, lesTower);

    return {
      root,
      stage1,
      stage2,
      stage3,
      lesTower,
      fairingLeft: null,
      fairingRight: null,
      slaPetals,
      csm,
      csmServiceModule,
      csmCommandModule,
      lander,
      lmDescentStage,
      lmAscentStage,
      landerLegs,
      stage1Nozzles,
      stage2Nozzles,
      stage3Nozzles,
      landerNozzleLocal,
      lmAscentNozzleLocal,
      csmNozzleLocal,
      isBallastOnly,
      totalHeight: 49,
      landerHeightOffset: 34.9,
    };
  }

  // --- REALISTIC UNCREWED LAUNCHERS (Atlas-Centaur, Atlas-Agena, Molniya-M, LVM3, SLS Block 1, Ariane 5 ECA) ---
  const isSLS = mission.architecture === 'sls-robotic';
  const isAriane5 = mission.architecture === 'ariane-5';
  const isLVM3 = mission.architecture === 'lvm3';
  const isMolniya = mission.architecture === 'molniya-m';
  const isAtlasAgena = mission.architecture === 'atlas-agena';
  const isAtlasFamily = isAtlasAgena || mission.architecture === 'atlas-centaur';
  const isTwoStageLauncher =
    mission.architecture === 'atlas-agena' ||
    mission.architecture === 'atlas-centaur' ||
    mission.architecture === 'ariane-5' ||
    mission.architecture === 'lvm3' ||
    mission.architecture === 'sls-robotic';

  const coreMat =
    isSLS || isAriane5
      ? orangeCryoMat
      : isLVM3
        ? whiteHullMat
        : isMolniya
          ? new THREE.MeshStandardMaterial({ color: 0x4b5848, roughness: 0.55, metalness: 0.3 })
          : metallicMat;
  const coreRadius = isSLS ? 1.95 : isAriane5 ? 1.75 : 1.45;
  const s1Height = isSLS || isAriane5 ? 18 : 14;

  const nasaLoaded = areNasaModelsLoaded();
  let usedNasaStage1 = false;

  if (nasaLoaded && isAtlasFamily) {
    const atlasRaw = getNasaModelClone('atlas');
    if (atlasRaw) {
      // NASA's Atlas 6 (Mercury-Atlas) mesh provides the Atlas D-family core;
      // trim its Mercury capsule. The specific 1966 Atlas D configuration is
      // not available as a NASA GLB, so minor vehicle-variant details differ.
      const atlasBooster = splitObjectTriangles(atlasRaw, [
        { id: 'booster', predicate: (_cx, cy) => cy <= 7.18 },
      ]).get('booster');
      if (atlasBooster && atlasBooster.children.length > 0) {
        const atlasNorm = normalizeNasaGroup(atlasBooster, {
          targetHeight: s1Height + 1.1,
          baseY: -0.35,
        });
        stage1.add(atlasNorm);
        stage1Nozzles.push(
          new THREE.Vector3(0, -0.4, 0),
          new THREE.Vector3(-1.35, 0.25, 0),
          new THREE.Vector3(1.35, 0.25, 0),
        );
        usedNasaStage1 = true;
      }
    }
  }

  if (!usedNasaStage1) {
    const coreBody = new THREE.Mesh(
      new THREE.CylinderGeometry(coreRadius, coreRadius, s1Height, 28),
      coreMat,
    );
    coreBody.position.y = s1Height / 2 + 1.0;
    coreBody.castShadow = true;
    coreBody.receiveShadow = true;
    stage1.add(coreBody);

    if (isAtlasFamily) {
      // Atlas D/SLV-3 used an aft engine cluster, not two long pods down its sides.
      const thrustSection = new THREE.Mesh(
        new THREE.CylinderGeometry(coreRadius * 0.82, coreRadius * 0.82, 0.65, 28),
        blackInterstageMat,
      );
      thrustSection.position.y = 0.83;
      stage1.add(thrustSection);

      const atlasEnginePositions = [
        [-0.46, 0],
        [0.46, 0],
        [0, 0.48],
      ] as const;
      for (const [x, z] of atlasEnginePositions) {
        const bell = createEngineBell(0.21, 0.39, 1.05, nozzleMat);
        bell.position.set(x, -0.35, z);
        stage1.add(bell);
        stage1Nozzles.push(new THREE.Vector3(x, -0.35, z));
      }
      for (const z of [-0.82, 0.82]) {
        const vernier = createEngineBell(0.07, 0.12, 0.48, nozzleMat);
        vernier.position.set(0.76, -0.16, z);
        stage1.add(vernier);
        stage1Nozzles.push(new THREE.Vector3(0.76, -0.16, z));
      }
    } else {
      const coreBell = createEngineBell(0.4, 0.75, 1.35, nozzleMat);
      coreBell.position.y = -0.35;
      stage1.add(coreBell);
      stage1Nozzles.push(new THREE.Vector3(0, -0.4, 0));
    }
  }

  if (isSLS || isLVM3 || isAriane5) {
    const boosterR = isSLS ? 0.85 : isAriane5 ? 0.82 : 0.75;
    const boosterH = isAriane5 ? s1Height * 0.96 : s1Height * 0.92;
    for (const side of [-1, 1]) {
      const bBody = new THREE.Mesh(
        new THREE.CylinderGeometry(boosterR, boosterR, boosterH, 20),
        whiteHullMat,
      );
      bBody.position.set(side * (coreRadius + boosterR + 0.15), boosterH / 2 + 1.1, 0);
      bBody.castShadow = true;
      stage1.add(bBody);

      const bCone = new THREE.Mesh(
        new THREE.ConeGeometry(boosterR, 1.9, 20),
        whiteHullMat,
      );
      bCone.position.set(side * (coreRadius + boosterR + 0.15), boosterH + 2.05, 0);
      stage1.add(bCone);

      const bBell = createEngineBell(0.32, 0.6, 1.15, nozzleMat);
      bBell.position.set(side * (coreRadius + boosterR + 0.15), -0.15, 0);
      stage1.add(bBell);
      stage1Nozzles.push(new THREE.Vector3(side * (coreRadius + boosterR + 0.15), -0.15, 0));
    }
  } else if (isMolniya) {
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      const strap = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.68, 9.6, 16), coreMat);
      strap.position.set(Math.cos(a) * 1.85, 5.8, Math.sin(a) * 1.85);
      strap.rotation.z = Math.cos(a) * 0.08;
      strap.rotation.x = -Math.sin(a) * 0.08;
      strap.castShadow = true;
      stage1.add(strap);
      stage1Nozzles.push(new THREE.Vector3(Math.cos(a) * 1.95, 0.8, Math.sin(a) * 1.95));
    }
  }

  // Stage 2 (Upper Cryogenic / Agena Stage)
  stage2.position.y = s1Height + 1.0;
  let usedNasaStage2 = false;
  if (isAtlasAgena) {
    // The NASA GLB is an Agena Target Vehicle, not the Agena D launch stage.
    // Rebuild the slim Agena D tank/engine section instead of showing the wrong spacecraft.
    const agenaTank = new THREE.Mesh(
      new THREE.CylinderGeometry(coreRadius * 0.82, coreRadius * 0.82, 6.6, 28),
      metallicMat,
    );
    agenaTank.position.y = 4.55;
    agenaTank.castShadow = true;
    stage2.add(agenaTank);
    const agenaForwardBand = new THREE.Mesh(
      new THREE.CylinderGeometry(coreRadius * 0.83, coreRadius * 0.83, 0.18, 28),
      blackInterstageMat,
    );
    agenaForwardBand.position.y = 7.85;
    stage2.add(agenaForwardBand);
    const agenaEngineBay = new THREE.Mesh(
      new THREE.CylinderGeometry(coreRadius * 0.57, coreRadius * 0.57, 1.1, 24),
      blackInterstageMat,
    );
    agenaEngineBay.position.y = 0.65;
    stage2.add(agenaEngineBay);
    const agenaBell = createEngineBell(0.27, 0.48, 1.0, nozzleMat);
    agenaBell.position.y = -0.1;
    stage2.add(agenaBell);
    stage2Nozzles.push(new THREE.Vector3(0, -0.1, 0));
    usedNasaStage2 = true;
  }
  if (!usedNasaStage2) {
    const s2Interstage = new THREE.Mesh(
      new THREE.CylinderGeometry(coreRadius * 0.96, coreRadius, 1.6, 28),
      blackInterstageMat,
    );
    s2Interstage.position.y = 0.8;
    stage2.add(s2Interstage);

    const s2Tank = new THREE.Mesh(
      new THREE.CylinderGeometry(coreRadius * 0.95, coreRadius * 0.95, 6.4, 28),
      isAriane5 ? whiteHullMat : isAtlasAgena ? blackInterstageMat : metallicMat,
    );
    s2Tank.position.y = 4.8;
    s2Tank.castShadow = true;
    stage2.add(s2Tank);

    const upperEngineXs = mission.architecture === 'atlas-centaur' ? [-0.34, 0.34] : [0];
    for (const x of upperEngineXs) {
      const s2Bell = createEngineBell(0.25, 0.46, 1.05, nozzleMat);
      s2Bell.position.set(x, -0.1, 0);
      stage2.add(s2Bell);
      stage2Nozzles.push(new THREE.Vector3(x, -0.1, 0));
    }
  }

  // This group is the third propulsion stage only for the multi-stage Molniya.
  // The Atlas, Centaur, SLS, LVM3, and Ariane stacks get a short payload adapter here.
  const s3BaseY = s1Height + 9.0;
  stage3.position.y = s3BaseY;
  const s3Adapter = new THREE.Mesh(
    new THREE.CylinderGeometry(coreRadius * 0.94, coreRadius * 0.94, isTwoStageLauncher ? 1.0 : 2.2, 24),
    blackInterstageMat,
  );
  s3Adapter.position.y = isTwoStageLauncher ? 0.5 : 1.1;
  stage3.add(s3Adapter);

  if (!isTwoStageLauncher) {
    const s3Bell = createEngineBell(0.24, 0.48, 0.85, nozzleMat);
    s3Bell.position.y = -0.1;
    stage3.add(s3Bell);
    stage3Nozzles.push(new THREE.Vector3(0, -0.1, 0));
  }

  lander.position.set(0, s3BaseY + (isTwoStageLauncher ? 1.0 : 2.2), 0);
  if (mission.id === 'jwst') {
    lander.scale.setScalar(0.62);
  } else if (nasaLoaded) {
    lander.scale.setScalar(0.45);
  }

  // Split Curved Clamshell Fairing (Left & Right halves)
  const fairingBaseY = s3BaseY + (isTwoStageLauncher ? 0.8 : 1.8);
  const fairingR = mission.id === 'jwst' ? coreRadius * 1.24 : coreRadius * 1.12;
  const buildFairingHalf = (phiStart: number) => {
    const grp = new THREE.Group();
    grp.position.y = fairingBaseY;

    const fMat = whiteHullMat.clone();
    fMat.side = THREE.DoubleSide;

    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(fairingR, fairingR * 0.95, 5.0, 18, 1, false, phiStart, Math.PI),
      fMat,
    );
    barrel.position.y = 2.5;
    barrel.castShadow = true;

    const ogive = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, fairingR, 3.4, 18, 1, false, phiStart, Math.PI),
      fMat,
    );
    ogive.position.y = 6.7;
    ogive.castShadow = true;

    grp.add(barrel, ogive);
    return grp;
  };

  fairingLeft = buildFairingHalf(Math.PI / 2);
  fairingRight = buildFairingHalf(-Math.PI / 2);

  root.add(stage1, stage2, stage3, lander, fairingLeft, fairingRight);

  return {
    root,
    stage1,
    stage2,
    stage3,
    lesTower,
    fairingLeft,
    fairingRight,
    slaPetals,
    csm: null,
    csmServiceModule: null,
    csmCommandModule: null,
    lander,
    lmDescentStage: null,
    lmAscentStage: null,
    landerLegs,
    stage1Nozzles,
    stage2Nozzles,
    stage3Nozzles,
    landerNozzleLocal,
    lmAscentNozzleLocal: landerNozzleLocal,
    csmNozzleLocal,
    isBallastOnly: false,
    totalHeight: fairingBaseY + 8.5,
    landerHeightOffset: s3BaseY + 2.2,
  };
}

export interface RoverAssembly {
  root: THREE.Group;
  wheels: THREE.Mesh[];
}

export function buildSurfaceRoverMesh(textures: ProceduralTextureSet): RoverAssembly {
  const rover = new THREE.Group();
  const wheels: THREE.Mesh[] = [];

  const goldMat = new THREE.MeshStandardMaterial({
    map: textures.goldFoilMap,
    bumpMap: textures.goldFoilBump,
    bumpScale: 0.04,
    roughness: 0.32,
    metalness: 0.82,
  });
  const alloyMat = new THREE.MeshStandardMaterial({
    color: 0xdbe2ea,
    roughness: 0.35,
    metalness: 0.78,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x1e242b,
    roughness: 0.65,
    metalness: 0.45,
  });
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x3f4754,
    roughness: 0.78,
    metalness: 0.52,
  });

  // Apollo Lunar Roving Vehicle (LRV) — scale geometry based on NASA Apollo 17
  // press-kit dimensions and the NASA engineering illustration. This is a
  // project reconstruction, not an original NASA-authored GLB.
  // Tubular Spaceframe Chassis
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.2, 2.25), alloyMat);
  chassis.position.y = 0.52;
  chassis.castShadow = true;
  rover.add(chassis);

  const forwardBay = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.34, 0.72), goldMat);
  forwardBay.position.set(0, 0.68, 0.78);
  forwardBay.castShadow = true;
  rover.add(forwardBay);

  for (const sx of [-0.38, 0.38]) {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.42, 0.46), darkMat);
    seat.position.set(sx, 0.82, -0.12);
    rover.add(seat);
  }

  // 4 Cylindrical Wire-Mesh Wheels + Gold Fenders
  for (const sx of [-0.86, 0.86]) {
    for (const sz of [-0.76, 0.76]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.24, 18), tireMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(sx, 0.32, sz);
      wheel.castShadow = true;
      rover.add(wheel);
      wheels.push(wheel);

      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.26, 12), alloyMat);
      hub.rotation.z = Math.PI / 2;
      hub.position.set(sx, 0.32, sz);
      rover.add(hub);

      const fender = new THREE.Mesh(
        new THREE.CylinderGeometry(0.37, 0.37, 0.28, 14, 1, true, -Math.PI / 3, (Math.PI * 2) / 3),
        goldMat,
      );
      fender.rotation.z = Math.PI / 2;
      fender.position.set(sx, 0.32, sz);
      rover.add(fender);
    }
  }

  // High-Gain Parabolic Umbrella Dish & TV Mast
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.05, 10), alloyMat);
  mast.position.set(0, 1.12, 0.78);
  rover.add(mast);

  const dishMat = alloyMat.clone();
  dishMat.side = THREE.DoubleSide;
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.08, 0.16, 18, 1, true), dishMat);
  dish.position.set(-0.24, 1.54, 0.82);
  dish.rotation.x = Math.PI / 3;
  rover.add(dish);

  const camHead = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.28), alloyMat);
  camHead.position.set(0.22, 1.52, 0.78);
  rover.add(camHead);

  // Dual Bright LED Headlights
  const headlampMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    emissive: 0xbae6fd,
    emissiveIntensity: 2.2,
    roughness: 0.1,
  });
  for (const sx of [-0.42, 0.42]) {
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.1, 12), headlampMat);
    lamp.rotation.x = Math.PI / 2;
    lamp.position.set(sx, 0.72, 1.16);
    rover.add(lamp);
  }

  return { root: rover, wheels };
}

export function buildNasaEvaAstronaut(): THREE.Group | null {
  if (!areNasaModelsLoaded()) return null;
  const astroRaw = getNasaModelClone('astronaut');
  if (!astroRaw) return null;
  return normalizeNasaGroup(astroRaw, {
    targetHeight: 1.75,
    baseY: 0.0,
  });
}

export function buildSurfaceEVAExplorer(): THREE.Group {
  const nasaAstronaut = buildNasaEvaAstronaut();
  if (nasaAstronaut) return nasaAstronaut;

  const explorer = new THREE.Group();
  const suit = new THREE.MeshStandardMaterial({ color: 0xe8edf0, roughness: 0.78 });
  const gold = new THREE.MeshStandardMaterial({
    color: 0xd79b24,
    metalness: 0.72,
    roughness: 0.22,
    emissive: 0x3d2606,
    emissiveIntensity: 0.16,
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x46515b, roughness: 0.7 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.42, 6, 12), suit);
  torso.position.y = 1.02;
  explorer.add(torso);
  const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.56, 0.28), dark);
  backpack.position.set(0, 1.05, -0.28);
  explorer.add(backpack);
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.48, 6, 10), suit);
    leg.position.set(sx * 0.15, 0.39, 0);
    explorer.add(leg);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.42, 6, 8), suit);
    arm.position.set(sx * 0.36, 1.02, 0.02);
    arm.rotation.z = sx * -0.16;
    explorer.add(arm);
  }
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.23, 16, 14), suit);
  helmet.position.y = 1.57;
  explorer.add(helmet);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), gold);
  visor.scale.set(0.88, 0.78, 0.45);
  visor.position.set(0, 1.57, 0.17);
  explorer.add(visor);
  return explorer;
}

export function buildNasaOrbitingCsm(): THREE.Group | null {
  if (!areNasaModelsLoaded()) return null;
  const csmRaw = getNasaModelClone('apolloCsm');
  if (!csmRaw) return null;
  const csmOnly = splitObjectTriangles(csmRaw, [
    { id: 'apollo', predicate: (cx) => cx < -0.55 },
  ]).get('apollo');
  if (!csmOnly || csmOnly.children.length === 0) return null;
  return normalizeNasaGroup(csmOnly, {
    targetHeight: 4.5,
    baseY: -0.65,
    euler: new THREE.Euler(0, 0, Math.PI / 2),
  });
}

export function buildSurveyor3Reconstruction(): THREE.Group {
  // Scale and silhouette follow NASA/JPL's three-metre Surveyor design:
  // triangular instrument frame, three landing legs, camera mast, and sampler.
  const root = new THREE.Group();
  root.name = 'surveyor-3-reconstruction';
  const foil = new THREE.MeshStandardMaterial({ color: 0xb5a16b, roughness: 0.58, metalness: 0.55 });
  const frame = new THREE.MeshStandardMaterial({ color: 0xb8c0c5, roughness: 0.42, metalness: 0.75 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x28313a, roughness: 0.62, metalness: 0.4 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x4fc3d2, emissive: 0x124653, roughness: 0.16, metalness: 0.45 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.74, 0.68, 3), foil);
  body.position.y = 2.02;
  body.rotation.y = Math.PI / 6;
  body.castShadow = true;
  root.add(body);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.12, 3), frame);
  top.position.y = 2.42;
  top.rotation.y = Math.PI / 6;
  root.add(top);

  // Instrument platform support struts and the central descent propulsion unit.
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI * 2) / 3 + Math.PI / 6;
    const x = Math.cos(a), z = Math.sin(a);
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 1.25, 8), frame);
    strut.position.set(x * 0.42, 1.35, z * 0.42);
    strut.rotation.z = -x * 0.42;
    strut.rotation.x = z * 0.42;
    root.add(strut);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.065, 1.35, 8), frame);
    leg.position.set(x * 1.05, 0.72, z * 1.05);
    leg.rotation.z = -x * 0.52;
    leg.rotation.x = z * 0.52;
    root.add(leg);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.3, 0.1, 16), foil);
    pad.position.set(x * 1.42, 0.04, z * 1.42);
    root.add(pad);
    const vernier = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.42, 12), dark);
    vernier.position.set(x * 0.88, 0.33, z * 0.88);
    root.add(vernier);
  }
  const retro = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.7, 0.9, 16), dark);
  retro.position.y = 1.12;
  root.add(retro);

  // Television camera/mirror head and Surveyor 3 surface-sampler pantograph arm.
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.76, 8), frame);
  mast.position.set(-0.18, 2.86, 0);
  root.add(mast);
  const cameraBox = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.33, 0.38), frame);
  cameraBox.position.set(-0.18, 3.28, 0);
  root.add(cameraBox);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.13, 0.1, 16), glass);
  lens.rotation.x = Math.PI / 2;
  lens.position.set(-0.18, 3.28, 0.23);
  root.add(lens);
  const armBase = new THREE.Vector3(0.42, 2.1, 0.45);
  const elbow = new THREE.Vector3(0.9, 1.58, 1.0);
  const tip = new THREE.Vector3(1.03, 0.7, 1.42);
  const samplerArm = new THREE.Group();
  samplerArm.name = 'surveyor-sampler-arm';
  samplerArm.position.copy(armBase);
  const addArmLink = (a: THREE.Vector3, b: THREE.Vector3, radius: number) => {
    const delta = b.clone().sub(a);
    const link = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), 8), frame);
    link.position.copy(a).add(b).multiplyScalar(0.5).sub(armBase);
    link.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    samplerArm.add(link);
  };
  addArmLink(armBase, elbow, 0.055);
  addArmLink(elbow, tip, 0.045);
  const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 0.22), dark);
  scoop.position.copy(tip).sub(armBase);
  samplerArm.add(scoop);
  root.add(samplerArm);
  return root;
}

export function buildNasaPadLandmarks(): { vab: THREE.Group | null; crawler: THREE.Group | null } {
  if (!areNasaModelsLoaded()) return { vab: null, crawler: null };
  const vabRaw = getNasaModelClone('vab');
  const crawlerRaw = getNasaModelClone('crawler');
  return {
    vab: vabRaw ? normalizeNasaGroup(vabRaw, { targetHeight: 54, baseY: 0 }) : null,
    crawler: crawlerRaw ? normalizeNasaGroup(crawlerRaw, { targetMaxDim: 16, baseY: 0 }) : null,
  };
}


