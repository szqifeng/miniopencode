/// <reference types="vite/client" />

declare global {
  interface Window {
    __MINIOPENCODE_DESKTOP__?: {
      apiBase?: string;
    };
  }
}

export {};
