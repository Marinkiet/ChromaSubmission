import {
  AmbientLight,
  BufferGeometry,
  DirectionalLight,
  FogExp2,
  Float32BufferAttribute,
  Points,
  PointsMaterial,
  World,
} from '@iwsdk/core';

/** Dark atmosphere: fog that swallows the far end of the field, plus distant stars. */
export function setupEnvironment(world: World): void {
  world.scene.fog = new FogExp2(0x03030a, 0.28);

  world.scene.add(new AmbientLight(0x404060, 0.4));
  const key = new DirectionalLight(0xaab4ff, 0.6);
  key.position.set(0.5, 3, 1);
  world.scene.add(key);

  // 400 points on a distant dome: one draw call.
  const pts: number[] = [];
  for (let i = 0; i < 400; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 0.9 + 0.05); // upper hemisphere
    const r = 40;
    pts.push(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi) + 1,
      r * Math.sin(phi) * Math.sin(theta),
    );
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pts, 3));
  world.scene.add(
    new Points(geo, new PointsMaterial({ size: 0.12, color: 0x9aa8ff, fog: false })),
  );
}
