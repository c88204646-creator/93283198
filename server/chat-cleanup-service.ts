import { db } from './db';
import { chatConversations } from '@shared/schema';
import { lt, sql, and } from 'drizzle-orm';

export async function cleanupOldConversations() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const deletedConversations = await db
      .delete(chatConversations)
      .where(
        and(
          lt(chatConversations.updatedAt, thirtyDaysAgo),
          sql`${chatConversations.status} = 'archived'`
        )
      )
      .returning({ id: chatConversations.id });

    if (deletedConversations.length > 0) {
      console.log(`[Chat Cleanup] Deleted ${deletedConversations.length} archived conversation(s) older than 30 days`);
    }

    return deletedConversations.length;
  } catch (error) {
    console.error('[Chat Cleanup] Error cleaning up old conversations:', error);
    return 0;
  }
}
