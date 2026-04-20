"use client";
import { useEffect, useRef, useState, useCallback } from "react";

const CLOUD = "dyazh2nxk";
const TOTAL = 521;

const IMAGES = Array.from({ length: TOTAL }, (_, i) => ({
  id: `img-${i}`,
  url: `https://res.cloudinary.com/${CLOUD}/image/upload/q_auto,f_auto/img${i.toString().padStart(5,"0")}.jpg`,
}));

function buildSpherePositions(count, radius) {
  const positions = [];
  const offset = 2 / count;
  const increment = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = ((i * offset) - 1) + offset / 2;
    const r = Math.sqrt(1 - Math.pow(y, 2));
    const phi = i * increment;
    positions.push({
      x: Math.cos(phi) * r * radius,
      y: y * radius,
      z: Math.sin(phi) * r * radius,
    });
  }
  return positions;
}

export default function Home() {
  const mountRef = useRef(null);
  const cameraCanvasRef = useRef(null);
  const videoRef = useRef(null);
  const [fullscreen, setFullscreen] = useState(null);
  const [loadedCount, setLoadedCount] = useState(0);
  const [cameraActive, setCameraActive] = useState(false);
  const threeRef = useRef({});

  const initThree = useCallback(async () => {
    const THREE = await import("three");
    const el = mountRef.current;
    if (!el) return;

    const W = innerWidth, H = innerHeight;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 8000);
    camera.position.set(0, 0, 1500);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    el.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    const RADIUS = 600;
    const TILE = 80;
    const positions = buildSpherePositions(TOTAL, RADIUS);
    const loader = new THREE.TextureLoader();
    const planes = [];
    let loaded = 0;

    positions.forEach((pos, i) => {
      const geo = new THREE.PlaneGeometry(TILE, TILE);
      const mat = new THREE.MeshBasicMaterial({ color: 0xcccccc, side: THREE.FrontSide });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pos.x, pos.y, pos.z);
      mesh.lookAt(0, 0, 0);
      mesh.rotateY(Math.PI);
      mesh.userData = { url: IMAGES[i].url };
      group.add(mesh);
      planes.push(mesh);
      loader.load(IMAGES[i].url, (tex) => {
        mat.map = tex;
        mat.color.set(0xffffff);
        mat.needsUpdate = true;
        loaded++;
        setLoadedCount(Math.round((loaded / TOTAL) * 100));
      });
    });

    let rotX = 0.15, rotY = 0;
    let velX = 0, velY = 0.0025;
    let dragging = false;
    let prevX = 0, prevY = 0;
    let targetFov = 55;
    let didDrag = false;
    let autoSpin = true;

    threeRef.current = { rotX, rotY, velX, velY, dragging, prevX, prevY, targetFov, didDrag, autoSpin, group, camera, renderer, planes, scene };

    const S = threeRef.current;

    const onDown = (x, y) => { S.dragging = true; S.autoSpin = false; S.prevX = x; S.prevY = y; S.velX = 0; S.velY = 0; S.didDrag = false; };
    const onMove = (x, y) => {
      if (!S.dragging) return;
      const dx = x - S.prevX, dy = y - S.prevY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) S.didDrag = true;
      S.velY = dx * 0.004; S.velX = dy * 0.004;
      S.rotY += S.velY; S.rotX += S.velX;
      S.rotX = Math.max(-1.4, Math.min(1.4, S.rotX));
      S.prevX = x; S.prevY = y;
    };
    const onUp = () => { S.dragging = false; };

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const onClick = (e) => {
      if (S.didDrag) return;
      mouse.x = (e.clientX / innerWidth) * 2 - 1;
      mouse.y = -(e.clientY / innerHeight) * 2 + 1;
      raycaster.setFromCamera(mouse, S.camera);
      const hits = raycaster.intersectObjects(S.planes);
      if (hits[0]) setFullscreen(hits[0].object.userData.url);
    };
    const onWheel = (e) => { S.targetFov = Math.max(20, Math.min(85, S.targetFov + e.deltaY * 0.03)); };

    let pinchDist = 0;
    const onTouchStart = (e) => {
      if (e.touches.length === 1) onDown(e.touches[0].clientX, e.touches[0].clientY);
      if (e.touches.length === 2) pinchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    };
    const onTouchMove = (e) => {
      e.preventDefault();
      if (e.touches.length === 1) onMove(e.touches[0].clientX, e.touches[0].clientY);
      if (e.touches.length === 2) {
        const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        S.targetFov = Math.max(20, Math.min(85, S.targetFov - (d - pinchDist) * 0.05));
        pinchDist = d;
      }
    };
    const onResize = () => {
      S.camera.aspect = innerWidth / innerHeight;
      S.camera.updateProjectionMatrix();
      S.renderer.setSize(innerWidth, innerHeight);
    };

    window.addEventListener("mousedown", e => onDown(e.clientX, e.clientY));
    window.addEventListener("mousemove", e => onMove(e.clientX, e.clientY));
    window.addEventListener("mouseup", onUp);
    window.addEventListener("click", onClick);
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onUp);
    window.addEventListener("resize", onResize);

    let animId;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (!S.dragging) {
        if (S.autoSpin) { S.rotY += 0.003; }
        else { S.velX *= 0.94; S.velY *= 0.94; S.rotX += S.velX; S.rotY += S.velY; S.rotX = Math.max(-1.4, Math.min(1.4, S.rotX)); }
      }
      S.group.rotation.x = S.rotX;
      S.group.rotation.y = S.rotY;
      S.camera.fov += (S.targetFov - S.camera.fov) * 0.08;
      S.camera.updateProjectionMatrix();
      S.renderer.render(S.scene, S.camera);
    };
    animate();
    threeRef.current.cleanup = () => {
      cancelAnimationFrame(animId);
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
      window.removeEventListener("mousedown", e => onDown(e.clientX, e.clientY));
      window.removeEventListener("mousemove", e => onMove(e.clientX, e.clientY));
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("click", onClick);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onUp);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const initHandTracking = useCallback(async () => {
    try {
      const vision = await import("@mediapipe/tasks-vision");
      const { HandLandmarker, FilesetResolver } = vision;
      const filesetResolver = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );
      const handLandmarker = await HandLandmarker.createFromOptions(filesetResolver, {
        baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task", delegate: "GPU" },
        runningMode: "VIDEO", numHands: 1,
      });

      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 240, height: 135 } });
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();
      setCameraActive(true);

      const cvs = cameraCanvasRef.current;
      const ctx = cvs.getContext("2d");
      let lastVideoTime = -1;
      let prevIndexTip = null;

      const detect = () => {
        if (video.currentTime !== lastVideoTime) {
          lastVideoTime = video.currentTime;
          ctx.save();
          ctx.scale(-1, 1);
          ctx.drawImage(video, -240, 0, 240, 135);
          ctx.restore();
          const results = handLandmarker.detectForVideo(video, performance.now());
          if (results.landmarks && results.landmarks.length > 0) {
            const lm = results.landmarks[0];
            const indexTip = lm[8];
            if (prevIndexTip && threeRef.current.group) {
              const dx = (indexTip.x - prevIndexTip.x) * 8;
              const dy = (indexTip.y - prevIndexTip.y) * 8;
              threeRef.current.rotY -= dx;
              threeRef.current.rotX -= dy;
              threeRef.current.rotX = Math.max(-1.4, Math.min(1.4, threeRef.current.rotX));
              threeRef.current.autoSpin = false;
            }
            prevIndexTip = indexTip;
          } else { prevIndexTip = null; }
        }
        requestAnimationFrame(detect);
      };
      detect();
    } catch (e) { console.log("Hand tracking not available:", e); }
  }, []);

  useEffect(() => {
    initThree();
    initHandTracking();
    return () => { threeRef.current.cleanup?.(); };
  }, [initThree, initHandTracking]);

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh", background: "#fff", overflow: "hidden" }}>
      <div ref={mountRef} style={{ position: "absolute", inset: 0, zIndex: 0 }} />

      {/* Camera preview bottom center */}
      <div style={{
        position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
        width: 240, height: 135, borderRadius: "1.8rem", overflow: "hidden",
        boxShadow: "0 20px 40px -10px rgba(0,0,0,0.1)",
        border: "5px solid white", background: "white",
        opacity: cameraActive ? 1 : 0.5, transition: "opacity 0.5s",
        zIndex: 10,
      }}>
        <video ref={videoRef} playsInline style={{ display: "none" }} width={240} height={135} />
        <canvas ref={cameraCanvasRef} width={240} height={135} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", border: "1px solid rgba(0,0,0,0.05)", borderRadius: "1.4rem" }} />
      </div>

      {/* Top left hint */}
      <div style={{ position: "absolute", top: 24, left: 24, zIndex: 10, display: "flex", flexDirection: "column", gap: 12 }}>
        <p style={{ paddingLeft: 8, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "rgb(163,163,163)", textTransform: "uppercase" }}>
          Pinch to zoom · Move to rotate
        </p>
      </div>

      {/* Loading */}
      {loadedCount < 100 && (
        <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "rgba(255,255,255,0.9)", borderRadius: 99, padding: "10px 24px", fontSize: 12, fontFamily: "system-ui", color: "rgba(0,0,0,0.4)", fontWeight: 600, letterSpacing: "0.1em", boxShadow: "0 2px 12px rgba(0,0,0,0.08)", zIndex: 20 }}>
          Loading {loadedCount}%
        </div>
      )}

      {/* Fullscreen */}
      {fullscreen && (
        <div onClick={() => setFullscreen(null)} style={{ position: "fixed", inset: 0, background: "rgba(255,255,255,0.97)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, cursor: "zoom-out", animation: "zoomIn 0.2s cubic-bezier(0.34,1.56,0.64,1)" }}>
          <style>{`@keyframes zoomIn{from{opacity:0;transform:scale(0.7)}to{opacity:1;transform:scale(1)}}`}</style>
          <img src={fullscreen} style={{ maxWidth: "88vw", maxHeight: "88vh", objectFit: "contain" }} />
        </div>
      )}
    </div>
  );
}
