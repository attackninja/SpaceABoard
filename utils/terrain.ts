import { PlanetConfig, PlanetType } from '../types';
import { WORLD_LENGTH } from '../constants';

const fract = (x: number) => x - Math.floor(x);
const hash = (x: number, z: number) => {
    return fract(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453);
}

// 2D Value Noise
const noise = (x: number, z: number) => {
    const iX = Math.floor(x);
    const iZ = Math.floor(z);
    const fX = fract(x);
    const fZ = fract(z);
    const uX = fX * fX * (3.0 - 2.0 * fX);
    const uZ = fZ * fZ * (3.0 - 2.0 * fZ);
    const a = hash(iX, iZ);
    const b = hash(iX + 1.0, iZ);
    const c = hash(iX, iZ + 1.0);
    const d = hash(iX + 1.0, iZ + 1.0);
    return (a * (1.0 - uX) + b * uX) * (1.0 - uZ) + 
           (c * (1.0 - uX) + d * uX) * uZ;
};

// Fractal Brownian Motion
const fbm = (x: number, z: number, octaves: number, persistence: number, lacunarity: number) => {
    let total = 0;
    let amplitude = 1;
    let frequency = 1;
    for(let i=0; i<octaves; i++) {
        total += noise(x * frequency, z * frequency) * amplitude;
        amplitude *= persistence;
        frequency *= lacunarity;
    }
    return total;
};

export const getTerrainHeight = (x: number, z: number, planet: PlanetConfig) => {
  // Global Downhill Slope (The Mountain Face)
  const zProgress = (z + WORLD_LENGTH / 2) / WORLD_LENGTH; // 0 start -> 1 end
  const slopeHeight = (1 - zProgress) * planet.mountainHeight;

  // -- MARS SPECIFIC REALISTIC GENERATION (Olympus Mons) --
  if (planet.name === PlanetType.MARS) {
      // Olympus Mons is a shield volcano. It doesn't have jagged cliffs like a canyon.
      // Instead, it has "Lava Levees" - cooled walls of lava channels.
      // The gameplay happens inside a major lava channel.
      
      const absX = Math.abs(x);
      const channelWidth = 140; // The playable "track" width
      
      // 1. Channel Floor (Slightly concave)
      // Smooth lava flow center
      let terrain = Math.pow(absX / channelWidth, 2) * 5; 

      // 2. The Levees (The "Mountains" on sides)
      // Unlike jagged cliffs, these are mounded ridges.
      if (absX > channelWidth) {
           const dist = absX - channelWidth;
           
           // Rise up to the ridge crest
           const rampWidth = 200;
           const rampProgress = Math.min(dist / rampWidth, 1.0);
           const smoothRamp = rampProgress * rampProgress * (3 - 2 * rampProgress);
           
           // Levee height ~80m (Visual barrier but realistic scale for a massive lava flow)
           const leveeHeight = 80;
           terrain += smoothRamp * leveeHeight;

           // 3. Flank Texture (Outside the channel)
           // "Aureole" terrain: rough, ridged, undulating lava lobes
           // Low frequency, high amplitude rolling hills
           const lobes = noise(x * 0.003, z * 0.003);
           terrain += lobes * 50 * rampProgress; // Only apply outside
           
           // 4. Shield Drop-off
           // The further out you go, the more it drops off (Shield volcano curvature)
           // This replaces the "infinite wall" look with a "horizon" look
           if (dist > rampWidth) {
               const dropDist = dist - rampWidth;
               terrain -= Math.pow(dropDist, 1.5) * 0.005;
           }
      }

      // 5. Surface Detail (Rocky/Dusty texture)
      // FBM for grit
      const surfaceNoise = fbm(x * 0.02, z * 0.02, 3, 0.5, 2.0);
      terrain += (surfaceNoise - 0.5) * 10;
      
      return slopeHeight + terrain - 200;
  }

  // -- GENERIC GENERATION FOR OTHER PLANETS --
  
  let profileHeight = 0;
  const absX = Math.abs(x);

  if (planet.terrainProfile === 'ridge') {
      // Moon/Ice: Sharp drop off
      profileHeight = -Math.pow(absX / 10, 1.5) * 2;
      profileHeight = Math.max(profileHeight, -3000);
  }
  else if (planet.terrainProfile === 'cloud') {
      // Rolling waves
      profileHeight = Math.cos(x * 0.005) * 50 - Math.pow(absX, 2) / 6000;
  }
  else if (planet.terrainProfile === 'pipe') {
      // Spacecraft: Artificial half-pipe.
      profileHeight = -Math.pow(absX / 40, 2) * 5;
      profileHeight = Math.max(profileHeight, -2000);
  }
  // Note: 'shield' profile fallback removed as Mars has custom block above.
  // Using generic fallback for any other shield types if added later.
  else if (planet.terrainProfile === 'shield') {
      profileHeight = -Math.pow(absX, 2) / 4500;
  }

  // Noise / Texture
  const largeScale = 0.0005; 
  let terrainNoise = fbm(x * largeScale, z * largeScale, 4, 0.5, 2.0);
  
  // Amplitude based on planet type
  let noiseAmplitude = 500 * planet.terrainRoughness;
  if (planet.terrainProfile === 'pipe') noiseAmplitude = 50; 
  
  let finalNoise = (terrainNoise - 0.5) * noiseAmplitude;

  // Flatten Center (The Path)
  if (absX < 150) {
      finalNoise *= 0.15; 
  }

  // Cliffs/Ridges on sides for non-Mars
  if (absX >= 150) {
      const cliffNoise = noise(x * 0.001, z * 0.001); 
      const ramp = Math.min((absX - 150) / 1000, 1);
      const cliffIntensity = Math.pow(ramp, 2); 
      finalNoise += cliffNoise * 600 * cliffIntensity * planet.terrainRoughness;
      const detailNoise = noise(x * 0.01, z * 0.01);
      finalNoise += detailNoise * 100 * cliffIntensity;
  }

  // Micro Detail
  const microScale = 0.8; 
  let microNoise = noise(x * microScale, z * microScale);
  if (planet.name === PlanetType.MOON) {
     microNoise = Math.pow(microNoise, 2); 
  }
  const microAmplitude = 1.0;

  return slopeHeight + profileHeight + finalNoise + (microNoise * microAmplitude) - 200; 
};

export const getTerrainNormal = (x: number, z: number, planet: PlanetConfig) => {
    const offset = 2.0; // Sample closer for sharper normals
    const hL = getTerrainHeight(x - offset, z, planet);
    const hR = getTerrainHeight(x + offset, z, planet);
    const hD = getTerrainHeight(x, z - offset, planet);
    const hU = getTerrainHeight(x, z + offset, planet);

    const norm = {
        x: hL - hR,
        y: 2.0 * offset, 
        z: hD - hU
    };
    
    const len = Math.sqrt(norm.x*norm.x + norm.y*norm.y + norm.z*norm.z);
    return { x: norm.x/len, y: norm.y/len, z: norm.z/len };
};