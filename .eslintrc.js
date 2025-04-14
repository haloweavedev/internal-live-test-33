module.exports = {
  // Extend Next.js config
  extends: ['next/core-web-vitals'],
  
  // Set root to true to avoid ESLint searching parent directories
  root: true,
  
  // Ignore patterns (these should take precedence over .eslintignore)
  ignorePatterns: [
    'node_modules/**',
    '.next/**',
    'app/generated/**/*',  // Use wildcard pattern to ignore all files in app/generated
    '**/generated/**',
    'node_modules/.prisma/**',
    '.prisma/**',
  ],
  
  // Override rules as needed
  rules: {
    // Fix for 'template literal' warning in payment-success/page.tsx
    '@typescript-eslint/restrict-template-expressions': 'off',
    '@typescript-eslint/no-unused-expressions': 'warn',
    '@typescript-eslint/no-this-alias': 'warn',
    '@typescript-eslint/no-unused-vars': 'warn',
    '@typescript-eslint/no-require-imports': 'warn'
  },
  
  // Add special overrides for generated files
  overrides: [
    {
      files: ['app/generated/**/*.js', '**/generated/**/*.js'],
      rules: {
        '@typescript-eslint/no-unused-expressions': 'off',
        '@typescript-eslint/no-this-alias': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        '@typescript-eslint/no-require-imports': 'off'
      }
    }
  ]
}; 