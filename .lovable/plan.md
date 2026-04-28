## Fix Facebook Sharing Debugger warnings

The debugger flagged two missing required Open Graph properties. I'll add them to `index.html` inside `<head>`:

- `<meta property="og:url" content="https://app.explorerbysl.com/" />`
- `<meta property="fb:app_id" content="772723352574900" />`

The Facebook App ID was retrieved from `bot_settings.facebook_app_id` in the database (matches the existing OAuth integration).

### Files touched
- `index.html` — add the two meta tags alongside existing `og:type` tag

After deploy, re-scrape the URL in the Facebook Sharing Debugger to clear the cache.
