"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Image as DreiImage, Environment } from "@react-three/drei";
import * as THREE from "three";

const CLOUD = "dyazh2nxk";
const TOTAL = 521;
const RADIUS = 7;

const ALL_URLS = Array.from({ length: TOTAL }, (_, i) =>
  `https://res.cloudinary.com/${CLOUD}/image/upload/q_auto,f_auto/img${i.toString().padStart(5,"0")}.jpg`
);

// Pick 65 random images — different every time the page loads
const shuffled = [...ALL_URLS].sort(() => Math.random() - 0.5);
const IMAGES = shuffled.slice(0, 65).map((url, i) => ({ id: `img-${i}`, url }));

function buildFibonacciSphere(count, radius) {
  const positions = [];
  const offset = 2 / count;
  const increment = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = ((i * offset) - 1) + offset / 2;
    const r = Math.sqrt(1 - y * y);
    const phi = i * increment;
    positions.push([Math.cos(phi) * r * radius, y * radius, Math.sin(phi) * r * radius]);
  }
  return positions;
}

const spherePositions = buildFibonacciSphere(TOTAL, RADIUS);
const items = IMAGES.map((img, i) => ({ ...img, position: spherePositions[i] }));

function PhotoTile({ item, onImageClick }) {
  const ref = useRef();
  useFrame(() => { if (ref.current) ref.current.lookAt(0, 0, 0); });
  return (
    <group position={item.position}>
      <DreiImage
        ref={ref}
        url={item.url}
        transparent
        opacity={1}
        scale={[1, 1.4, 1]}
        toneMapped={false}
        onClick={(e) => { e.stopPropagation(); onImageClick(item.url); }}
        onError={() => {}}
      />
    </group>
  );
}

function Scene({ handDataRef, onImageClick }) {
  const groupRef = useRef();
  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const hand = handDataRef.current;
    const lerpFactor = 0.12;
    if (hand.present) {
      const targetScale = 0.4 + Math.min(Math.max((hand.distance - 0.04) / 0.36, 0), 1) * 29.6;
      const s = THREE.MathUtils.lerp(groupRef.current.scale.x, targetScale, lerpFactor);
      groupRef.current.scale.set(s, s, s);
      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, (hand.position.y - 0.5) * Math.PI * 3.5, lerpFactor);
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, (hand.position.x - 0.5) * Math.PI * 3.5, lerpFactor);
    } else {
      groupRef.current.rotation.y += delta * 0.05;
      const s = THREE.MathUtils.lerp(groupRef.current.scale.x, 0.8, 0.05);
      groupRef.current.scale.set(s, s, s);
      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, 0, 0.03);
    }
  });
  return (
    <group ref={groupRef}>
      {items.map(item => <PhotoTile key={item.id} item={item} onImageClick={onImageClick} />)}
    </group>
  );
}

const HAND_CONNECTIONS = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];

export default function Home() {
  const videoRef = useRef(null);
  const cameraCanvasRef = useRef(null);
  const handDataRef = useRef({ present: false, distance: 0.1, position: { x: 0.5, y: 0.5 } });
  const smoothRef = useRef({ distance: 0.1, x: 0.5, y: 0.5 });
  const [cameraReady, setCameraReady] = useState(false);
  const [fullscreen, setFullscreen] = useState(null);

  useEffect(() => {
    let animId, stream, handLandmarker;
    async function init() {
      try {
        const { HandLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
        const filesetResolver = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        handLandmarker = await HandLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 1,
        });
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 240, height: 135, facingMode: "user" } });
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        setCameraReady(true);

        const cvs = cameraCanvasRef.current;
        const ctx = cvs.getContext("2d");
        let lastTime = -1;

        function detect() {
          animId = requestAnimationFrame(detect);
          if (!video || video.currentTime === lastTime) return;
          lastTime = video.currentTime;
          ctx.save();
          ctx.translate(240, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(video, 0, 0, 240, 135);
          ctx.restore();
          const results = handLandmarker.detectForVideo(video, performance.now());
          if (results.landmarks?.length > 0) {
            const lm = results.landmarks[0];
            const mirrored = lm.map(p => ({ ...p, x: 1 - p.x }));
            ctx.strokeStyle = "#000"; ctx.lineWidth = 2;
            HAND_CONNECTIONS.forEach(([a, b]) => {
              ctx.beginPath();
              ctx.moveTo(mirrored[a].x * 240, mirrored[a].y * 135);
              ctx.lineTo(mirrored[b].x * 240, mirrored[b].y * 135);
              ctx.stroke();
            });
            mirrored.forEach(p => {
              ctx.beginPath();
              ctx.arc(p.x * 240, p.y * 135, 2.5, 0, Math.PI * 2);
              ctx.fillStyle = "#fff"; ctx.fill();
              ctx.strokeStyle = "#000"; ctx.lineWidth = 1; ctx.stroke();
            });
            const thumbTip = lm[4], indexTip = lm[8], palm = lm[9];
            const dist = Math.sqrt(Math.pow(thumbTip.x - indexTip.x, 2) + Math.pow(thumbTip.y - indexTip.y, 2));
            const z = 0.4;
            smoothRef.current.distance += (dist - smoothRef.current.distance) * z;
            smoothRef.current.x += (palm.x - smoothRef.current.x) * z;
            smoothRef.current.y += (palm.y - smoothRef.current.y) * z;
            handDataRef.current = { present: true, distance: smoothRef.current.distance, position: { x: 1 - smoothRef.current.x, y: smoothRef.current.y } };
          } else {
            smoothRef.current.distance += (0.1 - smoothRef.current.distance) * 0.08;
            smoothRef.current.x += (0.5 - smoothRef.current.x) * 0.05;
            smoothRef.current.y += (0.5 - smoothRef.current.y) * 0.05;
            handDataRef.current = { present: false, distance: smoothRef.current.distance, position: { x: smoothRef.current.x, y: smoothRef.current.y } };
          }
        }
        detect();
      } catch (err) {
        console.warn("Hand tracking unavailable:", err);
      }
    }
    init();
    return () => {
      if (animId) cancelAnimationFrame(animId);
      stream?.getTracks().forEach(t => t.stop());
    };
  }, []);

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh", background: "#fff", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, zIndex: 0, background: "#fff" }}>
        <Canvas
          camera={{ position: [0, 0, 22], fov: 38 }}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          dpr={[1, 2]}
        >
          <color attach="background" args={["#ffffff"]} />
          <fog attach="fog" args={["#ffffff", 25, 40]} />
          <ambientLight intensity={2} />
          <directionalLight position={[10, 20, 20]} intensity={2.5} color="#ffffff" />
          <Suspense fallback={null}>
            <Scene handDataRef={handDataRef} onImageClick={setFullscreen} />
            <Environment preset="studio" />
          </Suspense>
        </Canvas>
      </div>

      {/* Camera preview — bottom center, exactly like reference */}
      <div style={{
        position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
        width: 240, height: 135, borderRadius: "1.8rem", overflow: "hidden",
        boxShadow: "0 20px 40px -10px rgba(0,0,0,0.1)",
        border: "5px solid white", background: "white",
        opacity: cameraReady ? 1 : 0.3, transition: "opacity 0.5s", zIndex: 10,
      }}>
        <video ref={videoRef} playsInline muted style={{ display: "none" }} width={240} height={135} />
        <canvas ref={cameraCanvasRef} width={240} height={135} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", border: "1px solid rgba(0,0,0,0.05)", borderRadius: "1.4rem" }} />
      </div>

      {/* Hint text — top left exactly like reference */}
      <div style={{ position: "absolute", top: 24, left: 24, zIndex: 10 }}>
        <p style={{ paddingLeft: 8, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "rgb(163,163,163)", textTransform: "uppercase", fontFamily: "Inter, system-ui, sans-serif" }}>
          Pinch to zoom · Move to rotate
        </p>
      </div>

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
