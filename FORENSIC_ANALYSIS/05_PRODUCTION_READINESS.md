# Production Readiness Checklist

## Overview

This document provides a comprehensive checklist for deploying Legozo 3D CMS to production, with special focus on WordPress embedding.

---

## Critical Pre-Production Fixes

### Must-Fix Before ANY Deployment ⚠️

- [ ] **Fix ModuleBase import path** (Issue #5)
  - `modules/physics/physics.module.js` line 22
  - `modules/ground/ground.module.js` line 15
  - Change: `../../core/ModuleBase.js` → `../base/module-base.js`

- [ ] **Fix physics initialization** (Issue #1)
  - Remove false dependencies in `physics.module.js`
  - Add plugin availability check
  - Fix load order in `legozo-loader.js`

- [ ] **Add error recovery** (Issue #4)
  - Graceful degradation for failed modules
  - User warning display for non-critical failures

- [ ] **Fix controller initialization** (Issue #6)
  - Wait for DOM before attaching controllers
  - Add timeout/retry logic

---

## WordPress Integration Checklist

### 1. WordPress Plugin Structure

**Required Files**:
```
wp-legozo-3d/
├── legozo-3d.php              (Main plugin file)
├── readme.txt                  (WordPress plugin readme)
├── includes/
│   ├── shortcode.php           (Shortcode handler)
│   ├── block.php               (Gutenberg block)
│   ├── admin.php               (Admin settings page)
│   └── rest-api.php            (REST API endpoints)
├── assets/
│   └── (entire 4v directory)
└── admin/
    ├── settings.css
    └── settings.js
```

**Main Plugin File** (`legozo-3d.php`):
```php
<?php
/**
 * Plugin Name: Legozo 3D Scene CMS
 * Description: Embed interactive 3D scenes in WordPress pages
 * Version: 1.0.0
 * Author: Your Name
 * License: GPL2
 */

defined('ABSPATH') or die('No direct access');

// Define plugin paths
define('LEGOZO_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('LEGOZO_PLUGIN_URL', plugin_dir_url(__FILE__));

// Include core files
require_once LEGOZO_PLUGIN_DIR . 'includes/shortcode.php';
require_once LEGOZO_PLUGIN_DIR . 'includes/block.php';
require_once LEGOZO_PLUGIN_DIR . 'includes/rest-api.php';
require_once LEGOZO_PLUGIN_DIR . 'includes/admin.php';

// Initialize plugin
add_action('init', 'legozo_init');
function legozo_init() {
    // Register shortcode
    add_shortcode('legozo_scene', 'legozo_render_scene_shortcode');

    // Register Gutenberg block
    register_block_type('legozo/scene-block', [
        'render_callback' => 'legozo_render_scene_block'
    ]);

    // Register REST API endpoints
    legozo_register_rest_routes();
}
```

---

### 2. Shortcode Implementation

**File**: `includes/shortcode.php`

```php
<?php
function legozo_render_scene_shortcode($atts) {
    $atts = shortcode_atts([
        'scene_id' => 'default',
        'width' => '100%',
        'height' => '600px',
        'autoplay' => 'true',
        'controls' => 'true'
    ], $atts);

    // Generate unique ID for multiple scenes on same page
    static $scene_count = 0;
    $scene_count++;
    $container_id = 'legozo-scene-' . $scene_count;

    // Enqueue assets
    legozo_enqueue_assets();

    // Get scene config
    $scene_config = legozo_get_scene_config($atts['scene_id']);

    // Render container
    ob_start();
    ?>
    <div id="<?php echo esc_attr($container_id); ?>"
         class="legozo-scene-container"
         style="width: <?php echo esc_attr($atts['width']); ?>; height: <?php echo esc_attr($atts['height']); ?>;">
        <canvas class="legozo-canvas"></canvas>
    </div>
    <script>
    (function() {
        // Initialize scene when ready
        document.addEventListener('DOMContentLoaded', function() {
            const container = document.getElementById('<?php echo $container_id; ?>');
            const canvas = container.querySelector('canvas');

            // Initialize Legozo on this canvas
            const legozo = new LegozoEmbed(canvas, <?php echo json_encode($scene_config); ?>);
            legozo.init();

            <?php if ($atts['autoplay'] === 'false'): ?>
            legozo.pause();
            <?php endif; ?>
        });
    })();
    </script>
    <?php
    return ob_get_clean();
}

function legozo_enqueue_assets() {
    static $assets_enqueued = false;
    if ($assets_enqueued) return;

    // Enqueue Babylon.js
    wp_enqueue_script('babylonjs',
        'https://cdn.babylonjs.com/babylon.js',
        [], '7.0', true);

    wp_enqueue_script('babylonjs-loaders',
        'https://cdn.babylonjs.com/loaders/babylonjs.loaders.min.js',
        ['babylonjs'], '7.0', true);

    wp_enqueue_script('babylonjs-gui',
        'https://cdn.babylonjs.com/gui/babylon.gui.min.js',
        ['babylonjs'], '7.0', true);

    wp_enqueue_script('havok-physics',
        'https://cdn.babylonjs.com/havok/HavokPhysics_umd.js',
        ['babylonjs'], '7.0', true);

    // Enqueue Legozo assets
    wp_enqueue_style('legozo-styles',
        LEGOZO_PLUGIN_URL . 'assets/ui/styles/main.css',
        [], '1.0');

    wp_enqueue_script('legozo-embed',
        LEGOZO_PLUGIN_URL . 'assets/dist/legozo-embed.js',
        ['babylonjs', 'havok-physics'], '1.0', true);

    $assets_enqueued = true;
}
```

---

### 3. Gutenberg Block

**File**: `includes/block.php`

```javascript
// block.js (client-side)
import { registerBlockType } from '@wordpress/blocks';
import { InspectorControls } from '@wordpress/block-editor';
import { PanelBody, TextControl, ToggleControl } from '@wordpress/components';

registerBlockType('legozo/scene-block', {
    title: 'Legozo 3D Scene',
    icon: 'welcome-view-site',
    category: 'embed',
    attributes: {
        sceneId: { type: 'string', default: 'default' },
        height: { type: 'string', default: '600px' },
        autoplay: { type: 'boolean', default: true }
    },
    edit: ({ attributes, setAttributes }) => {
        return (
            <>
                <InspectorControls>
                    <PanelBody title="Scene Settings">
                        <TextControl
                            label="Scene ID"
                            value={attributes.sceneId}
                            onChange={(value) => setAttributes({ sceneId: value })}
                        />
                        <TextControl
                            label="Height"
                            value={attributes.height}
                            onChange={(value) => setAttributes({ height: value })}
                        />
                        <ToggleControl
                            label="Autoplay"
                            checked={attributes.autoplay}
                            onChange={(value) => setAttributes({ autoplay: value })}
                        />
                    </PanelBody>
                </InspectorControls>
                <div className="legozo-block-preview"
                     style={{ height: attributes.height, background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <p>Legozo 3D Scene: {attributes.sceneId}</p>
                    <p><em>(Preview in frontend)</em></p>
                </div>
            </>
        );
    },
    save: ({ attributes }) => {
        // Return null - render via PHP
        return null;
    }
});
```

---

### 4. REST API Endpoints

**File**: `includes/rest-api.php`

```php
<?php
function legozo_register_rest_routes() {
    // Get scene data
    register_rest_route('legozo/v1', '/scenes/(?P<id>[a-zA-Z0-9-]+)', [
        'methods' => 'GET',
        'callback' => 'legozo_get_scene',
        'permission_callback' => '__return_true'
    ]);

    // Save scene data
    register_rest_route('legozo/v1', '/scenes/(?P<id>[a-zA-Z0-9-]+)', [
        'methods' => 'POST',
        'callback' => 'legozo_save_scene',
        'permission_callback' => 'legozo_can_edit_scenes'
    ]);

    // List all scenes
    register_rest_route('legozo/v1', '/scenes', [
        'methods' => 'GET',
        'callback' => 'legozo_list_scenes',
        'permission_callback' => '__return_true'
    ]);
}

function legozo_get_scene($request) {
    $scene_id = $request['id'];
    $scene_data = get_option('legozo_scene_' . $scene_id);

    if (!$scene_data) {
        return new WP_Error('scene_not_found', 'Scene not found', ['status' => 404]);
    }

    return rest_ensure_response(json_decode($scene_data, true));
}

function legozo_save_scene($request) {
    $scene_id = $request['id'];
    $scene_data = $request->get_json_params();

    update_option('legozo_scene_' . $scene_id, json_encode($scene_data));

    return rest_ensure_response(['success' => true]);
}

function legozo_can_edit_scenes() {
    return current_user_can('edit_posts');
}
```

---

### 5. Embed Wrapper (WordPress-specific)

**File**: `assets/dist/legozo-embed.js`

```javascript
/**
 * LegozoEmbed - WordPress Embed Wrapper
 * Lightweight wrapper around Legozo core for WordPress embedding
 */
class LegozoEmbed {
    constructor(canvas, config = {}) {
        this.canvas = canvas;
        this.config = config;
        this.legozo = null;
    }

    async init() {
        try {
            // Hide WordPress controls if needed
            this.setupWordPressIntegration();

            // Initialize core Legozo
            const { LegozoLoader } = await import('./core/legozo-loader.js');
            this.legozo = new LegozoLoader(this.canvas);

            // Load scene config
            await this.legozo.init(this.config);
            await this.legozo.start();

            // Emit ready event for WordPress hooks
            this.dispatchEvent('legozo:ready');

        } catch (error) {
            console.error('[LegozoEmbed] Initialization failed:', error);
            this.showError(error);
        }
    }

    setupWordPressIntegration() {
        // Listen for WordPress admin bar visibility
        if (document.getElementById('wpadminbar')) {
            document.body.classList.add('legozo-wordpress');
        }

        // Handle WordPress fullscreen mode
        window.addEventListener('resize', () => {
            this.legozo?.engine?.engine?.resize();
        });
    }

    dispatchEvent(eventName, data = {}) {
        window.dispatchEvent(new CustomEvent(eventName, { detail: data }));
    }

    showError(error) {
        this.canvas.style.display = 'none';
        const errorDiv = document.createElement('div');
        errorDiv.className = 'legozo-error';
        errorDiv.innerHTML = `
            <h3>Failed to load 3D scene</h3>
            <p>${error.message}</p>
        `;
        this.canvas.parentElement.appendChild(errorDiv);
    }
}

// Export for WordPress
window.LegozoEmbed = LegozoEmbed;
```

---

## Security Checklist

### Input Validation

- [ ] **Scene ID validation**: Only allow alphanumeric + hyphens
- [ ] **Config validation**: Validate all user-provided config with schema
- [ ] **File upload**: Sanitize filenames, check MIME types
- [ ] **XSS prevention**: Escape all output in templates

**Implementation**:
```php
function legozo_sanitize_scene_id($scene_id) {
    return preg_replace('/[^a-z0-9-]/i', '', $scene_id);
}

function legozo_validate_scene_config($config) {
    $schema = [
        'camera' => ['position', 'rotation'],
        'objects' => ['type' => ['box', 'sphere', 'cylinder']],
        // ...
    ];

    return legozo_validate_against_schema($config, $schema);
}
```

---

### Content Security Policy

**Add to WordPress headers**:
```php
function legozo_add_csp_header() {
    header("Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.babylonjs.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;");
}
add_action('send_headers', 'legozo_add_csp_header');
```

**Note**: `'unsafe-eval'` required for Babylon.js WASM

---

### Capability Checks

- [ ] **Scene editing**: Requires `edit_posts` capability
- [ ] **Scene deletion**: Requires `delete_posts` capability
- [ ] **Settings**: Requires `manage_options` capability

```php
function legozo_can_edit_scenes() {
    return current_user_can('edit_posts');
}

function legozo_can_delete_scenes() {
    return current_user_can('delete_posts');
}
```

---

## Performance Checklist

- [ ] **Enable Gzip compression** on server
- [ ] **Set cache headers** for static assets (1 year)
- [ ] **Implement service worker** for repeat load caching
- [ ] **Optimize images**: Compress textures (JPG quality 80%)
- [ ] **Lazy load non-critical modules**
- [ ] **Inline critical CSS** in templates
- [ ] **Preload Havok WASM**

**Server Config** (`.htaccess`):
```apache
# Enable Gzip
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/html text/css text/javascript application/javascript application/json
</IfModule>

# Cache static assets
<FilesMatch "\.(jpg|jpeg|png|gif|js|css|woff2)$">
    Header set Cache-Control "max-age=31536000, public"
</FilesMatch>
```

---

## Browser Compatibility

### Minimum Requirements

- **Chrome**: 90+ (2021)
- **Firefox**: 88+ (2021)
- **Safari**: 14+ (2020)
- **Edge**: 90+ (2021)
- **Mobile**: iOS 14+, Android Chrome 90+

### Feature Detection

**Add to Bootstrap.js**:
```javascript
function checkBrowserSupport() {
    const required = {
        webgl2: !!document.createElement('canvas').getContext('webgl2'),
        modules: 'noModule' in document.createElement('script'),
        wasm: typeof WebAssembly !== 'undefined'
    };

    const unsupported = Object.entries(required)
        .filter(([key, value]) => !value)
        .map(([key]) => key);

    if (unsupported.length > 0) {
        showUnsupportedBrowserMessage(unsupported);
        return false;
    }

    return true;
}

if (!checkBrowserSupport()) {
    throw new Error('Browser does not support required features');
}
```

---

## Testing Checklist

### Functional Testing

- [ ] Scene loads without errors
- [ ] All demo objects visible
- [ ] Camera controls work (WASD, mouse)
- [ ] Physics enabled (objects fall)
- [ ] Gravity presets work
- [ ] Ground textures load
- [ ] Lighting presets work
- [ ] Shadow quality settings work
- [ ] Mode toggle (View ↔ Edit)
- [ ] Object selection
- [ ] Gizmo manipulation
- [ ] Properties panel updates
- [ ] Save scene to JSON
- [ ] Load scene from JSON

---

### WordPress Integration Testing

- [ ] **Shortcode renders** in posts/pages
- [ ] **Multiple scenes** on same page work
- [ ] **Gutenberg block** appears in inserter
- [ ] **Block settings** update preview
- [ ] **Scene saves** via REST API
- [ ] **Scene loads** via REST API
- [ ] **Permissions** enforced (non-editors can't save)
- [ ] **No conflicts** with other plugins
- [ ] **Works with popular themes** (Astra, OceanWP, GeneratePress)

---

### Cross-Browser Testing

- [ ] Chrome (Windows, Mac, Linux)
- [ ] Firefox (Windows, Mac, Linux)
- [ ] Safari (Mac, iOS)
- [ ] Edge (Windows)
- [ ] Mobile Safari (iOS 14+)
- [ ] Mobile Chrome (Android)

---

### Performance Testing

- [ ] First load < 2 seconds (4G connection)
- [ ] Repeat load < 1 second (cached)
- [ ] Stable 60 FPS on desktop
- [ ] Stable 30 FPS on mobile
- [ ] No memory leaks (run for 5 minutes)
- [ ] Multiple scenes don't crash page

**Tools**:
- Chrome DevTools (Performance, Network, Memory)
- Lighthouse (Performance score > 80)
- WebPageTest (filmstrip timeline)

---

## Deployment Checklist

### Pre-Deployment

- [ ] All critical issues fixed (from Issue #1-#8)
- [ ] Code reviewed by team
- [ ] All tests passing
- [ ] Documentation updated
- [ ] WordPress plugin tested in staging

---

### WordPress Plugin Deployment

1. **Create Plugin ZIP**:
```bash
cd wp-legozo-3d
zip -r legozo-3d-v1.0.0.zip . -x "*.git*" "node_modules/*" ".DS_Store"
```

2. **Upload to WordPress**:
   - WordPress Admin → Plugins → Add New → Upload
   - Or: FTP to `/wp-content/plugins/`

3. **Activate Plugin**:
   - WordPress Admin → Plugins → Activate "Legozo 3D Scene CMS"

4. **Configure Settings**:
   - WordPress Admin → Settings → Legozo 3D
   - Set default scene, enable features

---

### Production Server Configuration

**Requirements**:
- PHP 7.4+
- WordPress 5.8+
- HTTPS (required for WASM)
- 256 MB PHP memory limit (for large scenes)

**Recommended Hosting**:
- WP Engine (optimized WordPress hosting)
- Cloudflare (CDN + cache)
- AWS S3 (for 3D model storage)

---

### Post-Deployment Verification

- [ ] Plugin activates without errors
- [ ] Shortcode renders correctly
- [ ] Block appears in Gutenberg
- [ ] No JavaScript console errors
- [ ] No PHP errors in logs
- [ ] Performance meets targets
- [ ] SSL certificate valid

---

## Monitoring & Maintenance

### Error Tracking

**Integrate Sentry** (or similar):
```javascript
// In Bootstrap.js
if (window.Sentry) {
    Sentry.init({
        dsn: 'YOUR_SENTRY_DSN',
        environment: 'production'
    });

    window.addEventListener('error', (e) => {
        Sentry.captureException(e.error);
    });
}
```

---

### Performance Monitoring

**Integrate Google Analytics** (or similar):
```javascript
// Track load time
window.addEventListener('load', () => {
    const loadTime = performance.now();
    gtag('event', 'timing_complete', {
        name: 'legozo_load',
        value: Math.round(loadTime)
    });
});
```

---

### Update Strategy

**Semantic Versioning**:
- **Patch** (1.0.X): Bug fixes, minor updates
- **Minor** (1.X.0): New features, backward compatible
- **Major** (X.0.0): Breaking changes

**WordPress Plugin Updates**:
- Use WordPress plugin update mechanism
- Test in staging before pushing to production
- Provide migration guides for major versions

---

## Rollback Plan

**If deployment fails**:
1. Deactivate plugin in WordPress
2. Revert to previous version
3. Check error logs (`wp-content/debug.log`)
4. Fix issues in staging
5. Re-deploy with fixes

**Database Rollback**:
```php
function legozo_rollback_to_version($version) {
    // Restore backed-up options
    $backup = get_option('legozo_backup_' . $version);
    if ($backup) {
        update_option('legozo_scenes', $backup['scenes']);
        update_option('legozo_settings', $backup['settings']);
    }
}
```

---

## Documentation Requirements

- [ ] **User Guide**: How to use shortcode/block
- [ ] **Developer Guide**: API reference, hooks, filters
- [ ] **Troubleshooting**: Common issues and solutions
- [ ] **Changelog**: Document all changes per version

---

## Support Plan

**Support Channels**:
- WordPress.org plugin support forum
- GitHub Issues (for bug reports)
- Email support (for premium version)

**Response Time SLA**:
- Critical bugs: 24 hours
- Major bugs: 1 week
- Feature requests: Triaged monthly

---

## Success Metrics

**Key Performance Indicators**:
- Plugin installs: Target 1,000+ in first 6 months
- Active installations: Target 80% retention
- Average rating: Target 4.5+ stars
- Load time: < 2 seconds on 95th percentile
- FPS: 60 FPS on 90% of devices
- Error rate: < 0.1% of loads

---

## Next Steps

See **[06_IMPLEMENTATION_PLAN.md](./06_IMPLEMENTATION_PLAN.md)** for step-by-step implementation guide.
