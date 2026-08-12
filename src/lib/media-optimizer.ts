import OptimizationWorker from "./optimization.worker?worker";

export interface OptimizationResult {
  blob: Blob;
  thumbnail?: Blob;
  originalSize: number;
  optimizedSize: number;
  ratio: number;
  metadata?: any;
}

const workerPool: Worker[] = [];

function getWorker() {
  if (workerPool.length > 0) return workerPool.pop()!;
  return new OptimizationWorker();
}

function releaseWorker(worker: Worker) {
  workerPool.push(worker);
}

const seenFiles = new Set<string>();

export async function optimizeMedia(
  file: File,
  kind: "image" | "model",
  options: any = {}
): Promise<OptimizationResult> {
  const fileId = `${file.name}-${file.size}-${file.lastModified}`;
  if (seenFiles.has(fileId)) {
    throw new Error("این فایل قبلاً انتخاب شده است.");
  }

  return new Promise((resolve, reject) => {
    const worker = getWorker();
    
    worker.onmessage = (e) => {
      const { status, result, error } = e.data;
      releaseWorker(worker);
      
      if (status === "success") {
        seenFiles.add(fileId);
        resolve({
          ...result,
          ratio: Math.round(((result.originalSize - result.optimizedSize) / result.originalSize) * 100),
        });
      } else {
        reject(new Error(error || "خطا در بهینه‌سازی فایل."));
      }
    };

    worker.onerror = (err) => {
      releaseWorker(worker);
      reject(err);
    };

    worker.postMessage({
      type: kind === "image" ? "IMAGE" : "STL",
      file: file,
      options: {
        ...options,
        maxWidth: 2048,
        maxHeight: 2048,
        quality: 0.85,
        maxFaces: 100000,
      },
    });
  });
}

export function clearSeenFiles() {
  seenFiles.clear();
}
