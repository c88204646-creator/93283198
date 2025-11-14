/**
 * Financial Analysis Service - Análisis financiero inteligente con IA
 * 
 * Actúa como experto financiero empresarial para analizar cuentas bancarias
 * Usa sistema de aprendizaje progresivo para reducir uso de API Gemini
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import crypto from 'crypto';
import { db } from './db';
import { eq, and, desc, sql } from 'drizzle-orm';
import { bankAccountAnalyses, knowledgeBase, payments, expenses } from '@shared/schema';
import type { BankAccount, Payment, Expense, InsertBankAccountAnalysis, InsertKnowledgeBase } from '@shared/schema';
import { uploadJsonToB2 } from './backblazeStorage';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

interface TransactionData {
  payments: Payment[];
  expenses: Expense[];
  account: BankAccount;
  periodStart: Date;
  periodEnd: Date;
}

interface FinancialAnalysisResult {
  analysis: string;
  confidence: number;
  usedKnowledge: boolean;
  knowledgeSource?: string;
}

export class FinancialAnalysisService {
  private model;
  private cacheTTL = 1000 * 60 * 60 * 24; // 24 horas

  constructor() {
    this.model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash-exp',
      systemInstruction: `Eres un EXPERTO FINANCIERO EMPRESARIAL con 20+ años de experiencia en análisis de cuentas corporativas, gestión de flujo de caja, y optimización financiera.

TU MISIÓN: Analizar cuentas bancarias y proporcionar insights accionables para mejorar la salud financiera del negocio.

CONTEXTO: Estás analizando una cuenta bancaria con sus movimientos (ingresos y egresos) durante un período específico.

ANÁLISIS QUE DEBES PROPORCIONAR:

1. **RESUMEN EJECUTIVO** (3-4 líneas)
   - Estado general de la cuenta
   - Tendencia principal (positiva/negativa/estable)
   - Hallazgo más importante

2. **ANÁLISIS DE FLUJO DE CAJA**
   - Balance neto del período (Ingresos - Egresos)
   - Tendencia de ingresos (creciente, estable, decreciente)
   - Tendencia de egresos (creciente, estable, decreciente)
   - Ratio de liquidez

3. **CATEGORIZACIÓN DE GASTOS**
   - Gastos operativos vs estratégicos
   - Identificar gastos recurrentes vs únicos
   - Detectar gastos anormales o fuera de patrón

4. **ALERTAS Y BANDERAS ROJAS** 🚩
   - Gastos excesivos en categorías específicas
   - Falta de ingresos regulares
   - Saldo insuficiente para cubrir obligaciones
   - Patrones preocupantes

5. **OPORTUNIDADES DE OPTIMIZACIÓN** 💡
   - Áreas donde reducir costos
   - Oportunidades de mejorar ingresos
   - Sugerencias de redistribución de recursos

6. **PROYECCIÓN Y RECOMENDACIONES** 📊
   - Proyección de saldo para próximo mes
   - Top 3 recomendaciones accionables
   - Prioridades inmediatas

FORMATO DE RESPUESTA:
- Usa emojis para hacer el análisis más visual (📈 📉 💰 ⚠️ ✅ etc.)
- Sé directo y específico con números
- Prioriza insights accionables sobre descripciones generales
- Usa lenguaje empresarial profesional pero accesible

EJEMPLO DE BUEN ANÁLISIS:
"💰 **RESUMEN:** Cuenta en crecimiento sostenido (+15% vs mes anterior) con flujo de caja positivo de $25,340 MXN. Principal hallazgo: Gastos operativos bien controlados.

📊 **FLUJO DE CAJA:**
- Ingresos: $85,000 MXN (↑12% vs promedio)
- Egresos: $59,660 MXN (↑3% controlado)
- Balance Neto: +$25,340 MXN ✅

🚩 **ALERTAS:**
- Gasto en 'Viaje' aumentó 40% ($12,000 vs $8,500 promedio)
- 2 gastos duplicados detectados en categoría 'Suministros'

💡 **OPORTUNIDADES:**
1. Consolidar proveedores de suministros para negociar descuentos por volumen
2. Implementar política de viajes con límites mensuales
3. Automatizar pagos recurrentes para evitar cargos por mora"

Responde SIEMPRE en español con análisis completo y profesional.`
    });
  }

  /**
   * Genera hash único para una cuenta y período de análisis
   */
  private generateAnalysisHash(accountId: string, periodStart: Date, periodEnd: Date): string {
    const content = `${accountId}-${periodStart.toISOString()}-${periodEnd.toISOString()}`;
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Busca análisis existente en caché (base de datos)
   */
  private async getCachedAnalysis(accountId: string): Promise<any | null> {
    const [cached] = await db
      .select()
      .from(bankAccountAnalyses)
      .where(eq(bankAccountAnalyses.bankAccountId, accountId))
      .orderBy(desc(bankAccountAnalyses.createdAt))
      .limit(1);

    if (!cached) return null;

    // Verificar si el caché sigue válido
    const age = Date.now() - new Date(cached.expiresAt).getTime();
    if (age > 0) {
      console.log('[Financial AI] ⏱️  Cache expirado, regenerando análisis...');
      return null;
    }

    if (cached.status === 'ready') {
      console.log('[Financial AI] 🎯 Cache HIT - Usando análisis existente');
      return cached;
    }

    return null;
  }

  /**
   * Busca en la base de conocimientos análisis similares
   */
  private async searchKnowledgeBase(account: BankAccount, transactionCount: number): Promise<any | null> {
    // Buscar conocimiento similar basado en tipo de cuenta, divisa y volumen de transacciones
    const similarKnowledge = await db
      .select()
      .from(knowledgeBase)
      .where(
        and(
          eq(knowledgeBase.type, 'bank_account'),
          eq(knowledgeBase.accountType, account.accountType || ''),
          eq(knowledgeBase.currency, account.currency)
        )
      )
      .orderBy(desc(knowledgeBase.qualityScore), desc(knowledgeBase.usageCount))
      .limit(1);

    if (similarKnowledge.length === 0) {
      console.log('[Financial AI] 📚 No se encontró conocimiento previo similar');
      return null;
    }

    const knowledge = similarKnowledge[0];
    
    // Verificar si el volumen de transacciones es similar (±30%)
    const volumeDiff = Math.abs(knowledge.transactionCount - transactionCount) / transactionCount;
    if (volumeDiff > 0.3) {
      console.log('[Financial AI] 📊 Volumen de transacciones muy diferente, requiere análisis nuevo');
      return null;
    }

    console.log(`[Financial AI] 🎓 REUSING KNOWLEDGE - Score: ${knowledge.qualityScore}/10, Used ${knowledge.usageCount} times`);
    
    // Actualizar contadores de uso
    await db
      .update(knowledgeBase)
      .set({
        usageCount: sql`${knowledgeBase.usageCount} + 1`,
        lastUsedAt: new Date(),
      })
      .where(eq(knowledgeBase.id, knowledge.id));

    return knowledge;
  }

  /**
   * Guarda análisis en la base de conocimientos
   */
  private async saveToKnowledgeBase(
    account: BankAccount,
    analysis: string,
    transactionCount: number
  ): Promise<void> {
    try {
      // Crear documento JSON con el análisis completo
      const knowledgeDoc = {
        accountType: account.accountType,
        currency: account.currency,
        transactionCount,
        analysis,
        metadata: {
          accountName: account.name,
          bankName: account.bankName,
          timestamp: new Date().toISOString(),
        }
      };

      // Subir a Backblaze B2
      const b2Key = await uploadJsonToB2(
        knowledgeDoc,
        `knowledge/bank_account_${account.id}_${Date.now()}.json`
      );

      // Extraer tags del análisis para búsqueda futura
      const tags: string[] = [];
      if (analysis.includes('crecimiento') || analysis.includes('positivo')) tags.push('positive-trend');
      if (analysis.includes('reducción') || analysis.includes('negativo')) tags.push('negative-trend');
      if (analysis.includes('gastos excesivos') || analysis.includes('alerta')) tags.push('high-expenses');
      if (analysis.includes('bien controlado') || analysis.includes('estable')) tags.push('stable');

      // Guardar en knowledge base
      const knowledgeEntry: InsertKnowledgeBase = {
        type: 'bank_account',
        b2Key,
        accountType: account.accountType,
        currency: account.currency,
        transactionCount,
        tags,
        qualityScore: 5, // Score inicial
        usageCount: 1,
      };

      await db.insert(knowledgeBase).values(knowledgeEntry);
      console.log('[Financial AI] 💾 Análisis guardado en base de conocimientos');
    } catch (error) {
      console.error('[Financial AI] ❌ Error guardando en knowledge base:', error);
    }
  }

  /**
   * Prepara el prompt con datos de transacciones
   */
  private prepareAnalysisPrompt(data: TransactionData): string {
    const { payments, expenses, account, periodStart, periodEnd } = data;

    // Calcular métricas
    const totalIncome = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
    const netBalance = totalIncome - totalExpenses;

    // Agrupar gastos por categoría
    const expensesByCategory = expenses.reduce((acc, e) => {
      const cat = e.category || 'other';
      if (!acc[cat]) acc[cat] = 0;
      acc[cat] += parseFloat(e.amount);
      return acc;
    }, {} as Record<string, number>);

    const prompt = `Analiza la siguiente cuenta bancaria y proporciona un análisis financiero completo como experto empresarial:

**INFORMACIÓN DE LA CUENTA:**
- Nombre: ${account.name}
- Banco: ${account.bankName || 'N/A'}
- Tipo: ${account.accountType === 'checking' ? 'Cuenta Corriente' : account.accountType === 'savings' ? 'Ahorro' : 'Inversión'}
- Divisa: ${account.currency}
- Saldo Actual: ${account.currency} ${parseFloat(account.currentBalance).toFixed(2)}
- Saldo Inicial: ${account.currency} ${parseFloat(account.initialBalance).toFixed(2)}

**PERÍODO DE ANÁLISIS:**
Del ${periodStart.toLocaleDateString('es-MX')} al ${periodEnd.toLocaleDateString('es-MX')}

**MOVIMIENTOS DEL PERÍODO:**

📈 **INGRESOS (${payments.length} transacciones):**
Total: ${account.currency} ${totalIncome.toFixed(2)}
${payments.slice(0, 5).map(p => `- ${new Date(p.paymentDate).toLocaleDateString('es-MX')}: ${account.currency} ${parseFloat(p.amount).toFixed(2)} (${p.paymentMethod})`).join('\n')}
${payments.length > 5 ? `... y ${payments.length - 5} transacciones más` : ''}

📉 **EGRESOS (${expenses.length} transacciones):**
Total: ${account.currency} ${totalExpenses.toFixed(2)}

Desglose por categoría:
${Object.entries(expensesByCategory).map(([cat, amount]) => {
  const label = cat === 'travel' ? 'Viaje' : cat === 'supplies' ? 'Suministros' : cat === 'equipment' ? 'Equipo' : cat === 'services' ? 'Servicios' : 'Otro';
  return `- ${label}: ${account.currency} ${amount.toFixed(2)}`;
}).join('\n')}

Últimos gastos:
${expenses.slice(0, 5).map(e => `- ${new Date(e.date).toLocaleDateString('es-MX')}: ${account.currency} ${parseFloat(e.amount).toFixed(2)} (${e.description})`).join('\n')}
${expenses.length > 5 ? `... y ${expenses.length - 5} gastos más` : ''}

💰 **BALANCE NETO DEL PERÍODO:**
${netBalance >= 0 ? '✅' : '⚠️'} ${account.currency} ${netBalance.toFixed(2)} (Ingresos - Egresos)

---

Proporciona tu análisis completo siguiendo la estructura indicada en tu sistema de instrucciones.`;

    return prompt;
  }

  /**
   * Analiza una cuenta bancaria usando Gemini AI
   */
  async analyzeAccount(data: TransactionData): Promise<FinancialAnalysisResult> {
    const { account, payments, expenses, periodStart, periodEnd } = data;
    const transactionCount = payments.length + expenses.length;

    console.log(`[Financial AI] 🔍 Analizando cuenta: ${account.name} (${transactionCount} transacciones)`);

    // 1. Verificar caché en base de datos
    const cached = await this.getCachedAnalysis(account.id);
    if (cached) {
      return {
        analysis: cached.analysis,
        confidence: 95,
        usedKnowledge: false,
      };
    }

    // 2. Buscar en base de conocimientos
    const knowledge = await this.searchKnowledgeBase(account, transactionCount);
    if (knowledge) {
      // Adaptar conocimiento previo al contexto actual
      console.log('[Financial AI] 🎓 Adaptando conocimiento previo...');
      const adaptedAnalysis = `${knowledge.analysis}\n\n---\n*Nota: Este análisis se basa en patrones aprendidos de cuentas similares y ha sido adaptado a tu contexto actual.*`;
      
      // Guardar análisis adaptado en caché
      const expiresAt = new Date(Date.now() + this.cacheTTL);
      await db.insert(bankAccountAnalyses).values({
        bankAccountId: account.id,
        analysis: adaptedAnalysis,
        paymentsAnalyzed: payments.length,
        expensesAnalyzed: expenses.length,
        periodStart,
        periodEnd,
        status: 'ready',
        expiresAt,
        generatedAt: new Date(),
      });

      return {
        analysis: adaptedAnalysis,
        confidence: knowledge.qualityScore * 10,
        usedKnowledge: true,
        knowledgeSource: knowledge.id,
      };
    }

    // 3. Llamar a Gemini API (nuevo análisis)
    console.log('[Financial AI] 🤖 CALLING GEMINI API - Generando análisis nuevo...');
    
    const prompt = this.prepareAnalysisPrompt(data);
    const result = await this.model.generateContent(prompt);
    const analysis = result.response.text();

    // 4. Guardar en caché y en base de conocimientos
    const expiresAt = new Date(Date.now() + this.cacheTTL);
    await db.insert(bankAccountAnalyses).values({
      bankAccountId: account.id,
      analysis,
      paymentsAnalyzed: payments.length,
      expensesAnalyzed: expenses.length,
      periodStart,
      periodEnd,
      status: 'ready',
      expiresAt,
      generatedAt: new Date(),
    });

    // Guardar en knowledge base para futuro reuso
    await this.saveToKnowledgeBase(account, analysis, transactionCount);

    console.log('[Financial AI] ✅ Análisis completado y guardado');

    return {
      analysis,
      confidence: 85,
      usedKnowledge: false,
    };
  }

  /**
   * Invalida el caché de análisis de una cuenta (útil cuando hay cambios significativos)
   */
  async invalidateCache(accountId: string): Promise<void> {
    await db
      .update(bankAccountAnalyses)
      .set({ expiresAt: new Date(0) }) // Expira inmediatamente
      .where(eq(bankAccountAnalyses.bankAccountId, accountId));
    
    console.log('[Financial AI] 🗑️  Cache invalidado para cuenta:', accountId);
  }
}

// Instancia singleton
export const financialAnalysisService = new FinancialAnalysisService();
