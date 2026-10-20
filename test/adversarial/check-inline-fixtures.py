"""Optional, standard-library-only validation of the Solidity inline PNG fixture."""

import base64
import hashlib
from pathlib import Path
import re
import struct
import zlib

directory = Path(__file__).resolve().parent
source = (directory / "SpecSupport.sol").read_text()
png_source = source.split("function png()", 1)[1].split("function pngBase64()", 1)[0]
png = bytes.fromhex(re.search(r'hex"([0-9a-f]+)"', png_source).group(1))
base64_source = source.split("function pngBase64()", 1)[1].split("function illustratedHtml()", 1)[0]
encoded = re.search(r'return\s+"([A-Za-z0-9+/=]+)"', base64_source).group(1)
assert base64.b64decode(encoded, validate=True) == png
assert png[:8] == b"\x89PNG\r\n\x1a\n"
position = 8
while position < len(png):
    size = struct.unpack(">I", png[position : position + 4])[0]
    kind = png[position + 4 : position + 8]
    data = png[position + 8 : position + 8 + size]
    crc = struct.unpack(">I", png[position + 8 + size : position + 12 + size])[0]
    assert zlib.crc32(kind + data) == crc
    print(kind.decode(), "length", size, "CRC verified")
    if kind == b"IHDR":
        assert struct.unpack(">IIBBBBB", data) == (1, 1, 8, 6, 0, 0, 0)
    if kind == b"IDAT":
        scanline = zlib.decompress(data)
        assert scanline == bytes([0, 43, 117, 191, 255])
        print("Decoded scanline:", scanline.hex())
    position += 12 + size
assert position == len(png)
print("Actual PNG bytes:", len(png))
print("PNG SHA-256:", hashlib.sha256(png).hexdigest())
print("Exact Base64 match: PASS")
print("No filesystem, environment, RPC or execution cheatcodes:")
for file in sorted(directory.glob("*.sol")):
    text = file.read_text()
    assert not re.search(
        r"vm\.(?:readFile|writeFile|readDir|setEnv|env\w*|ffi|create\w*Fork|rpc)\b", text
    )
    print(file.name, "PASS")
