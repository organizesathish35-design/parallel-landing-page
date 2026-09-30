// GLSL for the hero scene. Everything is authored in linear space;
// the OutputPass converts to sRGB at the end.

const noise = /* glsl */ `
  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x),
               mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
    for (int i = 0; i < 5; i++) { v += a * vnoise(p); p = r * p * 2.03 + 11.7; a *= 0.5; }
    return v;
  }
  float fbm3(vec2 p) {
    float v = 0.0, a = 0.5;
    mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
    for (int i = 0; i < 3; i++) { v += a * vnoise(p); p = r * p * 2.03 + 11.7; a *= 0.5; }
    return v / 0.875 * 0.97;
  }
`

export const skyVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
    vec4 p = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
    gl_Position = p.xyww; // pin to far plane
  }
`

export const skyFragment = /* glsl */ `
  uniform vec3 uZenith, uHorizon, uGlow, uSunColor, uCloudLit, uCloudShadow;
  uniform vec3 uSunDir, uMoonDir;
  uniform float uHorizonAngle, uNight, uLowSun, uTime, uCloudCover, uSunSize;
  uniform vec2 uCloudOffset;
  varying vec3 vDir;
  ${noise}

  void main() {
    vec3 dir = normalize(vDir);
    float el = asin(clamp(dir.y, -1.0, 1.0)) - uHorizonAngle; // elevation above the photo's skyline
    float h = max(el, 0.0);
    vec2 horiz = normalize(dir.xz + 1e-5);

    // base gradient
    float t = pow(clamp(h / 1.25, 0.0, 1.0), 0.42);
    vec3 col = mix(uHorizon, uZenith, t);

    // sun: broad scattering + tight halo + horizon band that follows its azimuth
    float cosT = dot(dir, uSunDir);
    float az = dot(horiz, normalize(uSunDir.xz + 1e-5)) * 0.5 + 0.5;
    float broad = pow(max(cosT, 0.0), 5.0);
    float tight = pow(max(cosT, 0.0), 180.0);
    float band = exp(-h * 7.0) * pow(az, 4.0);
    col += uGlow * (broad * (0.12 + 0.4 * uLowSun) + band * uLowSun * 0.9);
    col += uSunColor * tight * (0.35 + 0.5 * uLowSun);

    // clouds: a thin layer, ray-cast onto a plane above the city
    float cloudA = 0.0;
    vec3 cloudCol = vec3(0.0);
    float sinEl = sin(max(el, 0.05));
    vec2 cp = horiz * cos(el) / sinEl * 1.6 + uCloudOffset + vec2(uTime * 0.012, uTime * 0.004);
    vec2 q = cp * vec2(0.5, 0.75);
    vec2 warp = q + fbm3(q * 0.6 + uTime * 0.01) * 0.9;
    float d = fbm(warp);
    float cover = smoothstep(1.0 - uCloudCover, 1.0 - uCloudCover + 0.32, d);
    // light from the sun side: sample density a little toward the sun
    float d2 = fbm3(warp + normalize(uSunDir.xz + 1e-5) * 0.18);
    float lit = clamp(0.55 + (fbm3(warp) - d2) * 5.0, 0.0, 1.0);
    cloudCol = mix(uCloudShadow, uCloudLit, lit);
    cloudCol += uGlow * pow(max(cosT, 0.0), 10.0) * (1.0 - cover) * 1.4; // silver lining
    cloudCol = mix(cloudCol, uHorizon, exp(-h * 14.0) * 0.6);            // aerial perspective
    cloudA = cover * smoothstep(0.02, 0.2, el) * 0.95;

    // stars + moon (behind clouds)
    vec3 night = vec3(0.0);
    if (uNight > 0.001) {
      vec2 sp = vec2(atan(dir.z, dir.x), el) * 220.0;
      vec2 cell = floor(sp), f = fract(sp) - 0.5;
      float r = hash12(cell);
      if (r > 0.985) {
        vec2 o = vec2(hash12(cell + 7.1), hash12(cell + 3.3)) - 0.5;
        float s = smoothstep(0.16, 0.0, length(f - o * 0.6));
        float tw = 0.6 + 0.4 * sin(uTime * (1.5 + r * 4.0) + r * 60.0);
        night += vec3(0.85, 0.9, 1.0) * s * tw * (r - 0.985) * 90.0 * smoothstep(0.02, 0.25, el);
      }
      float cm = dot(dir, uMoonDir);
      float disc = smoothstep(0.99993, 0.99996, cm);
      float crater = 0.8 + 0.2 * vnoise(dir.xy * 1400.0);
      night += vec3(1.0, 0.97, 0.9) * disc * crater * 1.15;
      night += vec3(0.35, 0.42, 0.65) * pow(max(cm, 0.0), 4000.0) * 0.35;
      night += vec3(0.1, 0.13, 0.25) * pow(max(cm, 0.0), 40.0) * 0.35;
      night *= uNight;
    }
    col += night * (1.0 - cloudA);

    // sun disc sits behind clouds too
    float disc = smoothstep(cos(uSunSize), cos(uSunSize * 0.82), cosT);
    col += uSunColor * disc * 2.6 * (1.0 - cloudA * 0.85);

    col = mix(col, cloudCol, cloudA);

    // dither against banding
    col += (hash12(gl_FragCoord.xy) - 0.5) / 255.0;
    gl_FragColor = vec4(max(col, 0.0), 1.0);
  }
`

export const layerVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const layerFragment = /* glsl */ `
  uniform sampler2D map;
  uniform vec3 uAmbient, uHazeColor, uSunColor;
  uniform float uWindows, uHaze, uSat, uIsCity, uTime, uMist, uSunX, uLowSun;
  varying vec2 vUv;
  ${noise}

  void main() {
    vec4 tex = texture2D(map, vUv);
    if (tex.a < 0.004) discard;
    vec3 c = tex.rgb;
    float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));

    // lit windows / interiors: bright and strongly warm
    float warm = (c.r - c.b) / (lum + 0.04);
    float win = smoothstep(0.75, 1.15, warm) * smoothstep(0.18, 0.5, lum);

    vec3 base = mix(vec3(lum), c, uSat);
    vec3 col = base * uAmbient;
    // a little direct sun glancing off facades facing the low sun
    col += base * uSunColor * uLowSun * 0.25 * smoothstep(0.6, 0.0, abs(vUv.x - uSunX));
    col = mix(col, c * uWindows * 1.35, win * clamp(uWindows, 0.0, 1.0));

    if (uIsCity > 0.5) {
      // distance haze toward the skyline + drifting low mist at dawn
      float hz = smoothstep(0.34, 0.585, vUv.y);
      float mist = uMist > 0.01 ? fbm3(vec2(vUv.x * 5.0 + uTime * 0.02, vUv.y * 18.0)) : 0.0;
      float mistBand = smoothstep(0.36, 0.5, vUv.y) * smoothstep(0.64, 0.5, vUv.y);
      col = mix(col, uHazeColor, clamp(hz * uHaze + mistBand * mist * uMist, 0.0, 0.95));
    }
    gl_FragColor = vec4(col, tex.a);
  }
`

export const trailVertex = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`

// A contrail: uv.x runs along the path (0 = start, 1 = end), head at uHead.
export const trailFragment = /* glsl */ `
  uniform float uHead, uOpacity, uTime, uSeed;
  uniform vec3 uColor, uTint;
  varying vec2 vUv;
  ${noise}
  void main() {
    float behind = uHead - vUv.x;
    if (behind < 0.0) discard;
    float age = behind;                              // older = wider + fainter
    float width = mix(0.08, 0.95, smoothstep(0.0, 0.5, age));
    float y = abs(vUv.y - 0.5) * 2.0;
    float core = smoothstep(width, width * 0.2, y);
    float puff = 0.65 + 0.35 * vnoise(vec2(vUv.x * 90.0 + uSeed, vUv.y * 3.0 + uTime * 0.2));
    float fade = exp(-age * 3.2) * smoothstep(0.0, 0.006, behind);
    float a = core * puff * fade * uOpacity;
    vec3 col = mix(uColor, uTint, exp(-age * 9.0));
    gl_FragColor = vec4(col, a);
  }
`

// Instanced birds: a V made of two wing triangles, flapped in the vertex shader.
export const birdVertex = /* glsl */ `
  attribute vec4 aSeed;          // x: phase, y: speed, z: size, w: unused
  uniform float uTime;
  void main() {
    vec3 p = position;
    float flap = sin(uTime * (7.0 + aSeed.y * 3.0) + aSeed.x * 6.28);
    p.y += abs(p.x) * flap * 0.9;
    p *= aSeed.z;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
  }
`

export const birdFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  void main() { gl_FragColor = vec4(uColor, uOpacity); }
`
