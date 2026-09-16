/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_POKEWALLET_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*?url" {
  const src: string;
  export default src;
}

declare module "@sqlite.org/sqlite-wasm" {
  import type {
    Database,
    OpfsDatabase,
  } from "@sqlite.org/sqlite-wasm/dist/index.d.mts";

  export interface Sqlite3 {
    capi: Record<string, unknown>;
    oo1: {
      DB: typeof Database;
      OpfsDb?: typeof OpfsDatabase;
    };
    version: {
      libVersion: string;
      libVersionNumber: number;
    };
    opfs?: unknown;
  }

  export interface InitOptions {
    locateFile?: (file: string, prefix?: string) => string;
    print?: (...args: unknown[]) => void;
    printErr?: (...args: unknown[]) => void;
    [key: string]: unknown;
  }

  export default function sqlite3InitModule(
    options?: InitOptions,
  ): Promise<Sqlite3>;
}
