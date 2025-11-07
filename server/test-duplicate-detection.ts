import { db } from './db';
import { financialSuggestions, operations } from '@shared/schema';
import { FinancialDetectionService } from './financial-detection-service';
import { eq } from 'drizzle-orm';

/**
 * Script de pruebas para el sistema de detección de duplicados
 * 
 * Escenarios de prueba:
 * 1. Mismo hash de archivo (duplicado exacto)
 * 2. Monto similar ±2% (duplicado por similitud)
 * 3. Fecha cercana ±3 días (duplicado por similitud)
 * 4. Transacciones legítimas diferentes (NO duplicado)
 * 5. Múltiples duplicados del mismo archivo
 */

const testService = new FinancialDetectionService();

interface TestResult {
  scenario: string;
  passed: boolean;
  details: string;
  actualResult?: any;
}

const results: TestResult[] = [];

async function getTestOperationId(): Promise<string> {
  const operations = await db.query.operations.findFirst();
  if (!operations) {
    throw new Error('No operations found in database. Please create at least one operation first.');
  }
  return operations.id;
}

async function cleanupTestData() {
  console.log('\n🧹 Limpiando datos de prueba...');
  await db.delete(financialSuggestions).execute();
  console.log('✅ Datos de prueba eliminados\n');
}

async function testScenario1_ExactDuplicateHash(operationId: string) {
  console.log('\n📋 ESCENARIO 1: Mismo hash de archivo (duplicado exacto)');
  
  const testHash = 'abc123def456hash789';
  const testTransaction = {
    type: 'payment' as const,
    amount: 1000,
    currency: 'USD',
    date: new Date('2025-01-15'),
    description: 'Pago de prueba - Factura #001',
    confidence: 85,
    reasoning: 'Pago detectado en PDF',
  };

  // Primera transacción
  const suggestion1 = await testService.createSuggestionFromTransaction(testTransaction, {
    sourceType: 'email_attachment',
    operationId,
    extractedText: 'Test PDF content',
    attachmentHash: testHash,
  });

  await db.insert(financialSuggestions).values(suggestion1);
  console.log('  ✅ Primera sugerencia creada');

  // Segunda transacción con el MISMO hash
  const suggestion2 = await testService.createSuggestionFromTransaction(testTransaction, {
    sourceType: 'email_attachment',
    operationId,
    extractedText: 'Test PDF content',
    attachmentHash: testHash,
  });

  // Insertar también la segunda sugerencia para verla en la UI
  await db.insert(financialSuggestions).values(suggestion2);
  console.log('  ✅ Segunda sugerencia creada (duplicada)');

  const passed = suggestion2.isDuplicate === true && 
                 suggestion2.duplicateReason?.includes('mismo archivo');

  results.push({
    scenario: 'Escenario 1: Duplicado exacto (mismo hash)',
    passed,
    details: passed 
      ? `✅ Correctamente detectado como duplicado: "${suggestion2.duplicateReason}"`
      : `❌ No detectó duplicado. isDuplicate=${suggestion2.isDuplicate}`,
    actualResult: suggestion2,
  });

  console.log(passed ? '  ✅ PASÓ' : '  ❌ FALLÓ');
}

async function testScenario2_SimilarAmount(operationId: string) {
  console.log('\n📋 ESCENARIO 2: Monto similar ±2% (duplicado por similitud)');
  
  const baseAmount = 1000;
  const similarAmount = 1015; // +1.5% (dentro del rango)
  
  const transaction1 = {
    type: 'expense' as const,
    amount: baseAmount,
    currency: 'MXN',
    date: new Date('2025-01-20'),
    description: 'Gasto de transporte',
    confidence: 80,
    reasoning: 'Gasto detectado',
  };

  // Primera transacción
  const suggestion1 = await testService.createSuggestionFromTransaction(transaction1, {
    sourceType: 'email_attachment',
    operationId,
    extractedText: 'Transport invoice',
    attachmentHash: 'hash001',
  });

  await db.insert(financialSuggestions).values(suggestion1);
  console.log(`  ✅ Primera sugerencia: ${baseAmount} MXN`);

  // Segunda transacción con monto similar (+1.5%)
  const transaction2 = { ...transaction1, amount: similarAmount };
  const suggestion2 = await testService.createSuggestionFromTransaction(transaction2, {
    sourceType: 'email_attachment',
    operationId,
    extractedText: 'Transport invoice similar',
    attachmentHash: 'hash002',
  });

  // Insertar la segunda sugerencia para verla en la UI
  await db.insert(financialSuggestions).values(suggestion2);
  console.log(`  ✅ Segunda sugerencia: ${similarAmount} MXN (duplicada)`);

  const passed = suggestion2.isDuplicate === true;

  results.push({
    scenario: 'Escenario 2: Monto similar (±2%)',
    passed,
    details: passed
      ? `✅ Detectó duplicado: ${baseAmount} vs ${similarAmount} MXN (${((similarAmount - baseAmount) / baseAmount * 100).toFixed(1)}%)`
      : `❌ No detectó duplicado con diferencia de ${((similarAmount - baseAmount) / baseAmount * 100).toFixed(1)}%`,
    actualResult: suggestion2,
  });

  console.log(passed ? '  ✅ PASÓ' : '  ❌ FALLÓ');
}

async function testScenario3_SimilarDate(operationId: string) {
  console.log('\n📋 ESCENARIO 3: Fecha cercana ±3 días (duplicado por similitud)');
  
  const baseDate = new Date('2025-02-01');
  const similarDate = new Date('2025-02-03'); // +2 días (dentro del rango)
  
  const transaction1 = {
    type: 'payment' as const,
    amount: 5000,
    currency: 'USD',
    date: baseDate,
    description: 'Pago cliente ABC',
    confidence: 90,
    reasoning: 'Pago confirmado',
  };

  // Primera transacción
  const suggestion1 = await testService.createSuggestionFromTransaction(transaction1, {
    sourceType: 'email_attachment',
    operationId,
    extractedText: 'Payment confirmation',
    attachmentHash: 'hash003',
  });

  await db.insert(financialSuggestions).values(suggestion1);
  console.log(`  ✅ Primera sugerencia: ${baseDate.toISOString().split('T')[0]}`);

  // Segunda transacción con fecha similar (+2 días)
  const transaction2 = { ...transaction1, date: similarDate };
  const suggestion2 = await testService.createSuggestionFromTransaction(transaction2, {
    sourceType: 'email_attachment',
    operationId,
    extractedText: 'Payment confirmation similar',
    attachmentHash: 'hash004',
  });

  // Insertar la segunda sugerencia para verla en la UI
  await db.insert(financialSuggestions).values(suggestion2);
  console.log(`  ✅ Segunda sugerencia: ${similarDate.toISOString().split('T')[0]} (duplicada)`);

  const passed = suggestion2.isDuplicate === true;

  results.push({
    scenario: 'Escenario 3: Fecha cercana (±3 días)',
    passed,
    details: passed
      ? `✅ Detectó duplicado: ${baseDate.toISOString().split('T')[0]} vs ${similarDate.toISOString().split('T')[0]}`
      : `❌ No detectó duplicado entre fechas cercanas`,
    actualResult: suggestion2,
  });

  console.log(passed ? '  ✅ PASÓ' : '  ❌ FALLÓ');
}

async function testScenario4_LegitimatelyDifferent(operationId: string) {
  console.log('\n📋 ESCENARIO 4: Transacciones legítimas diferentes (NO duplicado)');
  
  const transaction1 = {
    type: 'payment' as const,
    amount: 1000,
    currency: 'USD',
    date: new Date('2025-01-10'),
    description: 'Pago cliente XYZ',
    confidence: 85,
    reasoning: 'Pago detectado',
  };

  const transaction2 = {
    type: 'payment' as const,
    amount: 1500, // +50% (fuera del rango ±2%)
    currency: 'USD',
    date: new Date('2025-01-11'),
    description: 'Pago cliente ABC',
    confidence: 87,
    reasoning: 'Pago diferente',
  };

  // Primera transacción
  const suggestion1 = await testService.createSuggestionFromTransaction(transaction1, {
    sourceType: 'email_attachment',
    operationId,
    extractedText: 'Payment XYZ',
    attachmentHash: 'hash005',
  });

  await db.insert(financialSuggestions).values(suggestion1);
  console.log(`  ✅ Primera sugerencia: ${transaction1.amount} USD`);

  // Segunda transacción con monto muy diferente
  const suggestion2 = await testService.createSuggestionFromTransaction(transaction2, {
    sourceType: 'email_attachment',
    operationId,
    extractedText: 'Payment ABC',
    attachmentHash: 'hash006',
  });

  // Insertar la segunda sugerencia para verla en la UI
  await db.insert(financialSuggestions).values(suggestion2);
  console.log(`  ✅ Segunda sugerencia: ${transaction2.amount} USD (NO duplicada)`);

  const passed = suggestion2.isDuplicate === false;

  results.push({
    scenario: 'Escenario 4: Transacciones diferentes',
    passed,
    details: passed
      ? `✅ Correctamente NO marcado como duplicado: ${transaction1.amount} vs ${transaction2.amount} USD (${((transaction2.amount - transaction1.amount) / transaction1.amount * 100).toFixed(0)}% diferencia)`
      : `❌ Incorrectamente marcado como duplicado`,
    actualResult: suggestion2,
  });

  console.log(passed ? '  ✅ PASÓ' : '  ❌ FALLÓ');
}

async function testScenario5_EdgeCases(operationId: string) {
  console.log('\n📋 ESCENARIO 5: Casos límite (exactamente ±2% y ±3 días)');
  
  // Caso límite: exactamente +2% de diferencia
  const baseAmount = 1000;
  const edgeAmount = 1020; // Exactamente +2%
  
  const transaction1 = {
    type: 'expense' as const,
    amount: baseAmount,
    currency: 'EUR',
    date: new Date('2025-03-01'),
    description: 'Servicio mensual',
    confidence: 88,
    reasoning: 'Gasto recurrente',
  };

  const suggestion1 = await testService.createSuggestionFromTransaction(transaction1, {
    sourceType: 'email_attachment',
    operationId,
    extractedText: 'Monthly service',
    attachmentHash: 'hash007',
  });

  await db.insert(financialSuggestions).values(suggestion1);
  console.log(`  ✅ Primera sugerencia: ${baseAmount} EUR`);

  // Exactamente +2%
  const transaction2 = { ...transaction1, amount: edgeAmount };
  const suggestion2 = await testService.createSuggestionFromTransaction(transaction2, {
    sourceType: 'email_attachment',
    operationId,
    extractedText: 'Monthly service edge',
    attachmentHash: 'hash008',
  });

  // Insertar la segunda sugerencia para verla en la UI
  await db.insert(financialSuggestions).values(suggestion2);
  console.log(`  ✅ Segunda sugerencia: ${edgeAmount} EUR (duplicada en el límite)`);

  const passed = suggestion2.isDuplicate === true;

  results.push({
    scenario: 'Escenario 5: Caso límite (exactamente ±2%)',
    passed,
    details: passed
      ? `✅ Detectó duplicado en el límite: ${baseAmount} vs ${edgeAmount} EUR (exactamente +2%)`
      : `❌ No detectó duplicado en el límite de ±2%`,
    actualResult: suggestion2,
  });

  console.log(passed ? '  ✅ PASÓ' : '  ❌ FALLÓ');
}

async function printResults() {
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 RESUMEN DE PRUEBAS - DETECCIÓN DE DUPLICADOS');
  console.log('='.repeat(80) + '\n');

  const totalTests = results.length;
  const passedTests = results.filter(r => r.passed).length;
  const failedTests = totalTests - passedTests;

  results.forEach((result, index) => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} Test ${index + 1}/${totalTests}: ${result.scenario}`);
    console.log(`   ${result.details}\n`);
  });

  console.log('='.repeat(80));
  console.log(`📈 Resultado Final: ${passedTests}/${totalTests} pruebas exitosas (${(passedTests/totalTests*100).toFixed(0)}%)`);
  
  if (failedTests > 0) {
    console.log(`⚠️  ${failedTests} prueba(s) fallaron - revisar configuración`);
  } else {
    console.log('🎉 ¡Todas las pruebas pasaron correctamente!');
  }
  console.log('='.repeat(80) + '\n');

  // Verificar datos en la base de datos
  const allSuggestions = await db.select().from(financialSuggestions);
  console.log(`\n💾 Total de sugerencias en BD: ${allSuggestions.length}`);
  console.log(`   - Marcadas como duplicados: ${allSuggestions.filter(s => s.isDuplicate).length}`);
  console.log(`   - NO marcadas como duplicados: ${allSuggestions.filter(s => !s.isDuplicate).length}\n`);
}

async function runTests() {
  console.log('\n🚀 Iniciando pruebas de detección de duplicados...\n');
  
  try {
    // Limpiar datos previos
    await cleanupTestData();

    // Obtener operación de prueba
    const operationId = await getTestOperationId();
    console.log(`📦 Usando operación: ${operationId}\n`);

    // Ejecutar escenarios
    await testScenario1_ExactDuplicateHash(operationId);
    await testScenario2_SimilarAmount(operationId);
    await testScenario3_SimilarDate(operationId);
    await testScenario4_LegitimatelyDifferent(operationId);
    await testScenario5_EdgeCases(operationId);

    // Imprimir resultados
    await printResults();

    console.log('\n✅ Pruebas completadas. Revisa la UI en /api/financial-suggestions/pending\n');
    
  } catch (error) {
    console.error('\n❌ Error durante las pruebas:', error);
    throw error;
  }
}

export { runTests };

// Ejecutar pruebas automáticamente
runTests()
  .then(() => {
    console.log('✅ Script completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
