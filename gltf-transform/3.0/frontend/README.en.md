# 3D Asset Toolbox (v3.0)

A web-based 3D asset processing tool supporting GLB model compression, HDR to KTX2 conversion, and HDR to skybox generation.

**Repository:** [https://gitee.com/zhangyiweb/gltf-transform](https://gitee.com/zhangyiweb/gltf-transform)

## Features

- **Model Compression** — Upload GLB files, view node tree and stats, compress with WebP / Draco / GLB optimization
- **HDR to KTX2** — Convert `.hdr` / `.exr` environment maps to KTX2 with UASTC encoding
- **HDR to Skybox** — Split equirectangular HDR into 6 cube faces (Three.js compatible), ZIP download

## Quick Start

```bash
npm install -g @gltf-transform/cli
cd 3.0/frontend
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Tech Stack

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express
- Compression: gltf-transform CLI, ktx2-encoder, sharp, hdrify

## License

MIT
