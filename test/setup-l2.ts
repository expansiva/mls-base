import { installMlsStub } from './mlsStub.js';

if (typeof globalThis.document === 'undefined') {
  (globalThis as typeof globalThis & { document: { documentElement: { lang: string } } }).document = {
    documentElement: { lang: 'en' },
  };
}

installMlsStub();