import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageRoot = path.resolve(__dirname, '..');
const stockfishDir = path.join(packageRoot, 'stockfish');
const stockfishBundlePath = path.join(packageRoot, 'stockfish-bundle.ts');

async function bundleStockfish() {
  try {
    console.log('Bundling Stockfish files...');

    // 1. Read all necessary files
    const stockfishJs = await fs.readFile(path.join(stockfishDir, 'stockfish.js'), 'utf-8');
    const stockfishWasm = await fs.readFile(path.join(stockfishDir, 'stockfish.wasm'));
    const stockfishWasmJs = await fs.readFile(path.join(stockfishDir, 'stockfish.wasm.js'), 'utf-8');

    // 2. Convert them to base64 strings
    const stockfishJsBase64 = Buffer.from(stockfishJs).toString('base64');
    const stockfishWasmBase64 = Buffer.from(stockfishWasm).toString('base64');
    const stockfishWasmJsBase64 = Buffer.from(stockfishWasmJs).toString('base64');

    // 3. Prepare the code snippet that will be injected into the WASM loader script.
    // This snippet overrides browser functions to use the bundled WASM data instead of fetching it.
    const wasmLoaderInjection = `
// Bundled WASM data
var BUNDLED_WASM_BINARY = Uint8Array.from(atob('${stockfishWasmBase64}'), c => c.charCodeAt(0));

// Override WebAssembly.instantiateStreaming to use the bundled data
if (typeof WebAssembly.instantiateStreaming === 'function') {
  WebAssembly.instantiateStreaming = function(response, imports) {
    return WebAssembly.instantiate(BUNDLED_WASM_BINARY, imports);
  };
}

// Override fetch to intercept requests for the .wasm file
if (typeof fetch === 'function') {
  var originalFetch = fetch;
  fetch = function(url, options) {
    if (typeof url === 'string' && url.endsWith('.wasm')) {
      return Promise.resolve(new Response(BUNDLED_WASM_BINARY, { headers: { 'Content-Type': 'application/wasm' } }));
    }
    return originalFetch(url, options);
  };
}
`;

    // 4. Construct the final content of the stockfish-bundle.ts file
    const bundleContent = `// Auto-generated bundled Stockfish files
// This file contains the Stockfish engine files as base64 strings for true bundling

export const STOCKFISH_JS_BASE64 = "${stockfishJsBase64}";

export const STOCKFISH_WASM_BASE64 = "${stockfishWasmBase64}";

export const STOCKFISH_WASM_JS_BASE64 = "${stockfishWasmJsBase64}";

// Helper functions to decode the bundled files (browser-compatible)
export function getStockfishJs(): string {
  return atob(STOCKFISH_JS_BASE64);
}

export function getStockfishWasmJs(): string {
  // For the WASM JS file, we need to modify it to use the bundled WASM
  const wasmJs = atob(STOCKFISH_WASM_JS_BASE64);
  const wasmData = ${JSON.stringify(wasmLoaderInjection)};
  return wasmData + wasmJs;
}

export function getStockfishWasm(): Uint8Array {
  return Uint8Array.from(atob(STOCKFISH_WASM_BASE64), c => c.charCodeAt(0));
}
`;

    // 5. Write the generated content to the file
    await fs.writeFile(stockfishBundlePath, bundleContent);

    console.log('Stockfish files bundled successfully.');

  } catch (error) {
    console.error('Error bundling Stockfish files:', error);
    process.exit(1);
  }
}

bundleStockfish();
