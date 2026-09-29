// Prettier has no settings for union `|` position, wrapped class braces, or
// generator-star spacing. `npm run format` runs `eslint --fix` afterward so
// those ESLint rules are what remain on disk.
const config = {
  printWidth: 80,
  singleQuote: true,
  semi: false,
  trailingComma: 'none',
  plugins: ['prettier-plugin-space-before-function-paren']
}

export default config
