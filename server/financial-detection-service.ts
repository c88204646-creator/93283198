import { GoogleGenerativeAI } from "@google/generative-ai";
import * as pdfParse from "pdf-parse";
import { createHash } from "crypto";
import type { InsertFinancialSuggestion, InsertProcessingQueue } from "@shared/schema";
import { db } from "./db";
import { financialSuggestions, processingQueue } from "@shared/schema";
import { and, eq, sql } from "drizzle-orm";
import { CircuitBreaker } from "./circuit-breaker";
import { BasicOCRExtractor } from "./basic-ocr-extractor";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const circuitBreaker = new CircuitBreaker("gemini-financial-detection");
const ocrExtractor = new BasicOCRExtractor();

interface DetectedTransaction {
  type: "payment" | "expense";
  amount: number;
  currency: string;
  date: Date;
  description: string;
  paymentMethod?: string;
  reference?: string;
  category?: string;
  confidence: number;
  reasoning: string;
}

export class FinancialDetectionService {
  private model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

  calculateFileHash(buffer: Buffer): string {
    return createHash("sha256").update(buffer).digest("hex");
  }

  async checkForDuplicates(
    transaction: DetectedTransaction,
    operationId?: string,
    attachmentHash?: string
  ): Promise<{ isDuplicate: boolean; duplicateReason?: string; relatedSuggestionId?: string }> {
    try {
      // First check: Has this exact file been processed before?
      if (attachmentHash) {
        const existingByHash = await db
          .select()
          .from(financialSuggestions)
          .where(eq(financialSuggestions.attachmentHash, attachmentHash))
          .limit(1);

        if (existingByHash.length > 0) {
          return {
            isDuplicate: true,
            duplicateReason: "El mismo archivo ya fue procesado anteriormente",
            relatedSuggestionId: existingByHash[0].id,
          };
        }
      }

      // Second check: Similar transaction (amount, date, operation)
      if (operationId) {
        const amount = parseFloat(transaction.amount.toString());
        const amountMin = amount * 0.98; // -2%
        const amountMax = amount * 1.02; // +2%

        const dateMin = new Date(transaction.date);
        dateMin.setDate(dateMin.getDate() - 3); // -3 days

        const dateMax = new Date(transaction.date);
        dateMax.setDate(dateMax.getDate() + 3); // +3 days

        const similarTransactions = await db
          .select()
          .from(financialSuggestions)
          .where(
            and(
              eq(financialSuggestions.operationId, operationId),
              eq(financialSuggestions.type, transaction.type),
              eq(financialSuggestions.currency, transaction.currency),
              sql`CAST(${financialSuggestions.amount} AS DECIMAL) >= ${amountMin}`,
              sql`CAST(${financialSuggestions.amount} AS DECIMAL) <= ${amountMax}`,
              sql`${financialSuggestions.date} >= ${dateMin}`,
              sql`${financialSuggestions.date} <= ${dateMax}`
            )
          )
          .limit(1);

        if (similarTransactions.length > 0) {
          return {
            isDuplicate: true,
            duplicateReason: `Transacción similar encontrada: ${transaction.currency} ${amount} en la misma operación con fecha cercana`,
            relatedSuggestionId: similarTransactions[0].id,
          };
        }
      }

      return { isDuplicate: false };
    } catch (error) {
      console.error("[Financial Detection] Error checking duplicates:", error);
      return { isDuplicate: false };
    }
  }

  async extractTextFromPDF(buffer: Buffer): Promise<string> {
    try {
      const data = await pdfParse(buffer);
      return data.text;
    } catch (error) {
      console.error("[Financial Detection] Error extracting text from PDF:", error);
      throw new Error("Failed to extract text from PDF");
    }
  }

  async detectTransactionsFromText(
    text: string,
    operationContext?: {
      operationId: string;
      operationName: string;
      clientName?: string;
    }
  ): Promise<DetectedTransaction[]> {
    // Check if circuit breaker allows the call
    if (!circuitBreaker.canExecute()) {
      console.log("[Financial Detection] Circuit breaker OPEN - Gemini unavailable");
      throw new Error("Gemini API circuit breaker open");
    }

    try {
      const prompt = `You are a financial transaction analyzer for a logistics company. Analyze the following text and detect any financial transactions (PAYMENTS or EXPENSES).

**Context:**
${operationContext ? `
- Operation: ${operationContext.operationName}
- Client: ${operationContext.clientName || "Unknown"}
` : "No operation context available"}

**Rules:**
1. PAYMENT: Money RECEIVED from clients (to pay invoices, deposits, etc.)
2. EXPENSE: Money SENT by the company (fees, services, suppliers, etc.)
3. Only return transactions with confidence >= 70%
4. Extract: amount, currency (MXN/USD/EUR), date, description, reference
5. For payments: detect payment method (transfer, check, card, cash)
6. For expenses: detect category (travel, supplies, equipment, services, customs, shipping, other)

**Text to analyze:**
${text}

**Response format (JSON array):**
[
  {
    "type": "payment" | "expense",
    "amount": number,
    "currency": "MXN" | "USD" | "EUR",
    "date": "YYYY-MM-DD",
    "description": "Clear description",
    "paymentMethod": "transfer" (only for payments),
    "reference": "transfer" | "check" | "card" | "cash",
    "category": "category" (only for expenses),
    "confidence": 0-100,
    "reasoning": "Why this is a payment/expense"
  }
]

Return empty array [] if no transactions detected.`;

      const result = await this.model.generateContent(prompt);
      const responseText = result.response.text();

      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.log("[Financial Detection] No transactions detected in response");
        circuitBreaker.recordSuccess(); // Successfully called API, even if no transactions
        return [];
      }

      const transactions: DetectedTransaction[] = JSON.parse(jsonMatch[0]);
      circuitBreaker.recordSuccess(); // API call succeeded
      
      return transactions.map(t => ({
        ...t,
        date: new Date(t.date),
      })).filter(t => t.confidence >= 70);

    } catch (error: any) {
      // Check if it's a rate limit error (429)
      if (error?.message?.includes("429") || error?.status === 429) {
        console.error("[Financial Detection] Rate limit error - Recording failure in circuit breaker");
        circuitBreaker.recordFailure();
      }
      
      console.error("[Financial Detection] Error detecting transactions:", error);
      throw error; // Re-throw to trigger fallback
    }
  }

  async detectFromEmailBody(
    emailBody: string,
    emailSubject: string,
    operationContext?: { operationId: string; operationName: string; clientName?: string }
  ): Promise<DetectedTransaction[]> {
    const combinedText = `Subject: ${emailSubject}\n\n${emailBody}`;
    return this.detectTransactionsFromText(combinedText, operationContext);
  }

  async detectFromPDFBuffer(
    pdfBuffer: Buffer,
    operationContext?: { operationId: string; operationName: string; clientName?: string }
  ): Promise<DetectedTransaction[]> {
    const extractedText = await this.extractTextFromPDF(pdfBuffer);
    if (!extractedText || extractedText.trim().length < 50) {
      console.log("[Financial Detection] Insufficient text extracted from PDF");
      return [];
    }
    return this.detectTransactionsFromText(extractedText, operationContext);
  }

  /**
   * OCR fallback - Uses BasicOCRExtractor when Gemini fails
   * Returns transactions with lower confidence (usually 50-65%)
   */
  async detectWithOCRFallback(
    pdfBuffer: Buffer,
    operationContext?: { operationId: string; operationName: string; clientName?: string }
  ): Promise<DetectedTransaction[]> {
    console.log("[Financial Detection] Using OCR fallback for PDF processing");
    
    try {
      const ocrResult = await ocrExtractor.extractFromPDF(pdfBuffer);
      
      if (!ocrResult.success || !ocrResult.amount) {
        console.log("[Financial Detection] OCR could not extract transaction data");
        return [];
      }

      // Convert OCR result to DetectedTransaction format
      const transaction: DetectedTransaction = {
        type: ocrResult.type || "expense",
        amount: ocrResult.amount,
        currency: ocrResult.currency || "MXN",
        date: ocrResult.date || new Date(),
        description: ocrResult.description || "Transacción detectada por OCR",
        reference: ocrResult.reference,
        confidence: ocrResult.confidence,
        reasoning: `Extracted via OCR (Tesseract). Confidence: ${ocrResult.confidence}%`,
        category: ocrResult.type === "expense" ? "other" : undefined,
        paymentMethod: ocrResult.type === "payment" ? "transfer" : undefined,
      };

      console.log(`[Financial Detection] OCR extracted transaction: ${transaction.currency} ${transaction.amount} (${transaction.confidence}% confidence)`);
      
      return [transaction];
    } catch (error) {
      console.error("[Financial Detection] Error in OCR fallback:", error);
      return [];
    }
  }

  /**
   * Save to processing queue for manual review
   * Used when both Gemini and OCR fail
   */
  async saveToProcessingQueue(
    pdfBuffer: Buffer,
    fileName: string,
    filePath: string,
    type: "payment" | "expense",
    context: {
      operationId?: string;
      gmailMessageId?: string;
      gmailAttachmentId?: string;
    }
  ): Promise<void> {
    try {
      const fileHash = this.calculateFileHash(pdfBuffer);

      // Check if already in queue
      const existing = await db
        .select()
        .from(processingQueue)
        .where(eq(processingQueue.fileHash, fileHash))
        .limit(1);

      if (existing.length > 0) {
        console.log(`[Financial Detection] File already in processing queue: ${fileName}`);
        return;
      }

      const queueItem: InsertProcessingQueue = {
        operationId: context.operationId || null,
        gmailMessageId: context.gmailMessageId || null,
        gmailAttachmentId: context.gmailAttachmentId || null,
        filePath,
        fileName,
        fileHash,
        type,
        status: "pending",
        fallbackLevel: 3, // Manual review level
        attempts: 0,
        lastAttempt: null,
        lastError: "Gemini and OCR both failed",
        ocrResult: null,
        ocrConfidence: null,
        financialSuggestionId: null,
      };

      await db.insert(processingQueue).values(queueItem);
      console.log(`[Financial Detection] Saved to processing queue: ${fileName} (hash: ${fileHash.substring(0, 8)})`);
    } catch (error) {
      console.error("[Financial Detection] Error saving to processing queue:", error);
    }
  }

  /**
   * Main method with 3-level fallback:
   * 1. Try Gemini AI
   * 2. If Gemini fails, try OCR
   * 3. If OCR fails, save to queue for manual review
   */
  async detectWithFallback(
    pdfBuffer: Buffer,
    fileName: string,
    filePath: string,
    detectionType: "payment" | "expense",
    operationContext?: { 
      operationId: string; 
      operationName: string; 
      clientName?: string;
      gmailMessageId?: string;
      gmailAttachmentId?: string;
    }
  ): Promise<{ transactions: DetectedTransaction[]; method: "gemini" | "ocr" | "queued" }> {
    // Level 1: Try Gemini AI
    try {
      const extractedText = await this.extractTextFromPDF(pdfBuffer);
      if (extractedText && extractedText.trim().length >= 50) {
        const transactions = await this.detectTransactionsFromText(extractedText, operationContext);
        if (transactions.length > 0) {
          console.log(`[Financial Detection] SUCCESS via Gemini: ${transactions.length} transactions found`);
          return { transactions, method: "gemini" };
        }
      }
    } catch (error: any) {
      console.log(`[Financial Detection] Gemini failed: ${error.message}`);
    }

    // Level 2: Try OCR fallback
    try {
      const transactions = await this.detectWithOCRFallback(pdfBuffer, operationContext);
      if (transactions.length > 0) {
        console.log(`[Financial Detection] SUCCESS via OCR: ${transactions.length} transactions found`);
        return { transactions, method: "ocr" };
      }
    } catch (error) {
      console.log(`[Financial Detection] OCR failed: ${error}`);
    }

    // Level 3: Save to queue for manual review
    await this.saveToProcessingQueue(pdfBuffer, fileName, filePath, detectionType, {
      operationId: operationContext?.operationId,
      gmailMessageId: operationContext?.gmailMessageId,
      gmailAttachmentId: operationContext?.gmailAttachmentId,
    });

    console.log(`[Financial Detection] QUEUED for manual review: ${fileName}`);
    return { transactions: [], method: "queued" };
  }

  async createSuggestionFromTransaction(
    transaction: DetectedTransaction,
    sourceInfo: {
      sourceType: "email_attachment" | "email_body" | "gmail_message";
      gmailMessageId?: string;
      gmailAttachmentId?: string;
      operationId?: string;
      extractedText: string;
      attachmentHash?: string;
      detectionMethod?: "gemini" | "ocr"; // How the transaction was detected
    }
  ): Promise<Omit<InsertFinancialSuggestion, "createdAt" | "updatedAt">> {
    // Check for duplicates
    const duplicateCheck = await this.checkForDuplicates(
      transaction,
      sourceInfo.operationId,
      sourceInfo.attachmentHash
    );

    const aiModel = sourceInfo.detectionMethod === "ocr" 
      ? "tesseract-ocr-fallback" 
      : "gemini-2.0-flash-exp";

    const aiReasoning = sourceInfo.detectionMethod === "ocr"
      ? `${transaction.reasoning}\n\n⚠️ Detected via OCR fallback (Gemini unavailable)`
      : transaction.reasoning;

    return {
      type: transaction.type,
      status: "pending",
      sourceType: sourceInfo.sourceType,
      gmailMessageId: sourceInfo.gmailMessageId,
      gmailAttachmentId: sourceInfo.gmailAttachmentId,
      operationId: sourceInfo.operationId,
      amount: transaction.amount.toString(),
      currency: transaction.currency,
      date: transaction.date,
      description: transaction.description,
      paymentMethod: transaction.paymentMethod,
      reference: transaction.reference,
      category: transaction.category,
      bankAccountId: null,
      invoiceId: null,
      aiConfidence: transaction.confidence.toString(),
      aiModel,
      aiReasoning,
      extractedText: sourceInfo.extractedText.substring(0, 5000),
      reviewedById: null,
      reviewedAt: null,
      rejectionReason: null,
      isDuplicate: duplicateCheck.isDuplicate,
      duplicateReason: duplicateCheck.duplicateReason || null,
      relatedSuggestionId: duplicateCheck.relatedSuggestionId || null,
      attachmentHash: sourceInfo.attachmentHash || null,
    };
  }
}
