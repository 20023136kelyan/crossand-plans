import { firestoreAdmin } from '@/lib/firebaseAdmin';
import type { Firestore } from 'firebase-admin/firestore';

export interface Backup {
  id: string;
  name: string;
  type: 'full' | 'incremental' | 'differential';
  status: 'completed' | 'running' | 'failed' | 'scheduled';
  size: string;
  createdAt: string;
  collections: string[];
  duration: string;
  location: string;
  downloadUrl?: string;
  metadata?: Record<string, any>;
}

export interface BackupSettings {
  enableAutomaticBackups: boolean;
  backupFrequency: 'daily' | 'weekly' | 'monthly';
  retentionDays: number;
  backupLocation: string;
  includeCollections: string[];
  excludeCollections: string[];
  maxBackupSize: number;
  backupTime: string;
}

/**
 * Get all backups from Firestore
 */
export async function getBackups(): Promise<Backup[]> {
  if (!firestoreAdmin) {
    throw new Error('Firestore not initialized');
  }

  const db = firestoreAdmin as Firestore;
  
  const backupsSnapshot = await db
    .collection('backups')
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get();

  return backupsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Backup[];
}

/**
 * Create a new backup
 */
export async function createBackup(
  name: string,
  type: 'full' | 'incremental' | 'differential' = 'full',
  collections: string[] = [],
  userId: string
): Promise<string> {
  if (!firestoreAdmin) {
    throw new Error('Firestore not initialized');
  }

  const db = firestoreAdmin as Firestore;
  const now = new Date();

  // Default collections to backup if none specified
  const defaultCollections = ['users', 'plans', 'subscriptions', 'messages', 'ratings', 'reports'];
  const collectionsToBackup = collections.length > 0 ? collections : defaultCollections;

  const backupData: Omit<Backup, 'id'> = {
    name: name || `${type.charAt(0).toUpperCase() + type.slice(1)} Backup - ${now.toLocaleString()}`,
    type,
    status: 'running',
    size: '0 MB', // Will be updated when backup completes
    createdAt: now.toISOString(),
    collections: collectionsToBackup,
    duration: '0 minutes', // Will be updated when backup completes
    location: 'Firebase Storage',
    metadata: {
      createdBy: userId,
      startTime: now.toISOString()
    }
  };

  const backupRef = await db.collection('backups').add(backupData);

  // Start backup process asynchronously
  processBackup(backupRef.id, collectionsToBackup, type)
    .catch(error => {
      console.error('Backup process failed:', error);
      // Update backup status to failed
      db.collection('backups').doc(backupRef.id).update({
        status: 'failed',
        metadata: {
          ...backupData.metadata,
          error: error.message,
          endTime: new Date().toISOString()
        }
      });
    });

  return backupRef.id;
}

/**
 * Process the actual backup
 */
async function processBackup(
  backupId: string,
  collections: string[],
  type: 'full' | 'incremental' | 'differential'
): Promise<void> {
  if (!firestoreAdmin) {
    throw new Error('Firestore not initialized');
  }

  const db = firestoreAdmin as Firestore;
  const startTime = new Date();

  try {
    let totalSize = 0;
    const backupData: Record<string, any> = {};
    let processedCollections = 0;

    // Update progress: starting backup
    await db.collection('backups').doc(backupId).update({
      status: 'processing',
      progress: 0,
      message: 'Starting backup process...'
    });

    for (const collectionName of collections) {
      // Update progress for current collection
      const progress = Math.round((processedCollections / collections.length) * 90); // Reserve 10% for finalization
      await db.collection('backups').doc(backupId).update({
        progress,
        message: `Backing up ${collectionName}...`
      });

      const collectionSnapshot = await db.collection(collectionName).get();
      const collectionData = collectionSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        _backupTimestamp: startTime.toISOString()
      }));
      
      backupData[collectionName] = collectionData;
      
      // Estimate size (rough calculation)
      const collectionSize = JSON.stringify(collectionData).length;
      totalSize += collectionSize;
      processedCollections++;
    }

    // Finalization phase
    await db.collection('backups').doc(backupId).update({
      progress: 95,
      message: 'Finalizing backup...'
    });

    // Store backup data in a subcollection for easy retrieval
    const backupDataRef = db.collection('backups').doc(backupId).collection('data');
    
    for (const [collectionName, data] of Object.entries(backupData)) {
      await backupDataRef.doc(collectionName).set({
        data: data,
        timestamp: startTime.toISOString()
      });
    }

    // Convert size to readable format
    const sizeInMB = totalSize / (1024 * 1024);
    const formattedSize = sizeInMB > 1024 
      ? `${(sizeInMB / 1024).toFixed(1)} GB`
      : `${sizeInMB.toFixed(0)} MB`;

    // Calculate duration
    const endTime = new Date();
    const durationMs = endTime.getTime() - startTime.getTime();
    const durationMinutes = Math.ceil(durationMs / (1000 * 60));
    const formattedDuration = durationMinutes === 1 ? '1 minute' : `${durationMinutes} minutes`;

    // Complete backup
    await db.collection('backups').doc(backupId).update({
      status: 'completed',
      progress: 100,
      message: 'Backup completed successfully',
      size: formattedSize,
      duration: formattedDuration,
      metadata: {
        endTime: endTime.toISOString(),
        totalDocuments: Object.values(backupData).reduce((total, docs: any) => total + docs.length, 0),
        collections: collections,
        backupType: type
      }
    });

  } catch (error) {
    console.error('Backup processing error:', error);
    
    // Update backup record with error
    await db.collection('backups').doc(backupId).update({
      status: 'failed',
      progress: 0,
      message: 'Backup failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    throw error;
  }
}

/**
 * Delete a backup
 */
export async function deleteBackup(backupId: string): Promise<void> {
  if (!firestoreAdmin) {
    throw new Error('Firestore not initialized');
  }

  const db = firestoreAdmin as Firestore;
  
  // In a real implementation, you would also delete the backup files from storage
  await db.collection('backups').doc(backupId).delete();
}

/**
 * Restore from a backup
 */
export async function restoreFromBackup(
  backupId: string,
  userId: string
): Promise<string> {
  if (!firestoreAdmin) {
    throw new Error('Firestore not initialized');
  }

  const db = firestoreAdmin as Firestore;
  
  // Get backup details
  const backupDoc = await db.collection('backups').doc(backupId).get();
  if (!backupDoc.exists) {
    throw new Error('Backup not found');
  }

  const backupData = backupDoc.data() as Backup;
  
  // Create a restore operation record
  const restoreData = {
    name: `Restore from ${backupData.name}`,
    type: 'restore' as const,
    status: 'running' as const,
    size: '0 MB',
    createdAt: new Date().toISOString(),
    collections: backupData.collections,
    duration: '0 minutes',
    location: 'Firebase Storage',
    sourceBackupId: backupId,
    metadata: {
      createdBy: userId,
      restoreStartTime: new Date().toISOString(),
      sourceBackup: backupData.name
    }
  };

  const restoreRef = await db.collection('backups').add(restoreData);

  // Process the actual restore
  processRestore(restoreRef.id, backupId).catch(error => {
    console.error('Restore process failed:', error);
  });

  return restoreRef.id;
}

/**
 * Process the actual restore operation
 */
async function processRestore(restoreId: string, backupId: string): Promise<void> {
  if (!firestoreAdmin) {
    throw new Error('Firestore not initialized');
  }

  const db = firestoreAdmin as Firestore;
  const startTime = new Date();

  try {
    // Update progress: starting restore
    await db.collection('backups').doc(restoreId).update({
      status: 'processing',
      progress: 0,
      message: 'Starting restore process...'
    });

    // Get backup data
    const backupDataRef = db.collection('backups').doc(backupId).collection('data');
    const backupDataSnapshot = await backupDataRef.get();

    if (backupDataSnapshot.empty) {
      throw new Error('No backup data found');
    }

    const collections = backupDataSnapshot.docs;
    let processedCollections = 0;

    for (const collectionDoc of collections) {
      const collectionName = collectionDoc.id;
      const collectionData = collectionDoc.data().data;

      // Update progress
      const progress = Math.round((processedCollections / collections.length) * 90);
      await db.collection('backups').doc(restoreId).update({
        progress,
        message: `Restoring ${collectionName}...`
      });

      // Restore collection data
      const batch = db.batch();
      let batchCount = 0;

      for (const doc of collectionData) {
        const { id, _backupTimestamp, ...docData } = doc;
        const docRef = db.collection(collectionName).doc(id);
        batch.set(docRef, docData, { merge: true });
        batchCount++;

        // Commit batch every 500 operations (Firestore limit)
        if (batchCount >= 500) {
          await batch.commit();
          batchCount = 0;
        }
      }

      // Commit remaining operations
      if (batchCount > 0) {
        await batch.commit();
      }

      processedCollections++;
    }

    // Finalization
    await db.collection('backups').doc(restoreId).update({
      progress: 95,
      message: 'Finalizing restore...'
    });

    const endTime = new Date();
    const duration = Math.round((endTime.getTime() - startTime.getTime()) / 1000);

    // Complete restore
    await db.collection('backups').doc(restoreId).update({
      status: 'completed',
      progress: 100,
      message: 'Restore completed successfully',
      duration: `${duration} seconds`,
      metadata: {
        restoreEndTime: endTime.toISOString(),
        restoredCollections: collections.length,
        sourceBackupId: backupId
      }
    });
  } catch (error) {
    console.error('Restore process failed:', error);
    
    // Update restore record with error
    await db.collection('backups').doc(restoreId).update({
      status: 'failed',
      progress: 0,
      message: 'Restore failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    throw error;
  }
 }

/**
 * Get backup settings
 */
export async function getBackupSettings(): Promise<BackupSettings> {
  if (!firestoreAdmin) {
    throw new Error('Firestore not initialized');
  }

  const db = firestoreAdmin as Firestore;
  
  const settingsDoc = await db.collection('settings').doc('backups').get();
  
  const defaultSettings: BackupSettings = {
    enableAutomaticBackups: true,
    backupFrequency: 'daily',
    retentionDays: 30,
    backupLocation: 'firebase-storage',
    includeCollections: ['users', 'plans', 'subscriptions', 'messages'],
    excludeCollections: ['logs', 'analytics'],
    maxBackupSize: 10, // GB
    backupTime: '02:00' // 2 AM
  };

  if (settingsDoc.exists) {
    return { ...defaultSettings, ...settingsDoc.data() } as BackupSettings;
  }

  return defaultSettings;
}

/**
 * Update backup settings
 */
export async function updateBackupSettings(
  settings: Partial<BackupSettings>,
  userId: string
): Promise<void> {
  if (!firestoreAdmin) {
    throw new Error('Firestore not initialized');
  }

  const db = firestoreAdmin as Firestore;
  
  // Update settings
  await db.collection('settings').doc('backups').set(settings, { merge: true });
  
  // Log the settings change
  await db.collection('backups').add({
    name: 'Backup Settings Updated',
    type: 'settings_change',
    status: 'completed',
    size: '0 MB',
    createdAt: new Date().toISOString(),
    collections: [],
    duration: '0 minutes',
    location: 'System',
    metadata: {
      createdBy: userId,
      settingsChanged: settings,
      description: 'Backup settings were modified by admin'
    }
  });
}

/**
 * Get backup statistics
 */
export async function getBackupStats() {
  if (!firestoreAdmin) {
    throw new Error('Firestore not initialized');
  }

  const db = firestoreAdmin as Firestore;
  
  const backupsSnapshot = await db.collection('backups').get();
  const backups = backupsSnapshot.docs.map(doc => doc.data() as Backup);
  
  const totalBackups = backups.length;
  const completedBackups = backups.filter(b => b.status === 'completed').length;
  const failedBackups = backups.filter(b => b.status === 'failed').length;
  const runningBackups = backups.filter(b => b.status === 'running').length;
  
  // Calculate total size
  const totalSize = backups.reduce((total, backup) => {
    const sizeMatch = backup.size.match(/([0-9.]+)\s*(MB|GB)/);
    if (sizeMatch) {
      const size = parseFloat(sizeMatch[1]);
      const unit = sizeMatch[2];
      return total + (unit === 'GB' ? size * 1024 : size);
    }
    return total;
  }, 0);
  
  const formattedTotalSize = totalSize > 1024 
    ? `${(totalSize / 1024).toFixed(1)} GB`
    : `${totalSize.toFixed(0)} MB`;
  
  return {
    totalBackups,
    completedBackups,
    failedBackups,
    runningBackups,
    totalSize: formattedTotalSize,
    successRate: totalBackups > 0 ? (completedBackups / totalBackups) * 100 : 0
  };
}