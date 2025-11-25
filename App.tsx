
import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Character, GeneratedImage } from './types';
import { db } from './services/db';
import { createCharacterPrompt, generateCharacterImage } from './services/geminiService';
import { CharacterForm } from './components/CharacterForm';
import { CharacterList } from './components/CharacterList';
import { ImageUploader } from './components/ImageUploader';
import { Gallery } from './components/Gallery';
import { ConfirmDialog } from './components/ConfirmDialog';
import { Plus, Sparkles, ArrowRight } from 'lucide-react';
import { resizeImage } from './utils/image';

// Declaration for window.aistudio
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  
  interface Window {
    aistudio?: AIStudio;
  }
}

const App: React.FC = () => {
  const [hasApiKey, setHasApiKey] = useState(false);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [isCreatingChar, setIsCreatingChar] = useState(false);
  
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);

  // State for Clear Confirmation Dialog
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);

  useEffect(() => {
    // Check for API Key on mount
    const checkKey = async () => {
      if (window.aistudio) {
        const has = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(has);
      } else {
        // Fallback for dev environments without aistudio namespace
        setHasApiKey(true);
      }
    };
    checkKey();

    // Load data from IndexedDB
    const loadData = async () => {
      try {
        await db.cleanupStuckJobs(); // Fix stuck processing items
        
        const chars = await db.getAllCharacters();
        setCharacters(chars);
        if (chars.length > 0) setSelectedCharacterId(chars[0].id);

        const imgs = await db.getAllImages();
        setGeneratedImages(imgs);
      } catch (err) {
        console.error("Failed to load initial data", err);
      }
    };
    loadData();
  }, []);

  // Global Paste Listener
  useEffect(() => {
    const handleGlobalPaste = async (e: ClipboardEvent) => {
      // Ignore if pasting into an input or textarea
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA'].includes(target.tagName)) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (file) {
            try {
              // Resize pasted image immediately
              const resized = await resizeImage(file);
              setSourceImage(resized);
            } catch (err) {
              console.error("Failed to process pasted image", err);
            }
            // We found our image, stop checking other items
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      // Assume success to mitigate race condition
      setHasApiKey(true);
    }
  };

  const handleSaveCharacter = async (newChar: Character) => {
    await db.saveCharacter(newChar);
    setCharacters(prev => [...prev, newChar]);
    setSelectedCharacterId(newChar.id);
    setIsCreatingChar(false);
  };

  const handleDeleteCharacter = async (id: string) => {
    await db.deleteCharacter(id);
    setCharacters(prev => prev.filter(c => c.id !== id));
    if (selectedCharacterId === id) setSelectedCharacterId(null);
  };

  /**
   * Fires off a background job for generation.
   * Does not await the result, allowing the UI to remain responsive.
   */
  const handleGenerate = async () => {
    if (!sourceImage || !selectedCharacterId) return;
    
    const character = characters.find(c => c.id === selectedCharacterId);
    if (!character) return;

    // Create a new job entry
    const newJobId = uuidv4();
    const newJob: GeneratedImage = {
      id: newJobId,
      characterId: character.id,
      prompt: "Pending analysis...",
      createdAt: Date.now(),
      status: 'processing'
    };

    // Add to UI immediately
    setGeneratedImages(prev => [newJob, ...prev]);
    await db.saveImage(newJob);

    // Start background processing
    processJob(newJobId, sourceImage, character);
  };

  /**
   * Background processor for a specific job
   */
  const processJob = async (jobId: string, srcImg: string, char: Character) => {
    try {
      // Step 1: Analyze
      const prompt = await createCharacterPrompt(srcImg, char);
      
      if (!prompt) {
        throw new Error("Analysis failed: No description generated.");
      }

      // Step 2: Generate
      // Pass the character's avatar image if available for reference
      const resultImage = await generateCharacterImage(prompt, char.avatarImage);
      
      // Success update
      const updatedJob: GeneratedImage = {
        id: jobId,
        characterId: char.id,
        imageData: resultImage,
        prompt: prompt,
        createdAt: Date.now(),
        status: 'completed'
      };
      
      await db.saveImage(updatedJob);
      setGeneratedImages(prev => prev.map(img => img.id === jobId ? updatedJob : img));

    } catch (error) {
      console.error(`Job ${jobId} failed with error:`, error);
      
      // Failure update
      const failedJob: GeneratedImage = {
        id: jobId,
        characterId: char.id,
        prompt: "Failed",
        createdAt: Date.now(),
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : "Unknown error"
      };
      
      await db.saveImage(failedJob);
      setGeneratedImages(prev => prev.map(img => img.id === jobId ? failedJob : img));
    }
  };

  // Trigger the clear dialog
  const handleClearGalleryRequest = () => {
    setIsClearDialogOpen(true);
  };

  // Actually perform the clear
  const performClearGallery = async () => {
    await db.clearAllImages();
    setGeneratedImages([]);
    setIsClearDialogOpen(false);
  };

  const handleDeleteOneImage = async (id: string) => {
      await db.deleteImage(id);
      setGeneratedImages(prev => prev.filter(img => img.id !== id));
  };

  // API Key Selection Screen
  if (!hasApiKey) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center">
        <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20 mb-6">
          <Sparkles className="text-white" size={32} />
        </div>
        <h1 className="text-3xl font-bold text-white mb-4">Welcome to PersonaMorph</h1>
        <p className="text-gray-400 max-w-md mb-8">
          To generate high-quality characters using Gemini 3 Pro (Nano Banana Pro), you need to select a billing-enabled API key.
        </p>
        <button 
          onClick={handleSelectKey}
          className="bg-primary hover:bg-indigo-500 text-white px-8 py-3 rounded-full font-bold transition-all hover:scale-105"
        >
          Connect API Key
        </button>
        <p className="mt-6 text-xs text-gray-500">
          Check <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="underline hover:text-gray-300">billing documentation</a> for details.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-white font-sans p-4 md:p-8">
      <header className="max-w-7xl mx-auto mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
                <Sparkles className="text-white" size={24} />
            </div>
            <div>
                <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">PersonaMorph</h1>
                <p className="text-xs text-gray-500">Character Consistency Tool powered by Gemini</p>
            </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT PANEL: Character Management */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-200">Characters</h2>
            <button
              onClick={() => setIsCreatingChar(true)}
              className="p-2 bg-gray-800 hover:bg-gray-700 rounded-full transition-colors"
              title="Add Character"
            >
              <Plus size={18} />
            </button>
          </div>

          {isCreatingChar && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                <div className="w-full max-w-md">
                    <CharacterForm onSave={handleSaveCharacter} onCancel={() => setIsCreatingChar(false)} />
                </div>
            </div>
          )}

          <CharacterList
            characters={characters}
            selectedId={selectedCharacterId}
            onSelect={setSelectedCharacterId}
            onDelete={handleDeleteCharacter}
          />
        </div>

        {/* CENTER/RIGHT PANEL: Workspace */}
        <div className="lg:col-span-9">
          
          <div className="bg-surface rounded-xl p-6 border border-gray-700 shadow-xl">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                 {/* SOURCE INPUT */}
                 <div className="h-[400px]">
                     <ImageUploader 
                        onImageSelect={setSourceImage} 
                        selectedImage={sourceImage} 
                      />
                 </div>

                 {/* ACTION AREA */}
                 <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
                    <div>
                        <h3 className="text-xl font-bold text-white mb-2">Ready to Morph</h3>
                        <p className="text-gray-400 text-sm max-w-xs mx-auto">
                           {selectedCharacterId 
                             ? `Selected Character: ${characters.find(c => c.id === selectedCharacterId)?.name}` 
                             : "Please select a character from the sidebar"}
                        </p>
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={!sourceImage || !selectedCharacterId}
                        className={`
                            flex items-center gap-3 px-8 py-4 rounded-full font-bold text-lg shadow-2xl transition-all transform
                            ${(!sourceImage || !selectedCharacterId)
                            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                            : 'bg-gradient-to-r from-primary to-indigo-600 text-white hover:scale-105 hover:shadow-primary/50 active:scale-95'
                            }
                        `}
                        >
                        Generate <ArrowRight size={20} />
                    </button>
                    
                    <div className="bg-black/30 p-4 rounded-lg text-xs text-gray-500 text-left w-full max-w-xs">
                        <p className="font-semibold text-gray-400 mb-1">Workflow:</p>
                        <ol className="list-decimal pl-4 space-y-1">
                            <li>Gemini Flash analyzes pose & expression.</li>
                            <li>Character traits & reference photo applied.</li>
                            <li>Nano Banana Pro generates final image.</li>
                        </ol>
                    </div>
                 </div>
             </div>
          </div>

          <Gallery 
            images={generatedImages} 
            characters={characters}
            onClear={handleClearGalleryRequest}
            onDeleteOne={handleDeleteOneImage}
          />
        </div>
      </main>

      <ConfirmDialog 
        isOpen={isClearDialogOpen}
        title="Clear Library"
        message="Are you sure you want to delete all generated images? This action cannot be undone."
        onConfirm={performClearGallery}
        onCancel={() => setIsClearDialogOpen(false)}
      />
    </div>
  );
};

export default App;
