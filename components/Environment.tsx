import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { PlanetConfig, PlanetType } from '../types';
import { Stars, Cloud } from '@react-three/drei';
import { WORLD_LENGTH } from '../constants';
import { getTerrainHeight } from '../utils/terrain';

interface EnvironmentProps {
  planet: PlanetConfig;
  nightVision: boolean;
}

// Procedural texture generator for moon surfaces
const useMoonTexture = (baseColor: string, craterDensity: number, dustiness: number) => {
    return useMemo(() => {
        const width = 512;
        const height = 512;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (ctx) {
            // 1. Base Regolith
            ctx.fillStyle = baseColor;
            ctx.fillRect(0, 0, width, height);

            // 2. Noise (Dust/Grain)
            const imgData = ctx.getImageData(0, 0, width, height);
            for (let i = 0; i < imgData.data.length; i += 4) {
                const grain = (Math.random() - 0.5) * 20 * (1 - dustiness);
                imgData.data[i] = Math.max(0, Math.min(255, imgData.data[i] + grain));
                imgData.data[i+1] = Math.max(0, Math.min(255, imgData.data[i+1] + grain));
                imgData.data[i+2] = Math.max(0, Math.min(255, imgData.data[i+2] + grain));
            }
            ctx.putImageData(imgData, 0, 0);

            // 3. Craters
            const numCraters = 50 * craterDensity;
            for (let i = 0; i < numCraters; i++) {
                const x = Math.random() * width;
                const y = Math.random() * height;
                const r = Math.random() * 20 + 5;
                
                // Crater Shadow (Inset)
                const grad = ctx.createRadialGradient(x, y, r * 0.8, x, y, r);
                grad.addColorStop(0, 'rgba(0,0,0,0.6)'); // Deep dark center
                grad.addColorStop(0.9, 'rgba(0,0,0,0.2)');
                grad.addColorStop(1, 'rgba(255,255,255,0.1)'); // Rim highlight

                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI * 2);
                ctx.fillStyle = grad;
                ctx.fill();
            }

            // 4. Grooves (Phobos specific mainly)
            if (craterDensity > 0.8) {
                ctx.strokeStyle = 'rgba(0,0,0,0.1)';
                ctx.lineWidth = 2;
                for(let i=0; i<20; i++) {
                    ctx.beginPath();
                    ctx.moveTo(0, Math.random() * height);
                    ctx.bezierCurveTo(width/3, Math.random() * height, width*2/3, Math.random() * height, width, Math.random() * height);
                    ctx.stroke();
                }
            }
        }

        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        return tex;
    }, [baseColor, craterDensity, dustiness]);
};

// Realistic Moon Component
const DetailedMoon: React.FC<{ 
    position: [number, number, number]; 
    scale: number; 
    color: string; 
    name: string;
    rotationSpeed: number;
    craterDensity: number;
    dustiness: number;
}> = ({ position, scale, color, rotationSpeed, craterDensity, dustiness }) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const texture = useMoonTexture(color, craterDensity, dustiness);

    useFrame((state, delta) => {
        if (meshRef.current) {
            meshRef.current.rotation.y += rotationSpeed * delta;
        }
    });

    return (
        <mesh ref={meshRef} position={position} scale={[scale, scale, scale]} castShadow receiveShadow>
            <sphereGeometry args={[1, 64, 64]} />
            <meshStandardMaterial 
                map={texture}
                bumpMap={texture}
                bumpScale={0.05}
                color={new THREE.Color(color).multiplyScalar(1.2)} // Slightly boost brightness against dark space
                roughness={0.9} // Very dusty/rough
                metalness={0.1}
            />
        </mesh>
    );
};

// --- ECO STRUCTURE COMPONENTS ---

const SolarTree: React.FC<{ position: [number, number, number] }> = ({ position }) => {
    return (
        <group position={position}>
            {/* Trunk */}
            <mesh position={[0, 12, 0]} castShadow>
                <cylinderGeometry args={[0.5, 1.5, 24, 8]} />
                <meshStandardMaterial color="#eef" roughness={0.5} />
            </mesh>
            {/* Leaf/Panel */}
            <group position={[0, 24, 0]} rotation={[0.4, 0, 0]}>
                 <mesh castShadow>
                    <cylinderGeometry args={[8, 0.2, 0.5, 6]} />
                    <meshStandardMaterial color="#112244" metalness={0.9} roughness={0.1} />
                 </mesh>
                 <mesh position={[0, 0.05, 0]} scale={[0.9, 1, 0.9]}>
                    <cylinderGeometry args={[8, 0.2, 0.5, 6]} />
                    <meshStandardMaterial color="#2244aa" emissive="#113399" emissiveIntensity={0.5} />
                 </mesh>
            </group>
            {/* Glow Ring at base */}
            <mesh position={[0, 1, 0]} rotation={[Math.PI/2, 0, 0]}>
                <torusGeometry args={[1.8, 0.1, 8, 16]} />
                <meshBasicMaterial color="#44ffaa" />
            </mesh>
        </group>
    )
}

const BioDome: React.FC<{ position: [number, number, number] }> = ({ position }) => {
     return (
        <group position={position}>
            {/* Base Platform */}
            <mesh position={[0, 1, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[22, 24, 2, 32]} />
                <meshStandardMaterial color="#f0f0f0" />
            </mesh>
            
            {/* Glass Dome */}
            <mesh position={[0, 0, 0]} castShadow>
                <sphereGeometry args={[20, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
                <meshPhysicalMaterial 
                    color="#ffffff" 
                    roughness={0} 
                    metalness={0.1} 
                    transmission={0.8} // Glass
                    thickness={1.5}
                    transparent 
                    opacity={0.3}
                />
            </mesh>
            
            {/* Structure Lattice */}
            <mesh position={[0, 0, 0]} scale={[1.01, 1.01, 1.01]}>
                <sphereGeometry args={[20, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
                <meshStandardMaterial color="#ffffff" wireframe />
            </mesh>

            {/* Internal Greenery (Abstract Trees) */}
             {[...Array(5)].map((_, i) => {
                 const angle = (i / 5) * Math.PI * 2;
                 const r = 10;
                 return (
                     <mesh key={i} position={[Math.cos(angle)*r, 5, Math.sin(angle)*r]} castShadow>
                         <coneGeometry args={[3, 10, 8]} />
                         <meshStandardMaterial color="#4a8a4a" />
                     </mesh>
                 )
             })}
              {/* Central Pillar */}
             <mesh position={[0, 10, 0]}>
                 <cylinderGeometry args={[2, 2, 20, 8]} />
                 <meshStandardMaterial color="#ddd" />
             </mesh>
        </group>
     )
}

const HexModule: React.FC<{ position: [number, number, number], size?: number }> = ({ position, size = 1 }) => {
    return (
        <group position={position} scale={[size, size, size]}>
             {/* Leg Supports */}
             {[0, 120, 240].map((deg, i) => (
                 <mesh key={i} position={[Math.cos(deg*Math.PI/180)*5, 2, Math.sin(deg*Math.PI/180)*5]} rotation={[0,0, -0.2]}>
                      <cylinderGeometry args={[0.5, 0.5, 6]} />
                      <meshStandardMaterial color="#555" />
                 </mesh>
             ))}

             {/* Main Module */}
             <mesh position={[0, 6, 0]} castShadow>
                 <cylinderGeometry args={[8, 7, 6, 6]} />
                 <meshStandardMaterial color="#f8f8f8" />
             </mesh>
             {/* Window Band */}
             <mesh position={[0, 6, 0]}>
                 <cylinderGeometry args={[8.1, 8.1, 2, 6]} />
                 <meshStandardMaterial color="#333" roughness={0.2} />
             </mesh>
             {/* Roof Garden */}
             <mesh position={[0, 9, 0]}>
                  <cylinderGeometry args={[7, 8, 0.5, 6]} />
                  <meshStandardMaterial color="#66aa66" />
             </mesh>
        </group>
    )
}

const SpaceCamp: React.FC<{ planet: PlanetConfig; z: number; side: 'left' | 'right' }> = ({ planet, z, side }) => {
    const x = side === 'left' ? -250 : 250;
    // Sunk by 8 units to ensure the foundation is embedded in ground and not floating
    const y = useMemo(() => getTerrainHeight(x, z, planet) - 8, [planet, z, x]);

    return (
        <group position={[x, y, z]} rotation={[0, side === 'left' ? -0.3 : 0.3, 0]}>
            <BioDome position={[0, 0, 0]} />
            
            <HexModule position={[side === 'left' ? -35 : 35, 0, 20]} />
            <HexModule position={[side === 'left' ? -25 : 25, 0, -25]} size={0.8} />

            <SolarTree position={[0, 0, 40]} />
            <SolarTree position={[side === 'left' ? 20 : -20, 0, 50]} />
            
            {/* Connecting Tubes */}
             <mesh position={[side === 'left' ? -17 : 17, 4, 10]} rotation={[0, side === 'left' ? -0.5 : 0.5, 0]}>
                  <boxGeometry args={[30, 2, 2]} />
                  <meshStandardMaterial color="#ddd" />
             </mesh>
             <mesh position={[side === 'left' ? -12 : 12, 4, -12]} rotation={[0, side === 'left' ? 0.8 : -0.8, 0]}>
                  <boxGeometry args={[25, 2, 2]} />
                  <meshStandardMaterial color="#ddd" />
             </mesh>
        </group>
    );
};

const MarsRover: React.FC<{ planet: PlanetConfig }> = ({ planet }) => {
    // Located EXACTLY where the player stops (approx finish line trigger)
    const z = WORLD_LENGTH / 2 - 150;
    const y = useMemo(() => getTerrainHeight(0, z, planet) + 5, [planet, z]);

    return (
        <group position={[0, y, z]} rotation={[0, Math.PI + 0.5, 0]} scale={[6, 6, 6]}>
            {/* Body */}
            <mesh position={[0, 1.5, 0]} castShadow>
                <boxGeometry args={[3, 1.5, 5]} />
                <meshStandardMaterial color="#eec" roughness={0.7} />
            </mesh>
            
            {/* Cockpit Window */}
            <mesh position={[0, 2.0, -1.5]} rotation={[-0.5, 0, 0]}>
                 <boxGeometry args={[2.8, 0.8, 1.5]} />
                 <meshStandardMaterial color="#111" metalness={0.9} roughness={0.1} />
            </mesh>
            
            {/* Wheels - Big and Rugged */}
            {[
                [1.8, 1.8], [-1.8, 1.8], 
                [1.8, -1.8], [-1.8, -1.8],
                [1.8, 0], [-1.8, 0]
            ].map((pos, i) => (
                <group key={i} position={[pos[0], 0.8, pos[1]]}>
                    <mesh rotation={[Math.PI/2, 0, 0]} castShadow>
                        <cylinderGeometry args={[0.9, 0.9, 1.0, 16]} />
                        <meshStandardMaterial color="#222" roughness={0.9} />
                    </mesh>
                    <mesh rotation={[Math.PI/2, 0, 0]}>
                        <cylinderGeometry args={[0.5, 0.5, 1.1, 8]} />
                        <meshStandardMaterial color="#555" metalness={0.8} />
                    </mesh>
                </group>
            ))}

            {/* Camera Mast / Sensor Array */}
            <group position={[0, 2.2, 1.5]}>
                <mesh castShadow>
                    <cylinderGeometry args={[0.15, 0.25, 2.0]} />
                    <meshStandardMaterial color="#888" />
                </mesh>
                <mesh position={[0, 1.0, 0]}>
                    <boxGeometry args={[0.8, 0.4, 0.4]} />
                    <meshStandardMaterial color="#fff" />
                </mesh>
                {/* Eyes */}
                <mesh position={[0.2, 1.0, 0.2]} rotation={[Math.PI/2, 0, 0]}>
                     <cylinderGeometry args={[0.1, 0.1, 0.2]} />
                     <meshBasicMaterial color="#0ff" />
                </mesh>
                <mesh position={[-0.2, 1.0, 0.2]} rotation={[Math.PI/2, 0, 0]}>
                     <cylinderGeometry args={[0.1, 0.1, 0.2]} />
                     <meshBasicMaterial color="#0ff" />
                </mesh>
            </group>

            {/* Solar Panel Arrays */}
            <group position={[0, 2.3, -1]} rotation={[-0.2, 0, 0]}>
                <mesh>
                    <boxGeometry args={[2.5, 0.1, 2.5]} />
                    <meshStandardMaterial color="#112244" roughness={0.2} metalness={0.8} />
                </mesh>
                {/* Grid lines */}
                <mesh position={[0, 0.06, 0]}>
                     <planeGeometry args={[2.4, 2.4]} />
                     <meshBasicMaterial color="#3366ff" wireframe />
                </mesh>
            </group>
            
            {/* Antenna */}
            <mesh position={[1.2, 2.3, -2]}>
                <cylinderGeometry args={[0.02, 0.05, 3]} />
                <meshStandardMaterial color="#aaa" />
            </mesh>
            <pointLight position={[1.2, 3.8, -2]} color="red" intensity={2} distance={10} />
        </group>
    );
};

const DistantLandscape: React.FC<{ planet: PlanetConfig }> = ({ planet }) => {
    // Vast static terrain that sits below the playable area to create a true horizon
    const geometry = useMemo(() => {
        const width = 120000;
        const geo = new THREE.PlaneGeometry(width, width, 128, 128);
        geo.rotateX(-Math.PI / 2);
        
        const pos = geo.attributes.position;
        const vertex = new THREE.Vector3();
        
        for (let i = 0; i < pos.count; i++) {
            vertex.fromBufferAttribute(pos, i);
            
            // Create organic rolling terrain for the distance
            const noise1 = Math.sin(vertex.x * 0.0001) * Math.cos(vertex.z * 0.0001) * 2000;
            const noise2 = Math.sin(vertex.x * 0.0005 + vertex.z * 0.0004) * 500;
            
            // Base height lower than track
            vertex.y = -1500 + noise1 + noise2;
            
            pos.setXYZ(i, vertex.x, vertex.y, vertex.z);
        }
        
        geo.computeVertexNormals();
        return geo;
    }, []);

    return (
        <mesh geometry={geometry} receiveShadow position={[0, -200, 0]}>
            <meshStandardMaterial 
                color={planet.groundColor} 
                roughness={0.9} 
                metalness={0.1}
            />
        </mesh>
    );
};

const HorizonMountains: React.FC<{ planet: PlanetConfig }> = ({ planet }) => {
  const geometry = useMemo(() => {
    // Much further away to encompass the new vast landscape
    const radius = 55000; 
    const height = 8000;
    const segments = 128;
    const geo = new THREE.CylinderGeometry(radius, radius, height, segments, 1, true);
    
    const pos = geo.attributes.position;
    const vertex = new THREE.Vector3();
    
    for (let i = 0; i < pos.count; i++) {
        vertex.fromBufferAttribute(pos, i);
        
        if (vertex.y > 0) {
            const noise = Math.sin(vertex.x * 0.0002) * 2000;
            const peaks = Math.abs(Math.sin(vertex.x * 0.0001)) * 3000;
            
            // Height adjustment to ensure they look like distant mountains, not a wall
            vertex.y = noise + peaks - 2000; 
        } else {
            vertex.y = -6000; 
        }
        
        pos.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }
    
    geo.computeVertexNormals();
    return geo;
  }, [planet.name]);

  return (
    <group position={[0, -500, 0]}>
        <mesh geometry={geometry}>
            <meshStandardMaterial 
                color={planet.groundColor} 
                roughness={0.9} 
                metalness={0.2}
                emissive={planet.groundColor}
                emissiveIntensity={0.1}
                fog={true} 
            />
        </mesh>
    </group>
  );
};

const CelestialBody: React.FC<{ planet: PlanetConfig }> = ({ planet }) => {
    const groupRef = useRef<THREE.Group>(null);
    const sunRef = useRef<THREE.Group>(null);
    const sunMeshRef = useRef<THREE.Mesh>(null);
    const phobosRef = useRef<THREE.Mesh>(null);
    const deimosRef = useRef<THREE.Mesh>(null);
    const { camera } = useThree();
    
    // Determine what is visible in the sky
    const bodyConfig = useMemo(() => {
        switch (planet.name) {
            case PlanetType.MOON:
                return {
                    type: 'earth',
                    color: '#2e56fa', 
                    emissive: '#112244',
                    size: 3000,
                    offset: [8000, 10000, 45000] as [number, number, number],
                    hasClouds: true
                };
            case PlanetType.SATURN_RINGS:
                return {
                    type: 'saturn',
                    color: '#e0cda6',
                    emissive: '#554433',
                    size: 20000,
                    offset: [0, -6000, 50000] as [number, number, number],
                    hasClouds: false
                };
            case PlanetType.SPACECRAFT:
                return {
                    type: 'sun',
                    color: '#ffcc33',
                    emissive: '#ffaa00',
                    size: 10000,
                    offset: [0, 8000, 50000] as [number, number, number],
                    hasClouds: false
                };
            case PlanetType.MARS:
                return { type: 'mars_system' };
            default:
                 return {
                    type: 'sun',
                    color: '#ffffff',
                    emissive: '#ffffff',
                    size: 800,
                    offset: [10000, 12000, 45000] as [number, number, number],
                    hasClouds: false
                };
        }
    }, [planet.name]);

    useFrame(() => {
        if (groupRef.current) {
            // Skybox effect: follow camera Z
            groupRef.current.position.z = camera.position.z;
        }

        const startZ = -WORLD_LENGTH / 2 + 1000;
        const endZ = WORLD_LENGTH / 2 - 1000;
        const z = camera.position.z;
        const progress = THREE.MathUtils.clamp((z - startZ) / (endZ - startZ), 0, 1);
        
        // SUNSET ANIMATION FIX:
        // Angle goes from Negative (High Noon) to Positive (Sunset/Below)
        const angle = THREE.MathUtils.lerp(-0.3, 0.5, progress);
        if (sunRef.current) {
            sunRef.current.rotation.x = angle;
        }

        // Fade out sun material
        if (sunMeshRef.current) {
             let brightness = 1;
             // Start fading when getting close to horizon (angle > 0)
             if (angle > 0.1) {
                 brightness = Math.max(0, 1 - (angle - 0.1) * 3); 
             }
             if (!Array.isArray(sunMeshRef.current.material)) {
                const mat = sunMeshRef.current.material as THREE.MeshBasicMaterial;
                mat.opacity = brightness;
                mat.transparent = true;
                mat.visible = brightness > 0.01;
             }
        }

        // Rotate generic bodies
        // @ts-ignore
        if(groupRef.current?.children[0]?.isMesh && bodyConfig.type !== 'sun' && bodyConfig.type !== 'mars_system') {
             // @ts-ignore
            groupRef.current.children[0].rotation.y += 0.0002;
        }

        // Rotate Mars moons
        if (phobosRef.current) {
            phobosRef.current.rotation.y += 0.0005;
        }
        if (deimosRef.current) {
            deimosRef.current.rotation.y += 0.0002;
        }
    });

    if (bodyConfig.type === 'mars_system') {
        return (
            <group ref={groupRef}>
                <group ref={sunRef}>
                    {/* Distant Small Sun (Star) - Now sets in the west/down */}
                    <mesh ref={sunMeshRef} position={[-15000, 15000, 60000]}>
                        <sphereGeometry args={[1500, 64, 64]} />
                        <meshBasicMaterial color="#ffffff" />
                    </mesh>
                     {/* Light is separate from mesh to control scene lighting in Environment main component */}
                </group>

                {/* Phobos: Sphere */}
                <DetailedMoon 
                    name="Phobos"
                    position={[15000, 22000, 50000]}
                    scale={2500}
                    color="#8c5e4d" // Dark Mars Red/Brown
                    rotationSpeed={0.05}
                    craterDensity={1.0}
                    dustiness={0.2}
                />

                {/* Deimos: Sphere */}
                <DetailedMoon 
                    name="Deimos"
                    position={[-12000, 30000, 55000]}
                    scale={1500}
                    color="#b0a8a0" // Pale Grey/Dust
                    rotationSpeed={0.02}
                    craterDensity={0.4}
                    dustiness={0.8}
                />
            </group>
        );
    }

    // Default single body render
    // @ts-ignore
    const { size, offset, color, emissive, type, hasClouds } = bodyConfig;

    return (
        <group ref={groupRef}>
            {type === 'sun' ? (
                 <group ref={sunRef}>
                    <group position={offset}>
                         <mesh ref={sunMeshRef}>
                            <sphereGeometry args={[size, 64, 64]} />
                            <meshStandardMaterial 
                                color={color} 
                                roughness={0.8} 
                                metalness={0.1}
                                emissive={emissive}
                                emissiveIntensity={2}
                            />
                        </mesh>
                    </group>
                 </group>
            ) : (
                <group position={offset}>
                    <mesh>
                        <sphereGeometry args={[size, 64, 64]} />
                        <meshStandardMaterial 
                            color={color} 
                            roughness={0.8} 
                            metalness={0.1}
                            emissive={emissive}
                            emissiveIntensity={0.15}
                        />
                    </mesh>
                    
                    {hasClouds && (
                        <mesh scale={[1.02, 1.02, 1.02]}>
                            <sphereGeometry args={[size, 64, 64]} />
                            <meshStandardMaterial color="#ffffff" transparent opacity={0.3} />
                        </mesh>
                    )}
                </group>
            )}
        </group>
    );
};

export const Environment: React.FC<EnvironmentProps> = ({ planet, nightVision }) => {
  const { scene, camera } = useThree();
  const dirLightRef = useRef<THREE.DirectionalLight>(null);
  const ambientLightRef = useRef<THREE.AmbientLight>(null);
  const starsRef = useRef<THREE.Group>(null);
  
  // Colors
  const daySkyColor = useMemo(() => new THREE.Color(planet.skyColor), [planet]);
  const nightSkyColor = useMemo(() => new THREE.Color('#000000'), []);
  const daySunColor = useMemo(() => new THREE.Color('#ffffff'), []);
  const nightMoonColor = useMemo(() => new THREE.Color('#b0c4de'), []); 
  
  // Night Vision Colors
  const nvBg = useMemo(() => new THREE.Color('#001100'), []);
  const nvFog = useMemo(() => new THREE.Color('#002200'), []);
  const nvAmbient = useMemo(() => new THREE.Color('#88ff88'), []);

  // Initialize background immediately
  useEffect(() => {
      scene.background = daySkyColor;
      scene.fog = new THREE.FogExp2(daySkyColor, 0); 
  }, [planet, daySkyColor, scene]);

  useFrame(() => {
      const startZ = -WORLD_LENGTH / 2 + 1000;
      const endZ = WORLD_LENGTH / 2 - 1000;
      const z = camera.position.z;
      const progress = THREE.MathUtils.clamp((z - startZ) / (endZ - startZ), 0, 1);

      // Follow camera with light source
      if (dirLightRef.current) {
          // Keep light closer to player for better shadow resolution
          dirLightRef.current.position.set(-2000, 3000, camera.position.z + 1000);
          dirLightRef.current.target.position.z = camera.position.z;
          dirLightRef.current.target.updateMatrixWorld();
      }
      
      // Infinite stars
      if (starsRef.current) {
          starsRef.current.position.z = camera.position.z;
      }

      // -- ATMOSPHERE & LIGHTING --
      let currentSky: THREE.Color;
      let currentSunColor: THREE.Color;
      let currentFogDensity = 0; // Default NO FOG
      let sunInt: number;
      let ambientInt: number;

      const stormColor = new THREE.Color(planet.fogColor).multiplyScalar(0.5); 
      const stormSunColor = new THREE.Color(planet.accentColor); 

      // Timeline: Day -> Sunset/Storm (30-70%) -> Night
      if (progress < 0.3) {
          // Phase 1: Day (Clear)
          currentSky = daySkyColor;
          currentSunColor = daySunColor;
          currentFogDensity = 0; // Clear
          sunInt = 2.0;
          ambientInt = 0.6;
      } else if (progress < 0.7) {
          // Phase 2: Sunset / "Extreme Weather Part"
          // Map 0.3->0.7 to 0->1 for linear interpolation
          const t = (progress - 0.3) / 0.4; 
          
          currentSky = daySkyColor.clone().lerp(stormColor, t);
          currentSunColor = daySunColor.clone().lerp(stormSunColor, t);
          
          // FOG LOGIC: Only if planet has weather
          if (planet.weather !== 'none') {
             // Ramp fog up and down
             // Peak at 0.5 (middle of phase)
             const peak = 1 - Math.abs(t - 0.5) * 2;
             currentFogDensity = peak * 0.005; // Slightly thicker for "extreme"
          }
          
          sunInt = THREE.MathUtils.lerp(2.0, 0.5, t);
          ambientInt = THREE.MathUtils.lerp(0.6, 0.3, t);
      } else if (progress < 0.9) {
          // Phase 3: Post-Storm -> Night
          // Map 0.7->0.9
          const t = (progress - 0.7) / 0.2;
          currentSky = stormColor.clone().lerp(nightSkyColor, t);
          currentSunColor = stormSunColor.clone().lerp(nightMoonColor, t);
          currentFogDensity = 0; // Clear again
          sunInt = THREE.MathUtils.lerp(0.5, 0.0, t); 
          ambientInt = THREE.MathUtils.lerp(0.3, 0.2, t); 
      } else {
          // Phase 4: Night
          currentSky = nightSkyColor;
          currentSunColor = nightMoonColor;
          currentFogDensity = 0;
          sunInt = 0.0;
          ambientInt = 0.2; 
      }

      // -- NIGHT VISION OVERRIDE --
      if (nightVision) {
          currentSky = nvBg;
          currentFogDensity = 0.0025; // NV needs fog to show depth/grid effect usually
          ambientInt = 1.2;
          sunInt = 0; 
      }

      if (scene.background instanceof THREE.Color) {
         scene.background.copy(currentSky);
      } else {
         scene.background = currentSky;
      }
      
      if (!scene.fog) {
          scene.fog = new THREE.FogExp2(currentSky, currentFogDensity);
      } else {
          // @ts-ignore
          if (scene.fog.isFogExp2) {
             const fog = scene.fog as THREE.FogExp2;
             fog.color.copy(nightVision ? nvFog : currentSky);
             fog.density = currentFogDensity;
          }
      }

      if (ambientLightRef.current) {
          ambientLightRef.current.intensity = ambientInt;
          if (nightVision) {
              ambientLightRef.current.color.copy(nvAmbient);
          } else {
              ambientLightRef.current.color.set('#ffffff');
          }
      }

      if (dirLightRef.current) {
          dirLightRef.current.intensity = sunInt;
          dirLightRef.current.color.copy(currentSunColor);
      }
  });

  // Calculate camp positions along the route
  const campPositions = useMemo(() => {
      const startZ = -WORLD_LENGTH / 2 + 250;
      const positions = [
          startZ, // Start
          startZ + WORLD_LENGTH * 0.25, // Checkpoint 1
          startZ + WORLD_LENGTH * 0.5,  // Checkpoint 2
          startZ + WORLD_LENGTH * 0.75, // Checkpoint 3
      ];
      return positions;
  }, []);

  return (
    <>
      <ambientLight ref={ambientLightRef} intensity={0.6} />
      
      <directionalLight 
        ref={dirLightRef}
        position={[-2000, 3000, 1000]} 
        intensity={2.0} 
        castShadow 
        shadow-bias={-0.0001}
        shadow-mapSize={[4096, 4096]}
      >
        <orthographicCamera attach="shadow-camera" args={[-2500, 2500, 2500, -2500]} far={8000} />
      </directionalLight>

      {/* Massive Distant Landscape (The Horizon) */}
      <DistantLandscape planet={planet} />

      {/* Far Mountains (The Rim) */}
      <HorizonMountains planet={planet} />
      
      {/* The Research Rover at the Finish Line */}
      <MarsRover planet={planet} />

      {/* Space Camps Distributed Along Route */}
      {campPositions.map((z, i) => (
          <React.Fragment key={i}>
              <SpaceCamp planet={planet} z={z} side="left" />
              <SpaceCamp planet={planet} z={z} side="right" />
          </React.Fragment>
      ))}

      {/* Stars */}
      <group ref={starsRef}>
          <Stars 
            radius={30000} 
            depth={2000} 
            count={20000} 
            factor={3} 
            saturation={0} 
            fade={true} 
            speed={0} 
          />
      </group>

      <CelestialBody planet={planet} />

      {planet.atmosphereDensity > 0.5 && (
        <group position={[0, planet.mountainHeight + 2000, 0]}>
            <Cloud opacity={0.3} speed={0.1} bounds={[10000, 500, 10000]} segments={60} color={planet.skyColor} />
        </group>
      )}
    </>
  );
};