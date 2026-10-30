"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Float } from "@react-three/drei";
import * as THREE from "three";

function stripeTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#120e0b";
  ctx.fillRect(0, 0, 128, 512);
  const colors = ["#c9a35c", "#f7f1e6", "#6e1d22"];
  const stripe = 36;
  for (let i = -8; i < 24; i++) {
    ctx.fillStyle = colors[((i % 3) + 3) % 3];
    ctx.beginPath();
    ctx.moveTo(0, i * stripe);
    ctx.lineTo(128, i * stripe + 96);
    ctx.lineTo(128, i * stripe + 96 + stripe * 0.72);
    ctx.lineTo(0, i * stripe + stripe * 0.72);
    ctx.closePath();
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function Pole() {
  const tex = useMemo(() => stripeTexture(), []);
  useEffect(() => () => tex?.dispose(), [tex]);
  useFrame((_, delta) => {
    if (tex) tex.offset.y = (tex.offset.y - delta * 0.18) % 1;
  });
  return (
    <group>
      <mesh position={[0, 1.35, 0]}>
        <sphereGeometry args={[0.2, 24, 16]} />
        <meshStandardMaterial color="#e6cf9b" metalness={0.55} roughness={0.28} />
      </mesh>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.34, 0.34, 2.35, 48, 1, true]} />
        <meshStandardMaterial map={tex ?? undefined} color={tex ? "#ffffff" : "#c9a35c"} roughness={0.42} metalness={0.12} />
      </mesh>
      <mesh position={[0, 1.18, 0]}>
        <cylinderGeometry args={[0.4, 0.4, 0.08, 32]} />
        <meshStandardMaterial color="#e8d7a8" metalness={0.7} roughness={0.22} />
      </mesh>
      <mesh position={[0, -1.12, 0]}>
        <cylinderGeometry args={[0.4, 0.46, 0.1, 32]} />
        <meshStandardMaterial color="#e8d7a8" metalness={0.7} roughness={0.22} />
      </mesh>
      <mesh position={[0, -1.32, 0]}>
        <cylinderGeometry args={[0.16, 0.22, 0.28, 24]} />
        <meshStandardMaterial color="#2a241c" metalness={0.4} roughness={0.45} />
      </mesh>
    </group>
  );
}

function Scissors() {
  const gold = { color: "#f4e2a8", metalness: 0.58, roughness: 0.24 };
  return (
    <Float speed={1.4} rotationIntensity={0.25} floatIntensity={0.45}>
      <group position={[0.78, 0.42, 1.25]} rotation={[0.35, 0.15, 0.62]} scale={0.72}>
        <mesh position={[0.2, 0.34, 0]} rotation={[0, 0, 0.2]}>
          <boxGeometry args={[0.045, 1.2, 0.016]} />
          <meshStandardMaterial {...gold} />
        </mesh>
        <mesh position={[-0.2, 0.34, 0]} rotation={[0, 0, -0.2]}>
          <boxGeometry args={[0.045, 1.2, 0.016]} />
          <meshStandardMaterial color="#e2c27a" metalness={0.58} roughness={0.24} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.05, 24]} />
          <meshStandardMaterial color="#fff4d0" metalness={0.4} roughness={0.2} />
        </mesh>
        <mesh position={[0.34, -0.5, 0]}>
          <torusGeometry args={[0.13, 0.022, 12, 28]} />
          <meshStandardMaterial {...gold} />
        </mesh>
        <mesh position={[-0.34, -0.5, 0]}>
          <torusGeometry args={[0.13, 0.022, 12, 28]} />
          <meshStandardMaterial {...gold} />
        </mesh>
      </group>
    </Float>
  );
}

function Dust() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const seeds = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        r: 1.15 + (i % 5) * 0.18,
        y: ((i * 37) % 100) / 40 - 1.2,
        a: (i / 28) * Math.PI * 2,
        s: 0.012 + (i % 4) * 0.006,
        sp: 0.12 + (i % 3) * 0.05,
      })),
    [],
  );
  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = clock.elapsedTime;
    for (let i = 0; i < seeds.length; i++) {
      const p = seeds[i];
      const a = p.a + t * p.sp;
      dummy.position.set(Math.cos(a) * p.r, p.y + Math.sin(t * 0.8 + i) * 0.06, Math.sin(a) * p.r * 0.42);
      dummy.scale.setScalar(p.s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, seeds.length]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshStandardMaterial color="#f3e2b0" emissive="#c9a35c" emissiveIntensity={0.45} roughness={0.35} />
    </instancedMesh>
  );
}

function Stage() {
  const ring = useRef<THREE.Mesh>(null);
  const rig = useRef<THREE.Group>(null);
  const aim = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      aim.current.x = (e.clientX / window.innerWidth - 0.5) * 0.45;
      aim.current.y = (e.clientY / window.innerHeight - 0.5) * 0.25;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);
  useFrame((_, delta) => {
    if (ring.current) ring.current.rotation.z += delta * 0.25;
    const g = rig.current;
    if (!g) return;
    g.rotation.y += (aim.current.x - g.rotation.y) * 0.06;
    g.rotation.x += (aim.current.y * 0.4 - g.rotation.x) * 0.06;
  });
  return (
    <group ref={rig} position={[0.15, -0.05, 0]}>
      <Pole />
      <Scissors />
      <Dust />
      <mesh ref={ring} rotation={[1.25, 0.45, 0.2]}>
        <torusGeometry args={[0.92, 0.014, 12, 80]} />
        <meshStandardMaterial color="#e6cf9b" metalness={0.55} roughness={0.25} />
      </mesh>
      <ContactShadows position={[0, -1.48, 0]} opacity={0.45} scale={7} blur={2.2} far={2.6} color="#000000" />
    </group>
  );
}

export default function HeroCanvas() {
  return (
    <div className="absolute inset-0" aria-hidden>
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [1.7, 0.35, 4.5], fov: 32 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        onCreated={({ gl, camera }) => {
          gl.setClearColor(0x000000, 0);
          camera.lookAt(0, 0.05, 0);
        }}
      >
        <ambientLight intensity={0.55} />
        <directionalLight position={[4, 3.5, 5]} intensity={2.4} color="#fff6e4" />
        <directionalLight position={[-3.5, 1.2, -2]} intensity={1.1} color="#e7c98a" />
        <pointLight position={[0.2, 0.4, 2.2]} intensity={6} distance={7} color="#ffe7b0" />
        <Stage />
      </Canvas>
    </div>
  );
}
