import { storage } from "./storage";
import { backblazeStorage } from "./backblazeStorage";
import type { Operation, KnowledgeBase } from "@shared/schema";
import { db } from "./db";
import { knowledgeBase } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

interface KnowledgeDocument {
  analysisText: string;
  operationData: {
    type: string | null;
    category: string | null;
    shippingMode: string | null;
    priority: string | null;
    status: string;
  };
  insights: {
    commonIssues: string[];
    recommendations: string[];
    documentationNeeds: string[];
  };
  metadata: {
    emailCount: number;
    taskCount: number;
    fileCount: number;
    createdAt: Date;
  };
}

/**
 * Knowledge Base Service
 * Implements progressive learning system to reduce Gemini API usage
 * by storing and reusing successful analyses from Backblaze
 */
export class KnowledgeBaseService {
  
  /**
   * Save a new knowledge document to Backblaze and index it in DB
   */
  async saveKnowledge(
    operation: Operation,
    analysis: string,
    emailCount: number,
    taskCount: number,
    fileCount: number
  ): Promise<KnowledgeBase | null> {
    try {
      // Extract tags from analysis for better matching
      const tags = this.extractTags(analysis);

      // Create knowledge document with full context
      const knowledgeDoc: KnowledgeDocument = {
        analysisText: analysis,
        operationData: {
          type: operation.operationType,
          category: operation.projectCategory,
          shippingMode: operation.shippingMode,
          priority: operation.priority,
          status: operation.status
        },
        insights: {
          commonIssues: this.extractIssues(analysis),
          recommendations: this.extractRecommendations(analysis),
          documentationNeeds: this.extractDocumentation(analysis)
        },
        metadata: {
          emailCount,
          taskCount,
          fileCount,
          createdAt: new Date()
        }
      };

      // Save to Backblaze usando uploadOperationFile (reutilizando infraestructura existente)
      const filename = `knowledge-${Date.now()}.json`;
      const buffer = Buffer.from(JSON.stringify(knowledgeDoc, null, 2), 'utf-8');
      
      const uploadResult = await backblazeStorage.uploadOperationFile(
        buffer,
        filename,
        'application/json',
        operation.id,
        'system', // Usuario del sistema
        'knowledge-base' // Categoría especial para knowledge base
      );
      
      const b2Key = uploadResult.fileKey;

      console.log(`[Knowledge] Saved to B2: ${b2Key}`);

      // Index in database
      const [knowledge] = await db.insert(knowledgeBase).values({
        b2Key,
        operationType: operation.operationType,
        projectCategory: operation.projectCategory,
        shippingMode: operation.shippingMode,
        priority: operation.priority,
        emailCount,
        taskCount,
        fileCount,
        tags,
        usageCount: 1,
        qualityScore: 5, // Initial score
      }).returning();

      console.log(`[Knowledge] Indexed in DB with ID: ${knowledge.id}`);
      return knowledge;

    } catch (error: any) {
      console.error('[Knowledge] Error saving knowledge:', error);
      return null;
    }
  }

  /**
   * Find similar knowledge based on operation characteristics
   * Returns best match with similarity score
   */
  async findSimilarKnowledge(operation: Operation): Promise<{ knowledge: KnowledgeBase; score: number } | null> {
    try {
      // Get all knowledge entries that might match
      const candidates = await db.select().from(knowledgeBase)
        .where(
          and(
            operation.operationType ? eq(knowledgeBase.operationType, operation.operationType) : sql`true`,
            operation.projectCategory ? eq(knowledgeBase.projectCategory, operation.projectCategory) : sql`true`
          )
        )
        .orderBy(sql`${knowledgeBase.qualityScore} DESC, ${knowledgeBase.usageCount} DESC`)
        .limit(10);

      if (candidates.length === 0) {
        console.log('[Knowledge] No similar knowledge found');
        return null;
      }

      // Calculate similarity scores
      let bestMatch: { knowledge: KnowledgeBase; score: number } | null = null;

      for (const candidate of candidates) {
        const score = this.calculateSimilarity(operation, candidate);
        
        if (score >= 60 && (!bestMatch || score > bestMatch.score)) {
          bestMatch = { knowledge: candidate, score };
        }
      }

      if (bestMatch) {
        console.log(`[Knowledge] Found similar knowledge (score: ${bestMatch.score}%): ${bestMatch.knowledge.id}`);
      } else {
        console.log('[Knowledge] No sufficiently similar knowledge found (threshold: 60%)');
      }

      return bestMatch;

    } catch (error: any) {
      console.error('[Knowledge] Error finding similar knowledge:', error);
      return null;
    }
  }

  /**
   * Reuse existing knowledge for a new operation
   * Returns adapted analysis text
   */
  async reuseKnowledge(knowledgeId: string, operation: Operation): Promise<string | null> {
    try {
      // Get knowledge entry from DB
      const [knowledge] = await db.select().from(knowledgeBase)
        .where(eq(knowledgeBase.id, knowledgeId));

      if (!knowledge) {
        return null;
      }

      // Load knowledge documents from local file
      const fs = await import('fs');
      const path = await import('path');
      const docsPath = path.join(process.cwd(), 'server', 'knowledge-documents.json');
      const docsContent = fs.readFileSync(docsPath, 'utf-8');
      const allDocs = JSON.parse(docsContent);

      // Get the specific document by b2Key (which is the key in our JSON)
      const docKey = knowledge.b2Key.split('/').pop()?.replace('.json', '') || '';
      const knowledgeDoc: KnowledgeDocument = allDocs[docKey];

      if (!knowledgeDoc) {
        console.error(`[Knowledge] Document not found for key: ${docKey}`);
        return null;
      }

      // Adapt the analysis to the new operation
      const adaptedAnalysis = this.adaptAnalysis(knowledgeDoc.analysisText, operation);

      // Update usage stats
      await db.update(knowledgeBase)
        .set({
          usageCount: sql`${knowledgeBase.usageCount} + 1`,
          qualityScore: sql`LEAST(${knowledgeBase.qualityScore} + 1, 10)`, // Cap at 10
          lastUsedAt: new Date()
        })
        .where(eq(knowledgeBase.id, knowledgeId));

      console.log(`[Knowledge] Reused knowledge ${knowledgeId} (new usage count: ${knowledge.usageCount + 1})`);
      return adaptedAnalysis;

    } catch (error: any) {
      console.error('[Knowledge] Error reusing knowledge:', error);
      return null;
    }
  }

  /**
   * Calculate similarity score between operation and knowledge entry (0-100)
   */
  private calculateSimilarity(operation: Operation, knowledge: KnowledgeBase): number {
    let score = 0;

    // Exact matches give high scores
    if (operation.operationType === knowledge.operationType) score += 40;
    if (operation.projectCategory === knowledge.projectCategory) score += 30;
    if (operation.shippingMode === knowledge.shippingMode) score += 15;
    if (operation.priority === knowledge.priority) score += 10;

    // Quality and usage boost
    score += (knowledge.qualityScore / 10) * 5; // Up to 5 points for quality

    return Math.min(score, 100);
  }

  /**
   * Adapt existing analysis to new operation context
   */
  private adaptAnalysis(originalAnalysis: string, operation: Operation): string {
    // Add header indicating this is based on similar cases
    let adapted = `**📚 Analysis based on similar ${operation.operationType || 'operation'} cases:**\n\n`;
    adapted += originalAnalysis;
    
    // Add customization note
    adapted += `\n\n---\n*Note: This analysis is based on similar operations and has been adapted to match your specific case (${operation.name}).`;
    adapted += ` For more precise insights specific to your operation's unique characteristics, consider refreshing the analysis.*`;

    return adapted;
  }

  /**
   * Extract relevant tags from analysis text
   */
  private extractTags(analysis: string): string[] {
    const keywords = [
      'customs', 'documentation', 'delay', 'urgent', 'pending',
      'invoice', 'payment', 'clearance', 'inspection', 'compliance',
      'missing', 'required', 'incomplete', 'verified', 'approved'
    ];

    const tags: string[] = [];
    const lowerAnalysis = analysis.toLowerCase();

    for (const keyword of keywords) {
      if (lowerAnalysis.includes(keyword)) {
        tags.push(keyword);
      }
    }

    return tags;
  }

  /**
   * Extract common issues from analysis
   */
  private extractIssues(analysis: string): string[] {
    const issues: string[] = [];
    const lines = analysis.split('\n');

    for (const line of lines) {
      if (line.toLowerCase().includes('issue') || 
          line.toLowerCase().includes('problem') ||
          line.toLowerCase().includes('missing') ||
          line.toLowerCase().includes('delay')) {
        issues.push(line.trim());
      }
    }

    return issues.slice(0, 5); // Top 5 issues
  }

  /**
   * Extract recommendations from analysis
   */
  private extractRecommendations(analysis: string): string[] {
    const recommendations: string[] = [];
    const lines = analysis.split('\n');

    for (const line of lines) {
      if (line.toLowerCase().includes('recommend') || 
          line.toLowerCase().includes('should') ||
          line.toLowerCase().includes('suggest')) {
        recommendations.push(line.trim());
      }
    }

    return recommendations.slice(0, 5); // Top 5 recommendations
  }

  /**
   * Extract documentation needs from analysis
   */
  private extractDocumentation(analysis: string): string[] {
    const docs: string[] = [];
    const lines = analysis.split('\n');

    for (const line of lines) {
      if (line.toLowerCase().includes('document') || 
          line.toLowerCase().includes('certificate') ||
          line.toLowerCase().includes('paperwork')) {
        docs.push(line.trim());
      }
    }

    return docs.slice(0, 5); // Top 5 documentation needs
  }

  /**
   * 🎓 FINANCIAL DETECTION LEARNING SYSTEM
   * Learn from approved and rejected suggestions to improve detection accuracy
   */
  
  /**
   * Save successful financial detection pattern to knowledge base
   * Called when a suggestion is APPROVED by the user
   */
  async learnFromApprovedSuggestion(suggestionId: string): Promise<void> {
    try {
      const suggestion = await storage.getFinancialSuggestion(suggestionId);
      if (!suggestion) return;

      // Extract detection pattern from the successful suggestion
      const pattern = this.extractDetectionPattern(suggestion);
      
      // Check if similar pattern already exists
      const existingPattern = await db.select().from(knowledgeBase)
        .where(
          and(
            eq(knowledgeBase.type, 'financial_detection'),
            eq(knowledgeBase.detectionMethod, suggestion.aiModel || 'unknown'),
            eq(knowledgeBase.transactionType, suggestion.type)
          )
        )
        .limit(1);

      if (existingPattern.length > 0) {
        // Update existing pattern with new success
        await db.update(knowledgeBase)
          .set({
            usageCount: sql`${knowledgeBase.usageCount} + 1`,
            qualityScore: sql`LEAST(${knowledgeBase.qualityScore} + 1, 10)`, // Increase quality, cap at 10
            approvalRate: sql`((${knowledgeBase.approvalRate} * ${knowledgeBase.usageCount} + 100) / (${knowledgeBase.usageCount} + 1))`, // Update approval rate
            lastUsedAt: new Date()
          })
          .where(eq(knowledgeBase.id, existingPattern[0].id));

        console.log(`[Knowledge] ✅ Updated financial detection pattern (ID: ${existingPattern[0].id})`);
      } else {
        // Create new pattern
        const knowledgeDoc = {
          patternInfo: pattern,
          approvedAt: new Date(),
          suggestionData: {
            type: suggestion.type,
            amount: suggestion.amount,
            currency: suggestion.currency,
            description: suggestion.description,
            aiModel: suggestion.aiModel,
            aiConfidence: suggestion.aiConfidence,
            extractedText: suggestion.extractedText?.substring(0, 500) // First 500 chars
          }
        };

        const filename = `financial-pattern-${Date.now()}.json`;
        const buffer = Buffer.from(JSON.stringify(knowledgeDoc, null, 2), 'utf-8');
        
        // For financial patterns, we don't link to a specific operation
        const uploadResult = await backblazeStorage.uploadOperationFile(
          buffer,
          filename,
          'application/json',
          '00000000-0000-0000-0000-000000000000', // System placeholder
          'system',
          'financial-learning'
        );

        await db.insert(knowledgeBase).values({
          type: 'financial_detection',
          b2Key: uploadResult.fileKey,
          detectionPattern: pattern.pattern,
          detectionMethod: suggestion.aiModel || 'unknown',
          transactionType: suggestion.type,
          accuracyScore: suggestion.aiConfidence || 75,
          approvalRate: 100, // First approval is 100%
          tags: this.extractFinancialTags(suggestion),
          usageCount: 1,
          qualityScore: 7, // Start with good score for approved patterns
        });

        console.log(`[Knowledge] 🎓 Learned new financial detection pattern for ${suggestion.type}`);
      }

    } catch (error: any) {
      console.error('[Knowledge] Error learning from approved suggestion:', error);
    }
  }

  /**
   * Update pattern when suggestion is REJECTED
   * Lowers quality score and approval rate
   */
  async learnFromRejectedSuggestion(suggestionId: string, reason: string): Promise<void> {
    try {
      const suggestion = await storage.getFinancialSuggestion(suggestionId);
      if (!suggestion) return;

      // Find matching pattern
      const matchingPattern = await db.select().from(knowledgeBase)
        .where(
          and(
            eq(knowledgeBase.type, 'financial_detection'),
            eq(knowledgeBase.detectionMethod, suggestion.aiModel || 'unknown'),
            eq(knowledgeBase.transactionType, suggestion.type)
          )
        )
        .limit(1);

      if (matchingPattern.length > 0) {
        // Decrease quality score and update approval rate
        await db.update(knowledgeBase)
          .set({
            usageCount: sql`${knowledgeBase.usageCount} + 1`,
            qualityScore: sql`GREATEST(${knowledgeBase.qualityScore} - 1, 1)`, // Decrease quality, floor at 1
            approvalRate: sql`((${knowledgeBase.approvalRate} * (${knowledgeBase.usageCount} - 1) + 0) / ${knowledgeBase.usageCount})`, // Add rejection (0%) to avg
            lastUsedAt: new Date()
          })
          .where(eq(knowledgeBase.id, matchingPattern[0].id));

        console.log(`[Knowledge] ⚠️ Updated pattern after rejection (ID: ${matchingPattern[0].id})`);
      }

    } catch (error: any) {
      console.error('[Knowledge] Error learning from rejected suggestion:', error);
    }
  }

  /**
   * Extract detection pattern from a financial suggestion
   */
  private extractDetectionPattern(suggestion: any): any {
    const keywords: string[] = [];
    const text = (suggestion.extractedText || suggestion.description || '').toLowerCase();

    // Extract common financial keywords
    const financialKeywords = [
      'factura', 'invoice', 'pago', 'payment', 'total', 'amount', 'monto',
      'transferencia', 'transfer', 'deposito', 'deposit', 'recibo', 'receipt',
      'gasto', 'expense', 'costo', 'cost', 'compra', 'purchase',
      'facturama', 'contpaq', 'sat', 'rfc', 'cfdi'
    ];

    for (const keyword of financialKeywords) {
      if (text.includes(keyword)) {
        keywords.push(keyword);
      }
    }

    return {
      pattern: keywords.join(' | '),
      keywords,
      sourceType: suggestion.sourceType,
      aiConfidence: suggestion.aiConfidence,
      detectionMethod: suggestion.aiModel || 'unknown'
    };
  }

  /**
   * Extract tags from financial suggestion
   */
  private extractFinancialTags(suggestion: any): string[] {
    const tags: string[] = [];
    const text = (suggestion.extractedText || suggestion.description || '').toLowerCase();

    // Platform detection
    if (text.includes('facturama')) tags.push('facturama');
    if (text.includes('contpaq')) tags.push('contpaq');
    if (text.includes('sat') || text.includes('cfdi')) tags.push('sat');

    // Transaction type
    tags.push(suggestion.type); // 'payment' or 'expense'
    
    // Currency
    tags.push(suggestion.currency);

    // Source type
    if (suggestion.sourceType) tags.push(suggestion.sourceType);

    return tags;
  }

  /**
   * Get best detection patterns for a given transaction type
   * Returns patterns sorted by quality and approval rate
   */
  async getBestDetectionPatterns(transactionType: 'payment' | 'expense', limit: number = 5): Promise<KnowledgeBase[]> {
    try {
      const patterns = await db.select().from(knowledgeBase)
        .where(
          and(
            eq(knowledgeBase.type, 'financial_detection'),
            eq(knowledgeBase.transactionType, transactionType)
          )
        )
        .orderBy(
          sql`${knowledgeBase.approvalRate} DESC, ${knowledgeBase.qualityScore} DESC, ${knowledgeBase.usageCount} DESC`
        )
        .limit(limit);

      return patterns;
    } catch (error: any) {
      console.error('[Knowledge] Error getting best detection patterns:', error);
      return [];
    }
  }
}

export const knowledgeBaseService = new KnowledgeBaseService();
