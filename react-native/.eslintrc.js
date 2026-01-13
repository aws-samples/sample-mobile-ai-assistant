module.exports = {
  root: true,
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
    '@react-native',
  ],
  ignorePatterns: ['android/**', 'ios/**'],
  rules: {
    // Allow require() for dynamic image imports in React Native
    '@typescript-eslint/no-require-imports': 'off',
    // Allow unused vars when prefixed with underscore, ignore catch block errors
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrors: 'none',
      },
    ],
    // Allow unused expressions for short-circuit evaluation (e.g., condition && action())
    '@typescript-eslint/no-unused-expressions': [
      'error',
      { allowShortCircuit: true, allowTernary: true },
    ],
  },
};
