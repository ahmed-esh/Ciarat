import { defineConfig } from 'vite';

export default defineConfig({
    server: {
        port: 3000,
    },
    resolve: {
        alias: {
            'three': '/node_modules/three/build/three.module.js',
        }
    }
}); 