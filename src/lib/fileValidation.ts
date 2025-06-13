// src/lib/fileValidation.ts
// Centralized file validation configuration
export const FILE_VALIDATION_CONFIG = {
  // File size limits (in bytes)
  LIMITS: {
    AVATAR: 2 * 1024 * 1024,      // 2MB for avatar images
    CHAT_MESSAGE: 5 * 1024 * 1024, // 5MB for chat message images
    POST_HIGHLIGHT: 50 * 1024 * 1024, // 50MB for post highlights
    GENERAL_UPLOAD: 10 * 1024 * 1024, // 10MB for general uploads
  },
  
  // Supported file formats
  FORMATS: {
    IMAGE: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg', 'avif', 'tiff'],
    DOCUMENT: ['pdf', 'doc', 'docx', 'txt'],
    ALL: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg', 'avif', 'tiff', 'pdf', 'doc', 'docx', 'txt']
  },
  
  // MIME type mappings
  MIME_TYPES: {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'webp': 'image/webp',
    'gif': 'image/gif',
    'bmp': 'image/bmp',
    'svg': 'image/svg+xml',
    'avif': 'image/avif',
    'tiff': 'image/tiff',
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'txt': 'text/plain'
  }
} as const;

export type FileValidationType = 'avatar' | 'chat_message' | 'post_highlight' | 'general_upload';
export type FileFormatType = 'image' | 'document' | 'all';

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

export interface FileValidationOptions {
  type: FileValidationType;
  allowedFormats?: FileFormatType;
  customSizeLimit?: number; // Override default size limit
  customFormats?: string[]; // Override default formats
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string | null {
  const extension = filename.split('.').pop()?.toLowerCase();
  return extension || null;
}

/**
 * Get MIME type from file extension
 */
export function getMimeTypeFromExtension(extension: string): string | null {
  return FILE_VALIDATION_CONFIG.MIME_TYPES[extension as keyof typeof FILE_VALIDATION_CONFIG.MIME_TYPES] || null;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Get size limit for validation type
 */
export function getSizeLimit(type: FileValidationType, customLimit?: number): number {
  if (customLimit) return customLimit;
  
  switch (type) {
    case 'avatar':
      return FILE_VALIDATION_CONFIG.LIMITS.AVATAR;
    case 'chat_message':
      return FILE_VALIDATION_CONFIG.LIMITS.CHAT_MESSAGE;
    case 'post_highlight':
      return FILE_VALIDATION_CONFIG.LIMITS.POST_HIGHLIGHT;
    case 'general_upload':
    default:
      return FILE_VALIDATION_CONFIG.LIMITS.GENERAL_UPLOAD;
  }
}

/**
 * Get allowed formats for validation type
 */
export function getAllowedFormats(formatType: FileFormatType = 'image', customFormats?: string[]): string[] {
  if (customFormats) return customFormats;
  
  switch (formatType) {
    case 'image':
      return [...FILE_VALIDATION_CONFIG.FORMATS.IMAGE];
    case 'document':
      return [...FILE_VALIDATION_CONFIG.FORMATS.DOCUMENT];
    case 'all':
    default:
      return [...FILE_VALIDATION_CONFIG.FORMATS.ALL];
  }
}

/**
 * Comprehensive file validation function
 */
export function validateFile(file: File, options: FileValidationOptions): FileValidationResult {
  const warnings: string[] = [];
  
  // Get validation parameters
  const sizeLimit = getSizeLimit(options.type, options.customSizeLimit);
  const allowedFormats = getAllowedFormats(options.allowedFormats, options.customFormats);
  const extension = getFileExtension(file.name);
  
  // Validate file size
  if (file.size > sizeLimit) {
    return {
      valid: false,
      error: `File size (${formatFileSize(file.size)}) exceeds the limit of ${formatFileSize(sizeLimit)} for ${options.type.replace('_', ' ')} uploads.`
    };
  }
  
  // Validate file extension
  if (!extension) {
    return {
      valid: false,
      error: 'File must have a valid extension.'
    };
  }
  
  if (!allowedFormats.includes(extension)) {
    return {
      valid: false,
      error: `File type '.${extension}' is not supported. Allowed formats: ${allowedFormats.join(', ')}`
    };
  }
  
  // Validate MIME type if available
  if (file.type) {
    const expectedMimeType = getMimeTypeFromExtension(extension);
    if (expectedMimeType && file.type !== expectedMimeType) {
      warnings.push(`MIME type mismatch: expected '${expectedMimeType}' but got '${file.type}'`);
    }
  } else {
    warnings.push('No MIME type provided by browser');
  }
  
  // Additional validation for images
  if (options.allowedFormats === 'image' || allowedFormats.includes(extension)) {
    if (!file.type.startsWith('image/') && !getMimeTypeFromExtension(extension)?.startsWith('image/')) {
      return {
        valid: false,
        error: 'File does not appear to be a valid image.'
      };
    }
  }
  
  return {
    valid: true,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

/**
 * Quick validation functions for common use cases
 */
export const FileValidators = {
  avatar: (file: File) => validateFile(file, { type: 'avatar', allowedFormats: 'image' }),
  chatMessage: (file: File) => validateFile(file, { type: 'chat_message', allowedFormats: 'image' }),
  postHighlight: (file: File) => validateFile(file, { type: 'post_highlight', allowedFormats: 'image' }),
  generalUpload: (file: File) => validateFile(file, { type: 'general_upload', allowedFormats: 'all' })
};

/**
 * Validation error messages for UI
 */
export const ValidationMessages = {
  FILE_TOO_LARGE: (type: FileValidationType, actualSize: number, limit: number) => 
    `File size (${formatFileSize(actualSize)}) exceeds the ${formatFileSize(limit)} limit for ${type.replace('_', ' ')} uploads.`,
  
  INVALID_FORMAT: (extension: string, allowedFormats: string[]) => 
    `File type '.${extension}' is not supported. Allowed formats: ${allowedFormats.join(', ')}`,
  
  NO_EXTENSION: () => 'File must have a valid extension.',
  
  NOT_AN_IMAGE: () => 'File does not appear to be a valid image.',
  
  MIME_TYPE_MISMATCH: (expected: string, actual: string) => 
    `File type mismatch: expected '${expected}' but got '${actual}'`
};