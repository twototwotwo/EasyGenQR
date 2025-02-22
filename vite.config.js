import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync } from 'fs';

function copyAssets() {
  return {
    name: 'copy-assets',
    closeBundle() {
      try {
        // 确保目标目录存在
        mkdirSync('dist/icons', { recursive: true });
        mkdirSync('dist/popup', { recursive: true });
        
        // 复制 manifest.json
        copyFileSync('src/manifest.json', 'dist/manifest.json');
        
        // 复制图标文件
        copyFileSync('src/icons/icon16.svg', 'dist/icons/icon16.svg');
        copyFileSync('src/icons/icon48.svg', 'dist/icons/icon48.svg');
        copyFileSync('src/icons/icon128.svg', 'dist/icons/icon128.svg');

        // 复制样式文件
        copyFileSync('src/popup/style.css', 'dist/popup/style.css');

        // 复制 HTML 文件
        copyFileSync('src/popup/index.html', 'dist/popup/index.html');

        console.log('Assets copied successfully!');
      } catch (err) {
        console.error('Error copying files:', err);
        throw err;
      }
    }
  };
}

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background/index.js'),
        'popup/popup': resolve(__dirname, 'src/popup/popup.js')
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].[hash].js',
        assetFileNames: (assetInfo) => {
          // 将 CSS 文件放在 popup 目录下
          if (assetInfo.name.endsWith('.css')) {
            return 'popup/[name].[ext]';
          }
          return 'assets/[name].[ext]';
        }
      }
    }
  },
  plugins: [copyAssets()]
}); 