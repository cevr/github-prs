# AGENTS.md

## Build/Lint/Test Commands
- `bun run build` - Build production bundle
- `bun run build.ts --help` - Build script options
- `bun run dev` - Hot reload development
- `bun run start` - Production server
- No lint/test commands configured

## Code Style Guidelines
- **Language**: TypeScript with strict mode
- **Imports**: Use ES modules, React 19 JSX transform
- **Styling**: Tailwind CSS v4
- **Naming**: camelCase for variables/functions, PascalCase for components
- **Types**: Strict TypeScript with chrome types
- **Structure**: src/popup/ and src/options/ directories
- **Entry**: HTML files as entrypoints via build.ts
- **Environment**: Browser extension with Chrome APIs