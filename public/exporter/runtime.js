/* EchoForge 3D — standalone exported-scene runtime (Task 3.6 / CUJ-04).
 *
 * Runs inside the exported single-file HTML bundle, which embeds three.core
 * (ESM, base64) and imports it as `THREE` before invoking this IIFE. The
 * scene snapshot lives in <script id="scene-data" type="application/json">.
 * Parses each entity's GLB with a minimal glTF-2.0 reader (positions,
 * normals, COLOR_0 vertex colors, indices) and renders terrain + entities
 * under a gentle orbit. Fully offline — no network, no external files.
 */
(function (THREE, sceneData) {
  'use strict';

  var canvas = document.createElement('canvas');
  document.body.appendChild(canvas);

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, canvas: canvas });
  } catch (err) {
    var hud = document.getElementById('hud');
    if (hud) hud.textContent = 'WebGL unavailable: ' + err.message;
    return;
  }
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x08090a);

  var camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    200,
  );
  camera.position.set(12, 10, 12);

  scene.add(new THREE.HemisphereLight(0x5e6ad2, 0x08090a, 1));
  scene.add(new THREE.DirectionalLight(0xffffff, 2));
  scene.add(new THREE.GridHelper(64, 64, 0x10b981, 0x16181d));

  // --- terrain ----------------------------------------------------------------
  if (sceneData.terrain) {
    var tSize = sceneData.terrain.size;
    var world = 64;
    var heightScale = 4;
    var tGeo = new THREE.PlaneGeometry(world, world, tSize, tSize);
    tGeo.rotateX(-Math.PI / 2);
    var pos = tGeo.attributes.position;
    var hm = sceneData.terrain.heightmap;
    for (var i = 0; i < pos.count; i++) {
      var gx = pos.getX(i);
      var gz = pos.getZ(i);
      var col = clamp(Math.round((gx / world + 0.5) * (tSize - 1)), 0, tSize - 1);
      var row = clamp(Math.round((gz / world + 0.5) * (tSize - 1)), 0, tSize - 1);
      pos.setY(i, hm[row * tSize + col] * heightScale);
    }
    pos.needsUpdate = true;
    tGeo.computeVertexNormals();
    scene.add(
      new THREE.Mesh(
        tGeo,
        new THREE.MeshStandardMaterial({
          color: 0x2a2f3a,
          flatShading: true,
          roughness: 0.9,
        }),
      ),
    );
  }

  // --- GLB parsing --------------------------------------------------------------
  function accessorData(json, bin, accessorIndex) {
    var acc = json.accessors[accessorIndex];
    var bv = json.bufferViews[acc.bufferView];
    var byteOffset = (bv.byteOffset || 0) + (acc.byteOffset || 0);
    var compSize = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }[acc.componentType];
    var numComps = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[acc.type];
    var Ctor = acc.componentType === 5123 ? Uint16Array
      : acc.componentType === 5125 ? Uint32Array
      : Float32Array;
    return {
      arr: new Ctor(bin.buffer, bin.byteOffset + byteOffset, acc.count * numComps),
      numComps: numComps,
    };
  }

  function geosFromGlb(bytes) {
    var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (dv.getUint32(0, true) !== 0x46546c67) return []; // 'glTF' magic
    var jsonLen = dv.getUint32(12, true);
    var jsonStart = 20;
    var json;
    try {
      json = JSON.parse(
        new TextDecoder().decode(
          new Uint8Array(bytes.buffer, bytes.byteOffset + jsonStart, jsonLen),
        ),
      );
    } catch (err) {
      return [];
    }
    var chunk2 = jsonStart + jsonLen;
    var binLen = dv.getUint32(chunk2, true);
    var bin = new Uint8Array(bytes.buffer, bytes.byteOffset + chunk2 + 8, binLen);

    var out = [];
    (json.meshes || []).forEach(function (meshDef) {
      (meshDef.primitives || []).forEach(function (prim) {
        var p = accessorData(json, bin, prim.attributes.POSITION);
        if (!p || p.numComps !== 3) return;
        var geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(p.arr, 3));
        if (prim.attributes.NORMAL !== undefined) {
          var n = accessorData(json, bin, prim.attributes.NORMAL);
          if (n) geo.setAttribute('normal', new THREE.BufferAttribute(n.arr, n.numComps));
        }
        if (prim.attributes.COLOR_0 !== undefined) {
          var c = accessorData(json, bin, prim.attributes.COLOR_0);
          if (c) geo.setAttribute('color', new THREE.BufferAttribute(c.arr, c.numComps));
        }
        if (prim.indices !== undefined) {
          var idx = accessorData(json, bin, prim.indices);
          if (idx) geo.setIndex(new THREE.BufferAttribute(idx.arr, 1));
        }
        out.push(geo);
      });
    });
    return out;
  }

  function addEntity(entity) {
    if (!entity.glbBase64) return;
    var bytes;
    try {
      var binStr = atob(entity.glbBase64);
      bytes = new Uint8Array(binStr.length);
      for (var k = 0; k < binStr.length; k++) bytes[k] = binStr.charCodeAt(k);
    } catch (err) {
      return;
    }
    var geos = geosFromGlb(bytes);
    if (geos.length === 0) return;
    var group = new THREE.Group();
    group.position.fromArray(entity.position || [0, 0, 0]);
    group.rotation.fromArray(entity.rotation || [0, 0, 0]);
    if (entity.scale) group.scale.fromArray(entity.scale);
    geos.forEach(function (geo) {
      group.add(
        new THREE.Mesh(
          geo,
          new THREE.MeshStandardMaterial({
            vertexColors: !!geo.getAttribute('color'),
            roughness: 0.9,
            metalness: 0,
          }),
        ),
      );
    });
    scene.add(group);
  }

  (sceneData.entities || []).forEach(addEntity);

  // --- gentle orbit --------------------------------------------------------------
  var azimuth = Math.atan2(camera.position.z, camera.position.x);
  var radius = Math.sqrt(
    camera.position.x * camera.position.x + camera.position.z * camera.position.z,
  );
  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  renderer.setAnimationLoop(function () {
    azimuth += 0.002;
    camera.position.x = radius * Math.cos(azimuth);
    camera.position.z = radius * Math.sin(azimuth);
    camera.lookAt(0, 2, 0);
    renderer.render(scene, camera);
  });

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }
})(THREE, JSON.parse(document.getElementById('scene-data').textContent));
