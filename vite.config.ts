import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [inspectAttr(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 1000, // Увеличиваем лимит до 1MB
    rollupOptions: {
      output: {
        manualChunks: {
          // Разделяем библиотеки на отдельные чанки
          'vendor-react': ['react', 'react-dom'],
          'vendor-pdf': ['jspdf', 'jspdf-autotable'],
          'vendor-charts': ['recharts'],
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-select', '@radix-ui/react-tabs'],
        }
      }
    }
  }
});
