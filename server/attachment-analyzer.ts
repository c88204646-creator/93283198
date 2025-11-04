import * as pdfParse from 'pdf-parse';
import { createWorker } from 'tesseract.js';

export class AttachmentAnalyzer {
  private static ocrWorker: any = null;

  static async initializeOCR() {
    if (!this.ocrWorker) {
      this.ocrWorker = await createWorker('eng+spa');
    }
    return this.ocrWorker;
  }

  static async extractTextFromPDF(buffer: Buffer): Promise<string> {
    try {
      const data = await pdfParse(buffer);
      return data.text.trim();
    } catch (error) {
      console.error('PDF parsing error:', error);
      return '';
    }
  }

  static async extractTextFromImage(buffer: Buffer): Promise<string> {
    try {
      const worker = await this.initializeOCR();
      const { data: { text } } = await worker.recognize(buffer);
      return text.trim();
    } catch (error) {
      console.error('OCR error:', error);
      return '';
    }
  }

  static async analyzeAttachment(
    mimeType: string,
    data: string
  ): Promise<string> {
    try {
      const buffer = Buffer.from(data, 'base64');

      if (mimeType === 'application/pdf') {
        return await this.extractTextFromPDF(buffer);
      }

      if (mimeType.startsWith('image/')) {
        return await this.extractTextFromImage(buffer);
      }

      return '';
    } catch (error) {
      console.error('Attachment analysis error:', error);
      return '';
    }
  }

  static async cleanup() {
    if (this.ocrWorker) {
      await this.ocrWorker.terminate();
      this.ocrWorker = null;
    }
  }
}
