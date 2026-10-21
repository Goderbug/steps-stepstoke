#!/usr/bin/env bash
# Optional Ubuntu 24.04 runner setup. No sudo, system install, root config edit or vendoring.
set -euo pipefail
frontend_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
tools_dir="${1:-/tmp/cto-relay-webkit}"
mkdir -p "$tools_dir/debs" "$tools_dir/libs"
tools_dir="$(cd -- "$tools_dir" && pwd)"
export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-/tmp/cto-relay-browsers}"
"$frontend_dir/node_modules/.bin/playwright" install webkit
(
  cd "$tools_dir/debs"
  apt-get -o APT::Sandbox::User=root download libgtk-4-1 libpangocairo-1.0-0 libgdk-pixbuf-2.0-0 libcairo-gobject2 \
    libgraphene-1.0-0 liblcms2-2 libevent-2.1-7t64 libopus0 libgstreamer-plugins-base1.0-0 \
    libgstreamer-plugins-bad1.0-0 libgstreamer-gl1.0-0 libflite1 libwebpdemux2 libavif16 \
    libharfbuzz-icu0 libepoxy0 libwebpmux3 libwayland-server0 libwayland-egl1 libwayland-client0 \
    libmanette-0.2-0 libenchant-2-2 libsecret-1-0 libhyphen0 libgles2 libx264-164 libegl1 \
    libsvtav1enc1d1 libdav1d7 libgav1-1 liborc-0.4-0t64 librav1e0 libwayland-cursor0 libyuv0 \
    libcloudproviders0 libcolord2 libdconf1 libevdev2 libgudev-1.0-0 libhunspell-1.7-0 \
    libaspell15 libjson-glib-1.0-0 libsecret-common libpangoft2-1.0-0 libxcursor1 libxinerama1 \
    libcairo-script-interpreter2 libabsl20220623t64 libdatrie1 libthai0 libfribidi0 libpixman-1-0 \
    libxcb-render0 libxcb-shm0 libegl-mesa0 libgl1-mesa-dri mesa-libgallium libllvm20 \
    libdrm2 libdrm-amdgpu1 libdrm-intel1 libgbm1 libvulkan1 libsensors5 libx11-xcb1 \
    libxcb-dri3-0 libxcb-present0 libxcb-randr0 libxcb-sync1 libxcb-xfixes0 libxshmfence1 \
    libedit2 libz3-4
  for archive in ./*.deb; do dpkg-deb -x "$archive" "$tools_dir/libs"; done
)
webkit_launcher="$(cd "$frontend_dir" && node --input-type=module -e 'import {webkit} from "playwright"; console.log(webkit.executablePath())')"
# The upstream MiniBrowser wrapper overwrites LD_LIBRARY_PATH. Use a dedicated wrapper for
# headless testing that keeps both the official bundled libraries and the extracted packages.
python3 - "$tools_dir" "$webkit_launcher" <<'PY'
import pathlib, shlex, sys
tools, launcher = map(pathlib.Path, sys.argv[1:])
browser = launcher.parent / 'minibrowser-wpe'
(tools/'cache').mkdir(exist_ok=True)
env = {
 'WEBKIT_EXEC_PATH': browser/'bin',
 'WEBKIT_INJECTED_BUNDLE_PATH': browser/'lib',
 'WEBKIT_INSPECTOR_RESOURCES_PATH': browser/'share',
 'LD_LIBRARY_PATH': f'{browser}/lib:{browser}/sys/lib:{tools}/libs/usr/lib/x86_64-linux-gnu',
 'WEBKIT_FORCE_COMPLEX_TEXT': '1',
 'LIBGL_ALWAYS_SOFTWARE': '1',
 '__EGL_VENDOR_LIBRARY_DIRS': tools/'libs/usr/share/glvnd/egl_vendor.d',
 'LIBGL_DRIVERS_PATH': tools/'libs/usr/lib/x86_64-linux-gnu/dri',
 'XDG_CACHE_HOME': tools/'cache',
 'MESA_SHADER_CACHE_DIR': tools/'cache/mesa',
}
wrapper = tools/'webkit-headless'
wrapper.write_text('#!/bin/sh\n' + ''.join(f'export {k}={shlex.quote(str(v))}\n' for k,v in env.items()) + f'exec {shlex.quote(str(browser/"bin/MiniBrowser"))} "$@"\n')
wrapper.chmod(0o755)
print(f'export W1_WEBKIT_EXECUTABLE={shlex.quote(str(wrapper))}')
PY
