# van-cli (TypeScript)

TypeScript CLI wrapper for the NGP VAN API (`https://api.securevan.com/v4`).

## Requirements

- Node.js 18+
- `VAN_API_KEY` environment variable
- Optional `VAN_APP_NAME` (defaults to `default_user`)

## Setup

```bash
export VAN_API_KEY="your-api-key|1"
export VAN_APP_NAME="your-app-name"
```

## Scripts

```bash
npm run build
npm test
npm run test:coverage
```

## CLI usage

```bash
van people find --firstName Jane --lastName Doe --top 10 --pretty
van saved-lists list --top 100
van export-jobs create --savedListId 12345
```

## Robustness features

- Retries on transient VAN errors (`429`, `5xx`) with exponential backoff
- Consistent typed API errors (`VanApiError`)
- Pagination helpers (`getPaginated`, `getAllPaginated`)
- Jest coverage thresholds enforced in CI (`jest.config.cjs`)
