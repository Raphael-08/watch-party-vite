/**
 * Chat Module
 *
 * Provides chat functionality for the watchparty room:
 * - ChatPanel: Slide-in glass-morphism overlay panel
 * - ChatMessage: Individual message rendering
 * - ChatInput: Message composition with keyboard shortcuts
 *
 * Integrates with RoomContext for WebSocket communication.
 */

export { ChatPanel } from './ChatPanel';
export { ChatMessage } from './ChatMessage';
export { ChatInput } from './ChatInput';
export { QuickChatInput } from './QuickChatInput';
