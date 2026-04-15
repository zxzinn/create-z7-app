import antfu from '@antfu/eslint-config'

export default antfu({
  react: true,
  typescript: true,
  formatters: true,
  stylistic: {
    indent: 2,
    quotes: 'single',
    semi: false,
  },
  ignores: [
    '**/node_modules/**',
    '**/dist/**',
    '**/packages/db/migrations/**',
    '**/routeTree.gen.ts',
  ],
  rules: {
    'node/prefer-global/process': 'off',
    'react-refresh/only-export-components': ['warn', { allowExportNames: ['Route'] }],
  },
})
