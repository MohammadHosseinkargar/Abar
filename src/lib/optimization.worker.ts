import * as THREE from "three";
import { STLLoader, STLExporter, SimplifyModifier } from "three-stdlib";

// This is a Web Worker for heavy media optimization tasks
self.onmessage = async (e) => {
  const { type, file, options } = e.data;

  try {
    if (type === "IMAGE") {
      const optimized = await optimizeImage(file, options);
      self.postMessage({ status: "success", result: optimized });
    } else if (type === "STL") {
      const optimized = await optimizeSTL(file, options);
      self.postMessage({ status: "success", result: optimized });
    }
  } catch (error) {
    self.postMessage({ status: "error", error: error instanceof Error ? error.message : String(error) });
  }
};

async function optimizeImage(file: Blob, options: any) {
  // We use OffscreenCanvas in the worker for image processing
  const imgBitmap = await createImageBitmap(file);
  const { maxWidth = 2048, maxHeight = 2048, quality = 0.85 } = options;

  let width = imgBitmap.width;
  let height = imgBitmap.height;

  // Preserve aspect ratio
  if (width > maxWidth) {
    height = (maxWidth / width) * height;
    width = maxWidth;
  }
  if (height > maxHeight) {
    width = (maxHeight / height) * width;
    height = maxHeight;
  }

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2D context from OffscreenCanvas");

  ctx.drawImage(imgBitmap, 0, 0, width, height);

  // Generate main optimized WebP
  const optimizedBlob = await canvas.convertToBlob({
    type: "image/webp",
    quality: quality,
  });

  // Generate thumbnail
  const thumbSize = 300;
  let tW = width, tH = height;
  if (tW > tH) {
    tH = (thumbSize / tW) * tH;
    tW = thumbSize;
  } else {
    tW = (thumbSize / tH) * tW;
    tH = thumbSize;
  }
  const thumbCanvas = new OffscreenCanvas(tW, tH);
  const tCtx = thumbCanvas.getContext("2d");
  tCtx?.drawImage(imgBitmap, 0, 0, tW, tH);
  const thumbBlob = await thumbCanvas.convertToBlob({ type: "image/webp", quality: 0.7 });

  return {
    blob: optimizedBlob,
    thumbnail: thumbBlob,
    originalSize: file.size,
    optimizedSize: optimizedBlob.size,
    width,
    height,
  };
}

async function optimizeSTL(file: Blob, options: any) {
  const arrayBuffer = await file.arrayBuffer();
  const loader = new STLLoader();
  
  let geometry: THREE.BufferGeometry;
  try {
    geometry = loader.parse(arrayBuffer);
  } catch (err) {
    throw new Error("فایل STL خراب یا نامعتبر است.");
  }

  if (geometry.attributes.position.count === 0) {
    throw new Error("مدل سه بعدی خالی است.");
  }

  // 1. Remove duplicate vertices (mergeVertices)
  // We need to use BufferGeometryUtils but we can do it manually or via a simpler way if needed
  // In three.js r125+, mergeVertices is part of BufferGeometryUtils
  // For simplicity here, we'll use a basic merge if possible or just proceed to simplification
  
  // 2. Simplify geometry if it's too dense
  const originalFaceCount = geometry.attributes.position.count / 3;
  let finalGeometry = geometry;
  let simplified = false;

  const maxFaces = options.maxFaces || 100000;
  if (originalFaceCount > maxFaces) {
    const modifier = new SimplifyModifier();
    const count = Math.floor(geometry.attributes.position.count * (maxFaces / originalFaceCount));
    try {
      finalGeometry = modifier.modify(geometry, count);
      simplified = true;
    } catch (e) {
      console.warn("Simplification failed, using original geometry", e);
    }
  }

  // 3. Recalculate normals
  finalGeometry.computeVertexNormals();

  // 4. Export to STL (binary)
  const exporter = new STLExporter();
  const stlData = exporter.parse(new THREE.Mesh(finalGeometry), { binary: true }) as DataView;
  const optimizedBlob = new Blob([stlData.buffer as any], { type: "application/sla" });

  return {
    blob: optimizedBlob,
    originalSize: file.size,
    optimizedSize: optimizedBlob.size,
    originalFaces: originalFaceCount,
    optimizedFaces: finalGeometry.attributes.position.count / 3,
    simplified
  };
}
