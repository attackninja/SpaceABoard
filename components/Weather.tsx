import React, { useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { PlanetConfig } from '../types';
import { WORLD_LENGTH } from '../constants';
import { audioController } from '../utils/audio';

interface WeatherProps {
  planet: PlanetConfig;
}

export const Weather: React.FC<WeatherProps> = ({ planet }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const matRef = useRef<THREE.Material>(null);
  
  const particleCount = 2000;
  
  // Initialize particles
  useLayoutEffect(() => {
    if (!meshRef.current) return;
    
    const dummy = new THREE.Object3D();
    
    for (let i = 0; i < particleCount; i++) {
      dummy.position.set(
        (Math.random() - 0.5) * 800,
        Math.random() * 400,
        (Math.random() - 0.5) * 800
      );
      
      const scale = Math.random() * 0.5 + 0.1;
      
      if (planet.weather === 'diamond_rain') {
          // Long streaks
          dummy.scale.set(0.1, 2.0, 0.1);
      } else {
          // Dust/Snow specs
          dummy.scale.set(scale, scale, scale);
      }
      
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [planet]);

  // Animate Weather
  useFrame((state, delta) => {
    // Determine weather intensity (alpha)
    let alpha = 0;
    
    if (planet.weather !== 'none') {
        const startZ = -WORLD_LENGTH / 2;
        const currentZ = state.camera.position.z;
        const progress = (currentZ - startZ) / WORLD_LENGTH;
        
        // Target Range: 0.3 to 0.7
        if (progress > 0.25 && progress < 0.75) {
             if (progress < 0.3) {
                 alpha = (progress - 0.25) / 0.05;
             } else if (progress > 0.7) {
                 alpha = 1 - (progress - 0.7) / 0.05;
             } else {
                 alpha = 1.0;
             }
        }
    }
    
    // Sync Audio
    audioController.updateWeather(planet.weather, alpha);

    // Visual Updates
    if (matRef.current) {
        const baseOpacity = planet.weather === 'dust_storm' ? 0.4 : 0.6;
        matRef.current.opacity = alpha * baseOpacity;
        matRef.current.visible = alpha > 0.01;
        matRef.current.transparent = true;
    }
    
    if (!meshRef.current || planet.weather === 'none') return;

    const dummy = new THREE.Object3D();
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    
    // Wind/Movement vector
    let speedX = 0;
    let speedY = 0;
    let speedZ = 0;

    if (planet.weather === 'dust_storm') {
        speedX = -50; // Strong side wind
        speedZ = -80; // Headwind
    } else if (planet.weather === 'diamond_rain') {
        speedY = -150; // Fast fall
    } else if (planet.weather === 'snow') {
        speedY = -10;
        speedX = -5;
    } else if (planet.weather === 'debris') {
        speedZ = 100; // Moving past you
    }

    for (let i = 0; i < particleCount; i++) {
        meshRef.current.getMatrixAt(i, matrix);
        position.setFromMatrixPosition(matrix);
        
        position.x += speedX * delta;
        position.y += speedY * delta;
        position.z += speedZ * delta;
        
        // Reset Logic
        const range = 600;
        
        if (position.y < -50) position.y += 400;
        if (position.x < -range) position.x += range * 2;
        if (position.z < -range + state.camera.position.z) position.z += range * 2; 
        if (position.z > range + state.camera.position.z) position.z -= range * 2;

        dummy.position.copy(position);
        
        // Rotation for debris
        if (planet.weather === 'debris') {
            dummy.rotation.x += delta;
            dummy.rotation.y += delta;
        }

        // Maintain scale
        const scale = Math.random() * 0.5 + 0.1;
        if (planet.weather === 'diamond_rain') dummy.scale.set(0.1, 2.0, 0.1);
        else dummy.scale.set(scale, scale, scale);
        
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  if (planet.weather === 'none') return null;

  const getMaterial = () => {
      const commonProps = { ref: matRef, transparent: true, opacity: 0 };
      if (planet.weather === 'diamond_rain') {
          return <meshStandardMaterial {...commonProps} color="#bfeeff" emissive="#ffffff" emissiveIntensity={0.8} roughness={0} />;
      }
      if (planet.weather === 'dust_storm') {
          return <meshBasicMaterial {...commonProps} color={planet.fogColor} />;
      }
      if (planet.weather === 'snow') {
          return <meshBasicMaterial {...commonProps} color="#ffffff" />;
      }
      return <meshStandardMaterial {...commonProps} color="#888" />;
  };

  const getGeometry = () => {
      if (planet.weather === 'debris') return <dodecahedronGeometry args={[1, 0]} />;
      if (planet.weather === 'diamond_rain') return <boxGeometry args={[1, 1, 1]} />;
      return <dodecahedronGeometry args={[0.5, 0]} />;
  };

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, particleCount]}>
        {getGeometry()}
        {getMaterial()}
    </instancedMesh>
  );
};