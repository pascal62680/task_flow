// Configuration ESLint 9 au format "flat config" (un simple tableau d'objets).
import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default [
  { ignores: ['node_modules/', 'dist/', 'reports/', 'coverage/'] },

  js.configs.recommended,

  // Code exécuté dans le navigateur
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: globals.browser, // document, fetch, window...
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'error',
    },
  },

  // Tests et configuration : exécutés par Node
  {
    files: ['tests/**/*.js', '*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },

  // Doit venir en dernier : désactive les règles de style qui gênent Prettier
  prettier,
];
