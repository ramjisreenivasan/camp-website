# Website Setup Documentation

## Infrastructure Summary

| Resource | Value |
|----------|-------|
| S3 Bucket | `aiproductcamp-ramji` |
| Region | `us-east-1` |
| AWS Profile | `ramji-cli` |
| CloudFront Distribution ID | `E33E8Y4FX8111` |
| CloudFront Domain | `https://d2eqj6ny4k60av.cloudfront.net` |
| S3 Website Endpoint | `http://aiproductcamp-ramji.s3-website-us-east-1.amazonaws.com` |
| Status | Deploying (takes 5-15 minutes for initial propagation) |

## What Was Configured

### S3 Bucket
- Created bucket `aiproductcamp-ramji` in `us-east-1`
- Enabled static website hosting with `index.html` as index document
- Disabled Block Public Access settings
- Applied public read bucket policy for all objects

### CloudFront Distribution
- Distribution ID: `E33E8Y4FX8111`
- Origin: S3 website endpoint (HTTP-only origin protocol)
- Viewer protocol: Redirect HTTP to HTTPS
- Cache policy: Managed `CachingOptimized` (ID: `658327ea-f89d-4fab-a63d-7e88639e58f6`)
- Compression: Enabled (gzip/brotli)
- Price class: `PriceClass_100` (US, Canada, Europe — lowest cost)
- HTTP version: HTTP/2
- Default root object: `index.html`

## Access URLs

- Production (HTTPS): `https://d2eqj6ny4k60av.cloudfront.net`
- Direct S3 (HTTP only): `http://aiproductcamp-ramji.s3-website-us-east-1.amazonaws.com`

Use the CloudFront URL for sharing — it provides HTTPS and edge caching.

## Deploying Updates

To push changes to the live site:

```bash
# Upload files to S3
aws s3 sync . s3://aiproductcamp-ramji --profile ramji-cli --exclude "*.md" --exclude "node_modules/*" --exclude "tests/*" --exclude "package*.json" --exclude "vitest.config.js" --exclude ".kiro/*" --exclude "bucket-policy.json" --exclude "cf-distribution.json" --exclude "reqs/*"

# Invalidate CloudFront cache (so changes appear immediately)
aws cloudfront create-invalidation --distribution-id E33E8Y4FX8111 --paths "/*" --profile ramji-cli
```

## Adding a Custom Domain (Future)

When you're ready to use a custom domain:

1. Request an SSL certificate in ACM (must be in `us-east-1` for CloudFront)
2. Add your domain as an alternate domain name (CNAME) on the distribution
3. Update your DNS to point to `d2eqj6ny4k60av.cloudfront.net` via CNAME record
4. Update the distribution's viewer certificate to use the ACM cert

## Tearing Down

To remove all infrastructure:

```bash
# Disable the CloudFront distribution first (required before deletion)
aws cloudfront get-distribution-config --id E33E8Y4FX8111 --profile ramji-cli > dist-config.json
# Edit dist-config.json: set "Enabled": false, then update
aws cloudfront update-distribution --id E33E8Y4FX8111 --if-match <ETag> --distribution-config file://dist-config.json --profile ramji-cli
# Wait for status to be "Deployed", then delete
aws cloudfront delete-distribution --id E33E8Y4FX8111 --if-match <ETag> --profile ramji-cli

# Empty and delete the S3 bucket
aws s3 rm s3://aiproductcamp-ramji --recursive --profile ramji-cli
aws s3 rb s3://aiproductcamp-ramji --profile ramji-cli
```
