import { GoogleGenerativeAI } from '@google/generative-ai';
import { storage } from './storage';
import { knowledgeBaseService } from './knowledge-base-service';
import type { OperationAnalysis } from '@shared/schema';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Operation Analysis Service
 * Generates AI-powered insights about operations based on linked emails
 */
export class OperationAnalysisService {
  private model;
  
  constructor() {
    this.model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash', // Using flash for cost efficiency
      systemInstruction: `You are an expert logistics and freight forwarding assistant. 
      
Your role is to analyze shipment operations and provide professional, actionable feedback.

ANALYSIS FORMAT:
Provide a concise, professional analysis in the following structure:

📊 **Current Status**: Brief overview of the operation's current state

🔔 **Key Updates**: Important developments from recent emails (if any)

⚠️ **Action Items**: What needs to be done (prioritized list)

📅 **Next Steps**: Recommended immediate actions

💡 **Recommendations**: Professional insights to improve efficiency

GUIDELINES:
- Be concise and actionable (max 500 words)
- Focus on business-critical information
- Highlight missing documentation or pending tasks
- Identify potential delays or issues
- Use professional freight forwarding terminology
- Provide specific, measurable recommendations
- Use emoji sparingly for visual organization only

LANGUAGE: Always respond in SPANISH (Español).`
    });
  }

  /**
   * Generate analysis for an operation
   */
  async generateAnalysis(operationId: string): Promise<string> {
    try {
      console.log(`[Analysis] Generating analysis for operation ${operationId}`);

      // Get operation details
      const operation = await storage.getOperation(operationId);
      if (!operation) {
        throw new Error('Operation not found');
      }

      // Get linked emails
      const emails = await storage.getGmailMessagesByOperation(operationId);
      console.log(`[Analysis] Found ${emails.length} linked emails`);

      // Get tasks and notes
      const [tasks, notes, files] = await Promise.all([
        storage.getOperationTasks(operationId),
        storage.getOperationNotes(operationId),
        storage.getOperationFiles(operationId)
      ]);

      // Prepare context for AI
      const emailSummaries = emails.slice(0, 20).map((email: any, idx: number) => {
        return `Email ${idx + 1}:
From: ${email.from}
To: ${email.to}
Subject: ${email.subject}
Date: ${new Date(email.date).toLocaleDateString('es-ES')}
Snippet: ${email.snippet || 'No preview available'}
---`;
      }).join('\n\n');

      const tasksSummary = tasks.map(t => 
        `- [${t.status}] ${t.title} (${t.priority})`
      ).join('\n');

      const notesSummary = notes.slice(0, 10).map((n, idx) => 
        `Note ${idx + 1}: ${n.content.substring(0, 150)}...`
      ).join('\n');

      const prompt = `Analyze this freight forwarding operation and provide professional feedback:

**OPERATION DETAILS:**
Name: ${operation.name}
Description: ${operation.description || 'No description'}
Status: ${operation.status}
Category: ${operation.projectCategory}
Type: ${operation.operationType}
Shipping Mode: ${operation.shippingMode}
Priority: ${operation.priority}
Start Date: ${new Date(operation.startDate).toLocaleDateString('es-ES')}
${operation.endDate ? `End Date: ${new Date(operation.endDate).toLocaleDateString('es-ES')}` : ''}
${operation.courier ? `Courier: ${operation.courier}` : ''}
${operation.bookingTracking ? `Booking/Tracking: ${operation.bookingTracking}` : ''}
${operation.pickUpAddress ? `Pickup: ${operation.pickUpAddress}` : ''}
${operation.deliveryAddress ? `Delivery: ${operation.deliveryAddress}` : ''}
${operation.etd ? `ETD: ${new Date(operation.etd).toLocaleDateString('es-ES')}` : ''}
${operation.eta ? `ETA: ${new Date(operation.eta).toLocaleDateString('es-ES')}` : ''}
${operation.mblAwb ? `MBL/AWB: ${operation.mblAwb}` : ''}
${operation.hblAwb ? `HBL/AWB: ${operation.hblAwb}` : ''}

**LINKED EMAILS (${emails.length} total, showing recent):**
${emailSummaries || 'No emails linked to this operation'}

**TASKS (${tasks.length} total):**
${tasksSummary || 'No tasks created'}

**RECENT NOTES (${notes.length} total):**
${notesSummary || 'No notes available'}

**FILES:**
${files.length} files uploaded

Based on this information, provide a comprehensive analysis of the operation's current status, identify pending actions, potential issues, and provide professional recommendations for the logistics team.`;

      // Generate analysis
      const result = await this.model.generateContent(prompt);
      const analysis = result.response.text();

      console.log(`[Analysis] Generated ${analysis.length} characters of analysis`);
      return analysis;

    } catch (error: any) {
      console.error('[Analysis] Error generating analysis:', error);
      throw new Error(`Failed to generate analysis: ${error?.message || 'Unknown error'}`);
    }
  }

  /**
   * Get cached analysis or generate new one (with knowledge base learning)
   */
  async getOrGenerateAnalysis(operationId: string): Promise<OperationAnalysis> {
    try {
      // Check for existing, valid cache (24 hours)
      const existing = await storage.getOperationAnalysis(operationId);
      
      if (existing && existing.status === 'ready') {
        const now = new Date();
        const expiresAt = new Date(existing.expiresAt);
        
        // Return cached if not expired (24 hours)
        if (expiresAt > now) {
          console.log(`[Analysis] Using cached analysis for operation ${operationId}`);
          return existing;
        }
      }

      // Get operation data for knowledge matching
      const operation = await storage.getOperation(operationId);
      if (!operation) {
        throw new Error('Operation not found');
      }

      console.log(`[Analysis] Looking for similar knowledge for operation ${operationId}`);
      
      // Try to find similar knowledge first (LEARNING SYSTEM)
      const similarKnowledge = await knowledgeBaseService.findSimilarKnowledge(operation);

      if (similarKnowledge && similarKnowledge.score >= 60) {
        console.log(`[Analysis] 🎓 REUSING KNOWLEDGE (score: ${similarKnowledge.score}%) - Saving Gemini API call!`);
        
        // Reuse existing knowledge
        const adaptedAnalysis = await knowledgeBaseService.reuseKnowledge(
          similarKnowledge.knowledge.id,
          operation
        );

        if (adaptedAnalysis) {
          // Save as cached analysis
          const cachedAnalysis = await storage.createOperationAnalysis({
            operationId,
            analysis: adaptedAnalysis,
            emailsAnalyzed: similarKnowledge.knowledge.emailCount,
            status: 'ready',
            generatedAt: new Date(),
            expiresAt: new Date(Date.now() + 86400000) // 24 hour cache
          });

          return cachedAnalysis;
        }
      }

      // No similar knowledge found - generate new with Gemini
      console.log(`[Analysis] 🤖 CALLING GEMINI API - No similar knowledge found`);
      
      // Create pending record
      const pendingAnalysis = await storage.createOperationAnalysis({
        operationId,
        analysis: 'Generating analysis...',
        emailsAnalyzed: 0,
        status: 'generating',
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000) // 24 hour expiration
      });

      try {
        // Get context
        const [emails, tasks, files] = await Promise.all([
          storage.getGmailMessagesByOperation(operationId),
          storage.getOperationTasks(operationId),
          storage.getOperationFiles(operationId)
        ]);
        
        // Generate analysis with Gemini
        const analysis = await this.generateAnalysis(operationId);

        // Update with results
        const completedAnalysis = await storage.updateOperationAnalysis(pendingAnalysis.id, {
          analysis,
          emailsAnalyzed: emails.length,
          status: 'ready',
          generatedAt: new Date(),
          expiresAt: new Date(Date.now() + 86400000) // 24 hour cache
        });

        // 📚 SAVE TO KNOWLEDGE BASE for future reuse
        console.log(`[Analysis] 💾 Saving to knowledge base for future learning...`);
        await knowledgeBaseService.saveKnowledge(
          operation,
          analysis,
          emails.length,
          tasks.length,
          files.length
        );

        return completedAnalysis!;

      } catch (error: any) {
        // Update with error
        await storage.updateOperationAnalysis(pendingAnalysis.id, {
          status: 'error',
          errorMessage: error?.message || 'Unknown error'
        });
        throw error;
      }

    } catch (error: any) {
      console.error('[Analysis] Error in getOrGenerateAnalysis:', error);
      throw error;
    }
  }
}

export const operationAnalysisService = new OperationAnalysisService();
