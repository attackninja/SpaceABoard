class AudioController {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  
  // Wind
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  
  // Drone (Ambience)
  private droneOsc: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;

  // Quantic Thruster (FM Synthesis + Sub)
  private fmCarrier: OscillatorNode | null = null;
  private fmModulator: OscillatorNode | null = null;
  private fmModGain: GainNode | null = null; 
  private thrusterGain: GainNode | null = null; 
  private subOsc: OscillatorNode | null = null;
  private subGain: GainNode | null = null;

  // High Speed Shimmer / Boost
  private shimmerOsc: OscillatorNode | null = null; 
  private shimmerGain: GainNode | null = null;

  // Brake (Air Resistance)
  private brakeSrc: AudioBufferSourceNode | null = null;
  private brakeGain: GainNode | null = null;
  private brakeFilter: BiquadFilterNode | null = null;

  // Turn (Swoosh)
  private turnSrc: AudioBufferSourceNode | null = null;
  private turnGain: GainNode | null = null;
  private turnFilter: BiquadFilterNode | null = null;
  private turnPanner: StereoPannerNode | null = null;

  // Weather System
  private weatherGain: GainNode | null = null;
  private stormSrc: AudioBufferSourceNode | null = null;
  private stormGain: GainNode | null = null;
  private stormFilter: BiquadFilterNode | null = null;

  private noiseBuffer: AudioBuffer | null = null;
  private isInitialized = false;

  init() {
    if (this.isInitialized) return;
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      // Increase Master Volume
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.8; 
      this.masterGain.connect(this.ctx.destination);

      this.createNoiseBuffer();
      
      this.setupWind();
      this.setupDrone();
      this.setupThruster();
      this.setupBrake();
      this.setupTurn();
      this.setupWeather();
      
      this.isInitialized = true;
    } catch (e) {
      console.error("Audio init failed", e);
    }
  }

  private createNoiseBuffer() {
      if (!this.ctx) return;
      const bufferSize = 2 * this.ctx.sampleRate;
      this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
          // Pure White Noise - we will filter it later
          output[i] = Math.random() * 2 - 1;
      }
  }

  private setupWind() {
    if (!this.ctx || !this.noiseBuffer || !this.masterGain) return;
    
    const noiseSrc = this.ctx.createBufferSource();
    noiseSrc.buffer = this.noiseBuffer;
    noiseSrc.loop = true;

    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.value = 200; // Start lower for white noise

    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0;

    noiseSrc.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.masterGain);
    
    noiseSrc.start(0);
  }

  private setupDrone() {
    if (!this.ctx || !this.masterGain) return;
    this.droneOsc = this.ctx.createOscillator();
    this.droneOsc.type = 'sine';
    this.droneOsc.frequency.value = 60; // Deep hum
    
    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.value = 0;

    this.droneOsc.connect(this.droneGain);
    this.droneGain.connect(this.masterGain);
    this.droneOsc.start(0);
  }

  private setupThruster() {
      if (!this.ctx || !this.masterGain) return;
      
      // 1. FM Engine (Mid/High Growl)
      this.fmCarrier = this.ctx.createOscillator();
      this.fmCarrier.type = 'sawtooth'; // Sawtooth for buzzier board sound
      this.fmCarrier.frequency.value = 80;

      this.fmModulator = this.ctx.createOscillator();
      this.fmModulator.type = 'sine';
      this.fmModulator.frequency.value = 40; 

      this.fmModGain = this.ctx.createGain();
      this.fmModGain.gain.value = 0; 

      this.fmModulator.connect(this.fmModGain);
      this.fmModGain.connect(this.fmCarrier.frequency);

      // Lowpass filter for the saw wave to make it less harsh
      const carrierFilter = this.ctx.createBiquadFilter();
      carrierFilter.type = 'lowpass';
      carrierFilter.frequency.value = 800;

      this.thrusterGain = this.ctx.createGain();
      this.thrusterGain.gain.value = 0;

      this.fmCarrier.connect(carrierFilter);
      carrierFilter.connect(this.thrusterGain);
      this.thrusterGain.connect(this.masterGain);

      // 2. Sub Oscillator (Weight)
      this.subOsc = this.ctx.createOscillator();
      this.subOsc.type = 'sine';
      this.subOsc.frequency.value = 40;
      
      this.subGain = this.ctx.createGain();
      this.subGain.gain.value = 0;
      
      this.subOsc.connect(this.subGain);
      this.subGain.connect(this.masterGain);

      // 3. High Speed Shimmer (Turbo Whine)
      this.shimmerOsc = this.ctx.createOscillator();
      this.shimmerOsc.type = 'triangle';
      this.shimmerOsc.frequency.value = 200;
      
      this.shimmerGain = this.ctx.createGain();
      this.shimmerGain.gain.value = 0;

      this.shimmerOsc.connect(this.shimmerGain);
      this.shimmerGain.connect(this.masterGain);

      this.fmCarrier.start(0);
      this.fmModulator.start(0);
      this.subOsc.start(0);
      this.shimmerOsc.start(0);
  }

  private setupBrake() {
      if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;

      this.brakeSrc = this.ctx.createBufferSource();
      this.brakeSrc.buffer = this.noiseBuffer;
      this.brakeSrc.loop = true;

      this.brakeFilter = this.ctx.createBiquadFilter();
      this.brakeFilter.type = 'highpass';
      this.brakeFilter.frequency.value = 500; 

      this.brakeGain = this.ctx.createGain();
      this.brakeGain.gain.value = 0;

      this.brakeSrc.connect(this.brakeFilter);
      this.brakeFilter.connect(this.brakeGain);
      this.brakeGain.connect(this.masterGain);
      this.brakeSrc.start(0);
  }

  private setupTurn() {
      if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;

      this.turnSrc = this.ctx.createBufferSource();
      this.turnSrc.buffer = this.noiseBuffer;
      this.turnSrc.loop = true;

      this.turnFilter = this.ctx.createBiquadFilter();
      this.turnFilter.type = 'bandpass';
      this.turnFilter.frequency.value = 400;
      this.turnFilter.Q.value = 1;

      this.turnPanner = this.ctx.createStereoPanner();
      this.turnGain = this.ctx.createGain();
      this.turnGain.gain.value = 0;

      this.turnSrc.connect(this.turnFilter);
      this.turnFilter.connect(this.turnPanner);
      this.turnPanner.connect(this.turnGain);
      this.turnGain.connect(this.masterGain);
      this.turnSrc.start(0);
  }

  private setupWeather() {
      if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;

      this.weatherGain = this.ctx.createGain();
      this.weatherGain.gain.value = 0.8;
      this.weatherGain.connect(this.masterGain);

      // Storm Wind Source
      this.stormSrc = this.ctx.createBufferSource();
      this.stormSrc.buffer = this.noiseBuffer;
      this.stormSrc.loop = true;

      this.stormFilter = this.ctx.createBiquadFilter();
      this.stormFilter.type = 'lowpass';
      this.stormFilter.frequency.value = 150; // Deep rumble
      
      this.stormGain = this.ctx.createGain();
      this.stormGain.gain.value = 0;

      this.stormSrc.connect(this.stormFilter);
      this.stormFilter.connect(this.stormGain);
      this.stormGain.connect(this.weatherGain);
      
      this.stormSrc.start(0);
  }

  // --- INTERACTION METHODS ---

  setWindIntensity(speed: number) {
    if (!this.windGain || !this.windFilter || !this.ctx) return;
    
    // Resume context if suspended (browser autoplay policy)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    const normalizedSpeed = Math.min(Math.max(speed / 150, 0), 1);
    const time = this.ctx.currentTime;
    
    // Wind Logic
    this.windGain.gain.setTargetAtTime(normalizedSpeed * 0.5, time, 0.2);
    // Open filter as speed increases
    this.windFilter.frequency.setTargetAtTime(200 + (normalizedSpeed * 1000), time, 0.2);
  }

  updatePlayerState(speed: number, isAccelerating: boolean, isBraking: boolean, turnInput: number) {
      if (!this.ctx) return;
      const time = this.ctx.currentTime;
      const absSpeed = Math.abs(speed);
      const normalizedSpeed = Math.min(absSpeed / 180, 1);

      // -- Quantic Thruster Logic --
      if (this.fmCarrier && this.fmModulator && this.fmModGain && this.thrusterGain && this.shimmerOsc && this.shimmerGain && this.subOsc && this.subGain) {
          
          // Pitch Pitch
          // Idle: 70Hz, Max: 180Hz. Boost adds +40Hz
          const basePitch = 70 + (normalizedSpeed * 110);
          const boostPitch = isAccelerating ? 80 : 0;
          
          this.fmCarrier.frequency.setTargetAtTime(basePitch + boostPitch, time, 0.1);
          this.subOsc.frequency.setTargetAtTime((basePitch + boostPitch) * 0.5, time, 0.1); // Sub octave

          // FM Growl Intensity
          const engineLoad = isAccelerating ? 300 : (50 + normalizedSpeed * 50);
          this.fmModGain.gain.setTargetAtTime(engineLoad, time, 0.15);
          this.fmModulator.frequency.setTargetAtTime((basePitch + boostPitch) * 0.5, time, 0.1);

          // Volume Mix
          // Louder when accelerating or high speed
          // When idle (speed 0, not accelerating), volume is low but audible (0.15)
          const baseVol = 0.15 + (normalizedSpeed * 0.2);
          const boostVol = isAccelerating ? 0.35 : 0;
          const rampTime = isAccelerating ? 0.05 : 0.2; // Fast attack, slower release

          this.thrusterGain.gain.setTargetAtTime(baseVol + boostVol, time, rampTime);
          
          // Sub Bass Volume
          this.subGain.gain.setTargetAtTime((baseVol + boostVol) * 0.6, time, rampTime);

          // Turbo Shimmer (High Freq Whine)
          // Only distinct at high speeds or boosting
          const shimmerVol = isAccelerating ? 0.25 : (normalizedSpeed > 0.6 ? (normalizedSpeed - 0.6) * 0.3 : 0);
          this.shimmerGain.gain.setTargetAtTime(shimmerVol, time, 0.3);
          this.shimmerOsc.frequency.setTargetAtTime(400 + (normalizedSpeed * 800), time, 0.2);
      }

      // Brake Logic
      if (this.brakeGain && this.brakeFilter) {
          const shouldPlay = isBraking && absSpeed > 10;
          const targetGain = shouldPlay ? 0.4 : 0.0;
          this.brakeGain.gain.setTargetAtTime(targetGain, time, 0.1);
          
          if (shouldPlay) {
             this.brakeFilter.frequency.setTargetAtTime(500 + (Math.random() * 200), time, 0.1);
          }
      }

      // Turn Logic (Swooshing)
      if (this.turnGain && this.turnPanner && this.turnFilter) {
          const turnIntensity = Math.abs(turnInput);
          // Play swoosh on hard turns
          const shouldPlay = turnIntensity > 0.2 && absSpeed > 30;
          const targetGain = shouldPlay ? (turnIntensity * 0.4) : 0;
          
          this.turnGain.gain.setTargetAtTime(targetGain, time, 0.1);
          this.turnPanner.pan.setTargetAtTime(-turnInput * 0.6, time, 0.1);
          this.turnFilter.frequency.setTargetAtTime(300 + (turnIntensity * 500), time, 0.1);
      }
  }

  updateWeather(type: string, intensity: number) {
      if (!this.ctx) return;
      const time = this.ctx.currentTime;
      
      // Dust Storm / Debris / Snow storm loop
      if (this.stormGain && this.stormFilter) {
          const isStorm = type === 'dust_storm' || type === 'debris' || type === 'snow';
          const targetGain = isStorm ? intensity * 0.5 : 0;
          
          this.stormGain.gain.setTargetAtTime(targetGain, time, 1.0);
          
          if (isStorm && intensity > 0.05) {
               // Varying storm rumble
               if (Math.random() < 0.05) {
                   const randomFreq = 100 + Math.random() * 200;
                   this.stormFilter.frequency.exponentialRampToValueAtTime(randomFreq, time + 0.5);
              }
          }
      }

      // Diamond Rain (Glassy Pings)
      if (type === 'diamond_rain' && intensity > 0.1) {
          if (Math.random() < 0.15 * intensity) {
              this.triggerRainPing(time);
          }
      }

      // Debris Impacts
      if (type === 'debris' && intensity > 0.1) {
           if (Math.random() < 0.05 * intensity) {
               this.triggerDebrisImpact(time);
           }
      }
  }

  private triggerRainPing(time: number) {
      if (!this.ctx || !this.weatherGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.frequency.value = 2500 + Math.random() * 2000;
      osc.type = 'sine';
      
      gain.gain.setValueAtTime(0.04, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
      
      osc.connect(gain);
      gain.connect(this.weatherGain);
      osc.start(time);
      osc.stop(time + 0.15);
  }

  private triggerDebrisImpact(time: number) {
      if (!this.ctx || !this.weatherGain || !this.noiseBuffer) return;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 600;
      const gain = this.ctx.createGain();
      
      gain.gain.setValueAtTime(0.15, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.weatherGain);
      src.start(time);
      src.stop(time + 0.15);
  }

  triggerJump() {
      if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
      const time = this.ctx.currentTime;

      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(200, time);
      filter.frequency.exponentialRampToValueAtTime(1200, time + 0.4);
      filter.Q.value = 2;
      
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.6, time);
      gain.gain.linearRampToValueAtTime(0, time + 0.4);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      src.start(time);
      src.stop(time + 0.4);
  }

  triggerLand(impactVelocity: number) {
      if (!this.ctx || !this.masterGain) return;
      const time = this.ctx.currentTime;
      const intensity = Math.min(impactVelocity / 40, 1.0);
      
      // Low Thud (Sine drop)
      const osc = this.ctx.createOscillator();
      osc.frequency.setValueAtTime(120, time);
      osc.frequency.exponentialRampToValueAtTime(40, time + 0.15);
      
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.6 * intensity, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
      
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(time);
      osc.stop(time + 0.15);
  }

  triggerImpact() {
      if (!this.ctx || !this.masterGain) return;
      const t = this.ctx.currentTime;

      // Sci-fi Shield Impact
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(100, t);
      osc.frequency.exponentialRampToValueAtTime(20, t + 0.5);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2000, t);
      filter.frequency.exponentialRampToValueAtTime(100, t + 0.4);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.7, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.4);
  }

  startAmbience() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    if (this.droneGain && this.ctx) {
       this.droneGain.gain.setTargetAtTime(0.15, this.ctx.currentTime, 2);
    }
  }

  stopAmbience() {
     if (this.droneGain && this.ctx) {
       this.droneGain.gain.setTargetAtTime(0, this.ctx.currentTime, 1);
    }
  }
}

export const audioController = new AudioController();