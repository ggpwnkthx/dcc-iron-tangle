import * as B from "@babylonjs/core";

export function createMeshBuilders(scene: B.Scene) {
  function box(
    name: string,
    w: number,
    h: number,
    d: number,
    p: B.Vector3,
    m: B.Material,
    parent: B.TransformNode | null,
  ) {
    const mesh = B.MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
    mesh.position = p;
    mesh.material = m;
    mesh.parent = parent;
    return mesh;
  }
  function tube(
    name: string,
    path: B.Vector3[],
    radius: number,
    m: B.Material,
    parent: B.TransformNode,
    tessellation = 8,
  ) {
    const mesh = B.MeshBuilder.CreateTube(
      name,
      { path, radius, tessellation, cap: B.Mesh.CAP_ALL },
      scene,
    );
    mesh.material = m;
    mesh.parent = parent;
    return mesh;
  }
  function torus(
    name: string,
    p: B.Vector3,
    diameter: number,
    thickness: number,
    m: B.Material,
    parent: B.TransformNode | null,
  ) {
    const mesh = B.MeshBuilder.CreateTorus(name, { diameter, thickness, tessellation: 48 }, scene);
    mesh.position = p;
    mesh.material = m;
    mesh.parent = parent;
    return mesh;

  return { box, tube, torus };
}
