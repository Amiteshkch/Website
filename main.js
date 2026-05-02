const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);

const renderer = new THREE.WebGLRenderer({ alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById("bg").appendChild(renderer.domElement);

const geometry = new THREE.SphereGeometry(5, 64, 64);

const material = new THREE.MeshBasicMaterial({
    wireframe: true
});

const sphere = new THREE.Mesh(geometry, material);
scene.add(sphere);

camera.position.z = 10;

function animate() {
    requestAnimationFrame(animate);

    sphere.rotation.x += 0.002;
    sphere.rotation.y += 0.003;

    renderer.render(scene, camera);
}

animate();
