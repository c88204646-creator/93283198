import { GoogleGenerativeAI } from "@google/generative-ai";
import { createHash } from "crypto";
import type { InsertFinancialSuggestion } from "@shared/schema";
import { db } from "./db";
import { financialSuggestions } from "@shared/schema";
import { and, eq, sql } from "drizzle-orm";
import { CircuitBreaker } from "./circuit-breaker";
import { BasicOCRExtractor } from "./basic-ocr-extractor";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

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
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(buffer),
        useSystemFonts: true,
      });
      
      const pdfDocument = await loadingTask.promise;
      const numPages = pdfDocument.numPages;
      const textPages: string[] = [];

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdfDocument.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        textPages.push(pageText);
      }

      const fullText = textPages.join('\n');
      console.log(`[Financial Detection] ✅ Extracted ${fullText.length} characters from ${numPages} pages`);
      return fullText;
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
    if (!circuitBreaker.canMakeRequest()) {
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
   * OCR fallback - Currently disabled for PDFs as Tesseract cannot read PDF files directly
   * Would require pdf-to-image conversion library (pdf2pic, pdf-poppler) which is not installed
   * Returns empty array to allow system to continue gracefully
   */
  async detectWithOCRFallback(
    pdfBuffer: Buffer,
    operationContext?: { operationId: string; operationName: string; clientName?: string }
  ): Promise<DetectedTransaction[]> {
    console.log("[Financial Detection] ⚠️ OCR fallback not available for PDFs (requires pdf-to-image conversion)");
    console.log("[Financial Detection] Skipping OCR fallback - will rely on Gemini AI for PDF text extraction");
    
    // OCR fallback is disabled for PDFs because:
    // 1. Tesseract only reads images, not PDFs
    // 2. Would need additional libraries (pdf2pic, pdf-poppler) to convert PDF → image
    // 3. These libraries are not installed in the current environment
    // 
    // Future enhancement: Install pdf2pic and convert PDF pages to images before OCR
    return [];
  }

  /**
   * Main method with 2-level fallback system:
   * 1. Try Gemini AI (high confidence, context-aware)
   * 2. If Gemini fails, try OCR (moderate confidence, pattern-based)
   * 3. If both fail, log and continue (no manual queue needed - user reviews all suggestions anyway)
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
  ): Promise<{ transactions: DetectedTransaction[]; method: "gemini" | "ocr" | "none" }> {
    // Level 1: Try Gemini AI
    try {
      const extractedText = await this.extractTextFromPDF(pdfBuffer);
      if (extractedText && extractedText.trim().length >= 50) {
        const transactions = await this.detectTransactionsFromText(extractedText, operationContext);
        if (transactions.length > 0) {
          console.log(`[Financial Detection] ✅ SUCCESS via Gemini: ${transactions.length} transactions found in ${fileName}`);
          return { transactions, method: "gemini" };
        }
      }
    } catch (error: any) {
      console.log(`[Financial Detection] ⚠️ Gemini failed for ${fileName}: ${error.message}`);
    }

    // Level 2: Try OCR fallback
    try {
      const transactions = await this.detectWithOCRFallback(pdfBuffer, operationContext);
      if (transactions.length > 0) {
        console.log(`[Financial Detection] ✅ SUCCESS via OCR: ${transactions.length} transactions found in ${fileName}`);
        return { transactions, method: "ocr" };
      }
    } catch (error) {
      console.log(`[Financial Detection] ⚠️ OCR failed for ${fileName}: ${error}`);
    }

    // Both methods failed - log and continue (user will review all suggestions anyway)
    console.log(`[Financial Detection] ℹ️ No transactions detected in ${fileName} (both Gemini and OCR failed)`);
    return { transactions: [], method: "none" };
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
