// app/ocr/arkaplan/index.ts

export { processWithLama } from "./lama";
export { processWithStableDiffusion } from "./stable-diffusion";

export const InpaintingEngines = [
  { code: "lama", name: "LaMa Inpainting" },
  { code: "sd", name: "Stable Diffusion" }
];
