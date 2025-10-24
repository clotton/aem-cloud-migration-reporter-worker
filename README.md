# Cloud Flare Worker for Migrations

**Important:** Never commit secrets or local environment variables.

- Store secrets in `wrangler.toml` under `[vars]` or use Cloudflare secrets:
  ```sh
  wrangler secret put API_TOKEN
  ```
- Use `wrangler dev` to test locally.
