# Spatial Portfolio — 3D Gallery Template

An original, browser-based 3D portfolio experiment. Drag to look around the room and click an illuminated object to open an information panel.

## Edit your content

Open `assets/js/content.js` and replace the bracketed placeholders. Each item controls one interactive object and its pop-up panel.

## Files

```text
vr-portfolio-gallery/
├── index.html              # Page structure and UI
└── assets/
    ├── css/styles.css      # Layout, visual system, responsive design
    └── js/
        ├── content.js      # Your portfolio content placeholders
        └── gallery.js      # Three.js room, camera, and interactions
```

## Run locally

Use a local web server instead of opening `index.html` directly, because the site uses JavaScript modules. GitHub Pages works without a build step.

## Notes

The scene is VR-like for mouse and touch interaction. It does not request headset/WebXR access. That can be added as a separate optional feature later.
