// ---------------------------------------------------------------------------
// ESLint config — Frontend (React + Vite)
// Milestone 10: CI/CD & Release Engineering — ใช้ตรวจจับ broken import / unused variable /
// React hooks rule violation เท่านั้น ไม่ใช่ style enforcement ที่เข้มงวด
// ---------------------------------------------------------------------------
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  { ignores: ['dist/**'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      // ใช้เฉพาะ 2 rule คลาสสิกของ react-hooks (rules-of-hooks + exhaustive-deps) ไม่ใช้
      // reactHooks.configs.recommended ทั้งชุด — เวอร์ชัน 7+ รวม rule ชุดใหม่แบบ "React Compiler"
      // (เช่น set-state-in-effect, immutability) ที่จะ flag pattern ปกติที่ใช้อยู่ทั่วโปรเจกต์นี้
      // (เช่น setPage(1) ใน useEffect ตอนรีเซ็ตหน้า) เปลี่ยนตามนั้นจะกลายเป็นการแก้ business logic
      // ซึ่งอยู่นอกขอบเขตของ Milestone 10 (เอกสารระบุชัดว่า "DO NOT change business logic")
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
]
