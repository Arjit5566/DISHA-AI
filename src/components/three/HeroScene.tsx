import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Icosahedron, MeshDistortMaterial, Stars, Sparkles } from "@react-three/drei";
import { Suspense, useRef } from "react";
import type { Mesh } from "three";

function Core() {
  const m = useRef<Mesh>(null);
  useFrame((_, dt) => {
    if (m.current) {
      m.current.rotation.x += dt * 0.15;
      m.current.rotation.y += dt * 0.2;
    }
  });
  return (
    <Float speed={1.4} rotationIntensity={0.6} floatIntensity={1.2}>
      <Icosahedron ref={m} args={[1.4, 2]}>
        
        <MeshDistortMaterial color="#8B5CF6" emissive="#6366F1" emissiveIntensity={0.6} distort={0.42} speed={1.6} roughness={0.15} metalness={0.85} />
      </Icosahedron>
    </Float>
  );
}

export function HeroScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 50 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      className="!absolute inset-0"
    >
      <Suspense fallback={null}>
        <ambientLight intensity={0.4} />
        <pointLight position={[5, 5, 5]} intensity={2.5} color="#8B5CF6" />
        <pointLight position={[-5, -5, -5]} intensity={2} color="#06B6D4" />
        <Core />
        <Sparkles count={80} scale={6} size={3} speed={0.4} color="#a78bfa" />
        <Stars radius={50} depth={50} count={2000} factor={4} fade speed={1} />
      </Suspense>
    </Canvas>
  );
}
