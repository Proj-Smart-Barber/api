import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  ListPartsCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type {
  StorageService,
  GenerateUploadUrlParams,
  GenerateUploadUrlResult,
  InspectObjectResult,
  SaveVariantParams,
} from "../../domain/application/services/storage-service";

export interface R2StorageConfig {
  endpoint: string;
  stagingBucket?: string;
  publicBucket?: string;
  bucket?: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicUrl: string;
  region?: string;
  forcePathStyle?: boolean;
}

export class R2StorageService implements StorageService {
  private client: S3Client;
  private stagingBucket: string;
  private publicBucket: string;
  private publicUrl: string;

  constructor(config: R2StorageConfig) {
    this.stagingBucket = config.stagingBucket || config.bucket || "smart-barber-staging";
    this.publicBucket = config.publicBucket || config.bucket || "smart-barber-public";
    this.publicUrl = config.publicUrl.replace(/\/+$/, "");
    this.client = new S3Client({
      region: config.region || "auto",
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: config.forcePathStyle ?? true,
      // URLs de upload são assinadas antes de a API receber os bytes do arquivo.
      requestChecksumCalculation: "WHEN_REQUIRED",
    });
  }

  async beginMultipart(key:string,mimeType:string):Promise<string> {
    const result=await this.client.send(new CreateMultipartUploadCommand({Bucket:this.stagingBucket,Key:key,ContentType:mimeType}));
    if(!result.UploadId)throw new Error('Não foi possível iniciar multipart.');return result.UploadId;
  }
  async signMultipartPart(key:string,uploadId:string,part:number,size:number):Promise<string> {
    return getSignedUrl(this.client,new UploadPartCommand({Bucket:this.stagingBucket,Key:key,UploadId:uploadId,PartNumber:part,ContentLength:size}),{expiresIn:300});
  }
  async listMultipartParts(key:string,uploadId:string) {
    const result=await this.client.send(new ListPartsCommand({Bucket:this.stagingBucket,Key:key,UploadId:uploadId,MaxParts:100}));
    if(result.IsTruncated)throw new Error('Quantidade de partes fora do limite permitido.');
    return (result.Parts??[]).map(part=>({part:part.PartNumber!,etag:part.ETag!,size:part.Size??0}));
  }
  async finishMultipart(key:string,uploadId:string,parts:Array<{part:number;etag:string}>):Promise<void> {
    await this.client.send(new CompleteMultipartUploadCommand({Bucket:this.stagingBucket,Key:key,UploadId:uploadId,MultipartUpload:{Parts:parts.map(part=>({PartNumber:part.part,ETag:part.etag}))}}));
  }
  async abortMultipart(key:string,uploadId:string):Promise<void> {
    try{await this.client.send(new AbortMultipartUploadCommand({Bucket:this.stagingBucket,Key:key,UploadId:uploadId}));}catch(error){if((error as {name?:string}).name!=='NoSuchUpload')throw error;}
  }

  isConfigured(): boolean {
    return true;
  }

  async generateUploadUrl(params: GenerateUploadUrlParams): Promise<GenerateUploadUrlResult> {
    const command = new PutObjectCommand({
      Bucket: this.stagingBucket,
      Key: params.objectKey,
      ContentType: params.mimeType,
      ContentLength: params.fileSize,
    });

    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: params.expiresInSeconds ?? 300,
    });

    return {
      uploadUrl,
      publicUrl: this.getPublicUrl(params.objectKey),
      objectKey: params.objectKey,
    };
  }

  async inspectStagingObject(objectKey: string, maxBytes?: number): Promise<InspectObjectResult> {
    return this.readObjectFromBucket(this.stagingBucket, objectKey, maxBytes);
  }

  async inspectObject(objectKey: string): Promise<InspectObjectResult> {
    return this.readObjectFromBucket(this.publicBucket, objectKey);
  }

  private async readObjectFromBucket(
    bucket: string,
    objectKey: string,
    maxBytes?: number
  ): Promise<InspectObjectResult> {
    try {
      const head = await this.client.send(
        new HeadObjectCommand({
          Bucket: bucket,
          Key: objectKey,
        })
      );

      const reportedSize = head.ContentLength ?? 0;
      if (maxBytes !== undefined && reportedSize > maxBytes) {
        return {
          exists: true,
          size: reportedSize,
          contentType: head.ContentType,
          truncated: true,
        };
      }

      const get = await this.client.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: objectKey,
        })
      );

      const chunks: Uint8Array[] = [];
      let totalBytes = 0;
      let truncated = false;

      if (get.Body) {
        for await (const chunk of get.Body as any) {
          totalBytes += chunk.length;
          if (maxBytes !== undefined && totalBytes > maxBytes) {
            truncated = true;
            break;
          }
          chunks.push(chunk);
        }
      }

      return {
        exists: true,
        size: reportedSize || totalBytes,
        contentType: head.ContentType,
        buffer: truncated ? undefined : Buffer.concat(chunks),
        truncated,
      };
    } catch (err: any) {
      if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
        return { exists: false, size: 0 };
      }
      throw err;
    }
  }

  async saveVariant(params: SaveVariantParams): Promise<{ publicUrl: string; objectKey: string }> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.publicBucket,
        Key: params.objectKey,
        Body: params.buffer,
        ContentType: params.mimeType,
        ContentLength: params.buffer.length,
      })
    );

    return {
      publicUrl: this.getPublicUrl(params.objectKey),
      objectKey: params.objectKey,
    };
  }

  async deleteStagingObject(objectKey: string): Promise<void> {
    await this.deleteFromBucket(this.stagingBucket, objectKey);
  }

  async deleteObject(objectKey: string): Promise<void> {
    await this.deleteFromBucket(this.publicBucket, objectKey);
  }

  private async deleteFromBucket(bucket: string, objectKey: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: objectKey,
        })
      );
    } catch (err: any) {
      if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
        return;
      }
      throw err;
    }
  }

  getPublicUrl(objectKey: string): string {
    const cleanKey = objectKey.replace(/^\/+/, "");
    return `${this.publicUrl}/${cleanKey}`;
  }
}
