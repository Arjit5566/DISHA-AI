import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Sparkles, Torus, MeshDistortMaterial } from "@react-three/drei";
import { Suspense, useRef } from "react";
import type { Group, Mesh } from "three";

function Document() {
  const m = useRef<Mesh>(null);
  useFrame((_, dt) => {
    if (m.current) m.current.rotation.y += dt * 0.5;
  });
  return (
    <Float speed={2} rotationIntensity={1} floatIntensity={1.4}>
      <mesh ref={m}>
        <boxGeometry args={[1.6, 2.1, 0.05]} />
        
        <MeshDistortMaterial color="#a78bfa" emissive="#6366F1" emissiveIntensity={0.5} distort={0.15} speed={1} roughness={0.2} metalness={0.7} />
      </mesh>
    </Float>
  );
}

function Rings() {
  const g = useRef<Group>(null);
  useFrame((_, dt) => {
    if (g.current) g.current.rotation.z += dt * 0.4;
  });
  return (
    <group ref={g}>
      <Torus args={[2.2, 0.02, 16, 100]} rotation={[Math.PI / 3, 0, 0]}>
        <meshStandardMaterial color="#8B5CF6" emissive="#8B5CF6" emissiveIntensity={1} />
      </Torus>
      <Torus args={[2.6, 0.015, 16, 100]} rotation={[Math.PI / 2.2, Math.PI / 4, 0]}>
        <meshStandardMaterial color="#06B6D4" emissive="#06B6D4" emissiveIntensity={1} />
      </Torus>
    </group>
  );
}

export function ProcessingOrb() {
  return (
    <Canvas camera={{ position: [0, 0, 6], fov: 50 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }} className="!absolute inset-0">
      <Suspense fallback={null}>
        <ambientLight intensity={0.5} />
        <pointLight position={[5, 5, 5]} intensity={2.5} color="#a78bfa" />
        <pointLight position={[-5, -3, -5]} intensity={2} color="#06B6D4" />
        <Document />
        <Rings />
        <Sparkles count={120} scale={8} size={4} speed={0.6} color="#c4b5fd" />
      </Suspense>
    </Canvas>
  );
}
