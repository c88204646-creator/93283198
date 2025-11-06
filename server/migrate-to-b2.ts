import { db } from './db';
import { gmailMessages, gmailAttachments } from '../shared/schema';
import { backblazeStorage } from './backblazeStorage';
import { eq, isNotNull, or } from 'drizzle-orm';

async function migrateEmailBodiesToB2() {
  console.log('📧 Starting migration of email bodies to Backblaze B2...\n');
  
  // Find all messages with bodies in DB but not in B2
  const messages = await db
    .select()
    .from(gmailMessages)
    .where(
      or(
        isNotNull(gmailMessages.bodyText),
        isNotNull(gmailMessages.bodyHtml)
      )
    );

  console.log(`Found ${messages.length} messages with email bodies in DB`);
  
  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const message of messages) {
    try {
      // Skip if already in B2
      if (message.bodyTextB2Key || message.bodyHtmlB2Key) {
        skipped++;
        continue;
      }

      // Upload to B2
      const b2Keys = await backblazeStorage.uploadEmailBody(
        message.id,
        message.bodyText,
        message.bodyHtml
      );

      // Update database record
      await db
        .update(gmailMessages)
        .set({
          bodyTextB2Key: b2Keys.textKey,
          bodyHtmlB2Key: b2Keys.htmlKey,
          // Keep the original data for now as backup
        })
        .where(eq(gmailMessages.id, message.id));

      migrated++;
      
      if (migrated % 10 === 0) {
        console.log(`  Progress: ${migrated}/${messages.length} migrated...`);
      }
    } catch (error: any) {
      console.error(`  ❌ Error migrating message ${message.id}:`, error.message);
      errors++;
    }
  }

  console.log(`\n✅ Email bodies migration complete:`);
  console.log(`   - Migrated: ${migrated}`);
  console.log(`   - Skipped: ${skipped}`);
  console.log(`   - Errors: ${errors}\n`);
  
  return { migrated, skipped, errors };
}

async function migrateAttachmentsToB2() {
  console.log('📎 Starting migration of attachments to Backblaze B2...\n');
  
  // Find all attachments with data in DB but not in B2
  const attachments = await db
    .select()
    .from(gmailAttachments)
    .where(isNotNull(gmailAttachments.data));

  console.log(`Found ${attachments.length} attachments with data in DB`);
  
  let migrated = 0;
  let skipped = 0;
  let errors = 0;
  let totalSize = 0;

  for (const attachment of attachments) {
    try {
      // Skip if already in B2
      if (attachment.b2Key) {
        skipped++;
        continue;
      }

      if (!attachment.data) {
        skipped++;
        continue;
      }

      // Convert base64 to buffer
      const buffer = Buffer.from(attachment.data, 'base64');
      totalSize += buffer.length;

      // Upload to B2
      const uploadResult = await backblazeStorage.uploadEmailAttachment(
        buffer,
        attachment.filename,
        attachment.mimeType
      );

      // Update database record
      await db
        .update(gmailAttachments)
        .set({
          b2Key: uploadResult.fileKey,
          fileHash: uploadResult.fileHash,
          // Keep the original data for now as backup
        })
        .where(eq(gmailAttachments.id, attachment.id));

      migrated++;
      
      if (migrated % 10 === 0) {
        const sizeMB = (totalSize / 1024 / 1024).toFixed(2);
        console.log(`  Progress: ${migrated}/${attachments.length} migrated (${sizeMB} MB)...`);
      }
    } catch (error: any) {
      console.error(`  ❌ Error migrating attachment ${attachment.id} (${attachment.filename}):`, error.message);
      errors++;
    }
  }

  const sizeMB = (totalSize / 1024 / 1024).toFixed(2);
  console.log(`\n✅ Attachments migration complete:`);
  console.log(`   - Migrated: ${migrated} files (${sizeMB} MB)`);
  console.log(`   - Skipped: ${skipped}`);
  console.log(`   - Errors: ${errors}\n`);
  
  return { migrated, skipped, errors, totalSize };
}

async function main() {
  console.log('🚀 Starting migration to Backblaze B2\n');
  console.log('=' .repeat(60));
  
  try {
    // Check if Backblaze is available
    if (!backblazeStorage.isAvailable()) {
      throw new Error('Backblaze B2 is not configured. Please check your environment variables.');
    }
    
    console.log('✅ Backblaze B2 is configured and ready\n');
    
    // Migrate email bodies
    const emailResults = await migrateEmailBodiesToB2();
    
    // Migrate attachments
    const attachmentResults = await migrateAttachmentsToB2();
    
    console.log('=' .repeat(60));
    console.log('🎉 Migration complete!\n');
    console.log('Summary:');
    console.log(`  Email bodies: ${emailResults.migrated} migrated, ${emailResults.errors} errors`);
    console.log(`  Attachments: ${attachmentResults.migrated} migrated (${(attachmentResults.totalSize / 1024 / 1024).toFixed(2)} MB), ${attachmentResults.errors} errors`);
    
    if (emailResults.errors === 0 && attachmentResults.errors === 0) {
      console.log('\n✅ All data migrated successfully to Backblaze B2!');
      console.log('\n⚠️  Next step: You can safely remove the old data from DB after verifying the migration.');
    } else {
      console.log('\n⚠️  Some errors occurred. Please review the logs above.');
    }
    
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Run migration
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
