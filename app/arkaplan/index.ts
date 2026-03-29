// app/ocr/arkaplan/index.ts

export { processWithLama } from "./lama";
export { processWithStableDiffusion } from "./stable-diffusion";
export { processWithGeminiNano } from "./gemini-nano";

export const InpaintingEngines = [
  { code: "lama", name: "LaMa Inpainting" },
  { code: "sd", name: "Stable Diffusion" },
  { code: "gemini", name: "Gemini Nano" }
];
