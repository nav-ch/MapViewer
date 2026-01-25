import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, 'src/main.js'),
            name: 'MapViewer',
            fileName: 'map-viewer',
            formats: ['umd', 'es']
        },
        rollupOptions: {
            // Ensure we don't bundle external dependencies if we want to keep it light
            // But for a plugin, it's often better to bundle everything
            external: [],
            output: {
                globals: {}
            }
        }
    }
});
