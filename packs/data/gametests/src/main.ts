import wasmModule from "#wasm";
import { ItemUseBeforeEvent, system, world } from "@minecraft/server";
import { ActionFormData, ModalFormData, ModalFormResponse } from "@minecraft/server-ui";
import { WebAssembly } from "polywasm";

globalThis.WebAssembly = WebAssembly;

// polywasm uses TextDecoder internally and since it isn't available in the
// Script API, we're forced to implement this polyfill.
class TextDecoderPolyfill {
    decode(bytes: Uint8Array): string {
        // Yes, this is terrible, but it's fine for this use-case.
        return String.fromCharCode(...bytes);
    }
}

// @ts-ignore - We don't care about other properties/methods. We know polywasm
// only uses `decode`.
globalThis.TextDecoder = TextDecoderPolyfill;

interface Exports {
    item_use(eventPtr: number, eventLen: number): void;
    parse_js(codePtr: number, codeLen: number): [number, number];
    send_message(msgPtr: number, msgLen: number): [number, number];
    memory: WebAssembly.Memory;
    alloc(size: number): number;
}

interface Imports {
    console_log(msgPtr: number, msgLen: number): void;
    console_error(msgPtr: number, msgLen: number): void;
}

class WasmRunner {
    private exports: Exports = {} as Exports;

    constructor(module: Uint8Array) {
        const imports = {
            console_log: (msgPtr, msgLen) => {
                this.print("log", this.readStr(msgPtr, msgLen));
            },
            console_error: (msgPtr, msgLen) => {
                console.error(this.readStr(msgPtr, msgLen));
            },
        } satisfies Imports;

        WebAssembly.instantiate(module, {
            env: imports,

            // Because of OXC..
            __wbindgen_placeholder__: {
                __wbindgen_describe() {},
                __wbindgen_throw() {},
            },
            __wbindgen_externref_xform__: {
                __wbindgen_externref_table_grow() {},
                __wbindgen_externref_table_set_null() {},
            },
        }).then((source) => {
            this.exports = source.instance.exports as unknown as Exports;
        });
    }

    public itemUse(event: ItemUseBeforeEvent) {
        const eventSer = JSON.stringify({
            item_stack: {
                type_id: event.itemStack.typeId,
                amount: event.itemStack.amount,
            },
        });
        const [ptr, len] = this.writeStr(eventSer);
        this.exports.item_use(ptr, len);
    }

    public sendMessage(msg: string) {
        const [msgPtr, msgLen] = this.writeStr(msg);
        const [resPtr, resLen] = this.exports.send_message(msgPtr, msgLen);
        const res = this.readStr(resPtr, resLen);
        this.print(this.sendMessage.name, res);
    }

    public parseJs(code: string) {
        const [codePtr, codeLen] = this.writeStr(code);

        const [resPtr, resLen] = this.exports.parse_js(codePtr, codeLen);
        const res = this.readStr(resPtr, resLen);
        this.print(this.parseJs.name, res);
    }

    private print(fn: string, msg: any) {
        world.sendMessage(`[Wasm::${fn}] ${msg}`);
    }

    private readStr(ptr: number, len: number): string {
        const bytes = new Uint8Array(this.exports.memory.buffer, ptr, len);
        return String.fromCharCode(...bytes);
    }

    private writeStr(str: string): [number, number] {
        const len = str.length;
        const ptr = this.exports.alloc(len);
        const bytes = new Uint8Array(this.exports.memory.buffer, ptr, len);
        for (let i = 0; i < len; i++) {
            bytes[i] = str.charCodeAt(i);
        }
        return [ptr, len];
    }
}

const wasmRunner = new WasmRunner(wasmModule);

system.runInterval(() => {
    world.getAllPlayers().forEach(async (player) => {
        if (!player.isSneaking) return;

        const actionRes = await new ActionFormData()
            .title("Choose")
            .button("Message")
            .button("OXC")
            .show(player);

        const modal = new ModalFormData().title(WasmRunner.name);
        let modalRes: ModalFormResponse;

        if (actionRes.selection === 0) {
            modalRes = await modal
                .textField("Send message to Wasm", "")
                .show(player);
            const message = modalRes.formValues?.[0];
            if (message !== "") wasmRunner.sendMessage(message as string);
        }

        if (actionRes.selection === 1) {
            modalRes = await modal
                .textField("Get JS AST with OXC", "", "export interface Foo { a: () => void; }")
                .show(player);
            const code = modalRes.formValues?.[0];
            if (code !== "") wasmRunner.parseJs(code as string);
        }
    });
});

world.beforeEvents.itemUse.subscribe((event) => {
    wasmRunner.itemUse(event);
});
