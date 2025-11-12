import { backblazeStorage } from './backblaze-storage';
import { facturamaInvoiceExtractor } from './facturama-invoice-extractor';

async function testXmlExtraction() {
  try {
    console.log('\n🔍 Descargando archivo XML de Facturama...');
    const b2Key = 'operations/files/d5ae40651e4d57409eeba2ddf7132c5659f5506666de217b1f3fbe2c2948a026';
    const fileBuffer = await backblazeStorage.downloadFile(b2Key);
    
    console.log(`✅ Archivo descargado: ${fileBuffer.length} bytes`);
    
    // Mostrar primeros 2000 caracteres del XML
    const xmlContent = fileBuffer.toString('utf-8');
    console.log('\n📄 Contenido del XML (primeros 2000 caracteres):');
    console.log('='.repeat(80));
    console.log(xmlContent.substring(0, 2000));
    console.log('='.repeat(80));
    
    // Intentar extraer datos
    console.log('\n🔍 Intentando extraer datos de factura...');
    const invoiceData = await facturamaInvoiceExtractor.extractInvoiceData(fileBuffer, 'Factura-1254-LOMA330829Q62.xml');
    
    if (invoiceData) {
      console.log('\n✅ FACTURA DETECTADA:');
      console.log(JSON.stringify(invoiceData, null, 2));
    } else {
      console.log('\n❌ No se pudo extraer datos de factura');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
  process.exit(0);
}

testXmlExtraction();
