import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()], build: { rollupOptions: { output: { manualChunks: { map: ['leaflet','react-leaflet'], validation: ['zod'] } } } }, test: { environment: 'node' } });
