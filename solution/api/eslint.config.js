// Configuration ESLint 9 au format "flat config" (un simple tableau d'objets).
import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default [
  // Dossiers à ne jamais analyser
  { ignores: ['node_modules/', 'reports/', 'coverage/'] },

  // Règles recommandées par ESLint
  js.configs.recommended,

  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: globals.node, // process, Buffer, etc.
    },
    rules: {
      // On autorise les paramètres inutilisés s'ils commencent par "_"
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // Le logger JSON écrit via process.stdout : console.log est donc interdit
      'no-console': 'error',
    },
  },

  // Doit venir en dernier : désactive les règles de style qui gênent Prettier
  prettier,
];
