"""Encode the portfolio videos for the site from the ORIGINAL files, 1080p minimum.

For each entry we make:
  public/work/full/<id>.mp4    1080p (short side), H.264 + AAC, faststart  - plays with sound
  public/work/loop/<id>.mp4    8 s, 1080p, silent                        - previews / backgrounds
  public/work/poster/<id>.jpg  a sharp still from the loop

Anything whose source is below 1080p is refused (the site only shows 1080p+).
Writes src/content/videos.json.   Run:  python scripts/encode_work.py [--jobs 3]
"""
import json
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

SRC = Path(r"E:/Archive/Download projects/Katha Frames Company Profile & Portfolio")
AI = SRC / "AI ｜ 2D Animation ｜ 2.5D Animation ｜ 3D Animation"
UGC = SRC / "UGC Videos ｜ Digital Ads ｜ Social Media Reels"
OUT = Path(__file__).resolve().parent.parent / "public" / "work"

# id, source (glob, relative), cat, title, client, [trim_start, trim_end]
VIDEOS = [
    # TV commercials & ad films
    ("zestbot-tvc", SRC / "TVCs • Brand Films • Documentary Films", "TV AD ZESTBOT*", "tvc", "Every Kirana, Online", "ZestBot"),
    ("isl", SRC / "TVCs • Brand Films • Documentary Films", "ISL ad*", "tvc", "Waves of Yellow", "ISL · JioCinema × Sports18"),
    ("brand-blue", UGC / "Brand Blue", "BRAND BLUE*", "tvc", "Step Inside the Store", "Brand Blue"),
    # films
    ("dollars", SRC / "AI Videos", "Dollars 18.mp4", "film", "Beyond Today", "Dollars Group"),
    ("mithra", SRC / "AI Videos", "Mithra 4k*", "film", "Where Faith Leads", "Mithra Developers"),
    ("di-files", SRC / "Short Films", "DI files*", "film", "DI Files", "Short film · Studio original"),
    ("harmone", SRC / "Music", "harmone*", "film", "Harmone — First Out", "Music video"),
    ("merino", AI / "Stock & Motion Graphics _ starts from 8k-min", "Merino*", "film", "Rooted to the Planet", "Merino"),
    # behind the scenes (trim the title card and the old logo sting)
    ("bts", UGC / "TVC  bts", "KathaFrames BTS*", "bts", "Behind the Scenes", "ZestBot shoot", 3.2, 31.6),
    # AI & animation — vertical
    ("fennec-cricket", SRC / "AI Videos", "Copy of Fennec*", "ai", "Game Day Ritual", "Fennec Fox"),
    ("zestbot-ai", SRC / "AI Videos", "Kirana store zt*", "ai", "Your Kirana, Delivered", "ZestBot"),
    ("audi-childrens-day", SRC / "AI Videos", "children day 2*", "ai", "Every Big Dream", "Audi Bengaluru Central"),
    ("atticply", AI / "AI-Powered Content Creation", "plywood reels*", "ai", "Strong in Every Condition", "Attic Decor · AtticPly"),
    ("wellness-shampoo", AI / "AI-Powered Content Creation", "shampoo reels*", "ai", "Powered by Nature", "The Wellness Box"),
    ("mockit", AI / "AI-Powered Content Creation", "MockIT Hub*", "ai", "Try It Free", "MockIT Hub"),
    ("mealomart-food", AI / "AI-Powered Content Creation", "Reels food*", "ai", "Fresh to Your Door", "MealoMart"),
    ("interior", AI / "AI-Powered Content Creation", "interior design*", "ai", "Spaces, Imagined", "Interior design · AI film"),
    # AI & animation — horizontal
    ("tiger-podcast", SRC / "AI Videos", "tiger podcast*", "ai", "The Wild Starts Here", "AI film"),
    ("ai-hospital", AI / "AI-Powered Content Creation", "AI-HOSPITAL*", "ai", "Care, Reimagined", "Hospital · AI ad film"),
    ("led-3d", AI / "3d", "4k Draft*", "anim", "Pixel Bar System", "3D product film"),
    ("holadrive", AI / "2.5d _ starts from 20k-min", "HolaDrive*", "anim", "Care. Safety. Respect.", "HolaDrive"),
    ("fortinet", AI / "2.5d _ starts from 20k-min", "*Fortinet*", "anim", "Security, Explained", "Fortinet"),
    ("deebee", AI / "2d _ starts from 15k-min", "DeeBee*", "anim", "Shop Near You", "DeeBee"),
    ("hk-vitals", AI / "Stock & Motion Graphics _ starts from 8k-min", "Final Hv*", "anim", "Watch the Weight Fizz Away", "HK Vitals"),
    ("invictus", AI / "Stock & Motion Graphics _ starts from 8k-min", "Invictus*", "anim", "Fintech, Simplified", "Invictus"),
]


def probe(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:stream_side_data=rotation:format=duration",
         "-of", "json", str(path)], capture_output=True, text=True, check=True).stdout
    d = json.loads(out)
    s = d["streams"][0]
    w, h = s["width"], s["height"]
    rot = 0
    for sd in s.get("side_data_list", []):
        rot = int(sd.get("rotation", 0) or 0)
    if abs(rot) in (90, 270):
        w, h = h, w
    audio = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", str(path)],
                           capture_output=True, text=True).stdout.strip() != ""
    return w, h, float(d["format"]["duration"]), audio


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError(r.stderr[-800:])


def encode(entry):
    vid, folder, pattern, cat, title, client, *trim = entry
    matches = sorted(folder.glob(pattern))
    if not matches:
        return {"id": vid, "error": f"no source for {pattern}"}
    src = matches[0]
    w, h, dur, audio = probe(src)
    if min(w, h) < 1080:
        return {"id": vid, "error": f"source is {w}x{h}, below 1080p"}
    t0, t1 = (trim + [0, dur])[:2] if trim else (0, dur)
    length = t1 - t0
    vertical = h > w
    scale = "scale=1080:-2:flags=lanczos" if vertical else "scale=-2:1080:flags=lanczos"
    ow, oh = (1080, round(1080 * h / w / 2) * 2) if vertical else (round(1080 * w / h / 2) * 2, 1080)
    full, loop, poster = OUT / "full" / f"{vid}.mp4", OUT / "loop" / f"{vid}.mp4", OUT / "poster" / f"{vid}.jpg"
    v = ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-profile:v", "high", "-fpsmax", "30", "-movflags", "+faststart"]
    run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t0}", "-i", str(src), "-t", f"{length}", "-vf", scale, *v,
         "-preset", "slow", "-crf", "21", "-maxrate", "6M", "-bufsize", "12M",
         *(["-c:a", "aac", "-b:a", "160k"] if audio else ["-an"]), str(full)])
    # the loop: 8 s from a quarter of the way in (past intros and logos)
    ls = t0 + (1.0 if length < 16 else length * 0.25)
    ll = min(8.0, max(3.0, t1 - ls - 0.5))
    run(["ffmpeg", "-v", "error", "-y", "-ss", f"{ls}", "-i", str(src), "-t", f"{ll}", "-vf", scale, *v,
         "-preset", "slow", "-crf", "23", "-maxrate", "5M", "-bufsize", "10M", "-an", str(loop)])
    run(["ffmpeg", "-v", "error", "-y", "-ss", "0.5", "-i", str(loop), "-frames:v", "1", "-q:v", "3", str(poster)])
    mb = lambda p: round(p.stat().st_size / 1e6, 1)
    print(f"ok  {vid:20s} {w}x{h} -> {ow}x{oh}  full {mb(full)}MB  loop {mb(loop)}MB", flush=True)
    return {"id": vid, "title": title, "client": client, "cat": cat, "orient": "v" if vertical else "h",
            "dur": round(length, 1), "w": ow, "h": oh}


def main():
    jobs = int(sys.argv[sys.argv.index("--jobs") + 1]) if "--jobs" in sys.argv else 3
    for d in ("full", "loop", "poster"):
        (OUT / d).mkdir(parents=True, exist_ok=True)
    def safe(e):
        try:
            return encode(e)
        except Exception as x:  # keep going; report at the end
            return {"id": e[0], "error": str(x)}

    with ThreadPoolExecutor(jobs) as ex:
        results = list(ex.map(safe, VIDEOS))
    ok = [r for r in results if "error" not in r]
    for r in results:
        if "error" in r:
            print("SKIP", r["id"], "-", r["error"], flush=True)
    dest = Path(__file__).resolve().parent.parent / "src" / "content" / "videos.json"
    dest.write_text(json.dumps(ok, ensure_ascii=False, indent=1), encoding="utf8")
    print(f"done: {len(ok)} videos -> {dest}", flush=True)


if __name__ == "__main__":
    main()
