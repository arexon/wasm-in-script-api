declare module "polywasm" {
    export const WebAssembly: typeof globalThis.WebAssembly;
}

declare module "#wasm" {
    const wasmModule: Uint8Array;
    export default wasmModule;
}
