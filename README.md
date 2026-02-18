# Resume Builder

Template-driven static resume builder with live preview, optional sections, JSON save/load, and print/PDF export.

## Run locally

```bash
python3 -m http.server 4173
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173)

## Current features

- All major resume sections are addable (`+ Add`) and removable
- Sections can be shown/hidden from `Section Visibility`
- Collapsed editor groups by default (`Edit` / `Close`) for compact workspace
- Sticky live preview while editing
- Configurable LinkedIn logo link in header
- Clickable links in content (URLs + `[label](url)` format)
- Font scale controls for fitting content
- JSON export/import for resume data
- Print/PDF layout tuned for A4

## Deploy to GitHub Pages

1. Create a GitHub repo and push this folder.
2. In GitHub: `Settings` -> `Pages`.
3. Under `Build and deployment`:
   - `Source`: `Deploy from a branch`
   - `Branch`: `main` (or your default branch), folder `/ (root)`
4. Save. GitHub will publish a URL like:
   `https://<username>.github.io/<repo>/`

No build step is needed because this is a static HTML/CSS/JS app.
