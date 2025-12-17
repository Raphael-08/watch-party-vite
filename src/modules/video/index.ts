/**
 * Video Module
 *
 * Provides WebRTC video functionality with Picture-in-Picture UI.
 *
 * Available hooks:
 * - useSimplePeer: SimplePeer-based P2P mesh connections (recommended for 2-4 users)
 * - useWebRTC: Custom SFU-based connections (for larger groups, requires Go SFU backend)
 */

export { PIPVideoWindow } from './PIPVideoWindow';
export { useWebRTC } from './useWebRTC';
export { useSimplePeer } from './useSimplePeer';
