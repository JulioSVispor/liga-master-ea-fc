import { describe, expect, it } from "vitest";
import { detectSupportedImage, MAX_IMAGE_BYTES } from "./image-validation";

describe("detectSupportedImage", () => {
  it("reconhece PNG pela assinatura", () => {
    expect(detectSupportedImage(Uint8Array.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))?.mime).toBe("image/png");
  });

  it("rejeita conteúdo que só declara uma extensão", () => {
    expect(detectSupportedImage(new TextEncoder().encode("arquivo-falso.png"))).toBeNull();
  });

  it("limita imagens a dois megabytes", () => {
    expect(MAX_IMAGE_BYTES).toBe(2_097_152);
  });
});
