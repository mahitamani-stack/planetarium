"use client";
import { useEffect, useRef, useState } from "react";

const TOTAL = 521;
const CLOUD = "dyazh2nxk";
const RADIUS = 800;

function imgUrl(i) {
  return `https://res.cloudinary.com/${CLOUD}/image/upload/q_auto,f_auto/img${i.toString().padStart(5,"0")}.jpg`;
}

export default function Home() {
  const mountRef = useRef(null);
  const [fullscreen, setFullscreen] = useState(null);

  useEffect(() => {
    let cleanup;
    import("three").then((THREE) => {
      const scene    = new THREE.Scene();
      const camera   = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 3000);
      camera.position.set(0, 0, 0);

      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(innerWidth, innerHeight);
      renderer.setPixelRatio(devicePixelRatio);
      mountRef.current.appendChild(renderer.domElement);

      const loader = new THREE.TextureLoader();
      const planes  = [];

      for (let i = 0; i < TOTAL; i++) {
        const phi   = Math.acos(-1 + (2 * i) / TOTAL);
        const theta = Math.sqrt(TOTAL * Math.PI) * phi;
        const x = RADIUS * Math.sin(phi) * Math.cos(theta);
        const y = RADIUS * Math.cos(phi);
        const z = RADIUS * Math.sin(phi) * Math.sin(theta);

        const geo = new THREE.PlaneGeometry(90, 120);
        const mat = new THREE.MeshBasicMaterial({ color: 0x222222, side: THREE.FrontSide });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        mesh.lookAt(0, 0, 0);
        mesh.userData = { url: imgUrl(i) };
        scene.add(mesh);
        planes.push(mesh);

        loader.load(imgUrl(i), (tex) => {
          mat.map = tex;
          mat.color.set(0xffffff);
          mat.needsUpdate = true;
        });
      }

      let rotX = 0, rotY = 0;
      let velX = 0, velY = 0;
      let dragging = false;
      let prevX = 0, prevY = 0;
      let fov = 70;
      let didDrag = false;

      const onDown = (x, y) => { dragging = true; prevX = x; prevY = y; velX = 0; velY = 0; didDrag = false; };
      const onMove = (x, y) => {
        if (!dragging) return;
        const dx = x - prevX, dy = y - prevY;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) didDrag = true;
        velX = dy * 0.004; velY = dx * 0.004;
        rotX += velX; rotY += velY;
        rotX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotX));
        prevX = x; prevY = y;
      };
      const onUp = () => { dragging = false; };

      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2();
      const onClick = (e) => {
        if (didDrag) return;
        mouse.x = (e.clientX / innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(planes);
        if (hits[0]) setFullscreen(hits[0].object.userData.url);
      };

      const onWheel = (e) => {
        fov = Math.max(20, Math.min(100, fov + e.deltaY * 0.05));
        camera.fov = fov;
        camera.updateProjectionMatrix();
      };

      let pinchDist = 0;
      const onTouchStart = (e) => {
        if (e.touches.length === 1) onDown(e.touches[0].clientX, e.touches[0].clientY);
        if (e.touches.length === 2) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          pinchDist = Math.hypot(dx, dy);
        }
      };
      const onTouchMove = (e) => {
        e.preventDefault();
        if (e.touches.length === 1) onMove(e.touches[0].clientX, e.touches[0].clientY);
        if (e.touches.length === 2) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const d = Math.hypot(dx, dy);
          fov = Math.max(20, Math.min(100, fov - (d - pinchDist) * 0.1));
          camera.fov = fov;
          camera.updateProjectionMatrix();
          pinchDist = d;
        }
      };

      const onResize = () => {
        camera.aspect = innerWidth / innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(innerWidth, innerHeight);
      };

      window.addEventListener("mousedown",  e => onDown(e.clientX, e.clientY));
      window.addEventListener("mousemove",  e => onMove(e.clientX, e.clientY));
      window.addEventListener("mouseup",    onUp);
      window.addEventListener("click",      onClick);
      window.addEventListener("wheel",      onWheel);
      window.addEventListener("touchstart", onTouchStart, { passive: true });
      window.addEventListener("touchmove",  onTouchMove,  { passive: false });
      window.addEventListener("touchend",   onUp);
      window.addEventListener("resize",     onResize);

      let animId;
      const animate = () => {
        animId = requestAnimationFrame(animate);
        if (!dragging) {
          velX *= 0.93; velY *= 0.93;
          rotX += velX * 0.1; rotY += velY * 0.1;
        }
        camera.rotation.order = "YXZ";
        camera.rotation.y = -rotY;
        camera.rotation.x = -rotX;
        renderer.render(scene, camera);
      };
      animate();

      cleanup = () => {
        cancelAnimationFrame(animId);
        renderer.dispose();
        if (mountRef.current?.contains(renderer.domElement))
          mountRef.current.removeChild(renderer.domElement);
        window.removeEventListener("mousedown",  e => onDown(e.clientX, e.clientY));
        window.removeEventListener("mousemove",  e => onMove(e.clientX, e.clientY));
        window.removeEventListener("mouseup",    onUp);
        window.removeEventListener("click",      onClick);
        window.removeEventListener("wheel",      onWheel);
        window.removeEventListener("touchstart", onTouchStart);
        window.removeEventListener("touchmove",  onTouchMove);
        window.removeEventListener("touchend",   onUp);
        window.removeEventListener("resize",     onResize);
      };
    });
    return () => cleanup?.();
  }, []);

  return (
    <>
      <div ref={mountRef} style={{ width: "100vw", height: "100vh", background: "#000", cursor: "grab" }} />

      {fullscreen && (
        <div onClick={() => setFullscreen(null)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 999, cursor: "pointer",
        }}>
          <img src={fullscreen} style={{
            maxWidth: "90vw", maxHeight: "90vh",
            borderRadius: 16, objectFit: "contain",
            boxShadow: "0 0 80px rgba(0,0,0,0.8)",
          }} />
          <p style={{ position: "absolute", bottom: 24, color: "rgba(255,255,255,0.4)", fontSize: 13, fontFamily: "sans-serif" }}>
            tap anywhere to close
          </p>
        </div>
      )}

      <p style={{
        position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)",
        color: "rgba(255,255,255,0.25)", fontSize: 12,
        fontFamily: "sans-serif", pointerEvents: "none",
      }}>
        drag · scroll to zoom · tap image to open
      </p>
    </>
  );
}
