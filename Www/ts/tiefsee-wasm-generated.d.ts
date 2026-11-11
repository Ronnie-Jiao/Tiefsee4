/**
 * Types for wasm-pack's generated JavaScript module.
 * The actual JavaScript/WASM binary is produced by gulp's build-rust step;
 * this declaration only lets a clean TypeScript checkout type-check before
 * the Rust artifacts are generated.
 */
declare module "*tiefsee_wasm.js" {
    export default function init(input: { module_or_path: URL }): Promise<unknown>;
    export function image_filter(imageData: ImageData, kernel: Float32Array): ImageData | Promise<ImageData>;
}
