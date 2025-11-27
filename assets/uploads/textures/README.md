# Ground Textures

This folder contains ground texture assets for the 3D CMS.

## How to Add Custom Textures

1. **Add your texture file** to this folder:
   ```
   assets/uploads/textures/my-texture.jpg
   ```

2. **Edit `textures.json`** and add an entry:
   ```json
   {
     "id": "my-texture",
     "name": "My Custom Texture",
     "icon": "🎨",
     "diffuse": "./assets/uploads/textures/my-texture.jpg",
     "tiling": { "u": 4, "v": 4 },
     "category": "custom"
   }
   ```

3. **Refresh the page** and your texture will appear in the Ground Textures panel!

## File Recommendations

- **Format:** JPG or PNG
- **Dimensions:** Power of 2 (512x512, 1024x1024, 2048x2048)
- **Seamless:** Use tileable textures for best results
- **File Size:** Keep under 2MB for fast loading

## Optional: Normal Maps

For more realistic lighting, add a normal map:

```json
{
  "id": "my-texture",
  "name": "My Custom Texture",
  "diffuse": "./assets/uploads/textures/my-texture.jpg",
  "normal": "./assets/uploads/textures/my-texture-normal.jpg",
  "tiling": { "u": 4, "v": 4 }
}
```

## Current Textures

The default textures use Babylon.js Playground CDN URLs so they work immediately without downloads. You can replace these with local files if needed.
