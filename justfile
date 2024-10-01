_default:
    just --list

build:
	RUSTFLAGS="-C target-feature=+multivalue" cargo b -r --target wasm32-unknown-unknown
	regolith run
