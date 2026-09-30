import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import {
  skyVertex, skyFragment, layerVertex, layerFragment,
  trailVertex, trailFragment, birdVertex, birdFragment,
} from './shaders.js'
import { lookAt, sunElevation, dirFromAngles } from './daycycle.js'

const { MathUtils: M } = THREE

// Source photo + where things sit in it (fractions of width / height from the top-left)
const IMG = { w: 1686, h: 933 }
const SKYLINE_Y = 0.44     // distant skyline
const FOCUS = { x: 0.55, y: 0.52 }
const OVERSCAN = 1.16      // room for camera moves without exposing plane edges
const D_CITY = 100
const D_TOWER = 62
const FOV = 38
const LIME = new THREE.Color(0xc7ff00)

const GrainVignette = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVignette: { value: 0.35 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uVignette; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float v = smoothstep(1.15, 0.35, length((vUv - 0.5) * vec2(1.25, 1.0)));
      c.rgb *= mix(1.0 - uVignette, 1.0, v);
      c.rgb += (h(vUv * 1000.0 + fract(uTime)) - 0.5) * 0.035;
      gl_FragColor = c;
    }`,
}

export class HeroScene {
  constructor(canvas) {
    this.canvas = canvas
    this.progress = 0
    this.smooth = 0
    this.enter = 0
    this.enterSmooth = 0
    this.mode = 'street' // 'street' = the day outside, 'roof' = the contact rooftop at night
    this.roof = 0
    this.pointer = new THREE.Vector2()
    this.pointerSmooth = new THREE.Vector2()
    this.clock = new THREE.Clock()
    this.running = false
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    this.compact = matchMedia('(pointer: coarse)').matches || innerWidth <= 720

    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: location.search.includes('debug') }))
    // adaptive resolution: start high, step down if the GPU can't hold ~50fps
    const dprCap = this.compact ? 1.25 : 1.75
    this.dprSteps = [1.75, 1.5, 1.25, 1, 0.85, 0.75, 0.65].filter((d) => d <= Math.min(devicePixelRatio, dprCap) + 0.01)
    this.dprIndex = 0
    this.perf = { frames: 0, time: 0, settled: false }
    r.setPixelRatio(this.dprSteps[0])
    r.outputColorSpace = THREE.SRGBColorSpace
    r.toneMapping = THREE.NoToneMapping

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 3000)
    this.camera.rotation.order = 'YXZ'
    this.frame = {}
  }

  async load(onProgress = () => {}) {
    const manager = new THREE.LoadingManager()
    manager.onProgress = (_, loaded, total) => onProgress(loaded / total)
    const loader = new THREE.TextureLoader(manager)
    const get = (url) => new Promise((res, rej) => loader.load(url, res, undefined, rej))
    const [city, tower] = await Promise.all([get('/hero/city.webp'), get('/hero/building.webp')])
    for (const t of [city, tower]) {
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = this.renderer.capabilities.getMaxAnisotropy()
      t.generateMipmaps = true
      t.minFilter = THREE.LinearMipmapLinearFilter
    }
    this.build(city, tower)
    this.resize()
    this.ready = true
  }

  build(cityTex, towerTex) {
    // --- sky dome (infinitely far, follows the camera)
    this.skyU = {
      uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() },
      uGlow: { value: new THREE.Color() }, uSunColor: { value: new THREE.Color() },
      uCloudLit: { value: new THREE.Color() }, uCloudShadow: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0, 0.1, -1) }, uMoonDir: { value: new THREE.Vector3(0, 0.3, -1) },
      uHorizonAngle: { value: 0 }, uNight: { value: 0 }, uLowSun: { value: 0 }, uTime: { value: 0 },
      uCloudCover: { value: 0.45 }, uSunSize: { value: 0.028 }, uCloudOffset: { value: new THREE.Vector2() },
    }
    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(1000, 64, 32),
      new THREE.ShaderMaterial({ uniforms: this.skyU, vertexShader: skyVertex, fragmentShader: skyFragment, side: THREE.BackSide, depthWrite: false }),
    )
    this.sky.renderOrder = 0
    this.scene.add(this.sky)

    // --- parallel contrails, far behind the city
    this.trails = [0, 1].map((i) => {
      const u = {
        uHead: { value: 0 }, uOpacity: { value: 0 }, uTime: { value: 0 }, uSeed: { value: i * 17.3 },
        uColor: { value: new THREE.Color(1, 1, 1) }, uTint: { value: i ? LIME.clone() : new THREE.Color(1, 1, 1) },
      }
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.ShaderMaterial({ uniforms: u, vertexShader: trailVertex, fragmentShader: trailFragment, transparent: true, depthWrite: false, depthTest: false }),
      )
      m.renderOrder = 1
      m.userData.u = u
      this.scene.add(m)
      return m
    })

    // --- photo layers
    const layer = (tex, isCity, order) => {
      const u = {
        map: { value: tex }, uAmbient: { value: new THREE.Color(1, 1, 1) }, uHazeColor: { value: new THREE.Color() },
        uSunColor: { value: new THREE.Color() }, uWindows: { value: 0.5 }, uHaze: { value: 0.3 }, uSat: { value: 1 },
        uIsCity: { value: isCity ? 1 : 0 }, uTime: { value: 0 }, uMist: { value: 0 }, uSunX: { value: 0.3 }, uLowSun: { value: 0 },
      }
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.ShaderMaterial({ uniforms: u, vertexShader: layerVertex, fragmentShader: layerFragment, transparent: true, depthWrite: false }),
      )
      m.renderOrder = order
      m.userData.u = u
      this.scene.add(m)
      return m
    }
    this.city = layer(cityTex, true, 2)
    this.tower = layer(towerTex, false, 4)

    // --- birds between the city and the tower
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute([
      0, 0.06, 0, -1, 0.28, 0, 0, -0.14, 0,
      0, 0.06, 0, 0, -0.14, 0, 1, 0.28, 0,
    ], 3))
    const N = 14
    const seeds = new Float32Array(N * 4)
    this.birdOffsets = []
    for (let i = 0; i < N; i++) {
      seeds.set([Math.random(), Math.random(), 0.45 + Math.random() * 0.3, 0], i * 4)
      const row = Math.ceil(i / 2), side = i % 2 ? 1 : -1
      this.birdOffsets.push(new THREE.Vector3(-row * 1.6 + Math.random() * 0.8, side * row * 0.55 + Math.random() * 0.5, Math.random() * 4 - 2))
    }
    g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4))
    this.birdU = { uTime: { value: 0 }, uColor: { value: new THREE.Color(0x0e0e12) }, uOpacity: { value: 0.9 } }
    this.birds = new THREE.InstancedMesh(
      g,
      new THREE.ShaderMaterial({ uniforms: this.birdU, vertexShader: birdVertex, fragmentShader: birdFragment, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
      N,
    )
    this.birds.renderOrder = 3
    this.birds.frustumCulled = false
    this.scene.add(this.birds)
    this._m4 = new THREE.Matrix4()
    this._q = new THREE.Quaternion()

    // --- post
    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    this.bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.5, 0.42, 0.85)
    this.bloom.enabled = !this.compact
    this.composer.addPass(this.bloom)
    this.composer.addPass(new OutputPass())
    this.grain = new ShaderPass(GrainVignette)
    this.grain.enabled = !this.compact
    this.composer.addPass(this.grain)
  }

  resize() {
    if (!this.city) return
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight
    if (!w || !h) return
    const compact = matchMedia('(pointer: coarse)').matches || w <= 720
    if (compact !== this.compact) {
      this.compact = compact
      if (this.bloom) this.bloom.enabled = !compact
      if (this.grain) this.grain.enabled = !compact
    }
    this.renderer.setSize(w, h, false)
    this.composer?.setSize(w, h)
    this.composer?.setPixelRatio(this.renderer.getPixelRatio())
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()

    // cover-fit the photo at unit depth, keeping FOCUS centred where possible
    const hU = 2 * Math.tan(M.degToRad(FOV / 2)), wU = hU * this.camera.aspect
    const s = Math.max(wU / IMG.w, hU / IMG.h) * OVERSCAN
    const Wf = IMG.w * s, Hf = IMG.h * s
    const X0 = M.clamp((0.5 - FOCUS.x) * Wf, -(Wf - wU) / 2, (Wf - wU) / 2)
    const Y0 = M.clamp((FOCUS.y - 0.5) * Hf, -(Hf - hU) / 2, (Hf - hU) / 2)
    Object.assign(this.frame, { Wf, Hf, X0, Y0, wU, hU })

    for (const [mesh, d] of [[this.city, D_CITY], [this.tower, D_TOWER]]) {
      mesh.scale.set(Wf * d, Hf * d, 1)
      mesh.position.set(X0 * d, Y0 * d, -d)
    }
    // image-x (0..1) -> azimuth, and the skyline's angle, both from the rest pose
    this.imgXToAz = (x) => Math.atan(X0 + (x - 0.5) * Wf)
    // the lit office floor we walk into (third floor of the tower, measured on the photo)
    this.window = { x: (X0 + (0.8 - 0.5) * Wf) * D_TOWER, y: (Y0 + (0.5 - 0.495) * Hf) * D_TOWER }
    this.skylineY = (Y0 + (0.5 - SKYLINE_Y) * Hf) * D_CITY
    this.horizonRest = Math.atan(this.skylineY / D_CITY)
    // visible image-x range, for keeping the sun on screen on narrow viewports
    this.visX = [0.5 - X0 / Wf - wU / Wf / 2, 0.5 - X0 / Wf + wU / Wf / 2]
    this.topEl = M.radToDeg(Math.atan(hU / 2)) - M.radToDeg(this.horizonRest) // skyline -> top of frame (deg)

    const trailDepth = 520
    for (const [i, t] of this.trails.entries()) {
      t.scale.set(wU * trailDepth * 1.3, 8, 1)
      t.position.set(0, (this.skylineY / D_CITY + (0.2 + i * 0.024) * hU) * trailDepth, -trailDepth)
      t.rotation.z = -0.05
    }
  }

  setProgress(p) { this.progress = p }
  setEnter(e) { this.enter = e }
  setRoof(r) { this.roof = r }
  setMode(mode) {
    if (mode === this.mode) return
    this.mode = mode
    // jump straight to the right time of day instead of easing across it
    this.smooth = this.progress = mode === 'roof' ? 1 : this.progress
    this.enterSmooth = this.enter = 0
  }
  setPointer(x, y) { this.pointer.set(x, y) }

  adapt(rawDt) {
    const f = this.perf
    if (f.settled || document.hidden) return
    f.frames++
    f.time += rawDt
    if (f.frames < 40) return
    const fps = f.frames / f.time
    f.frames = 0
    f.time = 0
    if (fps < 48 && this.dprIndex < this.dprSteps.length - 1) {
      this.dprIndex++
      this.renderer.setPixelRatio(this.dprSteps[this.dprIndex])
      this.resize()
    } else if (fps >= 48) {
      f.settled = true
    }
  }

  update() {
    const rawDt = this.clock.getDelta()
    this.adapt(rawDt)
    const dt = Math.min(rawDt, 0.05)
    const time = this.clock.elapsedTime
    this.smooth = M.damp(this.smooth, this.progress, 4, dt)
    this.pointerSmooth.x = M.damp(this.pointerSmooth.x, this.reduced ? 0 : this.pointer.x, 2.5, dt)
    this.pointerSmooth.y = M.damp(this.pointerSmooth.y, this.reduced ? 0 : this.pointer.y, 2.5, dt)
    const p = this.smooth, arc = Math.sin(Math.PI * p)

    // --- camera: slow dolly toward the tower, lift + tilt toward the sky at noon
    const cam = this.camera
    const breathe = this.reduced ? 0 : Math.sin(time * 0.25) * 0.12
    cam.position.set(
      // drifting left slides the (nearer) tower right, opening up more sky as the day goes on
      M.lerp(0.2, -2.2, M.smoothstep(p, 0, 1)) + this.pointerSmooth.x * 1.0,
      arc * 1.8 + this.pointerSmooth.y * 0.6 + breathe,
      -M.smootherstep(p, 0, 1) * 4.5,
    )
    cam.rotation.set(arc * 0.06 + this.pointerSmooth.y * 0.006, -this.pointerSmooth.x * 0.012, 0)

    // --- walking into the building: glide in front of the lit floor, then push through the glass
    this.enterSmooth = M.damp(this.enterSmooth, this.mode === 'street' ? this.enter : 0, 5, dt)
    const e = this.enterSmooth
    if (e > 0.0005) {
      const k = M.smootherstep(e, 0, 1)
      cam.position.x = M.lerp(cam.position.x, this.window.x, k)
      cam.position.y = M.lerp(cam.position.y, this.window.y, k)
      cam.position.z = M.lerp(cam.position.z, -D_TOWER + 6, k * k)
      cam.rotation.x *= 1 - k
      cam.rotation.y *= 1 - k
    }

    // --- rooftop: night, looking up past the tower into the stars
    if (this.mode === 'roof') {
      const r = this.roof
      cam.position.set(M.lerp(-2.4, 0.6, r) + this.pointerSmooth.x * 0.8, 3.2 + this.pointerSmooth.y * 0.5 + breathe, -3)
      cam.rotation.set(0.2 + r * 0.06 + this.pointerSmooth.y * 0.01, -this.pointerSmooth.x * 0.015, 0)
    }
    this.sky.position.copy(cam.position)

    // --- sun & palette
    const el = sunElevation(p)
    const look = lookAt(el)
    const [vx0, vx1] = this.visX
    const rise = Math.min(0.5, vx1 - 0.14), set = Math.max(0.2, vx0 + 0.08)
    const sx = M.lerp(rise, set, M.clamp((p - 0.02) / 0.94, 0, 1))
    // squeeze the real arc so the midday sun still sits inside the frame
    const elVis = el <= 0 ? el * 1.4 : Math.min(el, 60) / 60 * (this.topEl * 0.82 + M.radToDeg(0.06))
    const horizon = Math.atan2(this.skylineY - cam.position.y, D_CITY + cam.position.z)
    const su = this.skyU
    dirFromAngles(this.imgXToAz(sx), horizon + M.degToRad(elVis), su.uSunDir.value)
    dirFromAngles(this.imgXToAz(M.clamp(M.lerp(0.44, 0.24, p), vx0 + 0.1, vx1 - 0.12)), horizon + M.degToRad(this.topEl * M.lerp(0.62, 0.5, p)), su.uMoonDir.value)
    su.uHorizonAngle.value = horizon
    su.uZenith.value.copy(look.zenith)
    su.uHorizon.value.copy(look.horizon)
    su.uGlow.value.copy(look.glow)
    su.uSunColor.value.copy(look.sun)
    su.uCloudLit.value.copy(look.cloudLit)
    su.uCloudShadow.value.copy(look.cloudShadow)
    su.uNight.value = look.stars
    const lowSun = 1 - M.smoothstep(Math.abs(el - 1), 0, 16)
    su.uLowSun.value = lowSun
    su.uTime.value = time
    su.uCloudCover.value = look.cover
    su.uSunSize.value = 0.026 * (1 + lowSun * 0.35)
    su.uCloudOffset.value.set(cam.position.x * 0.01 + p * 1.2, cam.position.z * 0.012)

    for (const L of [this.city, this.tower]) {
      const u = L.userData.u
      u.uAmbient.value.copy(look.amb)
      u.uHazeColor.value.copy(look.haze).lerp(look.horizon, 0.35)
      u.uSunColor.value.copy(look.sun)
      u.uWindows.value = look.win
      u.uHaze.value = look.hazeAmt
      u.uSat.value = look.sat
      u.uMist.value = look.mist
      u.uTime.value = time
      u.uSunX.value = sx
      u.uLowSun.value = lowSun * (el > -2 ? 1 : 0)
    }

    // --- contrails: two jets flying in parallel through the day
    const head = M.clamp((p - 0.2) / 0.5, 0, 1) * 1.15 + Math.sin(time * 0.05) * 0.004
    for (const t of this.trails) {
      const u = t.userData.u
      u.uHead.value = head
      u.uTime.value = time
      u.uOpacity.value = M.smoothstep(p, 0.18, 0.24) * (1 - M.smoothstep(p, 0.74, 0.84)) * 0.85
      u.uColor.value.set(1, 1, 1).lerp(look.sun, lowSun * 0.6).lerp(look.cloudShadow, 0.15)
    }

    // --- birds: a loose V drifting across, twice a day
    const birdVis = M.smoothstep(p, 0.04, 0.12) * (1 - M.smoothstep(p, 0.3, 0.36)) + M.smoothstep(p, 0.62, 0.7) * (1 - M.smoothstep(p, 0.9, 0.95))
    this.birdU.uOpacity.value = birdVis * 0.9
    this.birdU.uTime.value = time
    this.birdU.uColor.value.set(0x0c0c10).lerp(look.cloudShadow, 0.15)
    this.birds.visible = birdVis > 0.01
    if (this.birds.visible) {
      const d = 84
      const loop = ((time * 0.035 + p * 0.9) % 1)
      const fx = M.lerp(this.visX[0] - 0.08, this.visX[1] + 0.05, loop)
      const X = (this.frame.X0 + (fx - 0.5) * this.frame.Wf) * d
      const Y = this.skylineY * d / D_CITY + this.frame.hU * d * 0.16 + Math.sin(time * 0.4) * 0.8
      this.birdOffsets.forEach((o, i) => {
        const bob = Math.sin(time * 1.3 + i) * 0.12
        this._m4.compose(new THREE.Vector3(X + o.x, Y + o.y + bob, -d + o.z), this._q, new THREE.Vector3(1, 1, 1))
        this.birds.setMatrixAt(i, this._m4)
      })
      this.birds.instanceMatrix.needsUpdate = true
    }

    this.bloom.strength = look.bloom
    this.bloom.threshold = M.lerp(0.8, 0.97, 1 - look.stars)
    this.grain.uniforms.uTime.value = time
    this.grain.uniforms.uVignette.value = M.lerp(0.16, 0.42, look.stars)

    this.composer.render()
    return { el, p }
  }

  start(onFrame) {
    if (this.running || !this.ready) return
    this.running = true
    this.clock.getDelta()
    const loop = () => {
      if (!this.running) return
      const info = this.update()
      onFrame?.(info)
      this.raf = requestAnimationFrame(loop)
    }
    loop()
  }

  stop() {
    this.running = false
    cancelAnimationFrame(this.raf)
  }
}
