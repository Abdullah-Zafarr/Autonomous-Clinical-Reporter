import assert from "node:assert/strict";
import { test } from "node:test";
import { mockKeyImagePayload } from "./fixtures/test-data";

// Extracted validator logic matching worksheet-service normalizeKeyImages
function validateKeyImages(images: unknown[]) {
  if (!Array.isArray(images)) return [];
  return images
    .filter((image: any) =>
      typeof image === "object" &&
      image !== null &&
      typeof image.id === "string" &&
      typeof image.caption === "string" &&
      typeof image.dataUrl === "string" &&
      /^(data:image\/(jpeg|png);base64,)/.test(image.dataUrl) &&
      image.dataUrl.length <= 3_000_000,
    )
    .slice(0, 6);
}

test("dicom: successfully validates PNG and JPEG key image payloads with annotations", () => {
  const validList = [
    mockKeyImagePayload,
    {
      id: "img-002",
      caption: "Transverse view showing cyst",
      dataUrl: "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
    },
  ];

  const result = validateKeyImages(validList);
  assert.equal(result.length, 2);
  assert.equal(result[0].id, "img-capture-001");
  assert.equal(result[1].id, "img-002");
});

test("dicom: blocks non-image dataUrls, malicious svg, and oversized payloads", () => {
  const invalidList = [
    // SVG script injection attempt
    {
      id: "bad-1",
      caption: "Script image",
      dataUrl: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
    },
    // Plain text
    {
      id: "bad-2",
      caption: "Plain text",
      dataUrl: "data:text/plain;base64,aGVsbG8=",
    },
    // Oversized payload exceeding 3MB limit
    {
      id: "bad-3",
      caption: "Oversized image",
      dataUrl: "data:image/png;base64," + "A".repeat(3_000_005),
    },
  ];

  const result = validateKeyImages(invalidList);
  assert.equal(result.length, 0);
});

test("dicom: enforces hard boundary of maximum 6 key images per clinical worksheet", () => {
  const manyImages = Array.from({ length: 10 }, (_, i) => ({
    id: `img-${i}`,
    caption: `Frame ${i}`,
    dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  }));

  const result = validateKeyImages(manyImages);
  assert.equal(result.length, 6);
  assert.equal(result[5].id, "img-5");
});
