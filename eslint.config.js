import antfu from '@antfu/eslint-config'
import jsdoc from 'eslint-plugin-jsdoc'

export default antfu({
  plugins: {
    jsdoc,
  },
  ignores: [
    'dist',
    'docs',
    '.github',
    '**/*.md',
    '**/*.MD',
    '**/*.markdown',
    '**/*.mdx',
    '**/LICENSE',
    '**/CHANGELOG.md',
    '**/README.md',
    '**/node_modules/**',
  ],
  jsx: false,
  typescript: true,
  formatters: {
    markdown: true,
  },
  rules: {
    'curly': ['error', 'multi-line'],
    'import/order': 0,
    'jsdoc/check-alignment': 'error',
    'jsdoc/check-line-alignment': 'error',
    'no-undef': 'error',
    'perfectionist/sort-exports': 'error',
    'perfectionist/sort-imports': 0,
    'perfectionist/sort-named-exports': 'error',
    'perfectionist/sort-named-imports': 'error',
    'sort-imports': 0,
    'style/brace-style': ['error', '1tbs', { allowSingleLine: true }],
    'style/quote-props': ['error', 'consistent-as-needed'],
    'test/no-only-tests': 'error',
    'unicorn/no-useless-spread': 'error',
    'max-statements-per-line': ['error', { max: 1 }],
    'unused-imports/no-unused-vars': ['error', {
      caughtErrors: 'none',
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
    }],
    'no-console': ['error', { allow: ['log', 'warn', 'error'] }],
    'no-new': 0, // Disable the no-new rule
    'new-cap': 0, // Disable the new-cap rule
  },
},
)
