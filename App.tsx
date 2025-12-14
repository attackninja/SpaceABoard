import React, { useState, useEffect } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { UI } from './components/UI';
import { PlanetType, GameState, PlayerCustomization } from './types';
import { PLANETS, WORLD_LENGTH } from './constants';
import { audioController } from './utils/audio';

export default function App() {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [currentPlanet, setCurrentPlanet] = useState<PlanetType>(PlanetType.MARS);
  
  // Expanded stats to include position for Maps and heading
  const [stats, setStats] = useState({ 
    speed: 0, 
    altitude: 0, 
    distance: 0,
    x: 0,
    y: 0,
    z: -WORLD_LENGTH / 2,
    heading: 0
  });
  
  // Customization State
  const [customization, setCustomization] = useState<PlayerCustomization>({
    suitColor: '#ffffff',
    helmetStyle: 'classic',
    boardType: 'standard',
    boardColor: '#ffffff'
  });

  const [nightVision, setNightVision] = useState(false);

  // Init audio on first interaction
  useEffect(() => {
    const initAudio = () => {
      audioController.init();
      audioController.startAmbience();
      window.removeEventListener('click', initAudio);
      window.removeEventListener('keydown', initAudio);
    };
    window.addEventListener('click', initAudio);
    window.addEventListener('keydown', initAudio);
    return () => {
       window.removeEventListener('click', initAudio);
       window.removeEventListener('keydown', initAudio);
    };
  }, []);

  return (
    <div className="w-full h-full relative bg-black">
      <GameCanvas 
        planet={PLANETS[currentPlanet]} 
        gameState={gameState}
        setGameState={setGameState}
        setStats={setStats}
        customization={customization}
        nightVision={nightVision}
      />
      <UI 
        gameState={gameState} 
        setGameState={setGameState}
        currentPlanet={currentPlanet}
        setPlanet={setCurrentPlanet}
        stats={stats}
        customization={customization}
        setCustomization={setCustomization}
        nightVision={nightVision}
        setNightVision={setNightVision}
      />
    </div>
  );
}