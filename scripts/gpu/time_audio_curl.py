import json, time, urllib.request

payload = json.dumps({"prompt": "a crackling campfire at dusk", "durationSec": 10}).encode()
req = urllib.request.Request("http://localhost:8000/api/v1/generate-audio", data=payload,
                             headers={"Content-Type": "application/json"})
t0 = time.time()
try:
    with urllib.request.urlopen(req, timeout=500) as r:
        data = r.read()
        synth = r.headers.get("X-EchoForge-Synthetic")
    print(f"CURL-10s: {time.time()-t0:.1f}s total, {len(data)} bytes, synthetic={synth}")
except Exception as e:
    print(f"CURL-10s FAILED: {e}")
