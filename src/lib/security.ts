/**
 * Security utilities for XSS protection and input sanitization
 */
import DOMPurify from 'dompurify';

/**
 * Sanitize HTML content to prevent XSS attacks
 * Use this for any user-generated content that will be rendered as HTML
 */
export function sanitizeHTML(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [], // No HTML tags allowed
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true, // Keep text content
  });
}

/**
 * Sanitize message text for chat
 * Strips HTML and limits length
 */
export function sanitizeChatMessage(message: string): string {
  const sanitized = sanitizeHTML(message);
  return sanitized.trim().substring(0, 500);
}

/**
 * Sanitize username
 * Strips HTML, limits length, and removes special characters
 */
export function sanitizeUsername(username: string): string {
  const sanitized = sanitizeHTML(username);
  // Remove any non-printable characters
  const cleaned = sanitized.replace(/[^\x20-\x7E]/g, '');
  return cleaned.trim().substring(0, 50);
}

/**
 * Escape HTML entities for safe display
 */
export function escapeHTML(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  return text.replace(/[&<>"'/]/g, (char) => map[char]);
}

/**
 * Validate and sanitize room code
 */
export function sanitizeRoomCode(code: string): string | null {
  const sanitized = sanitizeHTML(code);
  const cleaned = sanitized.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 6);
  return cleaned.length === 6 ? cleaned : null;
}
