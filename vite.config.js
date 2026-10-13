import {defineConfig} from 'vite';
export default defineConfig({resolve:{alias:{events:'events/',buffer:'buffer/',process:'process/browser'}},define:{global:'globalThis'},server:{proxy:{'/api':'http://127.0.0.1:8120'}},build:{target:'es2022',chunkSizeWarningLimit:1100}});
