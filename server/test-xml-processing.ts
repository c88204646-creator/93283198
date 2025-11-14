// Test script to verify XML invoice processing functionality
import { db } from './db';
import { operationFiles, operations, clients } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { backblazeStorage } from './backblazeStorage';
import { facturamaInvoiceExtractor } from './facturama-invoice-extractor';
import { InvoiceAutoAssignmentService } from './invoice-auto-assignment-service';

async function testXmlProcessing() {
  try {
    console.log('🧪 [TEST] Starting XML invoice processing test...\n');
    
    // Get NAVI-1590037 operation
    const operation = await db.select()
      .from(operations)
      .where(eq(operations.name, 'NAVI-1590037'))
      .limit(1);
    
    if (operation.length === 0) {
      console.log('❌ Operation NAVI-1590037 not found');
      return;
    }
    
    const op = operation[0];
    console.log(`✅ Found operation: ${op.name} (ID: ${op.id})`);
    console.log(`   Client ID: ${op.clientId || 'NOT SET'}\n`);
    
    // Get client info if exists
    if (op.clientId) {
      const client = await db.select()
        .from(clients)
        .where(eq(clients.id, op.clientId))
        .limit(1);
      
      if (client.length > 0) {
        console.log(`✅ Client: ${client[0].name}`);
        console.log(`   RFC: ${client[0].rfc}`);
        console.log(`   Email: ${client[0].email}\n`);
      }
    }
    
    // Get XML attachment: Factura-1254-LOMA330829Q62.xml
    const xmlFiles = await db.select()
      .from(operationFiles)
      .where(eq(operationFiles.operationId, op.id));
    
    const xmlFile = xmlFiles.find(f => f.name === 'Factura-1254-LOMA330829Q62.xml');
    
    if (!xmlFile) {
      console.log('❌ XML file not found in operation_files');
      console.log('Available files:', xmlFiles.map(f => f.name));
      return;
    }
    
    console.log(`✅ Found XML file: ${xmlFile.name}`);
    console.log(`   MIME type: ${xmlFile.mimeType}`);
    console.log(`   Size: ${xmlFile.size} bytes`);
    console.log(`   B2 Key: ${xmlFile.b2Key}\n`);
    
    if (!xmlFile.b2Key) {
      console.log('❌ No B2 key found for file');
      return;
    }
    
    // Download file from B2
    console.log('⬇️  Downloading file from Backblaze B2...');
    const fileBuffer = await backblazeStorage.downloadFile(xmlFile.b2Key);
    console.log(`✅ Downloaded ${fileBuffer.length} bytes\n`);
    
    // Extract invoice data using XML parser
    console.log('🔍 Extracting invoice data from XML...');
    const invoiceData = await facturamaInvoiceExtractor.extractInvoiceData(
      fileBuffer,
      xmlFile.name,
      xmlFile.mimeType
    );
    
    if (!invoiceData) {
      console.log('❌ Failed to extract invoice data');
      return;
    }
    
    console.log('✅ Successfully extracted invoice data!\n');
    console.log('📄 Invoice Data:');
    console.log(`   Invoice Number: ${invoiceData.invoiceNumber}`);
    console.log(`   UUID: ${invoiceData.uuid}`);
    console.log(`   Total: ${invoiceData.total} ${invoiceData.currency}`);
    console.log(`   Payment Method: ${invoiceData.paymentMethod}\n`);
    
    console.log('👤 Receptor (Client) Data:');
    console.log(`   RFC: ${invoiceData.receptor.rfc}`);
    console.log(`   Name: ${invoiceData.receptor.nombre}`);
    console.log(`   Razón Social: ${invoiceData.receptor.razonSocial || 'N/A'}`);
    console.log(`   Email: ${invoiceData.receptor.email || 'N/A'}`);
    console.log(`   Código Postal: ${invoiceData.receptor.codigoPostal || 'N/A'}`);
    console.log(`   Régimen Fiscal: ${invoiceData.receptor.regimenFiscal || 'N/A'}`);
    console.log(`   Uso CFDI: ${invoiceData.receptor.usoCFDI || 'N/A'}\n`);
    
    console.log('🎯 XML Processing Test: SUCCESS');
    console.log('The XML parser is working correctly and can extract CFDI data!\n');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Run test
testXmlProcessing()
  .then(() => {
    console.log('✅ Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
