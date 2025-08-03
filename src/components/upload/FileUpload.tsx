'use client';

import { useFileUploadLimits } from '@/hooks/use-limits';
import { useSettings } from '@/context/SettingsContext';
import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowUpTrayIcon,
  DocumentIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  PhotoIcon,
  DocumentTextIcon,
  FilmIcon,
  MusicalNoteIcon,
  ArchiveBoxIcon
} from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  maxFiles?: number;
  multiple?: boolean;
  accept?: string;
  disabled?: boolean;
  className?: string;
}

interface UploadedFile {
  file: File;
  id: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
}

export function FileUpload({
  onFilesSelected,
  maxFiles = 5,
  multiple = true,
  accept,
  disabled = false,
  className
}: FileUploadProps) {
  const { validateFile, maxFileSize, allowedFileTypes } = useFileUploadLimits();
  const { settings } = useSettings();
  const { toast } = useToast();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    // Handle rejected files
    rejectedFiles.forEach(({ file, errors }) => {
      errors.forEach((error: any) => {
        let message = `File "${file.name}" was rejected`;
        
        switch (error.code) {
          case 'file-too-large':
            message = `File "${file.name}" is too large. Maximum size is ${formatFileSize(maxFileSize)}.`;
            break;
          case 'file-invalid-type':
            message = `File "${file.name}" has an invalid type. Allowed types: ${allowedFileTypes.join(', ')}.`;
            break;
          case 'too-many-files':
            message = `Too many files. Maximum ${maxFiles} files allowed.`;
            break;
          default:
            message = `File "${file.name}" was rejected: ${error.message}`;
        }
        
        toast({
          title: 'File Upload Error',
          description: message,
          variant: 'destructive',
        });
      });
    });

    // Validate accepted files with our custom validation
    const validFiles: File[] = [];
    const invalidFiles: { file: File; error: string }[] = [];

    acceptedFiles.forEach(file => {
      const validation = validateFile(file);
      if (validation.isValid) {
        validFiles.push(file);
      } else {
        invalidFiles.push({ file, error: validation.error || 'Unknown error' });
      }
    });

    // Show errors for invalid files
    invalidFiles.forEach(({ file, error }) => {
      toast({
        title: 'File Validation Error',
        description: `File "${file.name}": ${error}`,
        variant: 'destructive',
      });
    });

    // Check total file count
    if (uploadedFiles.length + validFiles.length > maxFiles) {
      toast({
        title: 'Too Many Files',
        description: `Maximum ${maxFiles} files allowed. Please remove some files first.`,
        variant: 'destructive',
      });
      return;
    }

    // Add valid files to uploaded files
    const newFiles: UploadedFile[] = validFiles.map(file => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
      status: 'pending',
      progress: 0
    }));

    setUploadedFiles(prev => [...prev, ...newFiles]);
    onFilesSelected(validFiles);
  }, [validateFile, maxFileSize, allowedFileTypes, maxFiles, uploadedFiles.length, onFilesSelected, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: accept ? { [accept]: [] } : undefined,
    multiple,
    maxFiles,
    maxSize: maxFileSize,
    disabled
  });

  const removeFile = (id: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== id));
  };

  const getFileIcon = (file: File) => {
    const type = file.type;
    if (type.startsWith('image/')) return <PhotoIcon className="h-4 w-4" />;
    if (type.startsWith('video/')) return <FilmIcon className="h-4 w-4" />;
    if (type.startsWith('audio/')) return <MusicalNoteIcon className="h-4 w-4" />;
    if (type.includes('zip') || type.includes('rar') || type.includes('tar')) return <ArchiveBoxIcon className="h-4 w-4" />;
    return <DocumentTextIcon className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Upload Area */}
      <Card className={cn(
        'border-2 border-dashed transition-colors cursor-pointer',
        isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25',
        disabled && 'opacity-50 cursor-not-allowed'
      )}>
        <CardContent className="p-6">
          <div {...getRootProps()} className="text-center space-y-4">
            <input {...getInputProps()} />
            <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center">
              <ArrowUpTrayIcon className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {isDragActive ? 'Drop files here' : 'Drag & drop files here, or click to select'}
              </p>
              <p className="text-xs text-muted-foreground">
                Maximum {maxFiles} files, up to {formatFileSize(maxFileSize)} each
              </p>
              {allowedFileTypes.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Allowed types: {allowedFileTypes.join(', ')}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* File List */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Uploaded Files ({uploadedFiles.length}/{maxFiles})</h4>
          <div className="space-y-2">
            {uploadedFiles.map((uploadedFile) => (
              <Card key={uploadedFile.id} className="p-3">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    {getFileIcon(uploadedFile.file)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium truncate">
                        {uploadedFile.file.name}
                      </p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {formatFileSize(uploadedFile.file.size)}
                        </Badge>
                        {uploadedFile.status === 'success' && (
                          <CheckCircleIcon className="h-4 w-4 text-green-500" />
                        )}
                        {uploadedFile.status === 'error' && (
                          <ExclamationTriangleIcon className="h-4 w-4 text-amber-500" />
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(uploadedFile.id)}
                          className="h-6 w-6 p-0"
                        >
                          <XMarkIcon className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    
                    {uploadedFile.status === 'uploading' && (
                      <div className="mt-2">
                        <Progress value={uploadedFile.progress} className="h-1" />
                        <p className="text-xs text-muted-foreground mt-1">
                          Uploading... {uploadedFile.progress}%
                        </p>
                      </div>
                    )}
                    
                    {uploadedFile.status === 'error' && uploadedFile.error && (
                      <p className="text-xs text-red-500 mt-1">
                        {uploadedFile.error}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Upload Limits Info */}
      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <div className="space-y-2">
            <h5 className="text-sm font-medium">Upload Limits</h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div>Max file size: {formatFileSize(maxFileSize)}</div>
              <div>Max files: {maxFiles}</div>
              {allowedFileTypes.length > 0 && (
                <div className="sm:col-span-2">
                  Allowed types: {allowedFileTypes.join(', ')}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Simple file upload button for single files
export function FileUploadButton({
  onFileSelected,
  accept,
  disabled = false,
  children = 'Upload File'
}: {
  onFileSelected: (file: File) => void;
  accept?: string;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  const { validateFile } = useFileUploadLimits();
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validation = validateFile(file);
    if (!validation.isValid) {
      toast({
        title: 'File Validation Error',
        description: validation.error,
        variant: 'destructive',
      });
      return;
    }

    onFileSelected(file);
  };

  return (
    <div>
      <input
        type="file"
        accept={accept}
        onChange={handleFileChange}
        disabled={disabled}
        className="hidden"
        id="file-upload-button"
      />
      <label htmlFor="file-upload-button">
        <Button asChild disabled={disabled}>
          <span className="cursor-pointer">
            <ArrowUpTrayIcon className="h-5 w-5 mr-2" />
            {children}
          </span>
        </Button>
      </label>
    </div>
  );
}