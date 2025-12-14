export enum PlanetType {
  MARS = 'Mars',
  MOON = 'Moon',
  SATURN = 'Saturn',
  SATURN_RINGS = 'Saturn Rings',
  NEPTUNE = 'Neptune',
  URANUS = 'Uranus',
  SPACECRAFT = 'Space Craft',
}

export type TerrainProfile = 'shield' | 'ridge' | 'cloud' | 'pipe';
export type WeatherType = 'none' | 'dust_storm' | 'diamond_rain' | 'snow' | 'debris';

export interface PlanetConfig {
  name: PlanetType;
  gravity: number;
  atmosphereDensity: number;
  groundColor: string;
  skyColor: string;
  fogColor: string;
  mountainHeight: number;
  terrainRoughness: number;
  accentColor: string;
  stars: boolean;
  description: string;
  hasWater?: boolean;
  scatterType?: 'rock' | 'ice' | 'none' | 'tech';
  terrainProfile: TerrainProfile;
  weather: WeatherType;
  locked?: boolean;
}

export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  FINISHED = 'FINISHED',
  CRASHED = 'CRASHED',
}

export type HelmetStyle = 'classic' | 'visor' | 'tech';
export type BoardType = 'standard' | 'v-wing' | 'disk';

export interface PlayerCustomization {
  suitColor: string;
  helmetStyle: HelmetStyle;
  boardType: BoardType;
  boardColor: string;
}
