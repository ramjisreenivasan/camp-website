# AI Tech Product Camp Website

A single-page marketing website for "AI Tech Product Camp – Build the Future with AI." Built with plain HTML, CSS, and vanilla JavaScript — no build step required.

## Project Overview

This is a static marketing site designed to promote an AI-focused product camp for teens. It includes:

- Hero section with camp branding and CTA
- Program highlights and curriculum overview
- Schedule/session information
- Instructor profiles
- Registration form with client-side validation
- Responsive design for mobile and desktop

## File Structure

```
├── index.html          # Main HTML page
├── styles.css          # All styles
├── main.js             # Interactive behavior (form validation, smooth scroll, etc.)
├── assets/
│   └── images/         # Camp photos and graphics
├── tests/
│   └── setup.test.js   # Vitest tests
├── vitest.config.js    # Test configuration
├── package.json        # Dev dependencies (testing only)
└── README.md
```

## Local Development

No build step needed. Open `index.html` directly in a browser, or use a local server:

```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx serve .
```

Then visit `http://localhost:8000` (Python) or `http://localhost:3000` (serve).

## Deployment to AWS S3

All commands use the `ramji-cli` AWS profile (configured in `.kiro/.awsprofile`).

### 1. Create an S3 Bucket

```bash
aws s3 mb s3://your-bucket-name --region us-east-1 --profile ramji-cli
```

### 2. Enable Static Website Hosting

```bash
aws s3 website s3://your-bucket-name \
  --index-document index.html --profile ramji-cli
```

### 3. Configure Bucket Policy for Public Read Access

Apply this bucket policy to allow public access:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::your-bucket-name/*"
    }
  ]
}
```

```bash
aws s3api put-bucket-policy --bucket your-bucket-name --policy file://bucket-policy.json --profile ramji-cli
```

> **Note:** You may also need to disable the "Block Public Access" settings on the bucket for the policy to take effect.

### 4. Upload Files

```bash
aws s3 sync . s3://your-bucket-name --profile ramji-cli --exclude "*.md" --exclude "node_modules/*" --exclude "tests/*" --exclude "package*.json" --exclude "vitest.config.js" --exclude ".kiro/*"
```

Your site will be available at:
`http://your-bucket-name.s3-website-us-east-1.amazonaws.com`

### Cache Header Recommendations

Set cache headers per file type for optimal performance:

| File | Cache-Control | Reason |
|------|--------------|--------|
| `index.html` | `no-cache` | Always serve latest markup |
| `styles.css`, `main.js` | `max-age=31536000` | Long cache; bust via query string (`?v=2`) |
| Images (`assets/`) | `max-age=86400` | Cache for 24 hours |

Example upload with cache headers:

```bash
# HTML - no cache
aws s3 cp index.html s3://your-bucket-name/index.html \
  --cache-control "no-cache" --content-type "text/html" --profile ramji-cli

# CSS/JS - long cache
aws s3 cp styles.css s3://your-bucket-name/styles.css \
  --cache-control "max-age=31536000" --content-type "text/css" --profile ramji-cli
aws s3 cp main.js s3://your-bucket-name/main.js \
  --cache-control "max-age=31536000" --content-type "application/javascript" --profile ramji-cli

# Images - 24h cache
aws s3 sync assets/ s3://your-bucket-name/assets/ \
  --cache-control "max-age=86400" --profile ramji-cli
```

## Optional: CloudFront CDN

For HTTPS support, custom domains, and global edge caching:

1. **Create a CloudFront distribution** pointing to your S3 website endpoint as the origin.
2. **Custom domain** — request an SSL certificate via AWS Certificate Manager (ACM) in `us-east-1`, then add your domain as an alternate domain name (CNAME) on the distribution.
3. **Origin Access Identity (OAI)** — restrict direct S3 access so all traffic flows through CloudFront. Update the bucket policy to grant read access only to the OAI.

Refer to the [AWS CloudFront documentation](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/GettingStarted.SimpleDistribution.html) for step-by-step setup.

## Customization

To adapt this site for your own camp or event:

- **Content** — Replace placeholder text in `index.html` (camp name, dates, descriptions, instructor bios).
- **Images** — Add real photos to `assets/images/` and update `src` attributes in the HTML.
- **Colors/Fonts** — Edit CSS custom properties at the top of `styles.css`.
- **Form action** — Update the registration form's submission endpoint to your backend or form service.
