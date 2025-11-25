import { Character, GeneratedImage } from '../types';

const DB_NAME = 'PersonaMorphDB';
const DB_VERSION = 1;
const STORE_CHARACTERS = 'characters';
const STORE_IMAGES = 'images';

export class DBService {
  private dbPromise: Promise<IDBDatabase>;

  constructor() {
    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_CHARACTERS)) {
          db.createObjectStore(STORE_CHARACTERS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_IMAGES)) {
          db.createObjectStore(STORE_IMAGES, { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        resolve((event.target as IDBOpenDBRequest).result);
      };

      request.onerror = (event) => {
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
  }

  async getAllCharacters(): Promise<Character[]> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_CHARACTERS, 'readonly');
      const store = transaction.objectStore(STORE_CHARACTERS);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveCharacter(character: Character): Promise<void> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_CHARACTERS, 'readwrite');
      const store = transaction.objectStore(STORE_CHARACTERS);
      const request = store.put(character);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteCharacter(id: string): Promise<void> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_CHARACTERS, 'readwrite');
      const store = transaction.objectStore(STORE_CHARACTERS);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAllImages(): Promise<GeneratedImage[]> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_IMAGES, 'readonly');
      const store = transaction.objectStore(STORE_IMAGES);
      const request = store.getAll();
      request.onsuccess = () => {
        // Sort by createdAt desc
        const sorted = (request.result as GeneratedImage[]).sort((a, b) => b.createdAt - a.createdAt);
        resolve(sorted);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveImage(image: GeneratedImage): Promise<void> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_IMAGES, 'readwrite');
      const store = transaction.objectStore(STORE_IMAGES);
      const request = store.put(image);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteImage(id: string): Promise<void> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_IMAGES, 'readwrite');
      const store = transaction.objectStore(STORE_IMAGES);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clearAllImages(): Promise<void> {
     const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_IMAGES, 'readwrite');
      const store = transaction.objectStore(STORE_IMAGES);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Run on app load to fail any jobs that were stuck in 'processing' 
   * state when the app was closed/refreshed.
   */
  async cleanupStuckJobs(): Promise<void> {
    const images = await this.getAllImages();
    const stuckJobs = images.filter(img => img.status === 'processing');
    
    for (const job of stuckJobs) {
      await this.saveImage({
        ...job,
        status: 'failed',
        errorMessage: 'Interrupted by page reload'
      });
    }
  }
}

export const db = new DBService();