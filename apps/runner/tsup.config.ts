import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  target: 'node20',
  clean: true,
  // shared se publica como TypeScript fuente, así que se incluye en el bundle.
  noExternal: [/^@testpilot\/shared/],
});
