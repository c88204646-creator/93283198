import { invoiceAutoAssignmentService } from './server/invoice-auto-assignment-service';

async function main() {
  console.log('🔄 Iniciando reprocesamiento de facturas sin items...');
  const result = await invoiceAutoAssignmentService.reprocessInvoicesWithoutItems();
  console.log('\n✅ Reprocesamiento completado:');
  console.log(`   - Facturas procesadas: ${result.processed}`);
  console.log(`   - Items creados: ${result.itemsCreated}`);
  console.log(`   - Errores: ${result.errors}`);
  process.exit(0);
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
