import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import * as crypto from 'crypto';
import { Readable } from 'stream';

export interface B2UploadResult {
  fileKey: string;
  fileHash: string;
  fileUrl: string;
  size: number;
  isDuplicate: boolean;
}

export interface B2FileMetadata {
  originalName?: string;
  mimeType?: string;
  uploadedBy?: string;
  category?: string;
  source?: string;
  emailId?: string;
  attachmentId?: string;
}

export class BackblazeStorage {
  private client: S3Client | null = null;
  private bucketName: string | null = null;
  private endpoint: string | null = null;
  private isConfigured: boolean = false;

  constructor() {
    // Lazy initialization - don't throw if credentials are missing
    this.initializeIfPossible();
  }

  private initializeIfPossible(): void {
    let endpoint = process.env.B2_ENDPOINT;
    const keyId = process.env.B2_APPLICATION_KEY_ID;
    const appKey = process.env.B2_APPLICATION_KEY;
    const bucketId = process.env.B2_BUCKET_ID;

    if (!endpoint || !keyId || !appKey || !bucketId) {
      console.warn('Backblaze B2 credentials not configured. File operations will fall back to legacy storage.');
      this.isConfigured = false;
      return;
    }

    // Asegurarse de que el endpoint tenga el protocolo https://
    if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
      endpoint = `https://${endpoint}`;
      console.log(`B2_ENDPOINT corregido a: ${endpoint}`);
    }

    this.endpoint = endpoint;
    this.bucketName = bucketId;
    this.isConfigured = true;

    const region = this.extractRegionFromEndpoint(endpoint);

    this.client = new S3Client({
      endpoint: endpoint,
      region: region,
      credentials: {
        accessKeyId: keyId,
        secretAccessKey: appKey,
      },
      forcePathStyle: true,
    });
    
    console.log(`Backblaze B2 configurado: Region=${region}, Bucket=${bucketId}`);
  }

  private ensureConfigured(): void {
    if (!this.isConfigured || !this.client || !this.bucketName) {
      throw new Error('Backblaze B2 is not configured. Please set B2_ENDPOINT, B2_APPLICATION_KEY_ID, B2_APPLICATION_KEY, and B2_BUCKET_ID environment variables.');
    }
  }

  private extractRegionFromEndpoint(endpoint: string): string {
    const match = endpoint.match(/s3\.([^.]+)\./);
    return match ? match[1] : 'us-west-004';
  }

  calculateHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  async checkFileExists(fileHash: string, folder: string): Promise<string | null> {
    this.ensureConfigured();
    try {
      const fileKey = `${folder}/${fileHash}`;
      await this.client!.send(new HeadObjectCommand({
        Bucket: this.bucketName!,
        Key: fileKey,
      }));
      return fileKey;
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async uploadFile(
    buffer: Buffer,
    folder: string,
    metadata: B2FileMetadata = {}
  ): Promise<B2UploadResult> {
    this.ensureConfigured();
    const fileHash = this.calculateHash(buffer);
    const existingFile = await this.checkFileExists(fileHash, folder);

    if (existingFile) {
      return {
        fileKey: existingFile,
        fileHash,
        fileUrl: `${this.endpoint}/${this.bucketName}/${existingFile}`,
        size: buffer.length,
        isDuplicate: true,
      };
    }

    const fileKey = `${folder}/${fileHash}`;
    const metadataHeaders: Record<string, string> = {};

    if (metadata.originalName) metadataHeaders['original-name'] = metadata.originalName;
    if (metadata.mimeType) metadataHeaders['mime-type'] = metadata.mimeType;
    if (metadata.uploadedBy) metadataHeaders['uploaded-by'] = metadata.uploadedBy;
    if (metadata.category) metadataHeaders['category'] = metadata.category;
    if (metadata.source) metadataHeaders['source'] = metadata.source;
    if (metadata.emailId) metadataHeaders['email-id'] = metadata.emailId;
    if (metadata.attachmentId) metadataHeaders['attachment-id'] = metadata.attachmentId;

    await this.client!.send(new PutObjectCommand({
      Bucket: this.bucketName!,
      Key: fileKey,
      Body: buffer,
      ContentType: metadata.mimeType || 'application/octet-stream',
      Metadata: metadataHeaders,
    }));

    return {
      fileKey,
      fileHash,
      fileUrl: `${this.endpoint}/${this.bucketName}/${fileKey}`,
      size: buffer.length,
      isDuplicate: false,
    };
  }

  async uploadEmailBody(
    emailId: string,
    bodyText: string | null,
    bodyHtml: string | null
  ): Promise<{ textKey?: string; htmlKey?: string }> {
    this.ensureConfigured();
    const result: { textKey?: string; htmlKey?: string } = {};

    if (bodyText) {
      const textBuffer = Buffer.from(bodyText, 'utf-8');
      const textHash = this.calculateHash(textBuffer);
      const textKey = `emails/bodies/text/${textHash}`;
      
      await this.client!.send(new PutObjectCommand({
        Bucket: this.bucketName!,
        Key: textKey,
        Body: textBuffer,
        ContentType: 'text/plain; charset=utf-8',
        Metadata: {
          'email-id': emailId,
          'type': 'email-body-text',
        },
      }));

      result.textKey = textKey;
    }

    if (bodyHtml) {
      const htmlBuffer = Buffer.from(bodyHtml, 'utf-8');
      const htmlHash = this.calculateHash(htmlBuffer);
      const htmlKey = `emails/bodies/html/${htmlHash}`;
      
      await this.client!.send(new PutObjectCommand({
        Bucket: this.bucketName!,
        Key: htmlKey,
        Body: htmlBuffer,
        ContentType: 'text/html; charset=utf-8',
        Metadata: {
          'email-id': emailId,
          'type': 'email-body-html',
        },
      }));

      result.htmlKey = htmlKey;
    }

    return result;
  }

  async uploadAttachment(
    data: Buffer,
    filename: string,
    mimeType: string,
    emailId: string,
    attachmentId: string,
    extractedText?: string
  ): Promise<B2UploadResult> {
    const uploadResult = await this.uploadFile(data, 'emails/attachments', {
      originalName: filename,
      mimeType,
      source: 'gmail',
      emailId,
      attachmentId,
    });

    if (extractedText) {
      const textBuffer = Buffer.from(extractedText, 'utf-8');
      const textHash = this.calculateHash(textBuffer);
      const textKey = `emails/attachments/extracted-text/${textHash}`;
      
      await this.client!.send(new PutObjectCommand({
        Bucket: this.bucketName!,
        Key: textKey,
        Body: textBuffer,
        ContentType: 'text/plain; charset=utf-8',
        Metadata: {
          'attachment-id': attachmentId,
          'email-id': emailId,
          'type': 'extracted-text',
        },
      }));
    }

    return uploadResult;
  }

  async uploadOperationFile(
    data: Buffer,
    filename: string,
    mimeType: string,
    operationId: string,
    uploadedBy: string,
    category?: string,
    extractedText?: string
  ): Promise<B2UploadResult> {
    const uploadResult = await this.uploadFile(data, 'operations/files', {
      originalName: filename,
      mimeType,
      uploadedBy,
      category,
      source: 'operation',
    });

    if (extractedText) {
      const textBuffer = Buffer.from(extractedText, 'utf-8');
      const textHash = this.calculateHash(textBuffer);
      const textKey = `operations/files/extracted-text/${textHash}`;
      
      await this.client!.send(new PutObjectCommand({
        Bucket: this.bucketName!,
        Key: textKey,
        Body: textBuffer,
        ContentType: 'text/plain; charset=utf-8',
        Metadata: {
          'operation-id': operationId,
          'type': 'extracted-text',
        },
      }));
    }

    return uploadResult;
  }

  async downloadFile(fileKey: string): Promise<Buffer> {
    this.ensureConfigured();
    try {
      const response = await this.client!.send(new GetObjectCommand({
        Bucket: this.bucketName!,
        Key: fileKey,
      }));

      if (!response.Body) {
        throw new Error('Empty response body');
      }

      const stream = response.Body as Readable;
      const chunks: Buffer[] = [];

      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }

      return Buffer.concat(chunks);
    } catch (error: any) {
      console.error(`Error downloading file from Backblaze: ${fileKey}`, error);
      throw new Error(`Failed to download file: ${error.message}`);
    }
  }

  async downloadFileAsStream(fileKey: string): Promise<Readable> {
    this.ensureConfigured();
    try {
      const response = await this.client!.send(new GetObjectCommand({
        Bucket: this.bucketName!,
        Key: fileKey,
      }));

      if (!response.Body) {
        throw new Error('Empty response body');
      }

      return response.Body as Readable;
    } catch (error: any) {
      console.error(`Error downloading file from Backblaze: ${fileKey}`, error);
      throw new Error(`Failed to download file: ${error.message}`);
    }
  }

  async getFileMetadata(fileKey: string): Promise<any> {
    this.ensureConfigured();
    try {
      const response = await this.client!.send(new HeadObjectCommand({
        Bucket: this.bucketName!,
        Key: fileKey,
      }));

      return {
        contentType: response.ContentType,
        contentLength: response.ContentLength,
        metadata: response.Metadata,
        lastModified: response.LastModified,
      };
    } catch (error: any) {
      console.error(`Error getting file metadata from Backblaze: ${fileKey}`, error);
      throw new Error(`Failed to get file metadata: ${error.message}`);
    }
  }

  async listFiles(folder: string, maxKeys: number = 1000): Promise<string[]> {
    this.ensureConfigured();
    try {
      const response = await this.client!.send(new ListObjectsV2Command({
        Bucket: this.bucketName!,
        Prefix: folder,
        MaxKeys: maxKeys,
      }));

      return (response.Contents || []).map(item => item.Key || '').filter(key => key);
    } catch (error: any) {
      console.error(`Error listing files in Backblaze: ${folder}`, error);
      throw new Error(`Failed to list files: ${error.message}`);
    }
  }

  getPublicUrl(fileKey: string): string {
    this.ensureConfigured();
    return `${this.endpoint}/${this.bucketName}/${fileKey}`;
  }

  async getSignedUrl(fileKey: string, expiresIn: number = 600): Promise<string> {
    this.ensureConfigured();
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName!,
        Key: fileKey,
      });

      const signedUrl = await getSignedUrl(this.client!, command, { expiresIn });
      return signedUrl;
    } catch (error: any) {
      console.error(`Error generating signed URL for ${fileKey}:`, error);
      throw new Error(`Failed to generate signed URL: ${error.message}`);
    }
  }

  async getMultipleSignedUrls(fileKeys: string[], expiresIn: number = 600): Promise<Map<string, string>> {
    this.ensureConfigured();
    const urlMap = new Map<string, string>();

    await Promise.all(
      fileKeys.map(async (fileKey) => {
        try {
          const signedUrl = await this.getSignedUrl(fileKey, expiresIn);
          urlMap.set(fileKey, signedUrl);
        } catch (error) {
          console.error(`Failed to generate signed URL for ${fileKey}:`, error);
        }
      })
    );

    return urlMap;
  }

  isAvailable(): boolean {
    return this.isConfigured;
  }
}

export const backblazeStorage = new BackblazeStorage();
