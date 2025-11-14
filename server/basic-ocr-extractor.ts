import Tesseract from 'tesseract.js';
import fs from 'fs/promises';
import path from 'path';

interface ExtractedData {
  amount?: number;
  currency?: string;
  date?: string;
  invoiceNumber?: string;
  vendor?: string;
  description?: string;
}

interface ExtractionResult {
  data: ExtractedData;
  confidence: number;
  method: 'ocr_regex';
  rawText?: string;
}

export class BasicOCRExtractor {
  private patterns = {
    amount: [
      // Montos con símbolo de moneda
      /(?:USD|MXN|EUR|\$|€)\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi,
      /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(?:USD|MXN|EUR|\$|€)/gi,
      // Total en español/inglés
      /(?:Total|Monto|Amount)(?:\s*:)?\s*\$?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi,
      // Números con formato de moneda
      /\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi,
    ],
    currency: [
      /\b(USD|MXN|EUR|GBP|CAD)\b/gi,
      /(?:Divisa|Currency|Moneda)(?:\s*:)?\s*([A-Z]{3})/gi,
    ],
    date: [
      // DD/MM/YYYY or DD-MM-YYYY
      /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/g,
      // YYYY-MM-DD
      /(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/g,
      // Fecha: DD/MM/YYYY
      /(?:Fecha|Date|F\.)(?:\s*:)?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi,
      // Month DD, YYYY
      /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}/gi,
    ],
    invoiceNumber: [
      /(?:Invoice|Factura|Bill|No\.|#)(?:\s*(?:Number|No\.|#)?)(?:\s*:)?\s*([A-Z0-9\-]+)/gi,
      /(?:Folio|Ref|Reference)(?:\s*:)?\s*([A-Z0-9\-]+)/gi,
    ],
    vendor: [
      /(?:From|De|Vendor|Proveedor)(?:\s*:)?\s*([A-Z][A-Za-z\s&,.]+?)(?:\n|$)/gi,
      /(?:Bill\s+to|Facturar\s+a)(?:\s*:)?\s*([A-Z][A-Za-z\s&,.]+?)(?:\n|$)/gi,
    ],
  };

  async extractTextFromImage(buffer: Buffer): Promise<string> {
    let tempFilePath: string | null = null;
    try {
      // Write buffer to temp file
      tempFilePath = path.join('/tmp', `ocr-temp-image-${Date.now()}.png`);
      await fs.writeFile(tempFilePath, buffer);
      console.log('[OCR Extractor] Processing image from buffer');
      
      // Read image and extract text using Tesseract
      const { data: { text } } = await Tesseract.recognize(
        tempFilePath,
        'eng+spa', // English and Spanish
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              console.log(`[OCR Extractor] Progress: ${Math.round(m.progress * 100)}%`);
            }
          },
        }
      );

      console.log('[OCR Extractor] Text extracted from image, length:', text.length);
      
      // Clean up temp file
      if (tempFilePath) {
        try {
          await fs.unlink(tempFilePath);
        } catch (cleanupError) {
          console.warn('[OCR Extractor] Failed to cleanup temp file:', cleanupError);
        }
      }

      return text;
    } catch (error) {
      // Clean up temp file if created
      if (tempFilePath) {
        try {
          await fs.unlink(tempFilePath);
        } catch {
          // Ignore cleanup errors
        }
      }
      console.error('[OCR Extractor] ⚠️ Error extracting text from image (corrupted/invalid format):', error instanceof Error ? error.message : String(error));
      // Return empty string instead of throwing - this prevents system crashes on invalid images
      return '';
    }
  }

  async extractFromPDF(pdfPathOrBuffer: string | Buffer): Promise<ExtractionResult> {
    let tempFilePath: string | null = null;
    try {
      let pdfPath: string;

      // If Buffer, write to temp file
      if (Buffer.isBuffer(pdfPathOrBuffer)) {
        tempFilePath = path.join('/tmp', `ocr-temp-${Date.now()}.pdf`);
        await fs.writeFile(tempFilePath, pdfPathOrBuffer);
        pdfPath = tempFilePath;
        console.log('[OCR Extractor] Processing PDF from buffer');
      } else {
        pdfPath = pdfPathOrBuffer;
        console.log('[OCR Extractor] Processing PDF:', path.basename(pdfPath));
        // Check if file exists
        await fs.access(pdfPath);
      }
      
      // Read PDF and convert to text using Tesseract
      const { data: { text } } = await Tesseract.recognize(
        pdfPath,
        'eng+spa', // English and Spanish
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              console.log(`[OCR Extractor] Progress: ${Math.round(m.progress * 100)}%`);
            }
          },
        }
      );

      console.log('[OCR Extractor] Text extracted, length:', text.length);

      // Extract data using regex patterns
      const extractedData = this.extractFieldsFromText(text);
      
      // Calculate confidence based on extracted fields
      const confidence = this.calculateConfidence(extractedData);

      console.log('[OCR Extractor] Extraction complete:', {
        confidence,
        fields: Object.keys(extractedData).length,
      });

      // Clean up temp file if created
      if (tempFilePath) {
        try {
          await fs.unlink(tempFilePath);
        } catch (cleanupError) {
          console.warn('[OCR Extractor] Failed to cleanup temp file:', cleanupError);
        }
      }

      return {
        data: extractedData,
        confidence,
        method: 'ocr_regex',
        rawText: text.substring(0, 500), // First 500 chars for debugging
      };
    } catch (error) {
      // Clean up temp file if created
      if (tempFilePath) {
        try {
          await fs.unlink(tempFilePath);
        } catch {
          // Ignore cleanup errors
        }
      }
      console.error('[OCR Extractor] ⚠️ Error processing PDF (corrupted/invalid format):', error instanceof Error ? error.message : String(error));
      // Return empty result instead of throwing - this prevents system crashes
      return {
        data: {},
        confidence: 0,
        method: 'ocr_regex',
        rawText: '',
      };
    }
  }

  private extractFieldsFromText(text: string): ExtractedData {
    const data: ExtractedData = {};

    // Extract amount - collect ALL matches and choose the best one
    const amountCandidates: Array<{ value: number; priority: number; source: string }> = [];
    
    // Priority patterns for amounts (Total, Monto, Amount should have highest priority)
    const priorityPatterns = [
      { pattern: /(?:Total|Monto|Amount)(?:\s*:)?\s*\$?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi, priority: 100 },
      { pattern: /(?:USD|MXN|EUR)\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi, priority: 90 },
      { pattern: /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(?:USD|MXN|EUR)/gi, priority: 85 },
      { pattern: /\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi, priority: 50 },
    ];

    // Process all patterns
    for (const { pattern, priority } of priorityPatterns) {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);
      while ((match = regex.exec(text)) !== null) {
        const amountStr = match[1] || match[0];
        const cleanAmount = amountStr.replace(/[^0-9.]/g, '');
        const value = parseFloat(cleanAmount);
        
        if (!isNaN(value) && value > 0) {
          amountCandidates.push({
            value,
            priority,
            source: match[0]
          });
        }
      }
    }

    // Choose best amount: highest priority, then highest value
    if (amountCandidates.length > 0) {
      amountCandidates.sort((a, b) => {
        // First by priority
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }
        // Then by value (higher amounts are more likely to be the total)
        return b.value - a.value;
      });
      
      data.amount = amountCandidates[0].value;
      console.log('[OCR] Selected amount:', amountCandidates[0].value, 'from', amountCandidates.length, 'candidates');
    }

    // Extract currency - try to find it near the amount
    const currencyMatches: string[] = [];
    for (const pattern of this.patterns.currency) {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);
      while ((match = regex.exec(text)) !== null) {
        const currency = (match[1] || match[0]).toUpperCase().substring(0, 3);
        if (['USD', 'MXN', 'EUR', 'GBP', 'CAD'].includes(currency)) {
          currencyMatches.push(currency);
        }
      }
    }

    // If multiple currencies found, use the most common one
    if (currencyMatches.length > 0) {
      const currencyCount: Record<string, number> = {};
      currencyMatches.forEach(curr => {
        currencyCount[curr] = (currencyCount[curr] || 0) + 1;
      });
      
      // Get most frequent currency
      const mostFrequent = Object.entries(currencyCount)
        .sort(([, a], [, b]) => b - a)[0][0];
      
      data.currency = mostFrequent;
      console.log('[OCR] Selected currency:', mostFrequent, 'from matches:', currencyMatches);
    }

    // If no currency found but found amount, check for symbols
    if (!data.currency && data.amount) {
      if (text.match(/USD/i)) {
        data.currency = 'USD';
      } else if (text.match(/MXN/i)) {
        data.currency = 'MXN';
      } else if (text.includes('€') || text.match(/EUR/i)) {
        data.currency = 'EUR';
      } else if (text.includes('$')) {
        // Count $ symbols - if many, likely USD
        const dollarCount = (text.match(/\$/g) || []).length;
        data.currency = dollarCount > 2 ? 'USD' : 'MXN'; // Multiple $ usually means USD document
      }
    }

    // Extract date
    for (const pattern of this.patterns.date) {
      const match = pattern.exec(text);
      if (match) {
        data.date = match[1] || match[0];
        break;
      }
    }

    // Extract invoice number
    for (const pattern of this.patterns.invoiceNumber) {
      const match = pattern.exec(text);
      if (match) {
        data.invoiceNumber = match[1] || match[0];
        break;
      }
    }

    // Extract vendor
    for (const pattern of this.patterns.vendor) {
      const match = pattern.exec(text);
      if (match) {
        const vendor = (match[1] || match[0]).trim();
        if (vendor.length > 3) {
          data.vendor = vendor.substring(0, 100);
          break;
        }
      }
    }

    // Create description from available data
    if (data.invoiceNumber || data.vendor) {
      const parts = [];
      if (data.vendor) parts.push(data.vendor);
      if (data.invoiceNumber) parts.push(`#${data.invoiceNumber}`);
      data.description = parts.join(' - ');
    }

    return data;
  }

  private calculateConfidence(data: ExtractedData): number {
    let score = 0;
    const weights = {
      amount: 40,      // Most important
      currency: 15,
      date: 20,
      invoiceNumber: 15,
      vendor: 10,
    };

    if (data.amount && data.amount > 0) score += weights.amount;
    if (data.currency) score += weights.currency;
    if (data.date) score += weights.date;
    if (data.invoiceNumber) score += weights.invoiceNumber;
    if (data.vendor) score += weights.vendor;

    return Math.min(score, 100);
  }

  async canProcessFile(filePath: string): Promise<boolean> {
    try {
      const ext = path.extname(filePath).toLowerCase();
      return ['.pdf', '.png', '.jpg', '.jpeg'].includes(ext);
    } catch {
      return false;
    }
  }
}

// Singleton instance
export const basicOCRExtractor = new BasicOCRExtractor();
