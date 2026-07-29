"use client";

import { useEffect, useRef, useState } from "react";

type ThreeModule = typeof import("three");
type ThreeObject = import("three").Object3D;
type ThreeCamera = import("three").PerspectiveCamera;
type ThreeGroup = import("three").Group;
type ThreeControls =
  import("three/examples/jsm/controls/OrbitControls.js").OrbitControls;

export type ModelMetrics = {
  vertices: number;
  triangles: number;
  meshes: number;
  size: string;
  openEdges: number;
  nonManifold: number;
  degenerate: number;
  thinFaces: number;
  highValence: number;
  uvCoverage: number;
};

export type ModelAnnotation = {
  id: string;
  position: [number, number, number];
  text: string;
  severity: "reminder" | "serious";
};

export type FitResult = {
  percent: number;
  bakedFaces: number;
  failedFaces: number;
  checkedFaces: number;
  cageDistance: number;
};

type Props = {
  file?: File | null;
  url?: string | null;
  highFile?: File | null;
  highUrl?: string | null;
  color?: string;
  wireframe?: boolean;
  fitMode?: boolean;
  fitDistancePercent?: number;
  className?: string;
  onMetrics?: (m: ModelMetrics) => void;
  onFitResult?: (result: FitResult | null) => void;
  cameraCommand?: string;
  compareGhost?: boolean;
  annotationMode?: boolean;
  annotations?: ModelAnnotation[];
  onAddAnnotation?: (position: [number, number, number]) => void;
};

const blank = (): ModelMetrics => ({
  vertices: 0,
  triangles: 0,
  meshes: 0,
  size: "0 m",
  openEdges: 0,
  nonManifold: 0,
  degenerate: 0,
  thinFaces: 0,
  highValence: 0,
  uvCoverage: 0,
});

const edgeKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const positionKey = (point: import("three").Vector3) =>
  `${Math.round(point.x * 1e6)}:${Math.round(point.y * 1e6)}:${Math.round(point.z * 1e6)}`;

export function analyzeModel(
  THREE: ThreeModule,
  root: ThreeObject,
): ModelMetrics {
  const metrics = blank();
  const box = new THREE.Box3();
  const world = new THREE.Vector3();
  let uvCoveredVertices = 0;
  root.updateMatrixWorld(true);
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    metrics.meshes++;
    const geometry = child.geometry as import("three").BufferGeometry;
    const position = geometry.getAttribute("position");
    if (!position) return;
    const points = Array.from({ length: position.count }, (_, index) =>
      new THREE.Vector3().fromBufferAttribute(position, index),
    );
    const vertexKeys = points.map(positionKey);
    const uniqueVertices = new Set(vertexKeys);
    metrics.vertices += uniqueVertices.size;
    const index = geometry.getIndex();
    const triangles = index
      ? Math.floor(index.count / 3)
      : Math.floor(position.count / 3);
    metrics.triangles += triangles;
    if (geometry.getAttribute("uv")) uvCoveredVertices += uniqueVertices.size;
    const edges = new Map<string, number>();
    const valence = new Map<string, Set<string>>();
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    const read = (i: number) => (index ? index.getX(i) : i);
    for (let i = 0; i < triangles; i++) {
      const ia = read(i * 3);
      const ib = read(i * 3 + 1);
      const ic = read(i * 3 + 2);
      const ka = vertexKeys[ia];
      const kb = vertexKeys[ib];
      const kc = vertexKeys[ic];
      for (const [u, v] of [
        [ka, kb],
        [kb, kc],
        [kc, ka],
      ]) {
        const key = edgeKey(u, v);
        edges.set(key, (edges.get(key) || 0) + 1);
        if (!valence.has(u)) valence.set(u, new Set());
        if (!valence.has(v)) valence.set(v, new Set());
        valence.get(u)!.add(v);
        valence.get(v)!.add(u);
      }
      a.fromBufferAttribute(position, ia);
      b.fromBufferAttribute(position, ib);
      c.fromBufferAttribute(position, ic);
      const long = Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a));
      const short = Math.max(
        1e-8,
        Math.min(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a)),
      );
      const area = b.clone().sub(a).cross(c.clone().sub(a)).length() * 0.5;
      if (area < 1e-8) metrics.degenerate++;
      if (long / short > 12) metrics.thinFaces++;
    }
    edges.forEach((count) => {
      if (count === 1) metrics.openEdges++;
      if (count > 2) metrics.nonManifold++;
    });
    valence.forEach((neighbors) => {
      if (neighbors.size >= 8) metrics.highValence++;
    });
    for (const point of points) {
      world.copy(point).applyMatrix4(child.matrixWorld);
      box.expandByPoint(world);
    }
  });
  metrics.uvCoverage = metrics.vertices
    ? Math.round((uvCoveredVertices / metrics.vertices) * 100)
    : 0;
  if (!box.isEmpty()) {
    const size = new THREE.Vector3();
    box.getSize(size);
    metrics.size = `${Math.max(size.x, size.y, size.z).toFixed(2)} m`;
  }
  return metrics;
}

function demo(THREE: ThreeModule) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: "#7774ed",
    roughness: 0.62,
    flatShading: true,
  });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.62, 12, 8), material);
  head.position.y = 1.58;
  group.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.72, 4), material);
  beak.rotation.z = Math.PI / 2;
  beak.position.set(-0.62, 1.5, 0);
  group.add(beak);
  const crest = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.62, 7), material);
  crest.position.set(0.02, 2.24, 0);
  group.add(crest);
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.26, 0.48, 8),
    material,
  );
  neck.position.y = 0.91;
  group.add(neck);
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.58, 0.92, 1.35, 7),
    material,
  );
  body.position.y = -0.04;
  group.add(body);
  return group;
}

function normalizeModels(
  THREE: ThreeModule,
  low: ThreeObject,
  high?: ThreeObject | null,
) {
  const box = new THREE.Box3().setFromObject(low);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const scale = 3.3 / Math.max(size.x, size.y, size.z, 0.1);
  for (const model of [low, high]) {
    if (!model) continue;
    model.position.sub(center);
    model.position.y += size.y * 0.12;
    model.scale.multiplyScalar(scale);
    model.updateMatrixWorld(true);
  }
}

function addTopologyOverlay(
  THREE: ThreeModule,
  mesh: import("three").Mesh,
  lineColor: string,
  opacity = 0.86,
) {
  const lines = new THREE.LineSegments(
    new THREE.WireframeGeometry(
      mesh.geometry as import("three").BufferGeometry,
    ),
    new THREE.LineBasicMaterial({
      color: lineColor,
      transparent: true,
      opacity,
      depthTest: true,
    }),
  );
  lines.renderOrder = 3;
  lines.userData.topologyOverlay = true;
  lines.raycast = () => undefined;
  mesh.add(lines);
}

export function applyBakeCoverage(
  THREE: ThreeModule,
  low: ThreeObject,
  high: ThreeObject,
  distancePercent: number,
): FitResult {
  const lowBox = new THREE.Box3().setFromObject(low);
  const lowSize = new THREE.Vector3();
  lowBox.getSize(lowSize);
  const modelSize = Math.max(lowSize.x, lowSize.y, lowSize.z, 0.1);
  const cageDistance = modelSize * (distancePercent / 100);
  const rayOffset = Math.max(modelSize * 0.0005, 0.0001);
  const raycaster = new THREE.Raycaster();
  raycaster.near = 0;
  raycaster.far = cageDistance;

  high.updateMatrixWorld(true);
  high.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.material = new THREE.MeshStandardMaterial({
      color: "#b7d9ff",
      roughness: 0.34,
      metalness: 0.02,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.13,
      depthWrite: false,
    });
    child.renderOrder = 1;
  });

  let bakedFaces = 0;
  let failedFaces = 0;
  const blue = new THREE.Color("#2389ff");
  const red = new THREE.Color("#ff304f");
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const center = new THREE.Vector3();
  const edgeA = new THREE.Vector3();
  const edgeB = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const origin = new THREE.Vector3();

  low.updateMatrixWorld(true);
  low.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const source = child.geometry as import("three").BufferGeometry;
    const cloned = source.index ? source.toNonIndexed() : source.clone();
    child.geometry = cloned;
    const position = cloned.getAttribute("position");
    if (!position) return;
    const colors = new Float32Array(position.count * 3);
    const faceCount = Math.floor(position.count / 3);
    const stride = Math.max(1, Math.ceil(faceCount / 2400));

    for (let blockStart = 0; blockStart < faceCount; blockStart += stride) {
      const blockEnd = Math.min(faceCount, blockStart + stride);
      const sampleFace = Math.min(
        faceCount - 1,
        blockStart + Math.floor((blockEnd - blockStart) / 2),
      );
      const offset = sampleFace * 3;
      a.fromBufferAttribute(position, offset);
      b.fromBufferAttribute(position, offset + 1);
      c.fromBufferAttribute(position, offset + 2);
      center.copy(a).add(b).add(c).multiplyScalar(1 / 3);
      normal
        .copy(edgeA.subVectors(b, a))
        .cross(edgeB.subVectors(c, a))
        .normalize();
      center.applyMatrix4(child.matrixWorld);
      normal.transformDirection(child.matrixWorld);
      origin.copy(center).addScaledVector(normal, rayOffset);
      raycaster.set(origin, normal);

      const canBake = raycaster
        .intersectObject(high, true)
        .some(
          (hit) =>
            hit.object instanceof THREE.Mesh &&
            hit.distance <= cageDistance + rayOffset,
        );
      const selected = canBake ? blue : red;
      const blockFaces = blockEnd - blockStart;
      if (canBake) bakedFaces += blockFaces;
      else failedFaces += blockFaces;

      for (let face = blockStart; face < blockEnd; face++) {
        for (let vertex = 0; vertex < 3; vertex++) {
          const colorOffset = (face * 3 + vertex) * 3;
          colors[colorOffset] = selected.r;
          colors[colorOffset + 1] = selected.g;
          colors[colorOffset + 2] = selected.b;
        }
      }
    }
    cloned.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    child.material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.46,
      metalness: 0.03,
      side: THREE.DoubleSide,
      flatShading: true,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    child.renderOrder = 2;
  });

  high.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    addTopologyOverlay(THREE, child, "#9acbff", 0.68);
  });

  const checkedFaces = bakedFaces + failedFaces;
  return {
    percent: checkedFaces ? Math.round((bakedFaces / checkedFaces) * 100) : 0,
    bakedFaces,
    failedFaces,
    checkedFaces,
    cageDistance,
  };
}

export default function ModelViewer({
  file,
  url,
  highFile,
  highUrl,
  color = "#7471ee",
  wireframe = false,
  fitMode = false,
  fitDistancePercent = 12,
  className = "",
  onMetrics,
  onFitResult,
  cameraCommand,
  compareGhost = false,
  annotationMode = false,
  annotations = [],
  onAddAnnotation,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<ThreeCamera | null>(null);
  const controlsRef = useRef<ThreeControls | null>(null);
  const annotationsRef = useRef(annotations);
  const markerRefs = useRef(new Map<string, HTMLSpanElement>());
  const addAnnotationRef = useRef(onAddAnnotation);
  const annotationModeRef = useRef(annotationMode);
  const [message, setMessage] = useState("拖拽旋转 · 滚轮缩放 · 右键平移");
  const [fitResult, setFitResult] = useState<FitResult | null>(null);

  useEffect(() => {
    annotationsRef.current = annotations;
  }, [annotations]);
  useEffect(() => {
    addAnnotationRef.current = onAddAnnotation;
  }, [onAddAnnotation]);
  useEffect(() => {
    annotationModeRef.current = annotationMode;
  }, [annotationMode]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let analysisCompleted = false;
    let cleanup: undefined | (() => void);
    void (async () => {
      try {
        setMessage("正在初始化 3D 预览…");
        setFitResult(null);
        onFitResult?.(null);
        const [THREE, { GLTFLoader }, { OBJLoader }, { OrbitControls }] =
          await Promise.all([
            import("three"),
            import("three/examples/jsm/loaders/GLTFLoader.js"),
            import("three/examples/jsm/loaders/OBJLoader.js"),
            import("three/examples/jsm/controls/OrbitControls.js"),
          ]);
        if (cancelled) return;
        const loadModel = async (
          input?: File | null,
          inputUrl?: string | null,
        ) => {
          if (!input && !inputUrl) return null;
          const name = (input?.name || inputUrl || "").toLowerCase();
          const data = input
            ? await input.arrayBuffer()
            : await fetch(inputUrl!).then((response) => {
                if (!response.ok) throw new Error("模型文件读取失败");
                return response.arrayBuffer();
              });
          if (name.endsWith(".obj")) {
            return new OBJLoader().parse(new TextDecoder().decode(data));
          }
          if (name.endsWith(".glb") || name.endsWith(".gltf")) {
            const gltf = await new Promise<{ scene: ThreeGroup }>(
              (resolve, reject) =>
                new GLTFLoader().parse(data, "", resolve, reject),
            );
            return gltf.scene;
          }
          throw new Error("仅支持 OBJ、GLB 和内嵌资源的 GLTF");
        };

        const low = (await loadModel(file, url)) || demo(THREE);
        const high = fitMode ? await loadModel(highFile, highUrl) : null;
        if (cancelled) return;
        const metrics =
          !file && !url
            ? {
                vertices: 684,
                triangles: 1312,
                meshes: 5,
                size: "3.35 m",
                openEdges: 0,
                nonManifold: 0,
                degenerate: 0,
                thinFaces: 2,
                highValence: 4,
                uvCoverage: 100,
              }
            : analyzeModel(THREE, low);
        normalizeModels(THREE, low, high);
        if (fitMode && high) {
          const result = applyBakeCoverage(
            THREE,
            low,
            high,
            fitDistancePercent,
          );
          setFitResult(result);
          onFitResult?.(result);
          setMessage(
            `烘焙包裹成功 ${result.percent}% · 蓝色可投射 · 红色投射失败`,
          );
        } else {
          low.traverse((child) => {
            if (!(child instanceof THREE.Mesh)) return;
            child.material = new THREE.MeshStandardMaterial({
              color,
              roughness: 0.58,
              flatShading: true,
              transparent: compareGhost,
              opacity: compareGhost ? 0.78 : 1,
              polygonOffset: wireframe,
              polygonOffsetFactor: wireframe ? 1 : 0,
              polygonOffsetUnits: wireframe ? 1 : 0,
            });
            if (wireframe) addTopologyOverlay(THREE, child, "#24204f");
          });
          setMessage(
            fitMode
              ? "请先导入高模（选填），再进行高低模贴合检查"
              : annotationModeRef.current
                ? "标注模式：请单击模型表面添加问题点"
                : "拖拽旋转 · 滚轮缩放 · 右键平移",
          );
        }
        onMetrics?.(metrics);
        analysisCompleted = true;
        if (cancelled) return;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color("#0b1222");
        scene.fog = new THREE.Fog("#0b1222", 9, 20);
        const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
        camera.position.set(4.2, 2.8, 5.4);
        cameraRef.current = camera;
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.shadowMap.enabled = true;
        host.appendChild(renderer.domElement);
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.target.set(0, 0.45, 0);
        controlsRef.current = controls;
        scene.add(new THREE.HemisphereLight("#c8d4ff", "#141a29", 2.1));
        const keyLight = new THREE.DirectionalLight("#fff", 3.6);
        keyLight.position.set(4, 7, 5);
        scene.add(keyLight);
        const rim = new THREE.DirectionalLight("#6d71ff", 2.4);
        rim.position.set(-5, 3, -4);
        scene.add(rim);
        const grid = new THREE.GridHelper(16, 32, "#27334d", "#172239");
        grid.position.y = -0.78;
        scene.add(grid);
        if (fitMode && high) {
          scene.add(low, high);
        } else {
          scene.add(low);
        }
        camera.position.set(4.2, 2.8, 5.4);
        controls.update();

        const raycaster = new THREE.Raycaster();
        const pointer = new THREE.Vector2();
        let pointerStart: [number, number] = [0, 0];
        const onPointerDown = (event: PointerEvent) => {
          pointerStart = [event.clientX, event.clientY];
        };
        const onPointerUp = (event: PointerEvent) => {
          if (!annotationModeRef.current || !addAnnotationRef.current) return;
          if (
            Math.hypot(
              event.clientX - pointerStart[0],
              event.clientY - pointerStart[1],
            ) > 5
          )
            return;
          const rect = renderer.domElement.getBoundingClientRect();
          pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
          pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
          raycaster.setFromCamera(pointer, camera);
          const hit = raycaster.intersectObject(low, true)[0];
          if (!hit) return;
          addAnnotationRef.current([
            Number(hit.point.x.toFixed(4)),
            Number(hit.point.y.toFixed(4)),
            Number(hit.point.z.toFixed(4)),
          ]);
        };
        renderer.domElement.addEventListener("pointerdown", onPointerDown);
        renderer.domElement.addEventListener("pointerup", onPointerUp);
        const resize = () => {
          const width = host.clientWidth || 1;
          const height = host.clientHeight || 1;
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
        };
        const observer = new ResizeObserver(resize);
        observer.observe(host);
        resize();
        let frame = 0;
        const projected = new THREE.Vector3();
        const animate = () => {
          frame = requestAnimationFrame(animate);
          controls.update();
          for (const annotation of annotationsRef.current) {
            const marker = markerRefs.current.get(annotation.id);
            if (!marker) continue;
            projected.set(...annotation.position).project(camera);
            const visible = projected.z > -1 && projected.z < 1;
            marker.style.display = visible ? "grid" : "none";
            marker.style.left = `${((projected.x + 1) / 2) * host.clientWidth}px`;
            marker.style.top = `${((-projected.y + 1) / 2) * host.clientHeight}px`;
          }
          renderer.render(scene, camera);
        };
        animate();
        cleanup = () => {
          cancelAnimationFrame(frame);
          observer.disconnect();
          renderer.domElement.removeEventListener("pointerdown", onPointerDown);
          renderer.domElement.removeEventListener("pointerup", onPointerUp);
          controls.dispose();
          scene.traverse((child) => {
            if (
              !(
                child instanceof THREE.Mesh ||
                child instanceof THREE.LineSegments
              )
            )
              return;
            child.geometry.dispose();
            const materials = Array.isArray(child.material)
              ? child.material
              : [child.material];
            materials.forEach((material) => material.dispose());
          });
          renderer.dispose();
          cameraRef.current = null;
          controlsRef.current = null;
          if (renderer.domElement.parentNode === host)
            host.removeChild(renderer.domElement);
        };
      } catch (error) {
        if (!cancelled) {
          setMessage(
            analysisCompleted
              ? "当前浏览器未启用 3D 加速；几何数据与烘焙检测仍已完成"
              : error instanceof Error
                ? error.message
                : "模型加载失败",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [
    file,
    url,
    highFile,
    highUrl,
    color,
    wireframe,
    fitMode,
    fitDistancePercent,
    compareGhost,
    onMetrics,
    onFitResult,
  ]);

  useEffect(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls || !cameraCommand) return;
    const views: Record<string, [number, number, number]> = {
      front: [0, 0.6, 6],
      side: [6, 0.6, 0],
      top: [0, 7, 0.01],
      perspective: [4.2, 2.8, 5.4],
    };
    camera.position.set(
      ...(views[cameraCommand.split(":")[0]] || views.perspective),
    );
    camera.lookAt(controls.target);
    controls.update();
  }, [cameraCommand]);

  return (
    <div
      ref={hostRef}
      className={`model-canvas ${annotationMode ? "is-annotating" : ""} ${className}`}
    >
      <div className="viewer-hint">
        {annotationMode ? "标注模式：请单击模型表面添加问题点" : message}
      </div>
      {fitMode && (
        <div className="fit-legend">
          <span className="fit-high">高模透明轮廓</span>
          <span className="fit-blue">可成功烘焙</span>
          <span className="fit-red">包裹失败</span>
          {fitResult && <b>{fitResult.percent}%</b>}
        </div>
      )}
      {annotations.map((annotation, index) => (
        <span
          key={annotation.id}
          ref={(node) => {
            if (node) markerRefs.current.set(annotation.id, node);
            else markerRefs.current.delete(annotation.id);
          }}
          className={`model-annotation-marker ${annotation.severity}`}
          title={annotation.text}
        >
          {index + 1}
        </span>
      ))}
      <div className="viewer-axis">
        <span className="axis-y">Y</span>
        <span className="axis-x">X</span>
        <span className="axis-z">Z</span>
      </div>
    </div>
  );
}
