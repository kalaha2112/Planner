'use client';

import { useEffect, useRef } from 'react';

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function useImageUpload(
  onImage: (dataUrl: string, fileName: string) => void,
  isActive: boolean,
) {
  const onImageRef = useRef(onImage);
  onImageRef.current = onImage;

  // Clipboard paste
  useEffect(() => {
    if (!isActive) return;
    const onPaste = async (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? []);
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            const url = await fileToDataUrl(file);
            onImageRef.current(url, file.name || 'pasted-image');
          }
        }
      }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [isActive]);

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    for (const file of files) {
      const url = await fileToDataUrl(file);
      onImageRef.current(url, file.name);
    }
    e.target.value = '';
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
    for (const file of files) {
      const url = await fileToDataUrl(file);
      onImageRef.current(url, file.name);
    }
  };

  return { handleFileInput, handleDrop };
}
