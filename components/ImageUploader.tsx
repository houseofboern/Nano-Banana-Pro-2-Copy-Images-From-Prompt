
import React, { useState } from 'react';
import { Upload, Clipboard, Loader2 } from 'lucide-react';
import { resizeImage } from '../utils/image';

interface ImageUploaderProps {
  onImageSelect: (base64: string | null) => void;
  selectedImage: string | null;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageSelect, selectedImage }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const processFile = async (file: File) => {
    try {
      setIsProcessing(true);
      const resized = await resizeImage(file);
      onImageSelect(resized);
    } catch (err) {
      console.error("Error processing image:", err);
      alert("Failed to process image. Please try another.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
        processFile(file);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <h3 className="text-gray-300 font-semibold mb-2 flex items-center gap-2">
        <Upload size={18} /> Source Image
      </h3>
      
      {isProcessing ? (
        <div className="flex-1 border-2 border-dashed border-gray-600 rounded-lg flex flex-col items-center justify-center p-8 bg-surface">
            <Loader2 className="animate-spin text-primary mb-2" size={32} />
            <p className="text-gray-400 text-sm">Optimizing image...</p>
        </div>
      ) : selectedImage ? (
        <div 
          onClick={() => onImageSelect(null)}
          className="relative flex-1 bg-black rounded-lg overflow-hidden border border-gray-700 flex items-center justify-center group cursor-pointer hover:border-red-500/50 transition-colors"
          title="Click anywhere to remove image"
        >
          <img 
            src={`data:image/jpeg;base64,${selectedImage}`} 
            alt="Source" 
            className="max-w-full max-h-[400px] object-contain" 
          />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
            <span className="text-white font-bold bg-black/60 px-4 py-2 rounded-full border border-white/20 backdrop-blur-sm">
              Click to Remove
            </span>
          </div>
        </div>
      ) : (
        <div 
          className={`
            flex-1 border-2 border-dashed rounded-lg flex flex-col items-center justify-center p-8 transition-colors
            ${isDragging ? 'border-primary bg-primary/10' : 'border-gray-600 hover:border-gray-400 bg-surface'}
          `}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mb-4 text-gray-400">
            <Clipboard size={32} />
          </div>
          <p className="text-gray-300 font-medium mb-1">Paste image (Ctrl+V)</p>
          <p className="text-gray-500 text-sm mb-4">or drag and drop here</p>
          
          <label className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded cursor-pointer transition-colors text-sm">
            Browse Files
            <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
          </label>
        </div>
      )}
    </div>
  );
};
