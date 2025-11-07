import { GoogleGenerativeAI } from "@google/generative-ai";
import * as pdfParse from "pdf-parse";
import { createHash } from "crypto";
import type { InsertFinancialSuggestion } from "@shared/schema";
import { db } from "./db";
import { financialSuggestions } from "@shared/schema";
import { and, eq, sql } from "drizzle-orm";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

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
    "reference": "Reference number",
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
        return [];
      }

      const transactions: DetectedTransaction[] = JSON.parse(jsonMatch[0]);
      
      return transactions.map(t => ({
        ...t,
        date: new Date(t.date),
      })).filter(t => t.confidence >= 70);

    } catch (error) {
      console.error("[Financial Detection] Error detecting transactions:", error);
      return [];
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

  async createSuggestionFromTransaction(
    transaction: DetectedTransaction,
    sourceInfo: {
      sourceType: "email_attachment" | "email_body" | "gmail_message";
      gmailMessageId?: string;
      gmailAttachmentId?: string;
      operationId?: string;
      extractedText: string;
      attachmentHash?: string;
    }
  ): Promise<Omit<InsertFinancialSuggestion, "createdAt" | "updatedAt">> {
    // Check for duplicates
    const duplicateCheck = await this.checkForDuplicates(
      transaction,
      sourceInfo.operationId,
      sourceInfo.attachmentHash
    );

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
      aiModel: "gemini-2.0-flash-exp",
      aiReasoning: transaction.reasoning,
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
