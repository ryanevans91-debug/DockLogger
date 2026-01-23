import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import type { SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';

const DB_NAME = 'docklogger';

class DatabaseService {
  private sqlite: SQLiteConnection;
  private db: SQLiteDBConnection | null = null;
  private platform: string;
  private initialized = false;

  constructor() {
    this.sqlite = new SQLiteConnection(CapacitorSQLite);
    this.platform = Capacitor.getPlatform();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // For web platform, initialize web store
      if (this.platform === 'web') {
        await this.sqlite.initWebStore();
      }

      // Check if connection exists, if so retrieve it
      const ret = await this.sqlite.checkConnectionsConsistency();
      const isConn = (await this.sqlite.isConnection(DB_NAME, false)).result;

      if (ret.result && isConn) {
        this.db = await this.sqlite.retrieveConnection(DB_NAME, false);
      } else {
        this.db = await this.sqlite.createConnection(
          DB_NAME,
          false,
          'no-encryption',
          1,
          false
        );
      }

      await this.db.open();
      this.initialized = true;
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Database initialization error:', error);
      throw error;
    }
  }

  async getDb(): Promise<SQLiteDBConnection> {
    if (!this.db || !this.initialized) {
      await this.initialize();
    }
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  async execute(statement: string): Promise<void> {
    const db = await this.getDb();
    await db.execute(statement);

    // Persist to IndexedDB on web platform
    if (this.platform === 'web') {
      await this.sqlite.saveToStore(DB_NAME);
    }
  }

  async run(statement: string, values?: unknown[]): Promise<{ changes: number; lastId: number }> {
    const db = await this.getDb();
    const result = await db.run(statement, values);

    // Persist to IndexedDB on web platform
    if (this.platform === 'web') {
      await this.sqlite.saveToStore(DB_NAME);
    }

    return {
      changes: result.changes?.changes || 0,
      lastId: result.changes?.lastId || 0
    };
  }

  async query<T = unknown>(statement: string, values?: unknown[]): Promise<T[]> {
    const db = await this.getDb();
    const result = await db.query(statement, values);
    return (result.values || []) as T[];
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.sqlite.closeConnection(DB_NAME, false);
      this.db = null;
      this.initialized = false;
    }
  }

  // Save to IndexedDB for web platform
  async saveToStore(): Promise<void> {
    if (this.platform === 'web') {
      await this.sqlite.saveToStore(DB_NAME);
    }
  }
}

// Singleton instance
export const database = new DatabaseService();
