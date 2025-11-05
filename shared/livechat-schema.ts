
import { z } from 'zod';

export const chatMessageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  timestamp: z.date(),
  metadata: z.record(z.any()).optional()
});

export const conversationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string().optional(),
  startedAt: z.date(),
  lastMessageAt: z.date(),
  status: z.enum(['active', 'archived'])
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type Conversation = z.infer<typeof conversationSchema>;
