import { defineConfig } from 'vite';
export default defineConfig({build:{rollupOptions:{input:{viewer:'index.html',classic:'classic.html',classicDisplay:'classic-display.html',host:'host.html',display:'display.html',story:'story.html'}}}});
