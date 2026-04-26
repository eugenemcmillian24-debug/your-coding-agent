# Security Policy

## Reporting Vulnerabilities

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT** open a public issue
2. Email the maintainer directly
3. Include a description, reproduction steps, and potential impact

## Supported Versions

| Version | Supported |
|---------|-----------|
| v22.x   | ✅ Active |
| < v22   | ❌ EOL    |

## Security Practices

- All webhook payloads are verified with HMAC signatures
- Environment variables used for all secrets (never hardcoded)
- CORS restricted to known origins
- Input validation via Pydantic models
- Parameterized SQL queries (no string interpolation)
- Idempotency keys prevent duplicate operations
