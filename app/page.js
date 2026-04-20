"use client";
import { useEffect, useRef, useState } from "react";

const CLOUD = "dyazh2nxk";
const TOTAL = 521;

function imgUrl(i) {
  return `https://res.cloudinary.com/${CLOUD}/image/upload/q_auto,f_auto/img${i.toString().padStart(5,"0")}.jpg`;
}

function buildGridPositions(total, radius) {
  const positions = [];
  const rings = Math.round(Math.sqrt(total / 2)) + 4;
  for (let r = 0; r < rings; r++) {
    const phi = Math.PI * (r + 0.5) / rings;
    const circumference = Math.sin(phi);
    const count = Math.max(1, Math.round(total * circumference / rings * 2.2));
    for (let c = 0; c < count; c++) {
      const theta = (2 * Math.PI * c) / count;
      positions.push({
        x: radius * Math.sin(phi) * Math.cos(theta),
        y: radius * Math.cos(phi),
        z: radius * Math.sin(phi) * Math.sin(theta),
      });
    }
  }
  return positions;
}

export default function Home() {
  const mountRef = useRef(null);
  const [fullscreen, setFullscreen] = useState(null);
  const [loaded, setLoaded] = useState(0);

  useEffect(() => {
    let cleanup;
    import("three").then((THREE) => {
      const W = innerWidth, H = innerHeight;
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xffffff);

      const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 6000);
      camera.position.set(0, 0, 1500);

      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(W, H);
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      mountRef.current.appendChild(renderer.domElement);

      const group = new THREE.Group();
      scene.add(group);

      const RADIUS = 600;
      const TILE = 78;
      const positions = buildGridPositions(TOTAL, RADIUS);
      const loader = new THREE.TextureLoader();
      const planes = [];
      let loadCount = 0;

      positions.slice(0, TOTAL).forEach((pos, i) => {
        const geo = new THREE.PlaneGeometry(TILE, TILE);
        const mat = new THREE.MeshBasicMaterial({ color: 0xdddddd, side: THREE.FrontSide });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(pos.x, pos.y, pos.z);
        mesh.lookAt(0, 0, 0);
        mesh.rotateY(Math.PI);
        mesh.userData = { url: imgUrl(i % TOTAL) };
        group.add(mesh);
        planes.push(mesh);

        loader.load(imgUrl(i % TOTAL), (tex) => {
          mat.map = tex;
          mat.color.set(0xffffff);
          mat.needsUpdate = true;
          loadCount++;
          setLoaded(Math.round((loadCount / TOTAL) * 100));
        });
      });

      let rotX = 0.1, rotY = 0;
      let velX = 0, velY = 0.003;
      let dragging = false;
      let prevX = 0, prevY = 0;
      let targetFov = 55;
      let didDrag = false;
      let autoSpin = true;

      const onDown = (x, y) => {
        dragging = true; autoSpin = false;
        prevX = x; prevY = y;
        velX = 0; velY = 0; didDrag = false;
      };
      const onMove = (x, y) => {
        if (!dragging) return;
        const dx = x - prevX, dy = y - prevY;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) didDrag = true;
        velY = dx * 0.004;
        velX = dy * 0.004;
        rotY += velY;
        rotX += velX;
        rotX = Math.max(-1.4, Math.min(1.4, rotX));
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
        targetFov = Math.max(20, Math.min(85, targetFov + e.deltaY * 0.03));
      };

      let pinchDist = 0;
      const onTouchStart = (e) => {
        if (e.touches.length === 1) onDown(e.touches[0].clientX, e.touches[0].clientY);
        if (e.touches.length === 2) pinchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      };
      const onTouchMove = (e) => {
        e.preventDefault();
        if (e.touches.length === 1) onMove(e.touches[0].clientX, e.touches[0].clientY);
        if (e.touches.length === 2) {
          const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
          targetFov = Math.max(20, Math.min(85, targetFov - (d - pinchDist) * 0.05));
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
      window.addEventListener("wheel",      onWheel, { passive: true });
      window.addEventListener("touchstart", onTouchStart, { passive: true });
      window.addEventListener("touchmove",  onTouchMove, { passive: false });
      window.addEventListener("touchend",   onUp);
      window.addEventListener("resize",     onResize);

      let animId;
      const animate = () => {
        animId = requestAnimationFrame(animate);
        if (!dragging) {
          if (autoSpin) {
            rotY += 0.003;
          } else {
            velX *= 0.94; velY *= 0.94;
            rotX += velX; rotY += velY;
            rotX = Math.max(-1.4, Math.min(1.4, rotX));
          }
        }
        group.rotation.x = rotX;
        group.rotation.y = rotY;
        camera.fov += (targetFov - camera.fov) * 0.08;
        camera.updateProjectionMatrix();
        renderer.render(scene, camera);
      };
      animate();

      cleanup = () => {
        cancelAnimationFrame(animId);
        renderer.dispose();
        if (mountRef.current?.contains(renderer.domElement))
          mountRef.current.removeChild(renderer.domElement);
        ["mousedown","mousemove","mouseup","click","wheel","touchstart","touchmove","touchend","resize"]
          .forEach(ev => window.removeEventListener(ev, () => {}));
      };
    });
    return () => cleanup?.();
  }, []);

  return (
    <>
      <div ref={mountRef} style={{ width: "100vw", height: "100vh", cursor: "grab" }} />

      <p style={{
        position: "fixed", top: 24, left: 24,
        color: "rgba(0,0,0,0.3)", fontSize: 11,
        fontFamily: "system-ui,sans-serif",
        fontWeight: 700, letterSpacing: "0.15em",
        textTransform: "uppercase", pointerEvents: "none",
      }}>
        Pinch to zoom · Move to rotate
      </p>

      {loaded < 100 && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: "rgba(255,255,255,0.9)", borderRadius: 99,
          padding: "8px 20px", fontSize: 11,
          fontFamily: "system-ui,sans-serif", color: "rgba(0,0,0,0.4)",
          fontWeight: 600, letterSpacing: "0.1em",
          boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
        }}>
          Loading {loaded}%
        </div>
      )}

      {fullscreen && (
        <div onClick={() => setFullscreen(null)} style={{
          position: "fixed", inset: 0,
          background: "rgba(255,255,255,0.97)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 999, cursor: "zoom-out",
          animation: "zoomIn 0.2s cubic-bezier(0.34,1.56,0.64,1)",
        }}>
          <style>{`@keyframes zoomIn{from{opacity:0;transform:scale(0.7)}to{opacity:1;transform:scale(1)}}`}</style>
          <img src={fullscreen} style={{ maxWidth: "88vw", maxHeight: "88vh", objectFit: "contain" }} />
        </div>
      )}
    </>
  );
}
