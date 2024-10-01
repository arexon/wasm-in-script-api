# Wasm in Bedrock Script API

This is a little experiment that integrates the
[polywasm](https://github.com/evanw/polywasm) library to enable executing
WebAssembly inside the Script API. This means that we can run code written in
languages like Go, Rust, C, and C++ to name a few.

## Build instructions

Make sure that you have `Rust`, `Regolith`, and `Node.js` installed. `esbuild`
is used to embed the wasm module in the script.

Build the Rust library. Target feature `multivalue` is required.

```console
RUSTFLAGS="-C target-feature=+multivalue" cargo b -r --target wasm32-unknown-unknown
```

Then install and run Regolith filters.

```console
regolith install-all
regolith run
```
