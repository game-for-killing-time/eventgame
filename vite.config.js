import { defineConfig } from 'vite';
export default defineConfig({build:{rollupOptions:{input:{viewer:'index.html',host:'host.html',display:'display.html'}}}});
