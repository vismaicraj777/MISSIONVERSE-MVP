import * as THREE from 'three';

function hash2D(x: number, y: number, seed = 1): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}

function smoothNoise(x: number, y: number, seed = 1): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);

  const a = hash2D(ix, iy, seed);
  const b = hash2D(ix + 1, iy, seed);
  const c = hash2D(ix, iy + 1, seed);
  const d = hash2D(ix + 1, iy + 1, seed);

  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

export function fbm2D(x: number, y: number, octaves = 4, seed = 1): number {
  let value = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    value += amp * smoothNoise(x * freq, y * freq, seed + i * 19);
    freq *= 2.02;
    amp *= 0.5;
  }
  return value;
}

export interface ProceduralTextureSet {
  padGroundMap: THREE.CanvasTexture;
  earthGlobeMap: THREE.CanvasTexture;
  earthNightMap: THREE.CanvasTexture;
  earthRoughnessMap: THREE.CanvasTexture;
  earthCloudsMap: THREE.CanvasTexture;
  moonGlobeMap: THREE.CanvasTexture;
  moonGlobeBump: THREE.CanvasTexture;
  saturnHullMap: THREE.CanvasTexture;
  goldFoilMap: THREE.CanvasTexture;
  goldFoilBump: THREE.CanvasTexture;
  lunarGroundMap: THREE.CanvasTexture;
  lunarGroundBump: THREE.CanvasTexture;
  solarCellMap: THREE.CanvasTexture;
  oceanWaterMap: THREE.CanvasTexture;
  sunCoronaMap: THREE.CanvasTexture;
  particleGlowMap: THREE.CanvasTexture;
  dispose: () => void;
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextureSet {
  const textures: THREE.Texture[] = [];

  const registerSmooth = <T extends THREE.Texture>(tex: T, srgb = true): T => {
    tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = Math.min(8, maxAnisotropy);
    tex.needsUpdate = true;
    textures.push(tex);
    return tex;
  };

  // 1. Concrete & Brushed Asphalt Launch Pad Surface (256x256)
  const padCanvas = document.createElement('canvas');
  padCanvas.width = 256;
  padCanvas.height = 256;
  const pCtx = padCanvas.getContext('2d')!;
  const pImg = pCtx.createImageData(256, 256);
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const idx = (y * 256 + x) * 4;
      const n = fbm2D(x * 0.08, y * 0.08, 3, 7);
      const micro = hash2D(x, y, 13);
      const seam = x % 64 === 0 || y % 64 === 0 ? -24 : 0;
      const tone = Math.max(40, Math.min(200, Math.floor(112 + (n - 0.5) * 42 + (micro - 0.5) * 18 + seam)));
      pImg.data[idx] = tone;
      pImg.data[idx + 1] = tone + 2;
      pImg.data[idx + 2] = tone + 6;
      pImg.data[idx + 3] = 255;
    }
  }
  pCtx.putImageData(pImg, 0, 0);
  // Subtle hazard stripe border accent on pad tiles
  pCtx.fillStyle = 'rgba(245, 158, 11, 0.25)';
  pCtx.fillRect(0, 0, 256, 4);
  const padGroundMap = registerSmooth(new THREE.CanvasTexture(padCanvas), true);
  padGroundMap.wrapS = THREE.RepeatWrapping;
  padGroundMap.wrapT = THREE.RepeatWrapping;
  padGroundMap.repeat.set(8, 8);

  // 2. Realistic Earth Globe, Night City Lights & Ocean/Land Roughness (512x256)
  const ew = 512;
  const eh = 256;
  const earthCanvas = document.createElement('canvas');
  earthCanvas.width = ew;
  earthCanvas.height = eh;
  const eCtx = earthCanvas.getContext('2d')!;
  const eImg = eCtx.createImageData(ew, eh);

  const nightCanvas = document.createElement('canvas');
  nightCanvas.width = ew;
  nightCanvas.height = eh;
  const nCtx = nightCanvas.getContext('2d')!;
  const nImg = nCtx.createImageData(ew, eh);

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = ew;
  roughCanvas.height = eh;
  const rgCtx = roughCanvas.getContext('2d')!;
  const rgImg = rgCtx.createImageData(ew, eh);

  for (let y = 0; y < eh; y++) {
    const v = y / eh;
    const lat = Math.abs(v - 0.5) * 2;
    for (let x = 0; x < ew; x++) {
      const idx = (y * ew + x) * 4;
      const u = x / ew;
      // Wrap horizontally cleanly via cylindrical trig coordinates
      const angle = u * Math.PI * 2;
      const nx = Math.cos(angle) * 2.1 + 3.2;
      const nz = Math.sin(angle) * 2.1 + 3.2;
      const cont = fbm2D(nx, v * 5.2 + nz * 0.4, 5, 11);
      const ridge = fbm2D(nx * 2.5, v * 10.0 + nz, 4, 29);
      const micro = hash2D(x, y, 17);

      let r = 18;
      let g = 68;
      let b = 158;
      let roughVal = 65;
      let nightIntensity = 0;

      const polarThreshold = 0.84 - ridge * 0.1;
      if (lat > polarThreshold) {
        // Polar ice caps
        const ice = 228 + Math.floor(ridge * 24);
        r = ice;
        g = ice + 5;
        b = 255;
        roughVal = 175;
      } else if (cont > 0.515) {
        const elev = (cont - 0.515) * 4.5;
        const aridFactor = Math.max(0, 1 - Math.abs(lat - 0.25) * 3.4) * smoothNoise(nx * 1.4, v * 3.2, 53);
        if (elev > 0.72) {
          // High mountain peaks / snow-dusted cordillera
          r = 165 + Math.floor(ridge * 60);
          g = 162 + Math.floor(ridge * 58);
          b = 156 + Math.floor(ridge * 62);
          roughVal = 230;
        } else if (aridFactor > 0.48) {
          // Warm deserts / plateaus
          r = 188 + Math.floor(ridge * 38);
          g = 154 + Math.floor(ridge * 32);
          b = 102 + Math.floor(ridge * 24);
          roughVal = 240;
        } else {
          // Lush forest & temperate plains
          r = 36 + Math.floor(ridge * 46);
          g = 94 + Math.floor(ridge * 58);
          b = 40 + Math.floor(ridge * 28);
          roughVal = 225;
        }

        // Coastal & metropolitan night light clusters
        if (lat < 0.65 && cont < 0.63) {
          const metro = fbm2D(nx * 6.5, v * 18.0 + nz * 2.0, 3, 81);
          if (metro > 0.62 && micro > 0.45) {
            nightIntensity = Math.min(1, (metro - 0.58) * 3.2);
          }
        }
      } else {
        // Ocean bathymetry & turquoise continental shelves
        const shelf = Math.max(0, (cont - 0.43) / 0.085);
        r = Math.floor(10 + shelf * 24 + micro * 4);
        g = Math.floor(46 + shelf * 88 + micro * 6);
        b = Math.floor(126 + shelf * 84 + micro * 6);
        roughVal = 56;
      }

      eImg.data[idx] = Math.min(255, r);
      eImg.data[idx + 1] = Math.min(255, g);
      eImg.data[idx + 2] = Math.min(255, b);
      eImg.data[idx + 3] = 255;

      rgImg.data[idx] = roughVal;
      rgImg.data[idx + 1] = roughVal;
      rgImg.data[idx + 2] = roughVal;
      rgImg.data[idx + 3] = 255;

      nImg.data[idx] = Math.floor(nightIntensity * 255);
      nImg.data[idx + 1] = Math.floor(nightIntensity * 205);
      nImg.data[idx + 2] = Math.floor(nightIntensity * 115);
      nImg.data[idx + 3] = 255;
    }
  }
  eCtx.putImageData(eImg, 0, 0);
  nCtx.putImageData(nImg, 0, 0);
  rgCtx.putImageData(rgImg, 0, 0);

  const earthGlobeMap = registerSmooth(new THREE.CanvasTexture(earthCanvas), true);
  const earthNightMap = registerSmooth(new THREE.CanvasTexture(nightCanvas), true);
  const earthRoughnessMap = registerSmooth(new THREE.CanvasTexture(roughCanvas), false);

  // 3. Soft Swirling Earth Cloud Layer (512x256)
  const cloudCanvas = document.createElement('canvas');
  cloudCanvas.width = 512;
  cloudCanvas.height = 256;
  const cCtx = cloudCanvas.getContext('2d')!;
  const cImg = cCtx.createImageData(512, 256);
  for (let y = 0; y < 256; y++) {
    const v = y / 256;
    for (let x = 0; x < 512; x++) {
      const idx = (y * 512 + x) * 4;
      const angle = (x / 512) * Math.PI * 2;
      const swirl = Math.sin(v * 9.0 + Math.cos(angle * 2) * 1.4) * 0.35;
      const n = fbm2D(Math.cos(angle) * 3.0 + 5.0 + swirl, Math.sin(angle) * 3.0 + v * 6.5, 5, 99);
      const alpha = Math.max(0, Math.min(255, Math.floor((n - 0.46) * 620)));
      cImg.data[idx] = 248;
      cImg.data[idx + 1] = 251;
      cImg.data[idx + 2] = 255;
      cImg.data[idx + 3] = alpha;
    }
  }
  cCtx.putImageData(cImg, 0, 0);
  const earthCloudsMap = registerSmooth(new THREE.CanvasTexture(cloudCanvas), true);

  // 4. High-Detail Cratered Moon Globe & Bump Map (512x256)
  const mw = 512;
  const mh = 256;
  const moonCanvas = document.createElement('canvas');
  moonCanvas.width = mw;
  moonCanvas.height = mh;
  const mCtx = moonCanvas.getContext('2d')!;
  const mImg = mCtx.createImageData(mw, mh);

  const moonBumpCanvas = document.createElement('canvas');
  moonBumpCanvas.width = mw;
  moonBumpCanvas.height = mh;
  const mbCtx = moonBumpCanvas.getContext('2d')!;
  const mbImg = mbCtx.createImageData(mw, mh);

  const moonCraters: Array<{ u: number; v: number; r: number; ray: boolean }> = [];
  for (let i = 0; i < 65; i++) {
    moonCraters.push({
      u: hash2D(i, 1, 41),
      v: 0.14 + hash2D(i, 2, 42) * 0.72,
      r: 0.014 + Math.pow(hash2D(i, 3, 43), 2) * 0.065,
      ray: i % 9 === 0,
    });
  }

  for (let y = 0; y < mh; y++) {
    const v = y / mh;
    for (let x = 0; x < mw; x++) {
      const idx = (y * mw + x) * 4;
      const u = x / mw;
      const mare = fbm2D(u * 4.5 + 1.2, v * 3.0 + 0.7, 4, 44);
      const highland = fbm2D(u * 14, v * 9, 4, 71);
      let lum = 92 + mare * 82 + (highland - 0.5) * 34;
      let bump = 128 + (highland - 0.5) * 65;

      for (const c of moonCraters) {
        const du = Math.min(Math.abs(u - c.u), 1 - Math.abs(u - c.u));
        const dv = (v - c.v) * 0.6;
        const d = Math.hypot(du, dv);
        if (d < c.r * 1.4) {
          const norm = d / c.r;
          if (norm < 0.85) {
            lum -= 18 * (1 - norm);
            bump -= 55 * (1 - norm * norm);
          } else {
            const rim = Math.sin(((1.4 - norm) / 0.55) * Math.PI);
            lum += 28 * rim;
            bump += 45 * rim;
          }
        } else if (c.ray && d < c.r * 3.6) {
          const ang = Math.atan2(v - c.v, du);
          const streak = Math.max(0, Math.sin(ang * 14 + c.u * 40)) * (1 - d / (c.r * 3.6));
          lum += streak * 32;
        }
      }

      const cVal = Math.max(48, Math.min(238, Math.floor(lum)));
      mImg.data[idx] = cVal;
      mImg.data[idx + 1] = cVal;
      mImg.data[idx + 2] = Math.min(255, cVal + 4);
      mImg.data[idx + 3] = 255;

      const bVal = Math.max(0, Math.min(255, Math.floor(bump)));
      mbImg.data[idx] = bVal;
      mbImg.data[idx + 1] = bVal;
      mbImg.data[idx + 2] = bVal;
      mbImg.data[idx + 3] = 255;
    }
  }
  mCtx.putImageData(mImg, 0, 0);
  mbCtx.putImageData(mbImg, 0, 0);
  const moonGlobeMap = registerSmooth(new THREE.CanvasTexture(moonCanvas), true);
  const moonGlobeBump = registerSmooth(new THREE.CanvasTexture(moonBumpCanvas), false);

  // 5. Realistic Saturn V Hull Texture (512x512)
  const hullCanvas = document.createElement('canvas');
  hullCanvas.width = 512;
  hullCanvas.height = 512;
  const hCtx = hullCanvas.getContext('2d')!;
  hCtx.fillStyle = '#f1f5f9';
  hCtx.fillRect(0, 0, 512, 512);

  // Vertical fuselage corrugation & panel rivets
  hCtx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
  hCtx.lineWidth = 1;
  for (let gx = 0; gx < 512; gx += 32) {
    hCtx.beginPath();
    hCtx.moveTo(gx, 0);
    hCtx.lineTo(gx, 512);
    hCtx.stroke();
  }
  for (let gy = 0; gy < 512; gy += 64) {
    hCtx.beginPath();
    hCtx.moveTo(0, gy);
    hCtx.lineTo(512, gy);
    hCtx.stroke();
  }

  // Authentic black-and-white Saturn V roll pattern
  hCtx.fillStyle = '#111827';
  hCtx.fillRect(0, 340, 128, 172);
  hCtx.fillRect(256, 340, 128, 172);
  hCtx.fillRect(0, 0, 256, 48);

  // Red "USA" stripes & US Flag mark
  hCtx.fillStyle = '#b91c1c';
  hCtx.fillRect(156, 170, 52, 8);
  hCtx.fillRect(156, 186, 52, 8);
  hCtx.fillStyle = '#1e3a8a';
  hCtx.fillRect(156, 170, 22, 16);

  hCtx.fillStyle = '#b91c1c';
  hCtx.font = 'bold 30px sans-serif';
  hCtx.fillText('USA', 410, 220);

  const saturnHullMap = registerSmooth(new THREE.CanvasTexture(hullCanvas), true);
  saturnHullMap.wrapS = THREE.RepeatWrapping;

  // 6. Multi-Layered Crinkled Gold Kapton Foil + Bump Map (256x256)
  const foilCanvas = document.createElement('canvas');
  foilCanvas.width = 256;
  foilCanvas.height = 256;
  const fCtx = foilCanvas.getContext('2d')!;
  const foilBumpCanvas = document.createElement('canvas');
  foilBumpCanvas.width = 256;
  foilBumpCanvas.height = 256;
  const fbCtx = foilBumpCanvas.getContext('2d')!;

  const fImg = fCtx.createImageData(256, 256);
  const fbImg = fbCtx.createImageData(256, 256);
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const idx = (y * 256 + x) * 4;
      const crinkle = Math.abs(fbm2D(x * 0.14, y * 0.14, 4, 55) - 0.5) * 2.0;
      const sheen = fbm2D(x * 0.05 + 12, y * 0.05 + 8, 3, 66);
      const v = 0.64 + (1 - crinkle) * 0.36 + (sheen - 0.5) * 0.16;

      fImg.data[idx] = Math.min(255, Math.floor(245 * v));
      fImg.data[idx + 1] = Math.min(255, Math.floor(184 * v));
      fImg.data[idx + 2] = Math.min(255, Math.floor(42 * v));
      fImg.data[idx + 3] = 255;

      const bVal = Math.min(255, Math.max(0, Math.floor((1 - crinkle) * 245)));
      fbImg.data[idx] = bVal;
      fbImg.data[idx + 1] = bVal;
      fbImg.data[idx + 2] = bVal;
      fbImg.data[idx + 3] = 255;
    }
  }
  fCtx.putImageData(fImg, 0, 0);
  fbCtx.putImageData(fbImg, 0, 0);
  const goldFoilMap = registerSmooth(new THREE.CanvasTexture(foilCanvas), true);
  goldFoilMap.wrapS = THREE.RepeatWrapping;
  goldFoilMap.wrapT = THREE.RepeatWrapping;
  const goldFoilBump = registerSmooth(new THREE.CanvasTexture(foilBumpCanvas), false);
  goldFoilBump.wrapS = THREE.RepeatWrapping;
  goldFoilBump.wrapT = THREE.RepeatWrapping;

  // 7. Realistic Fine-Grained Lunar Regolith + Micro-Crater Bump (512x512)
  const regCanvas = document.createElement('canvas');
  regCanvas.width = 512;
  regCanvas.height = 512;
  const rCtx = regCanvas.getContext('2d')!;
  const regBumpCanvas = document.createElement('canvas');
  regBumpCanvas.width = 512;
  regBumpCanvas.height = 512;
  const rbCtx = regBumpCanvas.getContext('2d')!;

  const rImg = rCtx.createImageData(512, 512);
  const rbImg = rbCtx.createImageData(512, 512);
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const idx = (y * 512 + x) * 4;
      const wave = fbm2D(x * 0.035, y * 0.035, 4, 88);
      const grain = hash2D(x, y, 91);
      const pit = fbm2D(x * 0.16, y * 0.16, 2, 105);
      const pitShade = pit < 0.28 ? -26 : pit > 0.72 ? 18 : 0;
      const shade = Math.max(76, Math.min(215, Math.floor(138 + (wave - 0.5) * 48 + (grain - 0.5) * 24 + pitShade)));
      rImg.data[idx] = shade;
      rImg.data[idx + 1] = shade;
      rImg.data[idx + 2] = Math.min(255, shade + 4);
      rImg.data[idx + 3] = 255;

      const bump = Math.max(0, Math.min(255, Math.floor(128 + (wave - 0.5) * 90 + (grain - 0.5) * 55 + pitShade * 2)));
      rbImg.data[idx] = bump;
      rbImg.data[idx + 1] = bump;
      rbImg.data[idx + 2] = bump;
      rbImg.data[idx + 3] = 255;
    }
  }
  rCtx.putImageData(rImg, 0, 0);
  rbCtx.putImageData(rbImg, 0, 0);
  const lunarGroundMap = registerSmooth(new THREE.CanvasTexture(regCanvas), true);
  lunarGroundMap.wrapS = THREE.RepeatWrapping;
  lunarGroundMap.wrapT = THREE.RepeatWrapping;
  lunarGroundMap.repeat.set(16, 16);
  const lunarGroundBump = registerSmooth(new THREE.CanvasTexture(regBumpCanvas), false);
  lunarGroundBump.wrapS = THREE.RepeatWrapping;
  lunarGroundBump.wrapT = THREE.RepeatWrapping;
  lunarGroundBump.repeat.set(16, 16);

  // 8. Photovoltaic Solar Array Texture (256x256)
  const solarCanvas = document.createElement('canvas');
  solarCanvas.width = 256;
  solarCanvas.height = 256;
  const sCtx = solarCanvas.getContext('2d')!;
  const grad = sCtx.createLinearGradient(0, 0, 256, 256);
  grad.addColorStop(0, '#0c2356');
  grad.addColorStop(0.5, '#173e8f');
  grad.addColorStop(1, '#0d2b68');
  sCtx.fillStyle = grad;
  sCtx.fillRect(0, 0, 256, 256);
  sCtx.strokeStyle = 'rgba(191, 219, 254, 0.55)';
  sCtx.lineWidth = 2;
  for (let gx = 0; gx <= 256; gx += 32) {
    sCtx.beginPath();
    sCtx.moveTo(gx, 0);
    sCtx.lineTo(gx, 256);
    sCtx.stroke();
  }
  for (let gy = 0; gy <= 256; gy += 64) {
    sCtx.beginPath();
    sCtx.moveTo(0, gy);
    sCtx.lineTo(256, gy);
    sCtx.stroke();
  }
  sCtx.strokeStyle = 'rgba(147, 197, 253, 0.2)';
  sCtx.lineWidth = 1;
  for (let gy = 16; gy < 256; gy += 16) {
    sCtx.beginPath();
    sCtx.moveTo(0, gy);
    sCtx.lineTo(256, gy);
    sCtx.stroke();
  }
  const solarCellMap = registerSmooth(new THREE.CanvasTexture(solarCanvas), true);

  // 9. Animated Ocean Water Shimmer Texture (256x256)
  const oceanCanvas = document.createElement('canvas');
  oceanCanvas.width = 256;
  oceanCanvas.height = 256;
  const oCtx = oceanCanvas.getContext('2d')!;
  const oImg = oCtx.createImageData(256, 256);
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const idx = (y * 256 + x) * 4;
      const w1 = Math.sin((x / 256) * Math.PI * 8 + Math.cos((y / 256) * Math.PI * 4) * 1.6);
      const w2 = fbm2D(x * 0.06, y * 0.06, 3, 212);
      const crest = Math.max(0, w1 * 0.5 + (w2 - 0.5) * 1.4);
      oImg.data[idx] = Math.min(255, Math.floor(14 + crest * 55));
      oImg.data[idx + 1] = Math.min(255, Math.floor(78 + crest * 88));
      oImg.data[idx + 2] = Math.min(255, Math.floor(142 + crest * 85));
      oImg.data[idx + 3] = 255;
    }
  }
  oCtx.putImageData(oImg, 0, 0);
  const oceanWaterMap = registerSmooth(new THREE.CanvasTexture(oceanCanvas), true);
  oceanWaterMap.wrapS = THREE.RepeatWrapping;
  oceanWaterMap.wrapT = THREE.RepeatWrapping;
  oceanWaterMap.repeat.set(14, 14);

  // 10. Soft Sun Corona Flare Sprite (256x256)
  const coronaCanvas = document.createElement('canvas');
  coronaCanvas.width = 256;
  coronaCanvas.height = 256;
  const crCtx = coronaCanvas.getContext('2d')!;
  const crGrad = crCtx.createRadialGradient(128, 128, 2, 128, 128, 128);
  crGrad.addColorStop(0, 'rgba(255, 252, 240, 1)');
  crGrad.addColorStop(0.16, 'rgba(255, 232, 175, 0.85)');
  crGrad.addColorStop(0.45, 'rgba(253, 186, 116, 0.25)');
  crGrad.addColorStop(1, 'rgba(253, 186, 116, 0)');
  crCtx.fillStyle = crGrad;
  crCtx.fillRect(0, 0, 256, 256);
  const sunCoronaMap = registerSmooth(new THREE.CanvasTexture(coronaCanvas), true);

  // 11. Soft Volumetric Particle Glow Sprite (128x128)
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = 128;
  glowCanvas.height = 128;
  const gCtx = glowCanvas.getContext('2d')!;
  const pGrad = gCtx.createRadialGradient(64, 64, 2, 64, 64, 64);
  pGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  pGrad.addColorStop(0.35, 'rgba(255, 255, 255, 0.78)');
  pGrad.addColorStop(0.7, 'rgba(255, 255, 255, 0.22)');
  pGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  gCtx.fillStyle = pGrad;
  gCtx.fillRect(0, 0, 128, 128);
  const particleGlowMap = registerSmooth(new THREE.CanvasTexture(glowCanvas), true);

  return {
    padGroundMap,
    earthGlobeMap,
    earthNightMap,
    earthRoughnessMap,
    earthCloudsMap,
    moonGlobeMap,
    moonGlobeBump,
    saturnHullMap,
    goldFoilMap,
    goldFoilBump,
    lunarGroundMap,
    lunarGroundBump,
    solarCellMap,
    oceanWaterMap,
    sunCoronaMap,
    particleGlowMap,
    dispose: () => {
      textures.forEach((t) => t.dispose());
    },
  };
}
