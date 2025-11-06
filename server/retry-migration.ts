import { db } from './db';
import { gmailAttachments } from '../shared/schema';
import { backblazeStorage } from './backblazeStorage';
import { eq, isNotNull, isNull, and } from 'drizzle-orm';

async function retryPendingAttachments() {
  console.log('🔄 Retrying migration of pending attachments...\n');
  
  const pendingAttachments = await db
    .select()
    .from(gmailAttachments)
    .where(
      and(
        isNotNull(gmailAttachments.data),
        isNull(gmailAttachments.b2Key)
      )
    );

  console.log(`Found ${pendingAttachments.length} pending attachments\n`);
  
  let migrated = 0;
  let errors = 0;

  for (const attachment of pendingAttachments) {
    try {
      if (!attachment.data) continue;

      const buffer = Buffer.from(attachment.data, 'base64');

      const uploadResult = await backblazeStorage.uploadEmailAttachment(
        buffer,
        attachment.filename,
        attachment.mimeType
      );

      await db
        .update(gmailAttachments)
        .set({
          b2Key: uploadResult.fileKey,
          fileHash: uploadResult.fileHash,
        })
        .where(eq(gmailAttachments.id, attachment.id));

      migrated++;
      console.log(`✓ Migrated: ${attachment.filename}`);
      
    } catch (error: any) {
      console.error(`✗ Failed: ${attachment.filename} - ${error.message}`);
      errors++;
    }
  }

  console.log(`\n📊 Results:`);
  console.log(`   Migrated: ${migrated}`);
  console.log(`   Errors: ${errors}`);
  
  return { migrated, errors };
}

retryPendingAttachments()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
