---
name: confluence-cli
description: A CLI tool for Atlassian Confluence. Lets you read, search, create, update, move, delete, and convert pages and attachments from the terminal or from an agent.
---
# Confluence CLI (NPM Package)

## Overview

confluence-cli is a community-developed command-line interface for Atlassian Confluence that enables content management directly from the terminal. This is a **third-party tool** (not official Atlassian), available via NPM.

**Use this skill when:**

- Users request CLI-based Confluence operations
- Documentation workflows need automation
- Bulk page operations are required
- Content migration between spaces is needed
- Users want to script documentation updates

**Important**: This is NOT the official Atlassian CLI (acli), which does not support Confluence. This is a community tool: <https://github.com/pchuri/confluence-cli>

## Usage

### Read a Page

```
# Read by page ID
confluence read 123456789

# Read in markdown format
confluence read 123456789 --format markdown

# Read by URL (must contain pageId parameter)
confluence read "https://your-domain.atlassian.net/wiki/viewpage.action?pageId=123456789"
```

### Get Page Information

```
confluence info 123456789
```

### Search Pages

```
# Basic search
confluence search "search term"

# Limit results
confluence search "search term" --limit 5
```

### List or Download Attachments

```
# List all attachments on a page
confluence attachments 123456789

# Filter by filename and limit the number returned
confluence attachments 123456789 --pattern "*.png" --limit 5

# Download matching attachments to a directory
confluence attachments 123456789 --pattern "*.png" --download --dest ./downloads
```

### Upload Attachments

```
# Upload a single attachment
confluence attachment-upload 123456789 --file ./report.pdf

# Upload multiple files with a comment
confluence attachment-upload 123456789 --file ./a.pdf --file ./b.png --comment "v2"

# Replace an existing attachment by filename
confluence attachment-upload 123456789 --file ./diagram.png --replace
```

### Delete Attachments

```
# Delete an attachment by ID
confluence attachment-delete 123456789 998877

# Skip confirmation
confluence attachment-delete 123456789 998877 --yes
```

### Content Properties

```
# List all properties on a page
confluence property-list 123456789

# Get a specific property
confluence property-get 123456789 my-key

# Set a property (creates or updates with auto-versioning)
confluence property-set 123456789 my-key --value '{"color":"#ff0000"}'

# Set a property from a JSON file
confluence property-set 123456789 my-key --file ./property.json

# Delete a property
confluence property-delete 123456789 my-key

# Skip confirmation on delete
confluence property-delete 123456789 my-key --yes
```

### Comments

```
# List all comments (footer + inline)
confluence comments 123456789

# List inline comments as markdown
confluence comments 123456789 --location inline --format markdown

# Create a footer comment
confluence comment 123456789 --content "Looks good to me!"

# Create an inline comment
confluence comment 123456789 \
  --location inline \
  --content "Consider renaming this" \
  --inline-selection "foo" \
  --inline-original-selection "foo"

# Reply to a comment
confluence comment 123456789 --parent 998877 --content "Agree with this"

# Delete a comment
confluence comment-delete 998877
```

Inline comment creation note (Confluence Cloud): Creating inline comments requires editor-generated highlight metadata (`matchIndex`, `lastFetchTime`, `serializedHighlights`, plus the selection text). The public REST API does not provide these fields, so inline creation and inline replies can fail with a 400 unless you supply the full `--inline-properties` payload captured from the editor. Footer comments and replies are fully supported.

### Export a Page with Attachments

```
# Export page content (markdown by default) and all attachments
confluence export 123456789 --dest ./exports

# Custom content format/filename and attachment filtering
confluence export 123456789 --format html --file content.html --pattern "*.png"

# Skip attachments if you only need the content file
confluence export 123456789 --skip-attachments
```

### List Spaces

```
confluence spaces
```

### List Child Pages

```
# List direct child pages
confluence children 123456789

# List all descendants recursively
confluence children 123456789 --recursive

# Display as tree structure
confluence children 123456789 --recursive --format tree

# Show page IDs and URLs
confluence children 123456789 --show-id --show-url

# Limit recursion depth
confluence children 123456789 --recursive --max-depth 3

# Output as JSON for scripting
confluence children 123456789 --recursive --format json > children.json
```

### Find a Page by Title

```
# Find page by title
confluence find "Project Documentation"

# Find page by title in a specific space
confluence find "Project Documentation" --space MYTEAM
```

### Create a New Page

```
# Create with inline content and markdown format
confluence create "My New Page" SPACEKEY --content "**Hello** World!" --format markdown

# Create from a file
confluence create "Documentation" SPACEKEY --file ./content.md --format markdown
```

### Create a Child Page

```
# Create child page with inline content
confluence create-child "Meeting Notes" 123456789 --content "This is a child page"

# Create child page from a file
confluence create-child "Tech Specs" 123456789 --file ./specs.md --format markdown
```

### Copy Page Tree

```
# Copy a page and all its children to a new location
confluence copy-tree 123456789 987654321 "Project Docs (Copy)"

# Copy with maximum depth limit (only 3 levels deep)
confluence copy-tree 123456789 987654321 --max-depth 3

# Exclude pages by title (supports wildcards * and ?; case-insensitive)
confluence copy-tree 123456789 987654321 --exclude "temp*,test*,*draft*"

# Control pacing and naming
confluence copy-tree 123456789 987654321 --delay-ms 150 --copy-suffix " (Backup)"

# Dry run (preview only)
confluence copy-tree 123456789 987654321 --dry-run

# Quiet mode (suppress progress output)
confluence copy-tree 123456789 987654321 --quiet
```

Notes:

- Preserves the original parent-child hierarchy when copying.
- Continues on errors: failed pages are logged and the copy proceeds.
- Exclude patterns use simple globbing: `*` matches any sequence, `?` matches any single character, and special regex characters are treated literally.
- Large trees may take time; the CLI applies a small delay between sibling page creations to avoid rate limits (configurable via `--delay-ms`).
- Root title suffix defaults to `(Copy)`; override with `--copy-suffix`. Child pages keep their original titles.
- Use `--fail-on-error` to exit non-zero if any page fails to copy.

### Update an Existing Page

```
# Update title only
confluence update 123456789 --title "A Newer Title for the Page"

# Update content only from a string
confluence update 123456789 --content "Updated page content."

# Update content from a file
confluence update 123456789 --file ./updated-content.md --format markdown

# Update both title and content
confluence update 123456789 --title "New Title" --content "And new content"
```

### Move a Page to New Parent

```
# Move page by ID
confluence move 123456789 987654321

# Move page and rename it
confluence move 123456789 987654321 --title "Relocated Page"

# Move using URLs (for convenience)
confluence move "https://domain.atlassian.net/wiki/viewpage.action?pageId=123456789" \
                "https://domain.atlassian.net/wiki/viewpage.action?pageId=987654321"
```

**Note:** Pages can only be moved within the same Confluence space. Cross-space moves are not supported.

### Delete a Page

```
# Delete by page ID (prompts for confirmation)
confluence delete 123456789

# Delete by URL
confluence delete "https://your-domain.atlassian.net/wiki/viewpage.action?pageId=123456789"

# Skip confirmation (useful for scripts)
confluence delete 123456789 --yes
```

### Edit Workflow

The `edit` and `update` commands work together to create a seamless editing workflow.

```
# 1. Export page content to a file (in Confluence storage format)
confluence edit 123456789 --output ./page-to-edit.xml

# 2. Edit the file with your preferred editor
vim ./page-to-edit.xml

# 3. Update the page with your changes
confluence update 123456789 --file ./page-to-edit.xml --format storage
```

### Profile Management

```
# List all profiles and see which is active
confluence profile list

# Switch the active profile
confluence profile use staging

# Add a new profile interactively
confluence profile add staging

# Add a new profile non-interactively
confluence profile add staging --domain "staging.example.com" --auth-type bearer --token "xyz"

# Add a read-only profile (blocks all write operations)
confluence profile add agent --domain "company.atlassian.net" --auth-type basic --email "bot@example.com" --token "xyz" --read-only

# Remove a profile
confluence profile remove staging

# Use a specific profile for a single command
confluence --profile staging spaces
```

### Read-Only Mode

Read-only mode blocks all write operations at the CLI level, making it safe to hand the tool to AI agents (Claude Code, Copilot, etc.) without risking accidental edits.

**Enable via profile:**

```
# During init
confluence init --read-only

# When adding a profile
confluence profile add agent --domain "company.atlassian.net" --token "xyz" --read-only
```

**Enable via environment variable:**

```
export CONFLUENCE_READ_ONLY=true   # overrides profile setting
```

When read-only mode is active, any write command (`create`, `create-child`, `update`, `delete`, `move`, `edit`, `comment`, `attachment-upload`, `attachment-delete`, `property-set`, `property-delete`, `comment-delete`, `copy-tree`) exits with code 1 and prints an error message.

`confluence profile list` shows a `[read-only]` badge next to protected profiles.

### View Usage Statistics

```
confluence stats
```

## Commands

| Command                                                | Description                                                  | Options                                                      |
| ------------------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------ |
| `init`                                                 | Initialize CLI configuration                                 | `--read-only`                                                |
| `read <pageId_or_url>`                                 | Read page content                                            | `--format <html|text|markdown>`                              |
| `info <pageId_or_url>`                                 | Get page information                                         |                                                              |
| `search <query>`                                       | Search for pages                                             | `--limit <number>`                                           |
| `spaces`                                               | List all available spaces                                    |                                                              |
| `find <title>`                                         | Find a page by its title                                     | `--space <spaceKey>`                                         |
| `children <pageId>`                                    | List child pages of a page                                   | `--recursive`, `--max-depth <number>`, `--format <list|tree|json>`,`--show-url`,`--show-id` |
| `create <title> <spaceKey>`                            | Create a new page                                            | `--content <string>`, `--file <path>`, `--format <storage|html|markdown>` |
| `create-child <title> <parentId>`                      | Create a child page                                          | `--content <string>`, `--file <path>`, `--format <storage|html|markdown>` |
| `copy-tree <sourcePageId> <targetParentId> [newTitle]` | Copy page tree with all children                             | `--max-depth <number>`, `--exclude <patterns>`, `--delay-ms <ms>`, `--copy-suffix <text>`, `--dry-run`, `--fail-on-error`, `--quiet` |
| `update <pageId>`                                      | Update a page's title or content                             | `--title <string>`, `--content <string>`, `--file <path>`, `--format <storage|html|markdown>` |
| `move <pageId_or_url> <newParentId_or_url>`            | Move a page to a new parent location                         | `--title <string>`                                           |
| `delete <pageId_or_url>`                               | Delete a page by ID or URL                                   | `--yes`                                                      |
| `edit <pageId>`                                        | Export page content for editing                              | `--output <file>`                                            |
| `attachments <pageId_or_url>`                          | List or download attachments for a page                      | `--limit <number>`, `--pattern <glob>`, `--download`, `--dest <directory>` |
| `attachment-upload <pageId_or_url>`                    | Upload attachments to a page                                 | `--file <path>`, `--comment <text>`, `--replace`, `--minor-edit` |
| `attachment-delete <pageId_or_url> <attachmentId>`     | Delete an attachment from a page                             | `--yes`                                                      |
| `comments <pageId_or_url>`                             | List comments for a page                                     | `--format <text|markdown|json>`,`--limit <number>`,`--start <number>`,`--location <inline|footer|resolved>`,`--depth <root|all>`,`--all` |
| `comment <pageId_or_url>`                              | Create a comment on a page                                   | `--content <string>`, `--file <path>`, `--format <storage|html|markdown>`,`--parent <commentId>`,`--location <inline|footer>`,`--inline-selection <text>`,`--inline-original-selection <text>`,`--inline-marker-ref <ref>`,`--inline-properties <json>` |
| `comment-delete <commentId>`                           | Delete a comment by ID                                       | `--yes`                                                      |
| `property-list <pageId_or_url>`                        | List all content properties for a page                       | `--format <text|json>`,`--limit <number>`,`--start <number>`,`--all` |
| `property-get <pageId_or_url> <key>`                   | Get a content property by key                                | `--format <text|json>`                                       |
| `property-set <pageId_or_url> <key>`                   | Set a content property (create or update)                    | `--value <json>`, `--file <path>`, `--format <text|json>`    |
| `property-delete <pageId_or_url> <key>`                | Delete a content property by key                             | `--yes`                                                      |
| `export <pageId_or_url>`                               | Export a page to a directory with its attachments            | `--format <html|text|markdown>`,`--dest <directory>`,`--file <filename>`,`--attachments-dir <name>`,`--pattern <glob>`,`--referenced-only`,`--skip-attachments` |
| `profile list`                                         | List all configuration profiles                              |                                                              |
| `profile use <name>`                                   | Set the active configuration profile                         |                                                              |
| `profile add <name>`                                   | Add a new configuration profile                              | `-d, --domain`, `-p, --api-path`, `-a, --auth-type`, `-e, --email`, `-t, --token`, `--protocol`, `--read-only` |
| `profile remove <name>`                                | Remove a configuration profile                               |                                                              |
| `convert`                                              | Convert between content formats locally (no server required) | `--input-file <path>`, `--output-file <path>`, `--input-format <markdown|storage|html>`,`--output-format <markdown|storage|html|text>` |
| `stats`                                                | View your usage statistics                                   |                                                              |

**Global option:** `--profile <name>` — Use a specific profile for any command (overrides `CONFLUENCE_PROFILE` env var and active profile).

## Examples

```
# Setup
confluence init

# Read a page as text
confluence read 123456789

# Read a page as HTML
confluence read 123456789 --format html

# Get page details
confluence info 123456789

# Search with limit
confluence search "API documentation" --limit 3

# List all spaces
confluence spaces

# Move a page to a new parent
confluence move 123456789 987654321

# Move and rename
confluence move 123456789 987654321 --title "New Title"

# Upload and delete an attachment
confluence attachment-upload 123456789 --file ./report.pdf
confluence attachment-delete 123456789 998877 --yes

# View usage statistics
confluence stats

# Profile management
confluence profile list
confluence profile use staging
confluence --profile staging spaces

# Convert markdown to Confluence storage format (no server required)
confluence convert --input-file doc.md --input-format markdown --output-format storage

# Pipe conversion via stdin/stdout
echo "# Hello" | confluence convert --input-format markdown --output-format storage

# Convert storage format back to markdown
confluence convert -i page.xml -o page.md --input-format storage --output-format markdown
```
