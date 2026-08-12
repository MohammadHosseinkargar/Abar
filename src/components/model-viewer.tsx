import { useEffect, useRef, useState } from "react";

/**
 * Lightweight auto-rotating STL viewer.
 * three.js is imported dynamically so it never runs during SSR.
 */
export function ModelViewer({
  src,
  className = "",
  spin = true,
  label,
}: {
  src: string;
  className?: string;
  spin?: boolean;
  label?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      const THREE = await import("three");
      const { STLLoader } = await import("three/examples/jsm/loaders/STLLoader.js");
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      if (disposed) return;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 5000);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(host.clientWidth || 400, host.clientHeight || 400, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.style.display = "block";
      renderer.domElement.style.touchAction = "pan-y";
      host.appendChild(renderer.domElement);

      scene.add(new THREE.HemisphereLight(0xffffff, 0x9a9a9a, 1.15));
      const key = new THREE.DirectionalLight(0xffffff, 1.5);
      key.position.set(2, 3, 4);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0xffffff, 0.6);
      rim.position.set(-3, -1, -2);
      scene.add(rim);

      const pivot = new THREE.Group();
      scene.add(pivot);

      let geometry: import("three").BufferGeometry | null = null;
      let material: import("three").Material | null = null;
      let raf = 0;
      let dragging = false;
      let lastX = 0;
      let lastY = 0;
      let velocity = 0.006;

      let fitRadius = 0;
      const resize = () => {
        const w = host.clientWidth || 400;
        const h = host.clientHeight || 400;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
        if (fitRadius) {
          const dist = fitRadius * 3.1 * Math.max(1, 1 / camera.aspect);
          camera.position.set(0, fitRadius * 0.55, dist);
          camera.lookAt(0, 0, 0);
        }
      };
      const ro = new ResizeObserver(resize);
      ro.observe(host);


      const onDown = (e: PointerEvent) => {
        dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        renderer.domElement.setPointerCapture(e.pointerId);
      };
      const onMove = (e: PointerEvent) => {
        if (!dragging) return;
        const dx = (e.clientX - lastX) / 180;
        const dy = (e.clientY - lastY) / 220;
        lastX = e.clientX;
        lastY = e.clientY;
        pivot.rotation.y += dx;
        pivot.rotation.x = Math.max(-1.2, Math.min(1.2, pivot.rotation.x + dy));
        velocity = dx * 0.35 + velocity * 0.65;
      };
      const onUp = () => {
        dragging = false;
      };
      renderer.domElement.addEventListener("pointerdown", onDown);
      renderer.domElement.addEventListener("pointermove", onMove);
      renderer.domElement.addEventListener("pointerup", onUp);
      renderer.domElement.addEventListener("pointercancel", onUp);

      try {
        const isGLTF = src.toLowerCase().endsWith(".gltf") || src.toLowerCase().endsWith(".glb");
        
        if (isGLTF) {
          const loader = new GLTFLoader();
          const gltf = await new Promise<any>((resolve, reject) => {
            loader.load(src, resolve, undefined, reject);
          });
          if (disposed) return;
          
          const model = gltf.scene;
          pivot.add(model);
          
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          
          model.position.sub(center);
          fitRadius = size.length() * 0.5;
        } else {
          const buffer = await fetch(src).then((r) => {
            if (!r.ok) throw new Error("model fetch failed");
            return r.arrayBuffer();
          });
          if (disposed) return;
          geometry = new STLLoader().parse(buffer);
          geometry.computeVertexNormals();
          geometry.center();

          const sphere = geometry.boundingSphere ?? (geometry.computeBoundingSphere(), geometry.boundingSphere!);
          const radius = sphere?.radius || 1;

          material = new THREE.MeshStandardMaterial({
            color: 0xb8b8b8,
            metalness: 0.15,
            roughness: 0.55,
            flatShading: false,
          });
          const mesh = new THREE.Mesh(geometry, material);
          mesh.rotation.x = -Math.PI / 2;
          pivot.add(mesh);
          fitRadius = radius;
        }
        resize();

        setState("ready");

        const tick = () => {
          raf = requestAnimationFrame(tick);
          if (spin && !dragging) pivot.rotation.y += 0.006;
          else if (!dragging) pivot.rotation.y += velocity * 0.02;
          renderer.render(scene, camera);
        };
        tick();
      } catch {
        if (!disposed) setState("error");
      }

      cleanup = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        renderer.domElement.removeEventListener("pointerdown", onDown);
        renderer.domElement.removeEventListener("pointermove", onMove);
        renderer.domElement.removeEventListener("pointerup", onUp);
        renderer.domElement.removeEventListener("pointercancel", onUp);
        geometry?.dispose();
        material?.dispose();
        renderer.dispose();
        if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
      };
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [src, spin]);

  return (
    <div className={`relative ${className}`}>
      <div ref={hostRef} className="absolute inset-0" aria-label={label ?? "مدل سه‌بعدی"} role="img" />
      {state !== "ready" && (
        <div className="absolute inset-0 grid place-items-center font-mono text-[10px] tracking-widest text-ink-3 uppercase">
          {state === "loading" ? "LOADING 3D…" : "3D UNAVAILABLE"}
        </div>
      )}
    </div>
  );
}

export default ModelViewer;
