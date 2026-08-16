// ---------------------------------------------------------------------------
// ESLint config — Backend (Node.js + Express, ESM)
// Milestone 10: CI/CD & Release Engineering — ใช้ตรวจจับ broken import / unused variable
// เท่านั้น ไม่ใช่ style enforcement ที่เข้มงวด (โปรเจกต์นี้ไม่มี Prettier บังคับใช้)
// ---------------------------------------------------------------------------
import js from '@eslint/js'
import globals from 'globals'

export default [
  {
    ignores: ['node_modules/**', 'prisma/migrations/**'],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
]
