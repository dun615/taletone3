# TALETONE MUSIC Deploy Checklist

## GitHub Pages

- Custom domain: `taletone.net`
- `CNAME` file: `taletone.net`
- Enforce HTTPS: ON
- Deploy root: repository root
- Entry file: `index.html`

## Cloudflare

- SSL/TLS mode: Full
- Edge Certificate: Active
- Always Use HTTPS: ON
- Automatic HTTPS Rewrites: ON
- `taletone.net` A records: proxied
- `www` CNAME: proxied
- TXT verification records: DNS only

## Manual Checks

- Open `https://taletone.net/` after deploy cache clears.
- Confirm social preview image: `https://taletone.net/assets/social/og-image.png`
- Confirm `https://taletone.net/robots.txt`
- Confirm `https://taletone.net/sitemap.xml`
