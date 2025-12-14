import React, { useState, useEffect } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { UI } from './components/UI';
import { PlanetType, GameState, PlayerCustomization } from './types';
import { PLANETS, WORLD_LENGTH } from './constants';
import { audioController } from './utils/audio';
import { generateSpeech } from './utils/tts';

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
  const [introPlayed, setIntroPlayed] = useState(false);
  const [outroPlayed, setOutroPlayed] = useState(false);

  // Init audio on first interaction
  useEffect(() => {
    const initAudio = async () => {
      audioController.init();
      audioController.startAmbience();
      
      const ctx = audioController.getContext();
      if (ctx && !introPlayed) {
          setIntroPlayed(true);
          const text = "Welcome to Space Aboard, pilot. You have been selected for the interplanetary gliding program. Your mission: navigate the treacherous terrains of the solar system, from the dust storms of Mars to the icy rings of Saturn. Optimize your trajectory, manage your momentum, and survive the elements. Systems online. Good luck.";
          const buffer = await generateSpeech(text, ctx);
          if (buffer) audioController.playSpeech(buffer);
      }
      
      window.removeEventListener('click', initAudio);
      window.removeEventListener('keydown', initAudio);
    };
    window.addEventListener('click', initAudio);
    window.addEventListener('keydown', initAudio);
    return () => {
       window.removeEventListener('click', initAudio);
       window.removeEventListener('keydown', initAudio);
    };
  }, [introPlayed]);

  // Outro Voice
  useEffect(() => {
      if (gameState === GameState.FINISHED && !outroPlayed) {
          setOutroPlayed(true);
          const ctx = audioController.getContext();
          if (ctx) {
              const text = "SpaceABoard is a space sports game, game still under development, subscribe https://github.com/attackninja/SpaceABoard on Github for new releases of updates. Thank you for playing!";
               generateSpeech(text, ctx).then(buffer => {
                   if (buffer) audioController.playSpeech(buffer);
               });
          }
      }
      if (gameState === GameState.MENU) {
          setOutroPlayed(false);
      }
  }, [gameState, outroPlayed]);

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