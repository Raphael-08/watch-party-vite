// Message types for chat and cursor tracking

export interface ChatMessage {
  userId: string
  username: string
  message: string
  timestamp: number
}

// Alias for compatibility
export type ChatMessageBroadcastPayload = ChatMessage

export interface CursorPosition {
  userId: string
  username: string
  x: number
  y: number
}

// Alias for compatibility
export type CursorMoveBroadcastPayload = CursorPosition

export interface User {
  userId: string
  username: string
  role?: 'host' | 'viewer'
}

export interface WebRTCSignal {
  userId: string
  signal: any
  type: 'offer' | 'answer' | 'ice-candidate'
}

export interface ServerMessage {
  type: string
  payload: any
}

// Additional payload types
export interface RoomJoinedPayload {
  roomId: string
  users: User[]
}

export interface RoomUserJoinedPayload {
  userId: string
  username: string
  role?: 'host' | 'viewer'
}

export interface RoomUserLeftPayload {
  userId: string
}

export interface SyncStatePayload {
  users: User[]
  hyperbeamSessionUrl?: string
}

export interface WebRTCOfferBroadcastPayload {
  userId: string
  offer: any
}

export interface WebRTCAnswerBroadcastPayload {
  userId: string
  answer: any
}

export interface WebRTCICECandidateBroadcastPayload {
  userId: string
  candidate: any
}

// SimplePeer signaling payloads (includes targetUserId for routing)
export interface SimplePeerSignalPayload {
  userId: string // Sender ID
  targetUserId: string // Recipient ID
  signal: any // SimplePeer signal data
}

// SFU-specific WebRTC payloads (server sends answer directly, not broadcast)
export interface WebRTCAnswerPayload {
  roomId: string
  userId: string
  answer: RTCSessionDescriptionInit
}

export interface WebRTCICECandidatePayload {
  roomId: string
  userId: string
  candidate: RTCIceCandidateInit
}

// WebSocket event types - use const instead of enum for erasableSyntaxOnly
export const WSEventTypes = {
  CHAT_MESSAGE: 'room-message',
  CHAT_MESSAGE_BROADCAST: 'room-message',
  CURSOR_MOVE: 'cursor-moved',
  CURSOR_MOVE_BROADCAST: 'cursor-moved',
  USER_JOINED: 'user-joined',
  ROOM_USER_JOINED: 'user-joined',
  USER_LEFT: 'user-left',
  ROOM_USER_LEFT: 'user-left',
  ROOM_USERS: 'room-users',
  ROOM_JOINED: 'room-joined',
  ROOM_LEAVE: 'leave-room',
  SYNC_STATE: 'sync-state',
  ERROR: 'error',
  WEBRTC_OFFER: 'webrtc-offer',
  WEBRTC_ANSWER: 'webrtc-answer',
  WEBRTC_ICE_CANDIDATE: 'webrtc-ice-candidate',
  WEBRTC_OFFER_BROADCAST: 'webrtc-offer-broadcast',
  WEBRTC_ANSWER_BROADCAST: 'webrtc-answer-broadcast',
  WEBRTC_ICE_CANDIDATE_BROADCAST: 'webrtc-ice-candidate-broadcast',
} as const
