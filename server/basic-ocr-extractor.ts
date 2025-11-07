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

  async extractFromPDF(pdfPathOrBuffer: string | Buffer): Promise<ExtractionResult> {
    try {
      let tempFilePath: string | null = null;
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
      console.error('[OCR Extractor] Error:', error);
      throw error;
    }
  }

  private extractFieldsFromText(text: string): ExtractedData {
    const data: ExtractedData = {};

    // Extract amount
    for (const pattern of this.patterns.amount) {
      const match = pattern.exec(text);
      if (match) {
        const amountStr = match[1] || match[0];
        const cleanAmount = amountStr.replace(/[^0-9.]/g, '');
        const amount = parseFloat(cleanAmount);
        
        if (!isNaN(amount) && amount > 0) {
          data.amount = amount;
          break;
        }
      }
    }

    // Extract currency
    for (const pattern of this.patterns.currency) {
      const match = pattern.exec(text);
      if (match) {
        data.currency = (match[1] || match[0]).toUpperCase().substring(0, 3);
        break;
      }
    }

    // If no currency found but found amount, check for symbols
    if (!data.currency && data.amount) {
      if (text.includes('$') && text.match(/USD/i)) {
        data.currency = 'USD';
      } else if (text.includes('$') && text.match(/MXN/i)) {
        data.currency = 'MXN';
      } else if (text.includes('€')) {
        data.currency = 'EUR';
      } else if (text.includes('$')) {
        data.currency = 'USD'; // Default assumption
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
