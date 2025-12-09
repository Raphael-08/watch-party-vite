/**
 * Zod validation schemas for runtime type checking
 */
import { z } from 'zod';

export const roomCodeSchema = z
  .string()
  .length(6)
  .regex(/^[A-Z0-9]{6}$/, 'Room code must be 6 alphanumeric characters');

export const usernameSchema = z
  .string()
  .min(1, 'Username is required')
  .max(50, 'Username must be less than 50 characters')
  .trim();

export const messageSchema = z
  .string()
  .min(1, 'Message cannot be empty')
  .max(500, 'Message must be less than 500 characters')
  .trim();

export const roomNameSchema = z
  .string()
  .max(30, 'Room name must be less than 30 characters')
  .trim()
  .optional();
