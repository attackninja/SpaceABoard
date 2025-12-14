import React, { useMemo, useRef, useLayoutEffect } from 'react';
import * as THREE from 'three';
import { PlanetConfig, PlanetType } from '../types';
import { WORLD_LENGTH } from '../constants';
import { getTerrainHeight } from '../utils/terrain';

interface TerrainProps {
  planet: PlanetConfig;
}

const Route: React.FC<{ planet: PlanetConfig }> = ({ planet }) => {
  // High density geometry for the track, slightly wider to blend
  const width = 200; 
  const length = WORLD_LENGTH;
  // High resolution segments for smooth curves
  const segmentsW = 64; 
  const segmentsL = 1024; 

  const { geometry, texture, alphaMap } = useMemo(() => {
     // 1. Geometry
     const geo = new THREE.PlaneGeometry(width, length, segmentsW, segmentsL);
     geo.rotateX(-Math.PI / 2);
     const pos = geo.attributes.position;
     const v = new THREE.Vector3();
     
     for (let i = 0; i < pos.count; i++) {
         v.fromBufferAttribute(pos, i);
         // Get exact height from the terrain function
         const h = getTerrainHeight(v.x, v.z, planet);
         // Slight offset to prevent z-fighting, but relies mostly on polygonOffset
         pos.setY(i, h + 0.1); 
     }
     geo.computeVertexNormals();

     // 2. Texture Generation (Procedural Natural Ground)
     const canvas = document.createElement('canvas');
     canvas.width = 512;
     canvas.height = 1024;
     const ctx = canvas.getContext('2d');
     
     if (ctx) {
        // Base Color from planet config
        ctx.fillStyle = planet.groundColor;
        ctx.fillRect(0,0,512,1024);
        
        // Parse hex for pixel manipulation
        const hex = planet.groundColor.replace('#', '');
        const r = parseInt(hex.substring(0,2), 16);
        const g = parseInt(hex.substring(2,4), 16);
        const b = parseInt(hex.substring(4,6), 16);

        // Add heavy noise/grain for "realistic" high-res ground
        const imgData = ctx.getImageData(0,0,512,1024);
        for(let i=0; i<imgData.data.length; i+=4) {
            // Random variation (Dust/Grain)
            const grain = (Math.random() - 0.5) * 30;
            
            // Subtle longitudinal streaks for wind-blown look
            // This gives a sense of speed and direction without looking like a road
            const y = Math.floor((i / 4) / 512);
            const x = (i / 4) % 512;
            const streak = Math.sin(x * 0.05) * Math.cos(y * 0.01) * 15;

            const valR = Math.max(0, Math.min(255, r + grain + streak));
            const valG = Math.max(0, Math.min(255, g + grain + streak));
            const valB = Math.max(0, Math.min(255, b + grain + streak));

            imgData.data[i] = valR;
            imgData.data[i+1] = valG;
            imgData.data[i+2] = valB;
            imgData.data[i+3] = 255;
        }
        ctx.putImageData(imgData, 0, 0);
     }
     
     const tex = new THREE.CanvasTexture(canvas);
     tex.wrapS = THREE.RepeatWrapping;
     tex.wrapT = THREE.RepeatWrapping;
     tex.repeat.set(1, 40); // Repeat texture along the track length
     tex.anisotropy = 16;
     
     // 3. Alpha Map for soft edges blending into terrain
     const alphaCanvas = document.createElement('canvas');
     alphaCanvas.width = 256;
     alphaCanvas.height = 1;
     const aCtx = alphaCanvas.getContext('2d');
     if (aCtx) {
         const grad = aCtx.createLinearGradient(0,0,256,0);
         // Fade in smoothly from sides
         grad.addColorStop(0, 'rgba(0,0,0,0)');
         grad.addColorStop(0.2, 'rgba(255,255,255,1)');
         grad.addColorStop(0.8, 'rgba(255,255,255,1)');
         grad.addColorStop(1, 'rgba(0,0,0,0)');
         aCtx.fillStyle = grad;
         aCtx.fillRect(0,0,256,1);
     }
     const aTex = new THREE.CanvasTexture(alphaCanvas);
     
     return { geometry: geo, texture: tex, alphaMap: aTex };
  }, [planet]);

  return (
      <mesh geometry={geometry} receiveShadow>
          <meshStandardMaterial 
            map={texture}
            alphaMap={alphaMap}
            transparent={true}
            roughness={0.9} 
            metalness={0.1}
            polygonOffset={true}
            polygonOffsetFactor={-2} // Ensures it renders on top of the base terrain without z-fighting
          />
      </mesh>
  );
}

export const Terrain: React.FC<TerrainProps> = ({ planet }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const cliffScatterRef = useRef<THREE.InstancedMesh>(null);
  const routeScatterRef = useRef<THREE.InstancedMesh>(null);
  
  // Base Terrain (Background)
  const width = 6000; 
  const segmentsW = 128; 
  const segmentsL = 512;

  // Generate Procedural Grit Texture (Bump Map)
  const gritTexture = useMemo(() => {
      const size = 512;
      const data = new Uint8Array(4 * size * size);
      
      for (let i = 0; i < size * size; i++) {
          const stride = i * 4;
          const noise = Math.random();
          const val = Math.floor(noise * 200 + 55); 
          data[stride] = val;     // R
          data[stride + 1] = val; // G
          data[stride + 2] = val; // B
          data[stride + 3] = 255; // A
      }
      
      const texture = new THREE.DataTexture(data, size, size);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.needsUpdate = true;
      return texture;
  }, []);

  // Generate Base Terrain Geometry
  const { positions, uvs, colors, normals, indices } = useMemo(() => {
    const geo = new THREE.PlaneGeometry(width, WORLD_LENGTH, segmentsW, segmentsL);
    geo.rotateX(-Math.PI / 2);
    
    const posAttribute = geo.attributes.position;
    const uvAttribute = geo.attributes.uv;
    const vertex = new THREE.Vector3();
    const count = posAttribute.count;
    const colorsArr = [];
    
    const baseColor = new THREE.Color(planet.groundColor);
    const accentColor = new THREE.Color(planet.accentColor);
    const darkColor = new THREE.Color(planet.groundColor).multiplyScalar(0.4);
    const rockColor = new THREE.Color(planet.groundColor).multiplyScalar(0.7); 
    
    for (let i = 0; i < count; i++) {
      vertex.fromBufferAttribute(posAttribute, i);
      
      const u = uvAttribute.getX(i);
      const v = uvAttribute.getY(i);
      uvAttribute.setXY(i, u * 60, v * 150);

      vertex.y = getTerrainHeight(vertex.x, vertex.z, planet);
      
      // -- Coloring --
      let mixedColor = baseColor.clone();
      const absX = Math.abs(vertex.x);
      
      // Slope/Height Shading
      const heightFactor = (vertex.y + 500) / (planet.mountainHeight + 1000);
      const steepness = absX / 500; 
      
      if (steepness > 0.8) {
          mixedColor.lerp(darkColor, 0.5); 
      }

      if (heightFactor > 0.85) {
          mixedColor.lerp(accentColor, 0.5); 
      }

      // Noise Texture Variation
      const patchNoise = Math.sin(vertex.x * 0.02) * Math.cos(vertex.z * 0.02);
      if (patchNoise > 0.5) {
          mixedColor.lerp(rockColor, 0.3);
      } else {
          const noise = (Math.random() - 0.5) * 0.05;
          mixedColor.offsetHSL(0, 0, noise);
      }

      colorsArr.push(mixedColor.r, mixedColor.g, mixedColor.b);
      posAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }
    
    geo.computeVertexNormals();
    
    return {
        positions: posAttribute,
        uvs: uvAttribute,
        normals: geo.attributes.normal,
        indices: geo.index,
        colors: new Float32Array(colorsArr)
    };
  }, [planet]);

  // Generate Scatter
  useLayoutEffect(() => {
      if (!cliffScatterRef.current || !routeScatterRef.current || planet.scatterType === 'none') return;
      
      const cliffCount = 2000;
      const routeCount = 500;
      const dummy = new THREE.Object3D();
      
      const stepX = width / segmentsW;
      const stepZ = WORLD_LENGTH / segmentsL;

      // 1. CLIFF ROCKS (Background/Sides)
      for (let i = 0; i < cliffCount; i++) {
          let x = (Math.random() - 0.5) * 2000; // Wider area
          let z = (Math.random() - 0.5) * WORLD_LENGTH;
          
          // Only place on cliffs
          if (Math.abs(x) < 160) {
              // Push out to cliffs
              x = Math.sign(x || 1) * (160 + Math.random() * 800);
          }

          x = Math.round(x / stepX) * stepX;
          z = Math.round(z / stepZ) * stepZ;

          const terrainY = getTerrainHeight(x, z, planet);
          const s = Math.random() * 4 + 1.0; 
          const y = terrainY - 0.2 - (s * 0.3); 
          
          dummy.position.set(x, y, z);
          dummy.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
          dummy.scale.set(s, s, s);
          
          dummy.updateMatrix();
          cliffScatterRef.current.setMatrixAt(i, dummy.matrix);
      }

      // 2. ROUTE ROCKS (Small debris on the path edges)
      for (let i = 0; i < routeCount; i++) {
           // Distribute mainly on the edges of the path (20 < absX < 100)
           const side = Math.random() > 0.5 ? 1 : -1;
           // Random distance from center, biased towards edges (40-90)
           let x = side * (40 + Math.random() * 50); 
           let z = (Math.random() - 0.5) * WORLD_LENGTH;

           // Snap to grid
           x = Math.round(x / stepX) * stepX;
           z = Math.round(z / stepZ) * stepZ;

           const terrainY = getTerrainHeight(x, z, planet);
           const s = Math.random() * 0.5 + 0.3; // Much smaller
           // Embed deeper so they look like protrusions
           const y = terrainY - (s * 0.4); 

           dummy.position.set(x, y, z);
           dummy.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
           dummy.scale.set(s, s, s);
           dummy.updateMatrix();
           routeScatterRef.current.setMatrixAt(i, dummy.matrix);
      }

      cliffScatterRef.current.instanceMatrix.needsUpdate = true;
      routeScatterRef.current.instanceMatrix.needsUpdate = true;
  }, [planet]);

  const scatterGeometry = useMemo(() => {
      if (planet.scatterType === 'ice') return new THREE.IcosahedronGeometry(1, 0); 
      if (planet.scatterType === 'tech') return new THREE.BoxGeometry(1, 1, 1);
      return new THREE.DodecahedronGeometry(1, 0); 
  }, [planet.scatterType]);

  return (
    <group>
        {/* The High-Res Natural Route */}
        <Route planet={planet} />

        {/* The Base Environment */}
        <mesh ref={meshRef} receiveShadow castShadow>
          <bufferGeometry>
              <bufferAttribute attach="index" array={indices!.array} count={indices!.count} itemSize={1} />
              <bufferAttribute attach="attributes-position" count={positions.count} array={positions.array} itemSize={3} />
              <bufferAttribute attach="attributes-normal" count={normals.count} array={normals.array} itemSize={3} />
              <bufferAttribute attach="attributes-color" count={positions.count} array={colors} itemSize={3} />
              <bufferAttribute attach="attributes-uv" count={uvs.count} array={uvs.array} itemSize={2} />
          </bufferGeometry>
          <meshStandardMaterial 
            vertexColors 
            roughness={0.9} 
            metalness={0.1}
            bumpMap={gritTexture}
            bumpScale={0.3} 
          />
        </mesh>

        {planet.scatterType !== 'none' && (
            <>
                {/* Large Cliff Rocks */}
                <instancedMesh ref={cliffScatterRef} args={[scatterGeometry, undefined, 2000]} castShadow receiveShadow>
                    <meshStandardMaterial 
                        color={planet.scatterType === 'ice' ? '#bfeeff' : planet.scatterType === 'tech' ? '#555' : '#5a4a4a'} 
                        roughness={0.8}
                    />
                </instancedMesh>
                {/* Small Route Rocks */}
                <instancedMesh ref={routeScatterRef} args={[scatterGeometry, undefined, 500]} castShadow receiveShadow>
                     <meshStandardMaterial 
                        color={planet.scatterType === 'ice' ? '#bfeeff' : planet.scatterType === 'tech' ? '#444' : '#4a3a3a'} 
                        roughness={0.9}
                    />
                </instancedMesh>
            </>
        )}
    </group>
  );
};