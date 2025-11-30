
import React, { useState, useEffect } from 'react';
import { Character } from '../types';
import { Plus, X, Save, Upload, User, Loader2, Edit } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { resizeImage } from '../utils/image';

interface CharacterFormProps {
  initialData?: Character | null;
  onSave: (char: Character) => void;
  onCancel: () => void;
}

export const CharacterForm: React.FC<CharacterFormProps> = ({ initialData, onSave, onCancel }) => {
  const [name, setName] = useState(initialData?.name || '');
  const [hairColor, setHairColor] = useState(initialData?.hairColor || '');
  const [eyeColor, setEyeColor] = useState(initialData?.eyeColor || '');
  const [skinColor, setSkinColor] = useState(initialData?.skinColor || '');
  const [avatar, setAvatar] = useState<string | null>(initialData?.avatarImage || null);
  
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const cleanName = name.trim();
    const cleanHair = hairColor.trim();
    const cleanEye = eyeColor.trim();
    const cleanSkin = skinColor.trim();

    if (!cleanName || !cleanHair || !cleanEye || !cleanSkin) return;

    onSave({
      id: initialData?.id || uuidv4(),
      name: cleanName,
      hairColor: cleanHair,
      eyeColor: cleanEye,
      skinColor: cleanSkin,
      avatarImage: avatar || undefined
    });
  };

  const processFile = async (file: File) => {
    try {
      setIsProcessingImage(true);
      const resizedBase64 = await resizeImage(file);
      setAvatar(resizedBase64);
    } catch (err) {
      console.error("Failed to process image", err);
      alert("Failed to process image. Please try another one.");
    } finally {
      setIsProcessingImage(false);
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
    <div className="bg-surface p-6 rounded-lg border border-gray-700 shadow-xl mb-6 max-h-[90vh] overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          {initialData ? <Edit size={20} className="text-primary" /> : <Plus size={20} className="text-primary" />}
          {initialData ? 'Edit Character' : 'New Character'}
        </h3>
        <button onClick={onCancel} className="text-gray-400 hover:text-white">
          <X size={20} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex justify-center mb-6">
          <label 
            className={`
              relative cursor-pointer group 
              ${isProcessingImage ? 'pointer-events-none' : ''}
            `}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <div className={`
              w-24 h-24 rounded-full border-2 border-dashed flex items-center justify-center overflow-hidden transition-all duration-200
              ${isDragging ? 'border-primary bg-primary/20 scale-105' : ''}
              ${avatar && !isDragging ? 'border-primary' : 'border-gray-500 hover:border-gray-300'}
            `}>
              {isProcessingImage ? (
                <Loader2 className="animate-spin text-primary" size={24} />
              ) : avatar ? (
                <img src={`data:image/jpeg;base64,${avatar}`} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User size={32} className="text-gray-500" />
              )}
              
              {!isProcessingImage && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                  <Upload size={20} className="text-white" />
                </div>
              )}
            </div>
            <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} disabled={isProcessingImage} />
            <p className="text-xs text-center text-gray-400 mt-2">
              {isDragging ? 'Drop Image' : 'Upload or Drop'}
            </p>
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-background border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-primary"
            placeholder="e.g. Sarah"
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Hair Color</label>
            <input
              type="text"
              value={hairColor}
              onChange={(e) => setHairColor(e.target.value)}
              className="w-full bg-background border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-primary"
              placeholder="e.g. Chestnut Brown"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Eye Color</label>
            <input
              type="text"
              value={eyeColor}
              onChange={(e) => setEyeColor(e.target.value)}
              className="w-full bg-background border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-primary"
              placeholder="e.g. Emerald Green"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Skin Color</label>
            <input
              type="text"
              value={skinColor}
              onChange={(e) => setSkinColor(e.target.value)}
              className="w-full bg-background border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-primary"
              placeholder="e.g. Porcelain"
              required
            />
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={isProcessingImage}
            className="bg-primary hover:bg-indigo-500 text-white px-6 py-2 rounded font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={18} />
            {initialData ? 'Update Character' : 'Save Character'}
          </button>
        </div>
      </form>
    </div>
  );
};
