import * as THREE from 'three';

export interface ProceduralArtifactHandle {
  group: THREE.Group;
  update: (elapsed: number, delta: number) => void;
}

/**
 * Builds a composite 10-part architectural sculpture representing the intersection
 * of Law (precision balance rings) and Technology (faceted polyhedral core & orbital nodes).
 * Used automatically when `/models/scene.glb` is not present.
 */
export function createProceduralArtifact(): ProceduralArtifactHandle {
  const group = new THREE.Group();
  group.name = 'LawTechProceduralArtifact';

  // Varied PBR materials (roughness delta >= 0.25 between adjacent parts)
  const coreMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#1E3A8A'),
    metalness: 0.28,
    roughness: 0.16,
    clearcoat: 1.0,
    clearcoatRoughness: 0.12,
    reflectivity: 0.9,
    flatShading: true,
    envMapIntensity: 1.4,
  });

  const nucleusMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#C4956A'),
    emissive: new THREE.Color('#9A6B3B'),
    emissiveIntensity: 0.35,
    metalness: 0.65,
    roughness: 0.35,
    envMapIntensity: 1.1,
  });

  const bronzeRingMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#C4956A'),
    metalness: 0.92,
    roughness: 0.22,
    envMapIntensity: 1.5,
  });

  const titaniumRingMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#8C919E'),
    metalness: 0.85,
    roughness: 0.48,
    envMapIntensity: 1.2,
  });

  const indigoCollarMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#162657'),
    metalness: 0.72,
    roughness: 0.52,
    envMapIntensity: 1.1,
  });

  const latticeLineMaterial = new THREE.LineBasicMaterial({
    color: new THREE.Color('#4C6EF5'),
    transparent: true,
    opacity: 0.48,
  });

  const nodeMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#D4A77D'),
    metalness: 0.9,
    roughness: 0.2,
    envMapIntensity: 1.4,
  });

  // 1. Primary silhouette: Faceted crystalline icosahedron core
  const coreGeo = new THREE.IcosahedronGeometry(0.68, 0);
  const coreMesh = new THREE.Mesh(coreGeo, coreMaterial);
  coreMesh.castShadow = true;
  coreMesh.receiveShadow = true;
  group.add(coreMesh);

  // 2. Inner warm nucleus octahedron visible through gaps / silhouettes
  const nucleusGeo = new THREE.OctahedronGeometry(0.32, 0);
  const nucleusMesh = new THREE.Mesh(nucleusGeo, nucleusMaterial);
  nucleusMesh.position.set(0, 0, 0);
  group.add(nucleusMesh);

  // 3. Outer geodesic precision wireframe lattice
  const latticeBaseGeo = new THREE.IcosahedronGeometry(0.92, 1);
  const latticeEdgesGeo = new THREE.EdgesGeometry(latticeBaseGeo);
  latticeBaseGeo.dispose();
  const latticeSegments = new THREE.LineSegments(latticeEdgesGeo, latticeLineMaterial);
  group.add(latticeSegments);

  // 4. Equatorial brushed-bronze balance ring
  const ring1Geo = new THREE.TorusGeometry(1.18, 0.028, 24, 96);
  const ring1 = new THREE.Mesh(ring1Geo, bronzeRingMaterial);
  ring1.rotation.x = Math.PI * 0.42;
  ring1.rotation.y = Math.PI * 0.12;
  ring1.castShadow = true;
  group.add(ring1);

  // 5. Tilted brushed-titanium governance ring
  const ring2Geo = new THREE.TorusGeometry(1.36, 0.018, 20, 96);
  const ring2 = new THREE.Mesh(ring2Geo, titaniumRingMaterial);
  ring2.rotation.x = -Math.PI * 0.28;
  ring2.rotation.y = Math.PI * 0.35;
  ring2.castShadow = true;
  group.add(ring2);

  // 6. Perpendicular anodized indigo cryptographic collar ring
  const ring3Geo = new THREE.TorusGeometry(1.02, 0.022, 20, 84);
  const ring3 = new THREE.Mesh(ring3Geo, indigoCollarMaterial);
  ring3.rotation.y = Math.PI * 0.5;
  ring3.rotation.z = Math.PI * 0.18;
  group.add(ring3);

  // 7 & 8. Precision axis pole finials (top and bottom anchors)
  const finialGeo = new THREE.CylinderGeometry(0.025, 0.075, 0.22, 6);
  const topFinial = new THREE.Mesh(finialGeo, bronzeRingMaterial);
  topFinial.position.set(0, 1.06, 0);
  group.add(topFinial);

  const bottomFinial = new THREE.Mesh(finialGeo, bronzeRingMaterial);
  bottomFinial.position.set(0, -1.06, 0);
  bottomFinial.rotation.z = Math.PI;
  group.add(bottomFinial);

  // 9. Orbiting trust / data satellite nodes on sub-pivot
  const satelliteGroup = new THREE.Group();
  const nodeGeo = new THREE.OctahedronGeometry(0.065, 0);
  const nodeOffsets: [number, number, number][] = [
    [1.18, 0.18, 0],
    [-1.18, -0.18, 0],
    [0, 0.24, 1.32],
    [0, -0.24, -1.32],
  ];

  nodeOffsets.forEach((pos) => {
    const node = new THREE.Mesh(nodeGeo, nodeMaterial);
    node.position.set(pos[0], pos[1], pos[2]);
    satelliteGroup.add(node);
  });
  group.add(satelliteGroup);

  // 10. Fine inner structural meridian arc
  const meridianGeo = new THREE.TorusGeometry(0.84, 0.008, 12, 72);
  const meridian = new THREE.Mesh(meridianGeo, bronzeRingMaterial);
  meridian.rotation.z = Math.PI * 0.25;
  group.add(meridian);

  const update = (elapsed: number, delta: number) => {
    coreMesh.rotation.y += delta * 0.22;
    coreMesh.rotation.x += delta * 0.09;

    nucleusMesh.rotation.y -= delta * 0.35;
    latticeSegments.rotation.y += delta * 0.12;
    latticeSegments.rotation.z = Math.sin(elapsed * 0.35) * 0.08;

    ring1.rotation.z += delta * 0.18;
    ring2.rotation.z -= delta * 0.14;
    ring3.rotation.x += delta * 0.11;

    satelliteGroup.rotation.y += delta * 0.25;
    satelliteGroup.rotation.x = Math.sin(elapsed * 0.4) * 0.15;
  };

  return { group, update };
}

/**
 * Recursively disposes geometries, materials, and attached textures inside a Three.js Object3D.
 */
export function disposeObject3D(root: THREE.Object3D): void {
  const disposedGeometries = new Set<THREE.BufferGeometry>();
  const disposedMaterials = new Set<THREE.Material>();
  const disposedTextures = new Set<THREE.Texture>();

  const textureProps = [
    'map',
    'normalMap',
    'roughnessMap',
    'metalnessMap',
    'aoMap',
    'emissiveMap',
    'envMap',
    'alphaMap',
    'bumpMap',
    'displacementMap',
    'lightMap',
    'clearcoatMap',
    'clearcoatNormalMap',
    'clearcoatRoughnessMap',
  ] as const;

  const disposeMaterial = (mat: THREE.Material) => {
    if (disposedMaterials.has(mat)) return;
    disposedMaterials.add(mat);

    const record = mat as unknown as Record<string, unknown>;
    for (const prop of textureProps) {
      const value = record[prop];
      if (value instanceof THREE.Texture && !disposedTextures.has(value)) {
        disposedTextures.add(value);
        value.dispose();
      }
    }
    mat.dispose();
  };

  root.traverse((obj) => {
    const meshLike = obj as THREE.Mesh | THREE.LineSegments | THREE.Points;
    if (meshLike.geometry && !disposedGeometries.has(meshLike.geometry)) {
      disposedGeometries.add(meshLike.geometry);
      meshLike.geometry.dispose();
    }

    const material = (obj as THREE.Mesh).material;
    if (Array.isArray(material)) {
      material.forEach(disposeMaterial);
    } else if (material) {
      disposeMaterial(material);
    }
  });
}
