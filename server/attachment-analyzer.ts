import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
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

      return textPages.join('\n').trim();
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
