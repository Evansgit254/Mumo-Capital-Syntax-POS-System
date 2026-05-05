# Testing Guide

This project follows a multi-layered testing strategy to ensure reliability and maintainability.

## 🧪 Testing Stack

- **Backend**: [Vitest](https://vitest.dev/) for unit and integration testing.
- **Frontend**: Currently validated via TypeScript (Build check) and Manual QA.
- **CI/CD**: GitHub Actions automated pipeline.

## 🚀 Running Tests

### Backend
To run the server-side tests:
```bash
cd server
npm test
```

To run tests in watch mode during development:
```bash
npm run test:watch
```

### Frontend (Validation)
To run the build check:
```bash
cd client
npm run build
```

## 🏗️ Writing New Tests

### Backend Unit Tests
Place tests in `server/src/tests/`. Use the `.test.ts` extension.

Example structure:
```typescript
import { describe, it, expect, vi } from 'vitest';
// ... imports

describe('Feature Name', () => {
    it('should perform X when Y happens', () => {
        // Assertions
    });
});
```

### Integration Tests
Mock external services like database or payment gateways when possible to keep CI fast. Use `vi.mock()` for dependency injection.

## 🛡️ CI Pipeline
Every push and pull request to `main` triggers a GitHub Action that:
1. Installs dependencies for the entire monorepo.
2. Lints the codebase.
3. Builds all packages.
4. Runs backend unit tests.

Deployment is currently manual but can be automated by extending the `.github/workflows/ci.yml` pipeline.
