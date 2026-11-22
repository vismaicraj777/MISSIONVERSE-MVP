import * as THREE from 'three';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export type NasaModelKey =
  | 'saturnV'
  | 'apolloLm'
  | 'apolloCsm'
  | 'jwst'
  | 'atlas'
  | 'agena'
  | 'astronaut'
  | 'mobileLauncher'
  | 'crawler'
  | 'vab';

const MODEL_PATHS: Record<NasaModelKey, string> = {
  saturnV: '/you/models/saturn-v.glb',
  apolloLm: '/you/models/apollo-lm.glb',
  apolloCsm: '/you/models/apollo-csm.glb',
  jwst: '/you/models/jwst-a.glb',
  atlas: '/you/models/atlas.glb',
  agena: '/you/models/agena.glb',
  astronaut: '/you/models/astronaut.glb',
  mobileLauncher: '/you/models/mobile-launcher.glb',
  crawler: '/you/models/crawler.glb',
  vab: '/you/models/vab.glb',
};

const modelCache = new Map<NasaModelKey, THREE.Group>();
let preloadPromise: Promise<void> | null = null;
let modelsLoaded = false;

export function areNasaModelsLoaded(): boolean {
  return modelsLoaded;
}

export function hasNasaModel(key: NasaModelKey): boolean {
  return modelCache.has(key);
}

function tuneMaterial(mat: THREE.Material): THREE.Material {
  const m = mat.clone();
  if (m instanceof THREE.MeshStandardMaterial) {
    m.envMapIntensity = 1.2;
    const lum = 0.2126 * m.color.r + 0.7152 * m.color.g + 0.0722 * m.color.b;
    if (!m.map && lum < 0.05) {
      m.color.setRGB(0.14, 0.16, 0.2);
      m.roughness = Math.min(m.roughness, 0.55);
    }
    if (m.map) {
      m.map.colorSpace = THREE.SRGBColorSpace;
      m.map.needsUpdate = true;
    }
    if (m.transparent && m.opacity >= 0.99) {
      m.transparent = false;
    }
    m.needsUpdate = true;
  }
  return m;
}

function prepareLoadedScene(scene: THREE.Group): THREE.Group {
  scene.updateMatrixWorld(true);
  scene.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
      if (Array.isArray(obj.material)) {
        obj.material = obj.material.map(tuneMaterial);
      } else if (obj.material) {
        obj.material = tuneMaterial(obj.material);
      }
    }
  });
  return scene;
}

export function preloadNasaModels(onReady?: () => void): Promise<void> {
  if (modelsLoaded) {
    onReady?.();
    return Promise.resolve();
  }
  if (preloadPromise) {
    if (onReady) {
      void preloadPromise.then(onReady);
    }
    return preloadPromise;
  }

  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('/you/draco/');
  dracoLoader.preload();

  const loader = new GLTFLoader();
  loader.setDRACOLoader(dracoLoader);

  const entries = Object.entries(MODEL_PATHS) as Array<[NasaModelKey, string]>;

  preloadPromise = Promise.allSettled(
    entries.map(
      ([key, url]) =>
        new Promise<void>((resolve) => {
          loader.load(
            url,
            (gltf) => {
              modelCache.set(key, prepareLoadedScene(gltf.scene));
              resolve();
            },
            undefined,
            (err) => {
              console.error(`Failed to load NASA 3D model "${key}" (${url}):`, err);
              resolve();
            },
          );
        }),
    ),
  ).then(() => {
    modelsLoaded = modelCache.size > 0;
    dracoLoader.dispose();
    onReady?.();
  });

  return preloadPromise;
}

// Start preloading immediately when the module is imported
if (typeof window !== 'undefined') {
  void preloadNasaModels();
}

export function getNasaModelClone(key: NasaModelKey): THREE.Group | null {
  const src = modelCache.get(key);
  if (!src) return null;
  const clone = src.clone(true);
  clone.updateMatrixWorld(true);
  return clone;
}

export function normalizeNasaGroup(
  src: THREE.Group,
  options: {
    targetHeight?: number;
    targetMaxDim?: number;
    baseY?: number;
    euler?: THREE.Euler;
    centerXZ?: boolean;
  },
): THREE.Group {
  const wrapper = new THREE.Group();
  if (options.euler) {
    src.rotation.copy(options.euler);
  }
  src.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(src);
  const size = new THREE.Vector3();
  box.getSize(size);

  let scale = 1;
  if (options.targetHeight && size.y > 1e-4) {
    scale = options.targetHeight / size.y;
  } else if (options.targetMaxDim) {
    const maxDim = Math.max(size.x, size.y, size.z, 1e-4);
    scale = options.targetMaxDim / maxDim;
  }

  src.scale.multiplyScalar(scale);
  src.updateMatrixWorld(true);

  const scaledBox = new THREE.Box3().setFromObject(src);
  const scaledCenter = new THREE.Vector3();
  scaledBox.getCenter(scaledCenter);

  if (options.centerXZ !== false) {
    src.position.x -= scaledCenter.x;
    src.position.z -= scaledCenter.z;
  }
  const baseY = options.baseY ?? 0;
  src.position.y += baseY - scaledBox.min.y;

  wrapper.add(src);
  wrapper.updateMatrixWorld(true);
  return wrapper;
}

export interface TriangleSliceFilter {
  id: string;
  predicate: (cx: number, cy: number, cz: number) => boolean;
}

export function splitObjectTriangles(
  root: THREE.Object3D,
  slices: TriangleSliceFilter[],
): Map<string, THREE.Group> {
  root.updateMatrixWorld(true);
  const invRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map<string, THREE.Group>();
  for (const s of slices) {
    buckets.set(s.id, new THREE.Group());
  }

  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vC = new THREE.Vector3();

  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh) || !obj.geometry) return;
    const geom = obj.geometry as THREE.BufferGeometry;
    const posAttr = geom.getAttribute('position');
    if (!posAttr) return;

    const relMatrix = new THREE.Matrix4().multiplyMatrices(invRoot, obj.matrixWorld);
    const normAttr = geom.getAttribute('normal');
    const uvAttr = geom.getAttribute('uv');
    const indexAttr = geom.getIndex();

    const groups =
      geom.groups && geom.groups.length > 0
        ? geom.groups
        : [{ start: 0, count: indexAttr ? indexAttr.count : posAttr.count, materialIndex: 0 }];

    const triMaterials = Array.isArray(obj.material) ? obj.material : [obj.material];

    const perSliceMat = new Map<
      string,
      Map<number, { pos: number[]; norm: number[]; uv: number[] }>
    >();
    for (const s of slices) {
      perSliceMat.set(s.id, new Map());
    }

    const normalMat = new THREE.Matrix3().getNormalMatrix(relMatrix);
    const nA = new THREE.Vector3();
    const nB = new THREE.Vector3();
    const nC = new THREE.Vector3();

    for (const grp of groups) {
      const mIdx = grp.materialIndex ?? 0;
      const start = grp.start;
      const end = start + grp.count;

      for (let i = start; i + 2 < end; i += 3) {
        const ia = indexAttr ? indexAttr.getX(i) : i;
        const ib = indexAttr ? indexAttr.getX(i + 1) : i + 1;
        const ic = indexAttr ? indexAttr.getX(i + 2) : i + 2;

        vA.fromBufferAttribute(posAttr, ia).applyMatrix4(relMatrix);
        vB.fromBufferAttribute(posAttr, ib).applyMatrix4(relMatrix);
        vC.fromBufferAttribute(posAttr, ic).applyMatrix4(relMatrix);

        const cx = (vA.x + vB.x + vC.x) / 3;
        const cy = (vA.y + vB.y + vC.y) / 3;
        const cz = (vA.z + vB.z + vC.z) / 3;

        for (const s of slices) {
          if (!s.predicate(cx, cy, cz)) continue;
          const sliceMap = perSliceMat.get(s.id)!;
          let acc = sliceMap.get(mIdx);
          if (!acc) {
            acc = { pos: [], norm: [], uv: [] };
            sliceMap.set(mIdx, acc);
          }

          acc.pos.push(vA.x, vA.y, vA.z, vB.x, vB.y, vB.z, vC.x, vC.y, vC.z);

          if (normAttr) {
            nA.fromBufferAttribute(normAttr, ia).applyMatrix3(normalMat).normalize();
            nB.fromBufferAttribute(normAttr, ib).applyMatrix3(normalMat).normalize();
            nC.fromBufferAttribute(normAttr, ic).applyMatrix3(normalMat).normalize();
            acc.norm.push(nA.x, nA.y, nA.z, nB.x, nB.y, nB.z, nC.x, nC.y, nC.z);
          }

          if (uvAttr) {
            acc.uv.push(
              uvAttr.getX(ia),
              uvAttr.getY(ia),
              uvAttr.getX(ib),
              uvAttr.getY(ib),
              uvAttr.getX(ic),
              uvAttr.getY(ic),
            );
          }
          break;
        }
      }
    }

    for (const s of slices) {
      const sliceMap = perSliceMat.get(s.id)!;
      const bucketGroup = buckets.get(s.id)!;
      for (const [mIdx, acc] of sliceMap.entries()) {
        if (acc.pos.length === 0) continue;
        const newGeom = new THREE.BufferGeometry();
        newGeom.setAttribute('position', new THREE.Float32BufferAttribute(acc.pos, 3));
        if (acc.norm.length === acc.pos.length) {
          newGeom.setAttribute('normal', new THREE.Float32BufferAttribute(acc.norm, 3));
        } else {
          newGeom.computeVertexNormals();
        }
        if (acc.uv.length === (acc.pos.length / 3) * 2) {
          newGeom.setAttribute('uv', new THREE.Float32BufferAttribute(acc.uv, 2));
        }
        const mat = triMaterials[mIdx] ?? triMaterials[0];
        const mesh = new THREE.Mesh(newGeom, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        bucketGroup.add(mesh);
      }
    }
  });

  return buckets;
}
