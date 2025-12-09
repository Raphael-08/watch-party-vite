/**
 * Hyperbeam Settings Utility
 *
 * Provides utilities for managing Hyperbeam browser session preferences
 */

export interface HyperbeamSettings {
  kiosk: boolean;
  dark: boolean;
  webgl: boolean;
  adblock: boolean;
  draw: boolean;
  useTag: boolean;  // Session reuse via tag (premium feature)
  resolution: '720p' | '1080p';  // Video resolution (1080p is premium)
  fps: number;
  region: 'NA' | 'EU' | 'AS';
  quality: 'sharp' | 'smooth' | 'blocky';
}

export const DEFAULT_HYPERBEAM_SETTINGS: HyperbeamSettings = {
  kiosk: true,      // Hide browser UI
  dark: true,       // Dark mode
  webgl: true,      // Enable WebGL for video players
  adblock: true,    // Block ads
  draw: false,      // Disable drawing tools by default
  useTag: true,     // Enable session reuse by default
  resolution: '720p', // Standard resolution (default)
  fps: 30,          // Balanced frame rate
  region: 'AS',     // Asia (best for India)
  quality: 'smooth', // Optimized for video
};

/**
 * Get user's saved Hyperbeam settings from localStorage
 * Falls back to defaults if not found
 */
export function getHyperbeamSettings(): HyperbeamSettings {
  try {
    const saved = localStorage.getItem('hyperbeamSettings');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error('Failed to load Hyperbeam settings:', error);
  }
  return DEFAULT_HYPERBEAM_SETTINGS;
}

/**
 * Save Hyperbeam settings to localStorage
 */
export function saveHyperbeamSettings(settings: HyperbeamSettings): void {
  try {
    localStorage.setItem('hyperbeamSettings', JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save Hyperbeam settings:', error);
  }
}

/**
 * Convert frontend settings to backend SessionConfig format
 * Automatically strips restricted features when using test API key
 */
export function toSessionConfig(settings: HyperbeamSettings, roomCode: string, useProduction: boolean = false) {
  const config: any = {
    dark: settings.dark,
    webgl: settings.webgl,
    draw: settings.draw,
    fps: settings.fps,
    quality: {
      mode: settings.quality,
    },
    start_url: 'about:blank',
  };

  // Resolution: 720p is default (1280x720), 1080p is premium (1920x1080)
  if (settings.resolution === '1080p' && useProduction) {
    config.width = 1920;
    config.height = 1080;
  } else {
    // Use default 720p (don't send width/height, let Hyperbeam use defaults)
    // Or force 720p in test mode even if user had 1080p selected
  }

  // Region - include in both modes to test if it's actually restricted
  config.region = settings.region;

  // Only include premium features in production mode
  if (useProduction) {
    config.kiosk = settings.kiosk;
    config.adblock = settings.adblock;

    // Only add tag if user has it enabled
    if (settings.useTag) {
      config.tag = `room-${roomCode}`;
    }

    config.timeout = {
      offline: 7200,  // 2 hours when no users
      inactive: 0,    // No inactive timeout
      warning: 300,   // 5 minute warning
    };
    config.profile = {
      save: roomCode, // Save browser state per room
    };
  } else {
    // Test mode - restricted features not included (region included for testing)
    console.log('[Hyperbeam] Test mode: Excluding premium features (1080p, kiosk, adblock, tag, timeout, profile) - including region for testing');
  }

  return config;
}

/**
 * Get user-friendly description for FPS setting
 */
export function getFPSDescription(fps: number): string {
  switch (fps) {
    case 24:
      return 'Lower bandwidth';
    case 30:
      return 'Balanced';
    case 60:
      return 'Smooth, higher bandwidth';
    default:
      return '';
  }
}

/**
 * Get user-friendly description for quality mode
 */
export function getQualityDescription(quality: 'sharp' | 'smooth' | 'blocky'): string {
  switch (quality) {
    case 'sharp':
      return 'Best for text/UI';
    case 'smooth':
      return 'Best for video';
    case 'blocky':
      return 'Poor connections';
    default:
      return '';
  }
}

/**
 * Get user-friendly description for region
 */
export function getRegionDescription(region: 'NA' | 'EU' | 'AS'): string {
  switch (region) {
    case 'NA':
      return 'North America';
    case 'EU':
      return 'Europe';
    case 'AS':
      return 'Asia';
    default:
      return '';
  }
}
