/**
 * IndexedDB storage engine for scanned document pages
 * Prevents mobile memory crashes and persists scans across sessions
 */

import { Point, FilterMode } from './imageProcessing';

export interface ScannedPage {
  id: string;
  pageNumber: number;
  blob: Blob;
  thumbnailUrl: string; // Object URL for quick UI carousel
  width: number;
  height: number;
  sizeBytes: number;
  timestamp: number;
  corners: Point[];
  filterMode: FilterMode;
  isFrontCover?: boolean;
  isBackCover?: boolean;
  rotation?: number; // 0, 90, 180, 270 degrees
}

const DB_NAME = 'SmartBookScannerDB';
const DB_VERSION = 1;
const STORE_NAME = 'scanned_pages';

class StorageService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB not supported in this browser'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('pageNumber', 'pageNumber', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  public async getAllPages(): Promise<ScannedPage[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const items = request.result as ScannedPage[];
        // Sort by pageNumber ascending
        items.sort((a, b) => a.pageNumber - b.pageNumber);
        // Regenerate object URLs
        const hydated = items.map((item) => ({
          ...item,
          thumbnailUrl: URL.createObjectURL(item.blob),
        }));
        resolve(hydated);
      };

      request.onerror = () => reject(request.error);
    });
  }

  public async addPage(page: Omit<ScannedPage, 'thumbnailUrl'>): Promise<ScannedPage> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const request = store.add(page);

      request.onsuccess = () => {
        const fullPage: ScannedPage = {
          ...page,
          thumbnailUrl: URL.createObjectURL(page.blob),
        };
        resolve(fullPage);
      };

      request.onerror = () => reject(request.error);
    });
  }

  public async updatePage(page: ScannedPage): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      // Remove temporary object URL before storing in IDB
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { thumbnailUrl, ...cleanPage } = page;
      const request = store.put(cleanPage);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  public async deletePage(id: string): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  public async clearAll(): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  public async reorderPages(pages: ScannedPage[]): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      pages.forEach((page, index) => {
        page.pageNumber = index + 1;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { thumbnailUrl, ...cleanPage } = page;
        store.put(cleanPage);
      });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }
}

export const storageService = new StorageService();
