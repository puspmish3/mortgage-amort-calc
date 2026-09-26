# Mortgage payment calculators

A static page with four loan modules — Purchase, Refinance, Commercial, and Community lending. Each one has a short guide and a monthly-payment calculator with an amortization schedule. The original buydown schedule lives inside Purchase, because a temporary rate buydown is a purchase-loan feature.

Everything runs in the browser. Nothing you type is sent anywhere.

## Run locally

Open `index.html` in a browser, or serve the folder so the ES module loads reliably:

```powershell
python -m http.server 8080
```

Then visit `http://localhost:8080`.

No install and no build step. Chart.js draws the on-page balance chart. ExcelJS and JSZip build the customer workbook from **Export to Sheet**. The schedule still calculates if a CDN script is blocked; the sheet download needs both libraries.

On the Schedule sheet, a one-time extra over $1,000 is marked in coral with the note “extra payment made by -”. A regular monthly addition, including payment overage, keeps the lilac row and the note “Monthly additional monthly payment made by -”. Hover the extra-principal cell and fill in the name.

## Check the math

```powershell
node test-amortization.mjs
node test-products.mjs
```

## Deploy

Upload this folder to any static host (GitHub Pages, Netlify, Azure Static Web Apps, or an S3/Blob static website). There is no server and no monthly app cost beyond the host’s free tier.

# Post deploy