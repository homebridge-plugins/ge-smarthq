module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
  ],
  plugins: ['@typescript-eslint'],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  env: {
    node: true,
    es6: true,
  },
  rules: {
    'quotes': ['warn', 'single'],
    'indent': ['warn', 2, { 'SwitchCase': 1 }],
    'linebreak-style': ['warn', 'unix'],
    'semi': ['warn', 'always'],
    'comma-dangle': ['warn', 'always-multiline'],
    '@typescript-eslint/no-unused-vars': ['error'],
    'no-unused-vars': 'off', // Turn off base rule as it can report incorrect errors
    'max-len': ['warn', { 'code': 120 }],
    'object-curly-spacing': ['warn', 'always'],
  },
};