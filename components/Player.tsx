import React, { useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { PlanetConfig, GameState, PlayerCustomization } from '../types';
import { audioController } from '../utils/audio';
import { WORLD_LENGTH } from '../constants';
import { getTerrainHeight, getTerrainNormal } from '../utils/terrain';

interface PlayerProps {
  planet: PlanetConfig;
  gameState: GameState;
  setGameState: (state: GameState) => void;
  setStats: (stats: any) => void;
  customization: PlayerCustomization;
}

export const Player: React.FC<PlayerProps> = ({ planet, gameState, setGameState, setStats, customization }) => {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Group>(null);
  const thrusterRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  
  // -- BODY PART REFS --
  const hipsRef = useRef<THREE.Group>(null);
  const torsoRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const boardRef = useRef<THREE.Group>(null);

  // -- CONSTANTS --
  const HOVER_TARGET = 1.0; 
  const HOVER_STIFFNESS = 1800.0; 
  const HOVER_DAMPING = 120.0; 
  const MASS = 120; 
  
  const startZ = -WORLD_LENGTH / 2 + 200;
  const initialSpawnHeight = useMemo(() => {
      return getTerrainHeight(0, startZ, planet) + 5;
  }, [planet, startZ]);

  // -- PHYSICS STATE --
  const position = useRef(new THREE.Vector3(0, initialSpawnHeight, startZ));
  const velocity = useRef(new THREE.Vector3(0, 0, 0));
  const rotation = useRef(new THREE.Quaternion());
  const speed = useRef(0);
  const inputVector = useRef({ x: 0, z: 0 }); 
  const frameCount = useRef(0);
  const wasGrounded = useRef(false);
  
  const keys = useRef({ w: false, a: false, s: false, d: false, space: false });

  // Input Handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== GameState.PLAYING) return;
      const k = e.key.toLowerCase();
      if (k === 'w' || k === 'arrowup') keys.current.w = true;
      if (k === 's' || k === 'arrowdown') keys.current.s = true;
      if (k === 'a' || k === 'arrowleft') keys.current.a = true;
      if (k === 'd' || k === 'arrowright') keys.current.d = true;
      if (k === ' ') keys.current.space = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'w' || k === 'arrowup') keys.current.w = false;
      if (k === 's' || k === 'arrowdown') keys.current.s = false;
      if (k === 'a' || k === 'arrowleft') keys.current.a = false;
      if (k === 'd' || k === 'arrowright') keys.current.d = false;
      if (k === ' ') keys.current.space = false;
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState]);

  // Reset Logic
  useEffect(() => {
    if (gameState === GameState.MENU) {
      position.current.set(0, initialSpawnHeight, startZ);
      velocity.current.set(0, 0, 0); 
      speed.current = 0;
      rotation.current.identity();
    }
  }, [gameState, initialSpawnHeight, startZ]);

  // Initial Pose Setup
  useLayoutEffect(() => {
      // Hips at ~0.85m height gives enough room for legs to stand on board (at 0)
      if (hipsRef.current) hipsRef.current.position.set(0, 0.85, 0);
      
      // Torso sits slightly embedded in hips (Pelvis height ~0.25, top at 0.125)
      if (torsoRef.current) torsoRef.current.position.set(0, 0.1, 0); 
      
      // Head on top of torso
      if (headRef.current) headRef.current.position.set(0, 0.7, 0);
      
      // Arms
      if (leftArmRef.current) leftArmRef.current.position.set(-0.25, 0.55, 0);
      if (rightArmRef.current) rightArmRef.current.position.set(0.25, 0.55, 0);

      // Legs sockets (relative to hips)
      // Wide stance for snowboarding
      if (leftLegRef.current) leftLegRef.current.position.set(0, -0.1, 0.25);
      if (rightLegRef.current) rightLegRef.current.position.set(0, -0.1, -0.25);
  }, []);

  useFrame((state, delta) => {
    if (gameState !== GameState.PLAYING && gameState !== GameState.MENU) return;
    
    const dt = Math.min(delta, 0.05);
    const time = state.clock.getElapsedTime();

    // -- MENU ANIMATION --
    if (gameState === GameState.MENU) {
        if (groupRef.current) {
            const floatY = Math.sin(time * 2) * 1.5;
            groupRef.current.position.set(0, initialSpawnHeight + floatY + 5, startZ);
            groupRef.current.rotation.y = Math.sin(time * 0.5) * 0.2;
            
            // Idle breathing
            if(torsoRef.current) {
                torsoRef.current.rotation.x = Math.sin(time * 2) * 0.05;
            }
        }
        return;
    }

    // -- CHECK FINISH CONDITION --
    // End of track is at WORLD_LENGTH / 2. We trigger slightly before.
    if (position.current.z > (WORLD_LENGTH / 2) - 300 && gameState === GameState.PLAYING) {
        setGameState(GameState.FINISHED);
        // Force stop audio engine effects
        audioController.updatePlayerState(0, false, false, 0);
        return; 
    }

    // -- PHYSICS LOOP --
    const terrainHeight = getTerrainHeight(position.current.x, position.current.z, planet);
    const rawNormal = getTerrainNormal(position.current.x, position.current.z, planet);
    const groundNormal = new THREE.Vector3(rawNormal.x, rawNormal.y, rawNormal.z);
    const currentHeight = position.current.y - terrainHeight;
    const isGrounded = currentHeight < HOVER_TARGET + 1.0;

    // Landing Sound
    if (isGrounded && !wasGrounded.current && velocity.current.y < -5) {
        audioController.triggerLand(Math.abs(velocity.current.y));
    }
    wasGrounded.current = isGrounded;

    let forceY = -planet.gravity * 600; 
    if (currentHeight < HOVER_TARGET + 3.0) {
        const displacement = HOVER_TARGET - currentHeight;
        const springForce = displacement * HOVER_STIFFNESS;
        const dampingForce = -velocity.current.y * HOVER_DAMPING;
        forceY += Math.max(0, springForce + dampingForce);
        if (!keys.current.space && isGrounded) {
             forceY -= 800 + (Math.abs(speed.current) * 10);
        }
    }

    // Jump
    if (keys.current.space && isGrounded && currentHeight < HOVER_TARGET + 0.5) {
        velocity.current.y = 50;
        audioController.triggerJump();
    }

    velocity.current.y += forceY * dt / (MASS / 10); 
    const accel = 60; 
    const brake = 200;
    const maxSpeed = 190; 
    
    if (keys.current.w) speed.current += accel * dt;
    if (keys.current.s) speed.current -= brake * dt;
    speed.current *= 0.99; 
    speed.current = Math.min(Math.max(speed.current, -20), maxSpeed);

    const targetTurn = (keys.current.a ? 1 : 0) + (keys.current.d ? -1 : 0);
    inputVector.current.x = THREE.MathUtils.lerp(inputVector.current.x, targetTurn, dt * 6); 
    
    const turnRate = 50 + (speed.current * 0.1); 
    velocity.current.x += inputVector.current.x * turnRate * dt;
    velocity.current.x *= 0.88; 
    velocity.current.x += groundNormal.x * planet.gravity * 200 * dt; 
    
    if (groundNormal.z > 0) speed.current += groundNormal.z * planet.gravity * 100 * dt;

    const nextPos = position.current.clone();
    nextPos.x += velocity.current.x * dt;
    nextPos.z += (speed.current + 10) * dt; 
    nextPos.y += velocity.current.y * dt;

    const nextTerrainHeight = getTerrainHeight(nextPos.x, nextPos.z, planet);
    if (nextPos.y < nextTerrainHeight + 0.5) {
        nextPos.y = nextTerrainHeight + 0.5;
        velocity.current.y = 0;
    }

    if (nextTerrainHeight - position.current.y > 5.0) {
        speed.current *= 0.3; 
        velocity.current.x *= -0.5;
        nextPos.x = position.current.x; 
    }

    position.current.copy(nextPos);

    // -- AUDIO UPDATE --
    // Sync audio engine with physics state every frame
    audioController.updatePlayerState(
        speed.current,
        keys.current.w,
        keys.current.s,
        inputVector.current.x
    );

    // -- ROTATION --
    const lookAtPos = position.current.clone().add(new THREE.Vector3(velocity.current.x * 0.3, 0, 20));
    const dummyObj = new THREE.Object3D();
    dummyObj.position.copy(position.current);
    dummyObj.lookAt(lookAtPos); 
    
    const targetUp = isGrounded 
        ? groundNormal.clone().lerp(new THREE.Vector3(0, 1, 0), 0.1).normalize()
        : new THREE.Vector3(0, 1, 0); 
    const qTarget = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), targetUp);
    const bankAngle = -inputVector.current.x * 0.5; 
    const qBank = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), bankAngle);
    const finalQ = dummyObj.quaternion.clone().premultiply(qTarget).multiply(qBank);
    
    rotation.current.slerp(finalQ, dt * 8.0);

    if (groupRef.current) {
        groupRef.current.position.copy(position.current);
        groupRef.current.quaternion.copy(rotation.current);
    }

    // -- ANIMATION RIGGING --
    const turnAmt = inputVector.current.x; 
    const speedPct = Math.min(Math.abs(speed.current) / 150, 1);
    const isBraking = keys.current.s;
    const isTucking = keys.current.w || speedPct > 0.8;
    
    // BOARD TILT
    if (boardRef.current) {
        boardRef.current.rotation.z = THREE.MathUtils.lerp(boardRef.current.rotation.z, turnAmt * 0.3, dt * 5);
        boardRef.current.rotation.x = THREE.MathUtils.lerp(boardRef.current.rotation.x, isBraking ? -0.4 : 0, dt * 5);
    }

    // HIPS (Snowboard Stance - Sideways)
    if (hipsRef.current) {
         // Face right (-1.4 rads)
         const stanceAngle = -1.4; 
         // Crouch logic
         const crouchOffset = isTucking ? -0.2 : 0;
         const landOffset = isGrounded ? 0 : 0.1;
         
         // Keep minimal vertical bounce to avoid foot sliding
         hipsRef.current.position.y = THREE.MathUtils.lerp(hipsRef.current.position.y, 0.85 + crouchOffset + landOffset, dt * 10);
         hipsRef.current.rotation.y = stanceAngle;
         
         // Lean into turn (Using local Z because hips are rotated)
         // When rotated -90 deg Y:
         // Local Z axis points roughly world -X (Left).
         // Local X axis points roughly world -Z (Forward).
         
         // Lean hips into turn:
         hipsRef.current.rotation.z = THREE.MathUtils.lerp(hipsRef.current.rotation.z, turnAmt * 0.4, dt * 5);
         // Pitch hips for tuck:
         hipsRef.current.rotation.x = THREE.MathUtils.lerp(hipsRef.current.rotation.x, isTucking ? 0.3 : 0, dt * 5);
    }

    // TORSO (Counter-rotate to face forward)
    if (torsoRef.current) {
        // Hips are at -1.4. Torso needs to rotate +1.4 to face world forward.
        // Add turn look: -turnAmt
        const lookAngle = 1.4 - (turnAmt * 0.5);
        torsoRef.current.rotation.y = THREE.MathUtils.lerp(torsoRef.current.rotation.y, lookAngle, dt * 5);
        
        // Lean Forward/Back (Local X)
        const leanForward = isTucking ? 0.8 : 0.2;
        const leanBack = isBraking ? -0.5 : 0;
        torsoRef.current.rotation.x = THREE.MathUtils.lerp(torsoRef.current.rotation.x, leanForward + leanBack, dt * 5);
        
        // Lean Side (Local Z)
        torsoRef.current.rotation.z = THREE.MathUtils.lerp(torsoRef.current.rotation.z, turnAmt * 0.2, dt * 5);
    }

    // HEAD
    if (headRef.current) {
        // Face velocity
        headRef.current.rotation.y = THREE.MathUtils.lerp(headRef.current.rotation.y, turnAmt * 0.3, dt * 5);
        // Look up/down
        headRef.current.rotation.x = THREE.MathUtils.lerp(headRef.current.rotation.x, isTucking ? -0.6 : 0, dt * 5);
    }

    // LEGS (Fake IK - simple rotation based on stance)
    const legBend = isTucking ? 0.8 : 0.3;
    if (leftLegRef.current) {
        // Front leg (Left in stance)
        // Needs to point down and forward
        leftLegRef.current.rotation.x = THREE.MathUtils.lerp(leftLegRef.current.rotation.x, -legBend * 0.5, dt * 10);
        leftLegRef.current.rotation.z = THREE.MathUtils.lerp(leftLegRef.current.rotation.z, legBend * 0.5, dt * 10);
    }
    if (rightLegRef.current) {
        // Back leg (Right in stance)
        rightLegRef.current.rotation.x = THREE.MathUtils.lerp(rightLegRef.current.rotation.x, legBend * 0.5, dt * 10);
        rightLegRef.current.rotation.z = THREE.MathUtils.lerp(rightLegRef.current.rotation.z, -legBend * 0.5, dt * 10);
    }

    // ARMS
    if (leftArmRef.current && rightArmRef.current) {
        if (isTucking) {
             leftArmRef.current.rotation.z = 1.2;
             rightArmRef.current.rotation.z = -1.2;
             leftArmRef.current.rotation.x = 0.5;
             rightArmRef.current.rotation.x = 0.5;
        } else if (isBraking) {
             leftArmRef.current.rotation.z = 1.5; // Arms out wide
             rightArmRef.current.rotation.z = -1.5;
        } else {
             // Balance
             leftArmRef.current.rotation.z = 0.5;
             rightArmRef.current.rotation.z = -0.5;
             // Steer with arms
             leftArmRef.current.rotation.y = turnAmt * 0.5;
             rightArmRef.current.rotation.y = turnAmt * 0.5;
        }
    }

    // Thruster
    if (thrusterRef.current) {
        const scale = Math.max(0.2, speed.current / 80);
        thrusterRef.current.scale.set(1, 1, scale + (Math.random() * 0.2));
    }

    // Camera
    const camDist = 12 + (speed.current * 0.01); 
    const camHeight = 3.5 + (Math.max(0, currentHeight) * 0.1); 
    const idealOffset = new THREE.Vector3(0, camHeight, -camDist);
    idealOffset.applyQuaternion(rotation.current);
    idealOffset.add(position.current);
    camera.position.lerp(idealOffset, 0.12); 
    camera.lookAt(position.current.clone().add(new THREE.Vector3(0, 1, 30)));

    // Stats
    frameCount.current += 1;
    if (frameCount.current % 5 === 0) {
        setStats({
            speed: Math.round(Math.abs(speed.current) * 2), 
            altitude: Math.round(currentHeight * 10),
            distance: Math.min(Math.max(Math.round(((position.current.z + WORLD_LENGTH / 2) / WORLD_LENGTH) * 100), 0), 100),
            x: position.current.x,
            y: position.current.y,
            z: position.current.z,
            heading: new THREE.Euler().setFromQuaternion(rotation.current).y
        });
    }
  });

  const ArmorMat = <meshStandardMaterial color={customization.suitColor} roughness={0.3} metalness={0.5} />;
  const TechMat = <meshStandardMaterial color="#1a1a1a" roughness={0.7} metalness={0.8} />;
  const JointMat = <meshStandardMaterial color="#333" roughness={0.9} metalness={0.1} />;
  const GlowMat = <meshStandardMaterial color={customization.boardColor} emissive={customization.boardColor} emissiveIntensity={2} toneMapped={false} />;
  const GlassMat = <meshStandardMaterial color="#111" roughness={0.1} metalness={1.0} envMapIntensity={2.0} />;

  return (
    <group ref={groupRef}>
      <group ref={meshRef} position={[0, -0.9, 0]}> 
        <group ref={boardRef}>
           <mesh castShadow receiveShadow scale={[1.2, 0.12, 3.8]}>
                <boxGeometry />
                <meshStandardMaterial color={customization.boardType === 'standard' ? '#222' : '#333'} roughness={0.4} metalness={0.8} />
           </mesh>
           <mesh position={[0.55, 0.01, 0]} scale={[0.1, 0.13, 3.82]}><boxGeometry />{GlowMat}</mesh>
           <mesh position={[-0.55, 0.01, 0]} scale={[0.1, 0.13, 3.82]}><boxGeometry />{GlowMat}</mesh>
           <mesh position={[0, 0.07, 0]} scale={[0.9, 0.02, 1.5]}><boxGeometry /><meshStandardMaterial color="#111" roughness={1.0} /></mesh>
           <mesh position={[0.2, 0.1, -0.4]} rotation={[0, -0.2, 0]}><cylinderGeometry args={[0.22, 0.25, 0.1, 16]} /><meshStandardMaterial color="#444" /></mesh>
           <mesh position={[-0.2, 0.1, 0.4]} rotation={[0, 0.2, 0]}><cylinderGeometry args={[0.22, 0.25, 0.1, 16]} /><meshStandardMaterial color="#444" /></mesh>
           <group position={[0, 0.1, -1.9]} ref={thrusterRef}>
               <mesh rotation={[1.57, 0, 0]} position={[0, 0, -0.5]}>
                   <coneGeometry args={[0.4, 1.8, 16, 1, true]} />
                   <meshBasicMaterial color={customization.boardColor} transparent opacity={0.8} side={THREE.DoubleSide} />
               </mesh>
               <mesh rotation={[1.57, 0, 0]}><cylinderGeometry args={[0.25, 0.45, 0.6, 8]} /><meshStandardMaterial color="#111" metalness={0.8} /></mesh>
           </group>
        </group>

        <group ref={hipsRef}>
            <mesh castShadow><boxGeometry args={[0.4, 0.25, 0.3]} />{TechMat}</mesh>

            {/* Legs Container - No manual position prop, handled in useLayoutEffect */}
            <group ref={leftLegRef}>
                     <mesh position={[0, -0.25, 0]} rotation={[0.1, 0, -0.05]} castShadow><boxGeometry args={[0.18, 0.5, 0.18]} />{ArmorMat}</mesh>
                     <mesh position={[0, -0.5, 0]}><sphereGeometry args={[0.12]} />{JointMat}</mesh>
                     <mesh position={[0, -0.75, 0]} rotation={[-0.1, 0, 0]} castShadow><boxGeometry args={[0.16, 0.5, 0.16]} />{ArmorMat}</mesh>
                     <group position={[0, -1.0, 0.05]}>
                        <mesh castShadow><boxGeometry args={[0.2, 0.2, 0.35]} />{TechMat}</mesh>
                     </group>
            </group>
            <group ref={rightLegRef}>
                     <mesh position={[0, -0.25, 0]} rotation={[0.1, 0, 0.05]} castShadow><boxGeometry args={[0.18, 0.5, 0.18]} />{ArmorMat}</mesh>
                     <mesh position={[0, -0.5, 0]}><sphereGeometry args={[0.12]} />{JointMat}</mesh>
                     <mesh position={[0, -0.75, 0]} rotation={[-0.1, 0, 0]} castShadow><boxGeometry args={[0.16, 0.5, 0.16]} />{ArmorMat}</mesh>
                     <group position={[0, -1.0, 0.05]}>
                        <mesh castShadow><boxGeometry args={[0.2, 0.2, 0.35]} />{TechMat}</mesh>
                     </group>
            </group>

            <group ref={torsoRef}>
                <mesh position={[0, 0.15, 0]} castShadow><cylinderGeometry args={[0.18, 0.2, 0.3, 8]} />{TechMat}</mesh>
                <group position={[0, 0.45, 0]}>
                    <mesh castShadow><boxGeometry args={[0.45, 0.4, 0.3]} />{ArmorMat}</mesh>
                    <mesh position={[0, 0, 0.16]}><boxGeometry args={[0.2, 0.2, 0.05]} />{GlowMat}</mesh>
                    <mesh position={[0, 0, -0.2]} castShadow><boxGeometry args={[0.4, 0.5, 0.15]} />{TechMat}</mesh>
                </group>

                <group ref={headRef}> 
                    <mesh castShadow><sphereGeometry args={[0.18, 32, 32]} />{ArmorMat}</mesh>
                    <mesh position={[0, 0.02, 0.12]}><sphereGeometry args={[0.12, 32, 32, 0, Math.PI * 2, 0, Math.PI/2]} />{GlassMat}</mesh>
                </group>

                <group ref={leftArmRef}>
                     <mesh><sphereGeometry args={[0.14]} />{ArmorMat}</mesh>
                     <mesh position={[-0.05, -0.3, 0]} rotation={[0, 0, 0.1]} castShadow><boxGeometry args={[0.12, 0.5, 0.12]} />{TechMat}</mesh>
                     <mesh position={[-0.08, -0.6, 0]} castShadow><boxGeometry args={[0.12, 0.15, 0.12]} />{ArmorMat}</mesh>
                </group>
                <group ref={rightArmRef}>
                     <mesh><sphereGeometry args={[0.14]} />{ArmorMat}</mesh>
                     <mesh position={[0.05, -0.3, 0]} rotation={[0, 0, -0.1]} castShadow><boxGeometry args={[0.12, 0.5, 0.12]} />{TechMat}</mesh>
                     <mesh position={[0.08, -0.6, 0]} castShadow><boxGeometry args={[0.12, 0.15, 0.12]} />{ArmorMat}</mesh>
                </group>
            </group>
        </group>
      </group>
    </group>
  );
};