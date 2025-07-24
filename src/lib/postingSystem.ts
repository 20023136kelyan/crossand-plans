// src/lib/postingSystem.ts
'use server';

import { processImage, getOptimalProcessingOptions } from './imageProcessing';
import { validateFile, FileValidationType } from './fileValidation';
import { authAdmin, storageAdmin } from './firebaseAdmin';
// Using crypto.randomUUID() instead of uuid package for better compatibility

export interface PostingOptions {
  type: 'avatar' | 'chat_message' | 'post_highlight';
  userId: string;
  idToken: string;
  additionalData?: Record<string, any>;
}

export interface PostingResult {
  success: boolean;
  error?: string;
  data?: {
    url?: string;
    processedImage?: {
      size: number;
      width: number;
      height: number;
    };
    metadata?: Record<string, any>;
  };
}

/**
 * Centralized image upload and processing system
 */
export async function uploadAndProcessImage(
  file: File,
  options: PostingOptions
): Promise<PostingResult> {
  try {
    // Verify authentication
    if (!authAdmin) {
      console.error('[uploadAndProcessImage] Auth service not available');
      return { success: false, error: 'Authentication service unavailable.' };
    }

    let decodedToken;
    try {
      decodedToken = await authAdmin.verifyIdToken(options.idToken);
      if (decodedToken.uid !== options.userId) {
        return { success: false, error: 'Authentication mismatch.' };
      }
    } catch (authError: any) {
      console.error(`[uploadAndProcessImage] Authentication error:`, authError);
      return { 
        success: false, 
        error: authError.code === 'auth/id-token-expired' ? 'Session expired.' : 'Authentication failed.' 
      };
    }

    // Validate file using centralized validation
    const validationType: FileValidationType = 
      options.type === 'avatar' ? 'avatar' :
      options.type === 'chat_message' ? 'chat_message' :
      'post_highlight';
    
    const validation = validateFile(file, { 
      type: validationType, 
      allowedFormats: 'image' 
    });
    
    if (!validation.valid) {
      console.error(`[uploadAndProcessImage] File validation failed:`, validation.error);
      return { success: false, error: validation.error || 'Invalid file.' };
    }

    // Process image
    let processedImage;
    try {
      // Map posting types to image processing types
      const imageProcessingType = options.type === 'chat_message' ? 'post' : options.type;
      const processingOptions = getOptimalProcessingOptions(imageProcessingType as 'avatar' | 'post' | 'highlight');
      processedImage = await processImage(file, processingOptions);

    } catch (error: any) {
      console.error(`[uploadAndProcessImage] Image processing error:`, error);
      return { success: false, error: `Failed to process image: ${error.message || 'Unknown processing error'}` };
    }

    // Upload to Firebase Storage
    if (!storageAdmin) {
      console.error('[uploadAndProcessImage] Storage service not available');
      return { success: false, error: 'Storage service unavailable.' };
    }

    try {
      const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
      const bucket = bucketName ? storageAdmin.bucket(bucketName) : storageAdmin.bucket();
      
      if (!bucket) {
        console.error('[uploadAndProcessImage] Could not access Firebase Storage bucket.');
        return { success: false, error: 'Storage service unavailable.' };
      }

      // Generate file path based on type
      const timestamp = Date.now();
      const uniqueId = crypto.randomUUID();
      let filePath: string;
      
      switch (options.type) {
        case 'avatar':
          filePath = `avatars/${options.userId}/${timestamp}_${uniqueId}.jpg`;
          break;
        case 'chat_message':
          filePath = `chat-images/${options.userId}/${timestamp}_${uniqueId}.jpg`;
          break;
        case 'post_highlight':
          const planId = options.additionalData?.planId || 'unknown';
          filePath = `plan-highlights/${planId}/${timestamp}_${uniqueId}.jpg`;
          break;
        default:
          filePath = `uploads/${options.userId}/${timestamp}_${uniqueId}.jpg`;
      }

      const fileRef = bucket.file(filePath);
      
      // Upload the processed image
      await fileRef.save(processedImage.buffer, {
        metadata: {
          contentType: processedImage.contentType,
          metadata: {
            uploadedBy: options.userId,
            uploadType: options.type,
            originalSize: file.size.toString(),
            processedSize: processedImage.size.toString(),
            uploadTimestamp: timestamp.toString(),
            ...options.additionalData
          }
        }
      });

      // Make file publicly accessible
      await fileRef.makePublic();
      
      // Get public URL
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
      

      
      return {
        success: true,
        data: {
          url: publicUrl,
          processedImage: {
            size: processedImage.size,
            width: processedImage.width,
            height: processedImage.height
          },
          metadata: {
            filePath,
            originalSize: file.size,
            processedSize: processedImage.size,
            uploadTimestamp: timestamp
          }
        }
      };
      
    } catch (uploadError: any) {
      console.error(`[uploadAndProcessImage] Upload error:`, uploadError);
      return { success: false, error: `Failed to upload image: ${uploadError.message || 'Unknown upload error'}` };
    }
    
  } catch (error: any) {
    console.error(`[uploadAndProcessImage] Unexpected error:`, error);
    return { success: false, error: `Unexpected error: ${error.message || 'Unknown error'}` };
  }
}

/**
 * Quick upload functions for common use cases
 */
export async function uploadAvatar(file: File, userId: string, idToken: string): Promise<PostingResult> {
  return uploadAndProcessImage(file, { type: 'avatar', userId, idToken });
}

export async function uploadChatMessage(file: File, userId: string, idToken: string, chatId?: string): Promise<PostingResult> {
  return uploadAndProcessImage(file, { 
    type: 'chat_message', 
    userId, 
    idToken, 
    additionalData: { chatId } 
  });
}

export async function uploadPostHighlight(file: File, userId: string, idToken: string, planId: string): Promise<PostingResult> {
  return uploadAndProcessImage(file, { 
    type: 'post_highlight', 
    userId, 
    idToken, 
    additionalData: { planId } 
  });
}

/**
 * Cleanup function to remove old uploaded files
 */
export async function cleanupOldUploads(
  userId: string, 
  type: 'avatar' | 'chat_message' | 'post_highlight',
  keepLatest: number = 5
): Promise<{ success: boolean; error?: string; deletedCount?: number }> {
  try {
    if (!storageAdmin) {
      return { success: false, error: 'Storage service unavailable.' };
    }

    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    const bucket = bucketName ? storageAdmin.bucket(bucketName) : storageAdmin.bucket();
    
    if (!bucket) {
      return { success: false, error: 'Storage service unavailable.' };
    }

    let prefix: string;
    switch (type) {
      case 'avatar':
        prefix = `avatars/${userId}/`;
        break;
      case 'chat_message':
        prefix = `chat-images/${userId}/`;
        break;
      case 'post_highlight':
        prefix = `plan-highlights/`; // Will need additional filtering by userId in metadata
        break;
      default:
        prefix = `uploads/${userId}/`;
    }

    const [files] = await bucket.getFiles({ prefix });
    
    // Sort files by creation time (newest first)
    const sortedFiles = files.sort((a, b) => {
      const aTime = new Date(a.metadata.timeCreated || 0).getTime();
      const bTime = new Date(b.metadata.timeCreated || 0).getTime();
      return bTime - aTime;
    });

    // Keep only the latest files, delete the rest
    const filesToDelete = sortedFiles.slice(keepLatest);
    let deletedCount = 0;

    for (const file of filesToDelete) {
      try {
        await file.delete();
        deletedCount++;
      } catch (deleteError) {
        console.warn(`Failed to delete file ${file.name}:`, deleteError);
      }
    }

    return { success: true, deletedCount };
    
  } catch (error: any) {
    console.error(`[cleanupOldUploads] Error:`, error);
    return { success: false, error: error.message || 'Unknown cleanup error' };
  }
}