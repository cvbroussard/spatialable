/**
 * Build the <sa-media> web component loader.
 *
 * Usage:
 *   node embed/build.js            # Production (minified)
 *   node embed/build.js --dev      # Development (unminified, sourcemap)
 */

const { build } = require('esbuild');
const path = require('path');

const isDev = process.argv.includes('--dev');

async function main() {
  const result = await build({
    entryPoints: [path.resolve(__dirname, 'src/index.ts')],
    bundle: true,
    format: 'iife',
    target: 'es2020',
    outfile: path.resolve(__dirname, '../public/embed/loader.js'),
    minify: !isDev,
    sourcemap: isDev ? 'inline' : false,
    define: {
      '__SA_API_BASE__': JSON.stringify(isDev ? 'http://localhost:3000' : 'https://api.spatialable.com'),
    },
    banner: {
      js: `/* SpatialAble Embed Loader v0.1.0 | (c) ${new Date().getFullYear()} SpatialAble */`,
    },
    metafile: true,
  });

  const output = Object.keys(result.metafile.outputs)[0];
  const bytes = result.metafile.outputs[output].bytes;
  console.log(`Built: ${output} (${(bytes / 1024).toFixed(1)} KB${isDev ? '' : ' minified'})`);
}

main().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
