"""Pick the most detailed frame of each loop as its poster, plus a light thumbnail for cards."""
import glob
import os
import cv2

OUT = "public/work"
os.makedirs(f"{OUT}/thumb", exist_ok=True)
for loop in sorted(glob.glob(f"{OUT}/loop/*.mp4")):
    vid = os.path.splitext(os.path.basename(loop))[0]
    cap = cv2.VideoCapture(loop)
    fps, n = cap.get(5) or 25, int(cap.get(7))
    best, score = None, -1
    for t in [0.5 + i * 0.75 for i in range(10)]:
        cap.set(1, min(n - 1, int(t * fps)))
        ok, f = cap.read()
        if not ok:
            continue
        m, s = f.mean(), f.std()
        sc = s * (1.0 if 35 < m < 215 else 0.3)  # prefer well-exposed, detailed frames
        if sc > score:
            best, score = f, sc
    cv2.imwrite(f"{OUT}/poster/{vid}.jpg", best, [cv2.IMWRITE_JPEG_QUALITY, 88])
    h, w = best.shape[:2]
    k = (720 if w > h else 480) / w
    cv2.imwrite(f"{OUT}/thumb/{vid}.jpg", cv2.resize(best, (round(w * k), round(h * k)), interpolation=cv2.INTER_AREA),
                [cv2.IMWRITE_JPEG_QUALITY, 84])
    print(vid, int(best.mean()), int(best.std()))
