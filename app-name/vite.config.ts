import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

import cesium from 'vite-plugin-cesium';
export default defineConfig({
  plugins: [cesium(),vue()]
});

