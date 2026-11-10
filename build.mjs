import { build } from 'esbuild';
await build({ entryPoints:['src/crypto.js'], bundle:true, format:'esm', platform:'browser', outfile:'public/crypto.js' });
