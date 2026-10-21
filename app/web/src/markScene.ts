import * as THREE from 'three'
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js'

// Preserve the original authored brand geometry (brand/mark3d/index.html).
const BOWL = 'M58 302 C100 470 240 615 400 615 C560 615 698 470 743 302 C746 292 738 290 731 293 C620 345 510 376 400 376 C290 376 180 345 69 293 C62 290 55 293 58 302 Z'
const LID = 'M98 207 C220 246 330 252 420 250 C540 247 630 221 690 188 C714 176 724 196 709 216 C640 285 530 318 410 318 C290 318 170 287 99 240 C84 230 86 203 98 207 Z'
export function createMarkScene(canvas: HTMLCanvasElement, failed: () => void) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.outputColorSpace = THREE.SRGBColorSpace
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(30, 1, 1, 6000)
  camera.position.set(0, 25, 1750); camera.lookAt(0, 20, 0)
  const environment = document.createElement('canvas')
  environment.width = 2048; environment.height = 1024
  const ctx = environment.getContext('2d')!
  const gradient = ctx.createLinearGradient(0, 0, 0, 1024)
  gradient.addColorStop(0, '#1a1d24'); gradient.addColorStop(.5, '#3b4250'); gradient.addColorStop(1, '#0b0c0f')
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 2048, 1024)
  for (let i = 0; i < 90; i++) {
    ctx.beginPath(); const y = 120 + i * 9; ctx.moveTo(0, y)
    for (let x = 0; x <= 2048; x += 16) ctx.lineTo(x, y + Math.sin(x / 170 + i * .35) * 70 + Math.sin(x / 61 + i) * 18)
    ctx.strokeStyle = i % 3 === 0 ? `rgba(232,85,45,${.10 + (i % 7) * .02})` : i % 3 === 1 ? `rgba(230,205,180,${.10 + (i % 5) * .03})` : `rgba(150,175,205,${.08 + (i % 4) * .03})`
    ctx.lineWidth = 6 + (i % 5) * 4; ctx.stroke()
  }
  ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillRect(700, 120, 640, 90); ctx.fillRect(240, 700, 260, 40)
  const texture = new THREE.CanvasTexture(environment)
  texture.mapping = THREE.EquirectangularReflectionMapping; texture.colorSpace = THREE.SRGBColorSpace
  const pmrem = new THREE.PMREMGenerator(renderer)
  const reflections = pmrem.fromEquirectangular(texture)
  scene.environment = reflections.texture
  texture.dispose(); pmrem.dispose()
  const material = new THREE.MeshPhysicalMaterial({ color: '#d7dbe2', metalness: 1, roughness: .12, clearcoat: 1, clearcoatRoughness: .05, envMapIntensity: 1.25 })
  const root = new THREE.Group(); root.name = 'teampot-mark'
  const parts = [BOWL, LID].map((path, i) => {
    const shape = SVGLoader.createShapes(new SVGLoader().parse(`<svg><path d="${path}"/></svg>`).paths[0])
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: 46, bevelEnabled: true, bevelThickness: 14, bevelSize: 9, bevelSegments: 8, curveSegments: 48 })
    geometry.translate(-400, -400, i * 10); geometry.scale(1, -1, 1)
    const pivot = new THREE.Group(); pivot.name = i ? 'upper-crescent' : 'lower-bowl'
    pivot.add(new THREE.Mesh(geometry, material)); root.add(pivot)
    return pivot
  })
  root.userData.sculptRuntime = { pivots: parts, rootMotionNode: root, sockets: [], breakable: false }
  scene.add(root)
  const key = new THREE.DirectionalLight('#ffffff', 2.2); key.position.set(-600, 900, 1200); scene.add(key)
  const rim = new THREE.DirectionalLight('#ffd2bf', 1.4); rim.position.set(900, -300, -400); scene.add(rim)
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  let targetX = -.28, targetY = .42, targetSplit = 0, split = 0, raf = 0, disposed = false, visible = true
  root.rotation.set(targetX, targetY, .04)
  function draw() {
    raf = 0
    if (disposed || !visible || document.hidden) return
    const easing = reduced.matches ? 1 : .18
    root.rotation.x += (targetX - root.rotation.x) * easing
    root.rotation.y += (targetY - root.rotation.y) * easing
    split += (targetSplit - split) * easing
    parts[0].position.y = -split * 35; parts[1].position.y = split * 85
    parts[1].rotation.z = split * -.08
    renderer.render(scene, camera)
    canvas.dataset.pose = [root.rotation.x, root.rotation.y, split].map(v => v.toFixed(3)).join(',')
    if (Math.abs(targetX - root.rotation.x) + Math.abs(targetY - root.rotation.y) + Math.abs(targetSplit - split) > .001) schedule()
  }
  function schedule() { if (!raf && !disposed && visible && !document.hidden) raf = requestAnimationFrame(draw) }
  const resize = new ResizeObserver(() => {
    const box = canvas.getBoundingClientRect()
    if (box.width && box.height) { renderer.setSize(box.width, box.height, false); camera.aspect = box.width / box.height; camera.updateProjectionMatrix(); schedule() }
  })
  resize.observe(canvas)
  const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) schedule(); else { cancelAnimationFrame(raf); raf = 0 } })
  observer.observe(canvas)
  const visibility = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0 } else schedule() }
  document.addEventListener('visibilitychange', visibility)
  reduced.addEventListener('change', schedule)
  const contextLost = (event: Event) => { event.preventDefault(); failed() }
  canvas.addEventListener('webglcontextlost', contextLost)
  schedule()
  return {
    update(x: number, y: number, open: boolean) { targetX = Math.max(-.8, Math.min(.65, x)); targetY = Math.max(-1.15, Math.min(1.15, y)); targetSplit = open ? 1 : 0; schedule() },
    dispose() {
      disposed = true; cancelAnimationFrame(raf); resize.disconnect(); observer.disconnect()
      document.removeEventListener('visibilitychange', visibility); reduced.removeEventListener('change', schedule); canvas.removeEventListener('webglcontextlost', contextLost)
      parts.forEach(p => (p.children[0] as THREE.Mesh).geometry.dispose())
      material.dispose(); reflections.dispose(); renderer.dispose()
    },
  }
}
