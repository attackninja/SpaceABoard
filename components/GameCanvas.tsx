import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { PlanetConfig, GameState, PlayerCustomization } from '../types';
import { Terrain } from './Terrain';
import { Player } from './Player';
import { Environment } from './Environment';
import { Weather } from './Weather';
import { Loader } from '@react-three/drei';

interface GameCanvasProps {
  planet: PlanetConfig;
  gameState: GameState;
  setGameState: (state: GameState) => void;
  setStats: (stats: any) => void;
  customization: PlayerCustomization;
  nightVision: boolean;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({ planet, gameState, setGameState, setStats, customization, nightVision }) => {
  return (
    <>
      {/* Increased far plane to 100000 to ensure massive horizon is visible */}
      {/* Enabled 'soft' shadows for better aesthetics */}
      <Canvas shadows="soft" camera={{ position: [0, 10, -20], fov: 65, near: 0.1, far: 100000 }}>
        <Suspense fallback={null}>
          <Environment planet={planet} nightVision={nightVision} />
          <Terrain planet={planet} />
          <Weather planet={planet} />
          {/* Key forces complete remount of Player when planet changes, resetting physics */}
          <Player 
            key={planet.name} 
            planet={planet} 
            gameState={gameState} 
            setGameState={setGameState} 
            setStats={setStats}
            customization={customization}
          />
        </Suspense>
      </Canvas>
      <Loader />
    </>
  );
};