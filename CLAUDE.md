# Project Guidelines for Claude

## Git Commit Messages

When creating git commits, follow these guidelines:

1. Use conventional commit format (feat:, fix:, docs:, etc.)
2. Write clear, concise commit messages
3. DO NOT include "Co-Authored-By" or any attribution to Claude
4. DO NOT include emoji or "Generated with Claude Code" messages
5. Keep commit messages professional and focused on the changes

Example of good commit message:
```
feat: Add Header, Footer, and ScoreDisplay components

- Create Header component with default/minimal/transparent variants
- Add sticky header support with scroll effects
- Create Footer component with multiple layout options
- Add ScoreDisplay with animated counting and grade system
```

## Code Style

- Use TypeScript with strict typing
- Follow existing code patterns in the project
- Use semantic color variables from the theme system
- Prefer composition over inheritance
- Keep components focused and single-purpose