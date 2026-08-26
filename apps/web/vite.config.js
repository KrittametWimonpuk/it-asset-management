import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import process from 'node:process'

// ---------------------------------------------------------------------------
// ตั้งค่า Vite (เครื่องมือ dev + build ของ frontend)
//
// โหมด cloudflare โหลด apps/web/.env.cloudflare และบังคับให้ API URL เป็น absolute HTTPS URL
// เพื่อป้องกัน production bundle ยิง /api กลับเข้า Cloudflare Pages โดยไม่ตั้งใจ
// ---------------------------------------------------------------------------
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const apiUrl = process.env.VITE_API_URL || env.VITE_API_URL

  if (mode === 'cloudflare') {
    let parsedUrl
    try {
      parsedUrl = new URL(apiUrl)
    } catch {
      throw new Error('Cloudflare build requires a valid absolute VITE_API_URL')
    }
    if (parsedUrl.protocol !== 'https:') {
      throw new Error('Cloudflare build requires VITE_API_URL to use HTTPS')
    }
  }

  return {
    plugins: [react()],
    server: {
      port: 5173,
    },
  }
})
