const fs = require("fs");

function generateBundle() {
  try {
    console.log("🔄 Generating Stockfish bundle...");

    const stockfishJs = fs.readFileSync("./stockfish/stockfish.js");
    const stockfishWasm = fs.readFileSync("./stockfish/stockfish.wasm");
    const stockfishWasmJs = fs.readFileSync("./stockfish/stockfish.wasm.js");

    const bundleContent = `// Auto-generated bundled Stockfish files
// This file contains the Stockfish engine files as base64 strings for true bundling

export const STOCKFISH_JS_BASE64 = "${stockfishJs.toString("base64")}";

export const STOCKFISH_WASM_BASE64 = "${stockfishWasm.toString("base64")}";

export const STOCKFISH_WASM_JS_BASE64 = "${stockfishWasmJs.toString("base64")}";

// Helper functions to decode the bundled files (browser-compatible)
export function getStockfishJs(): string {
  return atob(STOCKFISH_JS_BASE64);
}

export function getStockfishWasmJs(): string {
  // For the WASM JS file, we need to modify it to use the bundled WASM
  let wasmJs = atob(STOCKFISH_WASM_JS_BASE64);
  
  // Instead of replacing fetch calls (which breaks syntax), we'll inject
  // the WASM data at the beginning and modify the WASM loading logic
  const wasmData = \`
// Bundled WASM data
var BUNDLED_WASM_BINARY = Uint8Array.from(atob('$\{STOCKFISH_WASM_BASE64\}'), c => c.charCodeAt(0));

// Override the WebAssembly instantiation to use bundled data
var originalInstantiateStreaming = WebAssembly.instantiateStreaming;
var originalInstantiate = WebAssembly.instantiate;

WebAssembly.instantiateStreaming = function(response, imports) {
  return WebAssembly.instantiate(BUNDLED_WASM_BINARY, imports);
};

WebAssembly.instantiate = function(bufferOrModule, imports) {
  if (bufferOrModule instanceof ArrayBuffer || bufferOrModule instanceof Uint8Array) {
    return originalInstantiate.call(this, bufferOrModule, imports);
  }
  // If it's a module, use the original function
  return originalInstantiate.call(this, bufferOrModule, imports);
};

// Also handle fetch calls for WASM files
var originalFetch = (typeof fetch !== 'undefined') ? fetch : function() { 
  return Promise.reject(new Error('fetch not available')); 
};

if (typeof fetch !== 'undefined') {
  fetch = function(url, options) {
    if (typeof url === 'string' && url.includes('.wasm')) {
      return Promise.resolve(new Response(BUNDLED_WASM_BINARY));
    }
    return originalFetch.call(this, url, options);
  };
}

\`;
  
  return wasmData + wasmJs;
}

export function getStockfishWasm(): Uint8Array {
  return Uint8Array.from(atob(STOCKFISH_WASM_BASE64), c => c.charCodeAt(0));
}
`;

    fs.writeFileSync("./stockfish-bundle.ts", bundleContent);
    console.log("✅ Generated stockfish-bundle.ts");
  } catch (error) {
    console.error("❌ Error generating bundle:", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  generateBundle();
}

module.exports = { generateBundle };
