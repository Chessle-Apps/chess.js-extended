
import esbuild from 'esbuild';
import { pnpPlugin } from '@yarnpkg/esbuild-plugin-pnp';

esbuild.build({
  entryPoints: ['index.ts'],
  bundle: true,
  platform: 'node',
  target: ['node16'],
  outfile: 'dist/index.js',
  format: 'esm',
  plugins: [pnpPlugin()],
  loader: {
    '.wasm': 'binary',
  },
}).catch(() => process.exit(1));
