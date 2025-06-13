import sharp from 'sharp';

import { FILE_VALIDATION_CONFIG, validateFile, FileValidators } from './fileValidation';

// Supported image formats for conversion
const SUPPORTED_INPUT_FORMATS = FILE_VALIDATION_CONFIG.FORMATS.IMAGE;
const OUTPUT_FORMAT = 'jpeg'; // Standard output format for compatibility
const MAX_PROCESSED_FILE_SIZE = FILE_VALIDATION_CONFIG.LIMITS.POST_HIGHLIGHT; // Use centralized limit
const AVATAR_SIZE = 512; // Avatar dimensions
const POST_MAX_WIDTH = 1920; // Max width for post images
const POST_MAX_HEIGHT = 1080; // Max height for post images

export interface ProcessedImage {
  buffer: Buffer;
  contentType: string;
  size: number;
  width: number;
  height: number;
}

export interface ImageProcessingOptions {
  type: 'avatar' | 'post' | 'highlight';
  quality?: number; // 1-100, default 85
  maxWidth?: number;
  maxHeight?: number;
}

/**
 * Process and compress an image file
 * @param file - The input file (File or Buffer)
 * @param options - Processing options
 * @returns Processed image data
 */
export async function processImage(
  file: File | Buffer,
  options: ImageProcessingOptions
): Promise<ProcessedImage> {
  try {
    // Convert File to Buffer if needed
    let inputBuffer: Buffer;
    if (file instanceof File) {
      inputBuffer = Buffer.from(await file.arrayBuffer());
    } else {
      inputBuffer = file;
    }

    // Validate input format
    const metadata = await sharp(inputBuffer).metadata();
    if (!metadata.format || !SUPPORTED_INPUT_FORMATS.includes(metadata.format as any)) {
      throw new Error(`Unsupported image format: ${metadata.format}. Supported formats: ${SUPPORTED_INPUT_FORMATS.join(', ')}`);
    }

    // Set processing parameters based on type
    let { quality = 85, maxWidth, maxHeight } = options;
    
    switch (options.type) {
      case 'avatar':
        maxWidth = AVATAR_SIZE;
        maxHeight = AVATAR_SIZE;
        quality = Math.max(quality, 90); // Higher quality for avatars
        break;
      case 'post':
      case 'highlight':
        maxWidth = maxWidth || POST_MAX_WIDTH;
        maxHeight = maxHeight || POST_MAX_HEIGHT;
        break;
    }

    // Start processing with Sharp
    let sharpInstance = sharp(inputBuffer);

    // Resize if needed
    if (maxWidth || maxHeight) {
      sharpInstance = sharpInstance.resize(maxWidth, maxHeight, {
        fit: options.type === 'avatar' ? 'cover' : 'inside',
        withoutEnlargement: true
      });
    }

    // Convert to JPEG and compress
    let processedBuffer = await sharpInstance
      .jpeg({ quality, progressive: true, mozjpeg: true })
      .toBuffer();

    // If still too large, reduce quality iteratively
    let currentQuality = quality;
    while (processedBuffer.length > MAX_PROCESSED_FILE_SIZE && currentQuality > 20) {
      currentQuality -= 10;
      processedBuffer = await sharp(inputBuffer)
        .resize(maxWidth, maxHeight, {
          fit: options.type === 'avatar' ? 'cover' : 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: currentQuality, progressive: true, mozjpeg: true })
        .toBuffer();
    }

    // If still too large, reduce dimensions
    if (processedBuffer.length > MAX_PROCESSED_FILE_SIZE) {
      const reductionFactor = 0.8;
      const newMaxWidth = maxWidth ? Math.floor(maxWidth * reductionFactor) : undefined;
      const newMaxHeight = maxHeight ? Math.floor(maxHeight * reductionFactor) : undefined;
      
      processedBuffer = await sharp(inputBuffer)
        .resize(newMaxWidth, newMaxHeight, {
          fit: options.type === 'avatar' ? 'cover' : 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: Math.max(currentQuality, 60), progressive: true, mozjpeg: true })
        .toBuffer();
    }

    // Get final metadata
    const finalMetadata = await sharp(processedBuffer).metadata();

    return {
      buffer: processedBuffer,
      contentType: 'image/jpeg',
      size: processedBuffer.length,
      width: finalMetadata.width || 0,
      height: finalMetadata.height || 0
    };
  } catch (error) {
    console.error('Image processing error:', error);
    throw new Error(`Failed to process image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate image file before processing
 * @param file - The file to validate
 * @param validationType - Type of validation to perform
 * @returns Validation result
 */
export function validateImageFile(file: File, validationType: 'avatar' | 'chat_message' | 'post_highlight' = 'post_highlight'): { valid: boolean; error?: string } {
  const result = validateFile(file, { type: validationType, allowedFormats: 'image' });
  return {
    valid: result.valid,
    error: result.error
  };
}

/**
 * Create a File object from processed image data
 * @param processedImage - The processed image data
 * @param originalFileName - Original file name for reference
 * @returns New File object
 */
export function createProcessedFile(
  processedImage: ProcessedImage,
  originalFileName: string
): File {
  const nameWithoutExt = originalFileName.split('.').slice(0, -1).join('.');
  const newFileName = `${nameWithoutExt}_processed.jpg`;
  
  return new File([processedImage.buffer], newFileName, {
    type: processedImage.contentType,
    lastModified: Date.now()
  });
}

/**
 * Get optimal processing options based on use case
 * @param type - The type of image processing needed
 * @returns Recommended processing options
 */
export function getOptimalProcessingOptions(type: 'avatar' | 'post' | 'highlight'): ImageProcessingOptions {
  switch (type) {
    case 'avatar':
      return {
        type: 'avatar',
        quality: 90,
        maxWidth: AVATAR_SIZE,
        maxHeight: AVATAR_SIZE
      };
    case 'post':
      return {
        type: 'post',
        quality: 85,
        maxWidth: POST_MAX_WIDTH,
        maxHeight: POST_MAX_HEIGHT
      };
    case 'highlight':
      return {
        type: 'highlight',
        quality: 85,
        maxWidth: POST_MAX_WIDTH,
        maxHeight: POST_MAX_HEIGHT
      };
    default:
      return {
        type: 'post',
        quality: 85
      };
  }
}