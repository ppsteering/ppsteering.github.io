# Proxy Policy Steering — project page

Anonymous project page for the CoRL 2026 submission **"Proxy Policy Steering:
Inference-Time Adaptation of Robotic Foundation Models"**. Live at
<https://proxy-policy-steering.github.io>.

The page is based on the [Nerfies project page template](https://github.com/nerfies/nerfies.github.io)
(CC-BY-SA 4.0) with all author-identifying links removed.

## Editing locally

The page is plain static HTML in `index.html` + assets under `static/`.

To preview, open `index.html` in a browser or run a tiny static server:

```bash
python3 -m http.server -d webpage 8000
# then open http://localhost:8000
```

## Things to fill in before / after the review window

- `index.html`: the Paper and Code buttons are currently commented out.
  Re-enable by removing the HTML comment markers around them once the
  public-facing PDF / repo URLs exist.
- `static/images/*.png`: regenerate from the latest paper PDFs via the
  Ghostscript pipeline (`gs -r600 -sDEVICE=pngalpha` + `sips
  --resampleWidth 3600`) whenever the paper figures change.
