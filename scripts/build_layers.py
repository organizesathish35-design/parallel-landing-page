"""Split the hero photo into parallax layers.

Outputs (public/hero/):
  city.webp      RGBA - skyline + city, sky removed, filled behind the tower
  building.webp  RGBA - foreground office tower (glass side panel semi-transparent)

Sky mask (assets/src/mask-sky.png) was produced with GrabCut; white = not sky.
"""
import cv2
import numpy as np

SRC = "assets/src/hero-city.webp"
im = cv2.imread(SRC)
H, W = im.shape[:2]
fg = cv2.imread("assets/src/mask-sky.png", 0) > 127

# --- soft alpha for the skyline edge: erode 1px (kills sky fringe), feather
fg_u8 = fg.astype(np.uint8) * 255
fg_u8 = cv2.erode(fg_u8, np.ones((2, 2), np.uint8))
alpha_fg = cv2.GaussianBlur(fg_u8, (0, 0), 0.8).astype(np.float32) / 255

# de-fringe: pull edge pixel colours toward their inner neighbours
inner = cv2.erode(fg_u8, np.ones((5, 5), np.uint8))
filled = cv2.inpaint(im, 255 - inner, 3, cv2.INPAINT_TELEA)
edge = (alpha_fg > 0) & (inner == 0)
im_dc = im.copy()
im_dc[edge] = (im[edge] * 0.35 + filled[edge] * 0.65).astype(np.uint8)

# --- tower geometry (measured on the source image)
EDGE_SLAB = 1019     # floor slabs project to here
EDGE_GLASS = 1034    # corner mullion
GLASS_R = 1063       # right edge of the transparent side panel
SLABS = [(0, 226), (353, 397), (526, 568), (701, 744), (870, 918)]
slab_rows = np.zeros(H, bool)
for a, b in SLABS:
    slab_rows[a:b] = True

xs = np.arange(W)[None, :].repeat(H, 0)
bmask = np.zeros((H, W), np.float32)
bmask[:, EDGE_GLASS:] = 1
bmask[slab_rows, EDGE_SLAB:] = 1
glass = np.zeros((H, W), bool)
glass[226:, EDGE_GLASS + 2:GLASS_R] = True
glass[slab_rows] = False
bmask[glass] = 0.32
# roof plants / railing follow the sky mask; slabs & glass ignore it (sky shows through glass)
b_alpha = bmask * np.where(glass, 1.0, alpha_fg)
b_alpha[glass] = 0.32
b_alpha = cv2.GaussianBlur(b_alpha, (0, 0), 0.6)
b_rgb = im_dc.copy()
b_rgb[glass] = (im[glass] * 0.55).astype(np.uint8)

# --- city layer: original, with a mirrored fill behind the tower
c_rgb = im_dc.copy().astype(np.float32)
c_alpha = alpha_fg.copy()
M = EDGE_SLAB - 1
for x in range(EDGE_SLAB, W):
    sx = max(0, 2 * M - x)
    # city really visible through the glass here (skip the corner mullion)
    keep_real = ~slab_rows & (np.arange(H) >= 232) if EDGE_GLASS + 6 <= x < GLASS_R - 2 else np.zeros(H, bool)
    rows = ~keep_real
    c_rgb[rows, x] = im_dc[rows, sx]
    c_alpha[rows, x] = alpha_fg[rows, sx]
# the glass panel rows above y=226 show sky in the source -> keep as sky
# soften the seam and darken the hidden fill a touch (it sits in the tower's shadow)
seam = np.clip((xs - EDGE_SLAB) / 80.0, 0, 1)[..., None]
blurred = cv2.GaussianBlur(c_rgb, (0, 0), 1.2)
c_rgb = c_rgb * (1 - seam * 0.5) + blurred * (seam * 0.5)
c_rgb *= 1 - seam * 0.18

def save(path, rgb, a):
    rgba = np.dstack([np.clip(rgb, 0, 255).astype(np.uint8), np.clip(a * 255, 0, 255).astype(np.uint8)])
    cv2.imwrite(path, rgba, [cv2.IMWRITE_WEBP_QUALITY, 92])

save("public/hero/city.webp", c_rgb, c_alpha)
save("public/hero/building.webp", b_rgb.astype(np.float32), b_alpha)
print("ok", W, H)
