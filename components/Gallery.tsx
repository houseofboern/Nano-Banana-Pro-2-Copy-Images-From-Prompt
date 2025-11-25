import React, { useState } from 'react';
import { GeneratedImage, Character } from '../types';
import { Download, Trash2, Clock, Loader2, AlertCircle, X } from 'lucide-react';

interface GalleryProps {
  images: GeneratedImage[];
  characters: Character[];
  onClear: () => void;
  onDeleteOne: (id: string) => void;
}

export const Gallery: React.FC<GalleryProps> = ({ images, characters, onClear, onDeleteOne }) => {
  const [previewImage, setPreviewImage] = useState<GeneratedImage | null>(null);
  
  const getCharacterName = (charId: string) => {
    return characters.find(c => c.id === charId)?.name || 'Unknown';
  };

  const handleDownload = (img: GeneratedImage) => {
    if (!img.imageData) return;
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${img.imageData}`;
    link.download = `personamorph-${img.id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (images.length === 0) {
    return (
      <div className="mt-12 pt-8 border-t border-gray-700 text-center text-gray-500">
        <p>No images in queue or library.</p>
      </div>
    );
  }

  return (
    <>
      <div className="mt-12 border-t border-gray-700 pt-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Clock size={24} className="text-primary" />
            Queue & Library
          </h2>
          <button
            onClick={onClear}
            className="text-red-400 hover:text-red-300 text-sm flex items-center gap-1 px-3 py-1 rounded hover:bg-red-900/20 transition-colors"
          >
            <Trash2 size={14} /> Clear All
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {images.map((img) => (
            <div 
              key={img.id} 
              className={`
                bg-surface rounded-lg overflow-hidden border border-gray-700 group shadow-lg flex flex-col h-full
                ${img.status === 'completed' ? 'cursor-zoom-in' : ''}
              `}
              onClick={() => {
                if (img.status === 'completed' && img.imageData) {
                  setPreviewImage(img);
                }
              }}
            >
              <div className="aspect-square relative overflow-hidden bg-black flex items-center justify-center">
                
                {/* STATUS: PROCESSING */}
                {img.status === 'processing' && (
                  <div className="flex flex-col items-center justify-center p-4 text-center space-y-3">
                    <Loader2 className="animate-spin text-primary" size={32} />
                    <div>
                      <p className="text-sm text-white font-medium">Generating...</p>
                      <p className="text-xs text-gray-500 mt-1 max-w-[150px]">
                        This may take a few minutes for high quality.
                      </p>
                    </div>
                  </div>
                )}

                {/* STATUS: FAILED */}
                {img.status === 'failed' && (
                  <div className="flex flex-col items-center justify-center p-4 text-center space-y-2 text-red-400">
                    <AlertCircle size={32} />
                    <p className="text-xs">Failed</p>
                    <p className="text-[10px] text-red-500/70 max-w-[150px] truncate">{img.errorMessage}</p>
                  </div>
                )}

                {/* STATUS: COMPLETED */}
                {img.status === 'completed' && img.imageData && (
                  <>
                    <img
                      src={`data:image/png;base64,${img.imageData}`}
                      alt="Generated"
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                       <div className="flex justify-between items-end">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(img);
                            }}
                            className="text-white hover:text-primary transition-colors"
                            title="Download"
                          >
                            <Download size={20} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteOne(img.id);
                            }}
                            className="text-white hover:text-red-400 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={20} />
                          </button>
                       </div>
                    </div>
                  </>
                )}

                {/* DELETE BUTTON FOR NON-COMPLETED */}
                {img.status !== 'completed' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteOne(img.id);
                    }}
                    className="absolute top-2 right-2 p-1 text-gray-500 hover:text-red-400 bg-black/50 rounded-full z-20"
                    title="Remove"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <div className="p-3 mt-auto bg-surface z-10">
                <p className="text-sm font-semibold text-white truncate">
                  {getCharacterName(img.characterId)}
                </p>
                <div className="flex justify-between items-center mt-1">
                   <p className="text-xs text-gray-500 truncate">
                    {new Date(img.createdAt).toLocaleTimeString()}
                  </p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                    img.status === 'completed' ? 'bg-green-900/30 text-green-400' :
                    img.status === 'failed' ? 'bg-red-900/30 text-red-400' :
                    'bg-yellow-900/30 text-yellow-400'
                  }`}>
                    {img.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Full Screen Image Modal */}
      {previewImage && previewImage.imageData && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 animate-in fade-in duration-200 cursor-zoom-out"
          onClick={() => setPreviewImage(null)}
        >
          <img 
            src={`data:image/png;base64,${previewImage.imageData}`} 
            alt="Full size" 
            className="max-w-full max-h-full object-contain rounded shadow-2xl"
          />
          <button className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors bg-black/20 p-2 rounded-full backdrop-blur-sm">
            <X size={32} />
          </button>
        </div>
      )}
    </>
  );
};