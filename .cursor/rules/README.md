# Cursor Rules - Modern Format

This directory contains the modern `.mdc` (Markdown Components) format for Cursor AI rules, replacing the legacy `.cursorrules` file.

## Structure

Rules are organized into focused, modular files with numeric prefixes for ordering:

### Quick Reference & Constraints (00-05)
- **00-quick-start.mdc** - Common tasks, commands, critical files map
- **01-project-overview.mdc** - What RideShare.Click is and project philosophy
- **02-critical-constraints.mdc** - Non-negotiable constraints (storage, styling, auth)
- **03-technology-stack.mdc** - Technologies and dependencies
- **04-amplify-gen2.mdc** - Amplify Gen 2 patterns and anti-patterns
- **05-apple-hig.mdc** - Apple Human Interface Guidelines compliance

### Core Implementation (06-10)
- **06-authentication.mdc** - SSO patterns, Apple Sign In configuration
- **07-architecture.mdc** - Component structure, routing, lazy loading
- **08-file-paths.mdc** - Where to find features in the codebase
- **09-core-features.mdc** - Ride-share features, business logic, key flows
- **10-data-models.mdc** - AWS Amplify data models and data flow

### Best Practices (11-12)
- **11-code-quality.mdc** - TypeScript, naming, error handling, notifications
- **12-common-patterns.mdc** - Reusable code patterns

### Maintenance & Operations (13-16)
- **13-troubleshooting.mdc** - Common issues and solutions
- **14-testing.mdc** - Testing strategies and manual checklist
- **15-deployment.mdc** - Git workflow, deployment, optimization
- **16-decision-trees.mdc** - Step-by-step debugging and development guides

## Priority System

Each file has a `priority` value in its frontmatter (higher = more important):
- **100**: Critical quick start info
- **95**: Non-negotiable constraints
- **90**: Core technology patterns (Amplify Gen 2)
- **85**: Important but context-specific (Auth, Apple HIG, File Paths, Project Overview)
- **82-83**: Core features and troubleshooting
- **80**: Architecture, common patterns, decision trees
- **78**: Code quality, deployment
- **75**: Testing

## Benefits Over Single .cursorrules File

1. **Modularity**: Easy to update specific areas without affecting others
2. **Maintainability**: Smaller, focused files are easier to maintain
3. **Selective Loading**: Cursor can load relevant rules based on context
4. **Clear Organization**: Related rules grouped logically
5. **Scalability**: Easy to add new rules without bloating a single file
6. **Version Control**: Git diffs are more meaningful for changes

## Frontmatter Format

Each `.mdc` file includes frontmatter:

```yaml
---
title: Quick Start
description: Most common tasks and commands for RideShare development
priority: 100
---
```

## Migration Notes

- Original `.cursorrules` file backed up as `.cursorrules.backup`
- All content migrated to modular `.mdc` files
- No functionality lost - same rules, better organization
- Restart Cursor to pick up new format

## When to Update

Update rules when:
- Adding new technologies or patterns
- Discovering new gotchas or issues
- Changing project constraints
- Adding new features with specific patterns
- Deprecating old patterns

## Maintenance

Keep rules:
- **Concise**: Focus on what AI needs to know
- **Actionable**: Provide specific examples and code snippets
- **Updated**: Remove outdated info, add new learnings
- **Prioritized**: Use priority values to guide AI's focus
- **Cross-referenced**: Link related rules together

## Project Note

- **RideShare.Click** is a cooperative ride-sharing app; rules are aligned to this codebase.

---

**Last Updated**: 2026-01-30 | **Version**: 1.0 (RideShare.Click)

## Recent Updates (2026-01-30)

- ✅ Rules aligned for RideShare.Click (cooperative ride-sharing platform)
- ✅ File paths and features updated to match actual codebase
- ✅ PokerRide-specific content removed; ride-share data models and flows documented

