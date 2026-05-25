import path from "path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    strictPort: false, // เปลี่ยนเป็น false เพื่อให้รันพอร์ตอื่นอัตโนมัติถ้า 3000 ไม่ว่าง
  },
  preview: {
    port: 3000,
    strictPort: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: [
      "react",
      "react-dom"
    ],
  },
})