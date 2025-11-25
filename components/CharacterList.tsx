import React from 'react';
import { Character } from '../types';
import { User, Trash2 } from 'lucide-react';

interface CharacterListProps {
  characters: Character[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export const CharacterList: React.FC<CharacterListProps> = ({ characters, selectedId, onSelect, onDelete }) => {
  if (characters.length === 0) {
    return (
      <div className="text-gray-400 text-sm text-center py-8 italic">
        No characters yet. Create one above!
      </div>
    );
  }

  return (
    <div className="space-y-2 mt-4 max-h-[400px] overflow-y-auto">
      {characters.map((char) => (
        <div
          key={char.id}
          className={`
            group relative p-3 rounded-md cursor-pointer border transition-all
            ${selectedId === char.id 
              ? 'bg-primary/20 border-primary' 
              : 'bg-surface border-gray-700 hover:border-gray-500'}
          `}
          onClick={() => onSelect(char.id)}
        >
          <div className="flex items-center gap-3">
            <div className={`
              w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold overflow-hidden border border-gray-600 flex-shrink-0
              ${selectedId === char.id ? 'border-primary' : ''}
              ${!char.avatarImage ? 'bg-gray-700 text-gray-300' : 'bg-black'}
            `}>
              {char.avatarImage ? (
                <img src={`data:image/png;base64,${char.avatarImage}`} alt={char.name} className="w-full h-full object-cover" />
              ) : (
                char.name.charAt(0).toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <h4 className="font-medium text-white truncate">{char.name}</h4>
              <p className="text-xs text-gray-400 truncate">
                {char.hairColor} • {char.eyeColor}
              </p>
            </div>
          </div>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(char.id);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity bg-surface/80 rounded-full"
            title="Delete Character"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
    </div>
  );
};