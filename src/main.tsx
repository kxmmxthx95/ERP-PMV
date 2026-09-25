import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'

// ปลด V8 default (10 frame) เพื่อให้ crash report ในโปรดักชันได้ stack เต็ม — ช่วย decode ผ่าน hidden sourcemap
Error.stackTraceLimit = Infinity;

// สร้าง QueryClient สำหรับจัดการ Cache ข้อมูล
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // เก็บแคชไว้ 5 นาที
      retry: 1, // ลองใหม่ 1 ครั้งหากพลาด
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
