const canvas = document.getElementById('bg');

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true
});

renderer.setSize(window.innerWidth, window.innerHeight);

camera.position.z = 2;

// Geometry
const geometry = new THREE.PlaneGeometry(5, 5, 100, 100);

// Shader Material
const material = new THREE.ShaderMaterial({
  uniforms: {
    time: { value: 0 }
  },
  vertexShader: `
    varying vec2 vUv;
    uniform float time;

    void main() {
      vUv = uv;
      vec3 pos = position;

      pos.z += sin(pos.x * 4.0 + time) * 0.2;
      pos.z += cos(pos.y * 4.0 + time) * 0.2;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    uniform float time;

    void main() {
      vec3 color = vec3(
        0.2 + 0.6 * sin(time + vUv.x * 4.0),
        0.3 + 0.5 * cos(time + vUv.y * 4.0),
        1.0
      );

      gl_FragColor = vec4(color, 1.0);
    }
  `
});

const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);

// Animation
function animate() {
  requestAnimationFrame(animate);

  material.uniforms.time.value += 0.02;
  mesh.rotation.z += 0.001;

  renderer.render(scene, camera);
}

animate();

// Resize
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});
