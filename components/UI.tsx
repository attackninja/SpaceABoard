import React, { useEffect, useState, useRef, useMemo } from 'react';
import { GameState, PlanetType, PlanetConfig, PlayerCustomization, HelmetStyle, BoardType } from '../types';
import { PLANETS, WORLD_LENGTH } from '../constants';
import { getTerrainHeight } from '../utils/terrain';
import { Wind, Map, Mountain, Target, Settings, AlertTriangle, User, RefreshCw, Lock, Navigation, ArrowUp, Eye, Menu } from 'lucide-react';

interface UIProps {
  gameState: GameState;
  setGameState: (s: GameState) => void;
  currentPlanet: PlanetType;
  setPlanet: (p: PlanetType) => void;
  stats: { speed: number; altitude: number; distance: number; x: number; y: number; z: number; heading: number };
  customization: PlayerCustomization;
  setCustomization: (c: PlayerCustomization) => void;
  nightVision: boolean;
  setNightVision: (v: boolean) => void;
}

// --- MINI MAP COMPONENTS ---

const HeightProfile: React.FC<{ planet: PlanetConfig; playerZ: number }> = ({ planet, playerZ }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    // Generate static profile data once per planet
    const profilePoints = useMemo(() => {
        const points = [];
        const steps = 100;
        const startZ = -WORLD_LENGTH / 2;
        const totalZ = WORLD_LENGTH;
        
        for (let i = 0; i <= steps; i++) {
            const z = startZ + (totalZ * (i / steps));
            // Sample center height
            const h = getTerrainHeight(0, z, planet);
            points.push(h);
        }
        return points;
    }, [planet]);

    useEffect(() => {
        const cvs = canvasRef.current;
        if (!cvs) return;
        const ctx = cvs.getContext('2d');
        if (!ctx) return;

        const w = cvs.width;
        const h = cvs.height;
        const pad = 8;
        
        // Clear
        ctx.clearRect(0,0,w,h);
        
        // Draw Background
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0,0,w,h);
        
        // Find min/max for scaling
        const maxAlt = Math.max(...profilePoints) + 500;
        const minAlt = Math.min(...profilePoints) - 100;
        const range = maxAlt - minAlt;

        // Draw Slope Profile
        ctx.beginPath();
        ctx.strokeStyle = planet.accentColor;
        ctx.lineWidth = 2;
        
        profilePoints.forEach((alt, i) => {
            const x = pad + (i / 100) * (w - 2 * pad);
            // Invert Y because canvas 0 is top
            const y = h - pad - ((alt - minAlt) / range) * (h - 2 * pad);
            if (i===0) ctx.moveTo(x,y);
            else ctx.lineTo(x,y);
        });
        ctx.stroke();

        // Fill under
        ctx.lineTo(w - pad, h - pad);
        ctx.lineTo(pad, h - pad);
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fill();

        // Draw Player Marker
        const progress = (playerZ + WORLD_LENGTH / 2) / WORLD_LENGTH;
        const clampedProgress = Math.min(Math.max(progress, 0), 1);
        const playerX = pad + clampedProgress * (w - 2 * pad);
        
        // Find player y on curve approximately
        const index = Math.floor(clampedProgress * 100);
        const alt = profilePoints[index] || 0;
        const playerY = h - pad - ((alt - minAlt) / range) * (h - 2 * pad);

        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(playerX, playerY, 3, 0, Math.PI * 2);
        ctx.fill();
        
        // Glow
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowBlur = 0;

    }, [playerZ, profilePoints, planet]);

    return (
        <div className="flex flex-col gap-1 w-full max-w-[150px] md:max-w-[240px]">
            <canvas ref={canvasRef} width={240} height={60} className="w-full h-auto rounded border border-white/10" />
        </div>
    );
};

const MiniMap: React.FC<{ planet: PlanetConfig; playerX: number; playerZ: number; heading: number }> = ({ planet, playerX, playerZ, heading }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const cvs = canvasRef.current;
        if (!cvs) return;
        const ctx = cvs.getContext('2d');
        if (!ctx) return;

        const w = cvs.width;
        const h = cvs.height;
        const cx = w/2;
        const cy = h/2;

        ctx.clearRect(0,0,w,h);
        
        // Background - Radar style
        ctx.fillStyle = 'rgba(0, 15, 30, 0.8)';
        ctx.beginPath();
        ctx.arc(cx, cy, w/2 - 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = planet.accentColor;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Save context for rotation
        ctx.save();
        ctx.translate(cx, cy);
        
        // Grid Rings (Static to player frame)
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(0, 0, w/4, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, w/8, 0, Math.PI * 2); ctx.stroke();
        
        // Render Terrain (Relative to player)
        // Since the map is "player facing up", we draw terrain shifted by x
        // Assuming the track is mostly straight Z, we just show lateral deviation
        const scale = 0.15; 
        const leftBnd = (-200 - playerX) * scale;
        const rightBnd = (200 - playerX) * scale;

        ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
        // Draw world bounds relative to center
        // Left Cliff
        ctx.fillRect(-w/2, -h/2, (w/2 + leftBnd), h);
        // Right Cliff
        ctx.fillRect(rightBnd, -h/2, (w/2 - rightBnd), h);

        ctx.restore();

        // Player (Always Center, facing UP)
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(cx, cy - 6);
        ctx.lineTo(cx - 5, cy + 5);
        ctx.lineTo(cx + 5, cy + 5);
        ctx.fill();
        
        // Compass Ring (Rotates based on heading)
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(heading); // Rotate the compass ring
        
        const r = w/2 - 8;
        ctx.font = '10px monospace';
        ctx.fillStyle = '#0ff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        ctx.fillText('N', 0, -r); 
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText('S', 0, r);
        ctx.fillText('E', r, 0);
        ctx.fillText('W', -r, 0);
        
        // Small ticks
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath();
        for(let i=0; i<12; i++) {
            ctx.rotate(Math.PI / 6);
            ctx.moveTo(0, -r + 2);
            ctx.lineTo(0, -r - 2);
        }
        ctx.stroke();

        ctx.restore();

        // Clip to circle cleanup
        ctx.globalCompositeOperation = 'destination-in';
        ctx.beginPath();
        ctx.arc(cx, cy, w/2 - 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';

    }, [playerX, planet, heading]);

    return (
        <div className="relative">
             <canvas ref={canvasRef} width={100} height={100} className="block w-[80px] h-[80px] md:w-[100px] md:h-[100px]" />
        </div>
    );
};

// --- MAIN UI ---

export const UI: React.FC<UIProps> = ({ gameState, setGameState, currentPlanet, setPlanet, stats, customization, setCustomization, nightVision, setNightVision }) => {
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<'mission' | 'hangar'>('mission');
  const [tempMessage, setTempMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        if (gameState === GameState.MENU) {
             setShowSettings(true);
        } else if (gameState === GameState.PLAYING) {
            setShowSettings(prev => !prev);
            setGameState(GameState.PAUSED);
        } else if (gameState === GameState.PAUSED && !showSettings) { 
            setGameState(GameState.PLAYING);
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [gameState, showSettings, setGameState]);

  const closeSettings = () => {
      setShowSettings(false);
      if (gameState === GameState.PAUSED) setGameState(GameState.PLAYING);
  };

  const handlePlanetChange = (planet: PlanetConfig) => {
      if (planet.locked) {
          setTempMessage(`${planet.name} - COMING SOON`);
          setTimeout(() => setTempMessage(null), 1500);
          return;
      }
      setPlanet(planet.name);
      setGameState(GameState.MENU); // Reset state to trigger clean start
  };

  const handleRestart = () => {
      setGameState(GameState.MENU);
      setShowSettings(false);
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-4 md:p-6 overflow-hidden">
      
      {/* Top Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center text-white gap-4">
        <div>
           <h1 className="text-2xl md:text-4xl font-bold tracking-widest italic" style={{ textShadow: '0 0 10px #fff' }}>SPACEABOARD <span className="text-sm align-top not-italic text-cyan-400">Beta</span></h1>
           <div className="flex items-center gap-2 opacity-80 mt-1">
             <Map size={14} className="md:w-4 md:h-4" />
             <span className="text-xs md:text-sm font-mono uppercase">{currentPlanet} SECTOR</span>
           </div>
        </div>
        
        {/* Stats HUD (Top Center/Right) */}
        {(gameState === GameState.PLAYING || gameState === GameState.PAUSED) && (
            <div className="flex gap-4 md:gap-6 bg-black/40 backdrop-blur-md p-2 md:p-4 rounded-xl border border-white/10 self-start md:self-auto">
                <div className="text-center min-w-[50px]">
                    <div className="flex items-center justify-center gap-1 text-cyan-400 mb-1"><Wind size={14} className="md:w-[18px]" /></div>
                    <div className="text-lg md:text-2xl font-mono font-bold">{stats.speed}</div>
                    <div className="text-[10px] md:text-xs text-white/50">KM/H</div>
                </div>
                <div className="text-center border-l border-white/10 pl-4 md:pl-6 min-w-[50px]">
                    <div className="flex items-center justify-center gap-1 text-purple-400 mb-1"><Mountain size={14} className="md:w-[18px]" /></div>
                    <div className="text-lg md:text-2xl font-mono font-bold">{stats.altitude}</div>
                    <div className="text-[10px] md:text-xs text-white/50">AGL</div>
                </div>
                <div className="text-center border-l border-white/10 pl-4 md:pl-6 min-w-[50px]">
                    <div className="flex items-center justify-center gap-1 text-green-400 mb-1"><Target size={14} className="md:w-[18px]" /></div>
                    <div className="text-lg md:text-2xl font-mono font-bold">{stats.distance}%</div>
                    <div className="text-[10px] md:text-xs text-white/50">DONE</div>
                </div>
            </div>
        )}
      </div>

      {/* Touch Controls Hint (Mobile Only) */}
      {gameState === GameState.MENU && (
        <div className="md:hidden absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center opacity-60 pointer-events-none">
            <p className="text-xs uppercase tracking-widest mb-2">Tap Settings to Start</p>
        </div>
      )}

      {/* Bottom Controls Container */}
      <div className="flex justify-between items-end pb-safe">
          {/* Bottom Left: Night Vision Toggle + Settings Trigger (Mobile) */}
          <div className="flex gap-2 pointer-events-auto">
              <button 
                onClick={() => setNightVision(!nightVision)}
                className={`p-3 md:p-4 rounded-full border transition-all duration-300 ${nightVision ? 'bg-green-900/80 border-green-400 text-green-400 shadow-[0_0_20px_rgba(74,222,128,0.5)]' : 'bg-black/60 border-white/20 text-white/50 hover:bg-white/10'}`}
              >
                  <Eye size={20} className="md:w-6 md:h-6" />
              </button>
              
              {/* Settings button visible on mobile primarily, or always convenient */}
              <button 
                onClick={() => {
                    setShowSettings(true);
                    if (gameState === GameState.PLAYING) setGameState(GameState.PAUSED);
                }}
                className="p-3 md:p-4 rounded-full border bg-black/60 border-white/20 text-white/50 hover:bg-white/10 pointer-events-auto"
              >
                  <Menu size={20} className="md:w-6 md:h-6" />
              </button>
          </div>

          {/* Bottom Right: Mini Map & Height Profile */}
          {(gameState === GameState.PLAYING || gameState === GameState.PAUSED) && (
              <div className="flex items-end gap-2 md:gap-4 pointer-events-auto">
                 <div className="bg-black/60 backdrop-blur-md p-2 md:p-3 rounded-xl border border-white/10 hidden sm:block">
                    <HeightProfile planet={PLANETS[currentPlanet]} playerZ={stats.z} />
                 </div>
                 <div className="bg-black/60 backdrop-blur-md p-2 md:p-3 rounded-full border border-white/10">
                    <MiniMap planet={PLANETS[currentPlanet]} playerX={stats.x} playerZ={stats.z} heading={stats.heading} />
                 </div>
              </div>
          )}
      </div>

      {/* Settings Modal - Responsive */}
      {(showSettings || gameState === GameState.MENU) && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm pointer-events-auto z-50">
           <div className="bg-slate-900 border-none md:border md:border-slate-700 w-full h-full md:h-auto md:max-h-[85vh] md:max-w-3xl md:rounded-2xl shadow-2xl overflow-hidden flex flex-col">
              
              {/* Header / Tabs */}
              <div className="flex border-b border-slate-700 shrink-0">
                  <button 
                    onClick={() => setActiveTab('mission')}
                    className={`flex-1 py-4 font-bold flex items-center justify-center gap-2 text-sm md:text-base ${activeTab === 'mission' ? 'bg-slate-800 text-white' : 'bg-slate-900 text-slate-500 hover:text-white'}`}
                  >
                      <Map size={16} /> MISSION
                  </button>
                  <button 
                    onClick={() => setActiveTab('hangar')}
                    className={`flex-1 py-4 font-bold flex items-center justify-center gap-2 text-sm md:text-base ${activeTab === 'hangar' ? 'bg-slate-800 text-white' : 'bg-slate-900 text-slate-500 hover:text-white'}`}
                  >
                      <User size={16} /> HANGAR
                  </button>
              </div>

              {/* Content Area */}
              <div className="p-4 md:p-8 overflow-y-auto custom-scrollbar flex-1 relative">
                  {tempMessage && (
                      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-cyan-500 text-black font-bold px-6 py-2 rounded-full shadow-[0_0_20px_rgba(6,182,212,0.6)] z-50 animate-pulse text-sm whitespace-nowrap">
                          {tempMessage}
                      </div>
                  )}

                  {activeTab === 'mission' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-8">
                        {Object.values(PLANETS).map((p) => (
                            <button
                            key={p.name}
                            onClick={() => handlePlanetChange(p)}
                            className={`p-3 md:p-4 rounded-lg text-left transition-all border relative overflow-hidden group
                                ${currentPlanet === p.name ? 'bg-white/10 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.5)]' : 'bg-black/20 border-white/5 hover:bg-white/5'}
                                ${p.locked ? 'opacity-60' : ''}
                            `}
                            >
                                <div className="flex justify-between items-start">
                                    <div className="font-bold text-white mb-1">{p.name}</div>
                                    {p.locked && <Lock size={14} className="text-slate-500" />}
                                </div>
                                <div className="text-xs text-slate-400 line-clamp-2 mb-2">
                                    {p.locked ? "LOCKED SECTOR" : p.description}
                                </div>
                                {!p.locked && (
                                    <div className="flex gap-3 text-[10px] uppercase font-mono text-slate-500">
                                        <span className="flex items-center gap-1"><ArrowUp size={10} /> {p.gravity}G</span>
                                        <span className="flex items-center gap-1 text-cyan-700"><Wind size={10} /> {p.weather}</span>
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                  )}

                  {activeTab === 'hangar' && (
                      <div className="space-y-6 mb-8">
                          {/* Helmet Config */}
                          <div>
                              <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Helmet System</label>
                              <div className="flex flex-wrap gap-2 md:gap-4">
                                  {(['classic', 'visor', 'tech'] as HelmetStyle[]).map(style => (
                                      <button 
                                        key={style}
                                        onClick={() => setCustomization({...customization, helmetStyle: style})}
                                        className={`px-3 py-2 md:px-4 rounded border text-sm ${customization.helmetStyle === style ? 'bg-cyan-900/50 border-cyan-500 text-white' : 'border-slate-700 text-slate-400'}`}
                                      >
                                          {style.toUpperCase()}
                                      </button>
                                  ))}
                              </div>
                          </div>

                           {/* Suit Color */}
                           <div>
                              <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Nano-Suit Color</label>
                              <div className="flex gap-3 flex-wrap">
                                  {['#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#000000'].map(color => (
                                      <button 
                                        key={color}
                                        onClick={() => setCustomization({...customization, suitColor: color})}
                                        style={{ backgroundColor: color }}
                                        className={`w-8 h-8 rounded-full border-2 ${customization.suitColor === color ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-70'}`}
                                      />
                                  ))}
                              </div>
                          </div>

                           {/* Board Config */}
                           <div>
                              <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Spaceboard Model</label>
                              <div className="flex flex-wrap gap-2 md:gap-4">
                                  {(['standard', 'v-wing', 'disk'] as BoardType[]).map(type => (
                                      <button 
                                        key={type}
                                        onClick={() => setCustomization({...customization, boardType: type})}
                                        className={`px-3 py-2 md:px-4 rounded border text-sm ${customization.boardType === type ? 'bg-purple-900/50 border-purple-500 text-white' : 'border-slate-700 text-slate-400'}`}
                                      >
                                          {type.toUpperCase()}
                                      </button>
                                  ))}
                              </div>
                          </div>

                           {/* Board Color */}
                           <div>
                              <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Board Finish</label>
                              <div className="flex gap-3 flex-wrap">
                                  {['#ffffff', '#333333', '#00ffff', '#ff6600', '#cc00cc', '#e63946'].map(color => (
                                      <button 
                                        key={color}
                                        onClick={() => setCustomization({...customization, boardColor: color})}
                                        style={{ backgroundColor: color }}
                                        className={`w-8 h-8 rounded-full border-2 ${customization.boardColor === color ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-70'}`}
                                      />
                                  ))}
                              </div>
                          </div>
                      </div>
                  )}

                  {/* Credits */}
                  <div className="mt-8 pt-6 border-t border-slate-800 text-center pb-4">
                      <p className="text-[10px] md:text-xs text-slate-500 tracking-widest mb-1">Designed by Z.Chao Z. (Attackninja)</p>
                      <p className="text-[10px] md:text-xs font-bold tracking-wide">
                        <span className="text-slate-600">powered by </span>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Gemini 3 Pro</span>
                      </p>
                  </div>
              </div>

              {/* Footer Actions */}
              <div className="p-4 md:p-6 bg-slate-950 border-t border-slate-800 flex justify-between items-center shrink-0">
                  <div className="flex gap-4">
                      <button 
                        onClick={handleRestart}
                        className="flex items-center gap-2 text-slate-400 hover:text-white text-[10px] md:text-xs font-bold uppercase transition-colors"
                      >
                          <RefreshCw size={14} /> <span className="hidden md:inline">Restart Mission</span> <span className="md:hidden">Restart</span>
                      </button>
                  </div>
                  
                  <button 
                    onClick={() => {
                        if (gameState === GameState.MENU) {
                            setGameState(GameState.PLAYING);
                            setShowSettings(false);
                        } else {
                            closeSettings();
                        }
                    }}
                    className="bg-cyan-600 hover:bg-cyan-500 text-white px-6 md:px-8 py-2 md:py-3 rounded-lg font-bold tracking-wide transition-colors text-sm md:text-base shadow-lg shadow-cyan-900/50"
                  >
                     {gameState === GameState.MENU ? 'LAUNCH' : 'RESUME'}
                  </button>
              </div>
           </div>
        </div>
      )}

      {/* Game Over / Crashed Screens */}
      {gameState === GameState.CRASHED && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-900/60 backdrop-blur-md pointer-events-auto z-50 px-4">
             <div className="text-center w-full max-w-lg bg-black/40 p-8 rounded-2xl border border-red-500/30">
                <AlertTriangle size={64} className="text-red-500 mx-auto mb-4 animate-bounce" />
                <h2 className="text-3xl md:text-5xl font-black text-white mb-2">SYSTEM CRASH</h2>
                <p className="text-red-200 text-lg md:text-xl mb-8">CRITICAL FAILURE DETECTED</p>
                <button 
                  onClick={() => setGameState(GameState.MENU)}
                  className="bg-white text-red-900 px-8 py-3 rounded-full font-bold hover:scale-105 transition-transform w-full md:w-auto"
                >
                    REBOOT SYSTEM
                </button>
             </div>
          </div>
      )}

      {gameState === GameState.FINISHED && (
          <div className="absolute inset-0 flex items-center justify-center bg-green-900/60 backdrop-blur-md pointer-events-auto z-50 px-4">
             <div className="text-center w-full max-w-lg bg-black/40 p-8 rounded-2xl border border-green-500/30">
                <Target size={64} className="text-green-400 mx-auto mb-4 animate-pulse" />
                <h2 className="text-3xl md:text-5xl font-black text-white mb-2">ROUTE COMPLETE</h2>
                <p className="text-green-200 text-base md:text-lg mb-8 max-w-md mx-auto">
                    SpaceABoard is a space sports game, game still under development, subscribe <a href="https://github.com/attackninja/SpaceABoard" target="_blank" className="underline text-green-100 hover:text-white">https://github.com/attackninja/SpaceABoard</a> on Github for new releases of updates. Thank you for playing!
                </p>
                <button 
                  onClick={() => setGameState(GameState.MENU)}
                  className="bg-white text-green-900 px-8 py-3 rounded-full font-bold hover:scale-105 transition-transform w-full md:w-auto"
                >
                    RETURN TO BASE
                </button>
             </div>
          </div>
      )}
    </div>
  );
};