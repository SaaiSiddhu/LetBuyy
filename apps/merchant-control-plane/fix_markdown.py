#!/usr/bin/env python3
"""
Script to fix markdown formatting in the LetBuyy Implementation Plan.
Fixes: missing headers, missing code fences, broken metadata, etc.
"""
import re
import os

FILE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)),
    "LetBuyy Multi-Tenant Store Platform — Comprehensive Implementation Plan.md")

with open(FILE_PATH, 'r', encoding='utf-8') as f:
    content = f.read()

lines = content.split('\n')
new_lines = []
i = 0

# Track state for code fence fixing
in_code_block = False
pending_lang = None

while i < len(lines):
    line = lines[i]
    stripped = line.strip()

    # ============================================================
    # FIX 1: Title line (line 1)
    # ============================================================
    if i == 0 and stripped == "LetBuyy Multi-Tenant Store Platform — Comprehensive Implementation Plan":
        new_lines.append("# LetBuyy Multi-Tenant Store Platform — Comprehensive Implementation Plan")
        i += 1
        continue

    # ============================================================
    # FIX 2: Metadata line (line 2) - split into proper format
    # ============================================================
    if stripped.startswith("Version: 2.0Date:"):
        new_lines.append("")
        new_lines.append("> **Version:** 2.0 | **Date:** February 12, 2026 | **Status:** Production-Ready Architecture")
        new_lines.append(">")
        new_lines.append("> **Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Supabase, Cloudflare Workers, Resend Email API")
        new_lines.append("")
        i += 1
        continue

    # ============================================================
    # FIX 3: Table of Contents - add ## header
    # ============================================================
    if stripped == "Table of Contents":
        new_lines.append("---")
        new_lines.append("")
        new_lines.append("## Table of Contents")
        i += 1
        continue

    # ============================================================
    # FIX 4: Main section headers (1. xxx, 2. xxx, etc.)
    # ============================================================
    # Match lines like "1. Executive Summary" that should be ## headers
    section_match = re.match(r'^(\d+)\.\s+(.+)$', stripped)
    if section_match and not in_code_block:
        num = section_match.group(1)
        title = section_match.group(2)
        # Only apply to top-level sections listed in TOC
        top_sections = {
            "Executive Summary", "Architecture Overview", "Tech Stack & Dependencies",
            "Database Schema", "DNS & SSL Configuration",
            "Implementation Plan — Part by Part", "Email Notification System",
            "UI Wireframes — All Screens", "Deployment Checklist",
            "Testing & Validation"
        }
        if title in top_sections:
            new_lines.append("")
            new_lines.append("---")
            new_lines.append("")
            new_lines.append(f"## {num}. {title}")
            new_lines.append("")
            i += 1
            continue

    # ============================================================
    # FIX 5: Sub-section headers (X.Y Title)
    # ============================================================
    subsec_match = re.match(r'^(\d+\.\d+)\s+(.+)$', stripped)
    if subsec_match and not in_code_block:
        num = subsec_match.group(1)
        title = subsec_match.group(2)
        # Known sub-sections
        known_subsections = [
            "Domain Topology", "Application Map", "User Journey Flow",
            "Frontend Stack", "Backend Stack", "Infrastructure",
            "Package Dependencies", "Core Tables",
            "Row Level Security (RLS)", "Database Functions",
            "Cloudflare DNS Setup (Fresh Account)",
            "SSL Configuration", "DNS Validation Commands",
            "Email Templates Architecture",
            "Email Layout Component", "Success Email Template",
            "Failure Email Template", "Email API Routes",
            "Environment Variables",
            "Onboarding: Loading State", "Onboarding: Step 1 — Site Type Selection",
            "Onboarding: Step 2 — Store Name Input", "Onboarding: Error State (Overlay)",
            "Onboarding: Success State", "Dark Mode Comparison",
            "Responsive: Mobile vs Desktop",
            "Email Template: Success (Desktop Preview)",
            "Email Template: Failure (Desktop Preview)",
            "Pre-Deployment (Local Development)",
            "Cloudflare Setup (New Account)", "Vercel Setup (New Account)",
            "Vercel Configuration Files", "Post-Deployment Verification",
            "Unit Tests (Optional)", "E2E Tests (Cypress/Playwright)",
            "Manual Testing Checklist",
        ]
        if title in known_subsections:
            new_lines.append("")
            new_lines.append(f"### {num} {title}")
            new_lines.append("")
            i += 1
            continue

    # ============================================================
    # FIX 6: Feature table (Feature Status Priority)
    # ============================================================
    if stripped == "Feature\tStatus\tPriority":
        new_lines.append("")
        new_lines.append("| Feature | Status | Priority |")
        new_lines.append("|---------|--------|----------|")
        i += 1
        # Process following table rows
        while i < len(lines):
            row = lines[i].strip()
            if '\t' in row:
                cols = row.split('\t')
                if len(cols) >= 3:
                    new_lines.append(f"| {cols[0]} | {cols[1]} | {cols[2]} |")
                i += 1
            else:
                break
        continue

    # ============================================================
    # FIX 7: Sub-section headers like "Objectives", "Key Features",
    #         "Deployment Targets", "Step 1:", "Step 2:", etc.
    # ============================================================
    simple_headers = [
        "Objectives", "Key Features", "Deployment Targets",
        "Step 1: Add Domain to Cloudflare",
        "Step 2: Configure DNS Records",
    ]
    if stripped in simple_headers and not in_code_block:
        new_lines.append("")
        new_lines.append(f"#### {stripped}")
        new_lines.append("")
        i += 1
        continue

    # ============================================================
    # FIX 8: Bare language identifiers that should be code fence openers
    # e.g., a line that is just "json", "sql", "css", "typescript", "tsx",
    # "bash", "terraform" appearing outside a code block
    # ============================================================
    lang_keywords = {'json', 'sql', 'css', 'typescript', 'tsx', 'bash', 'terraform', 'markdown'}
    if stripped in lang_keywords and not in_code_block:
        # Check if previous line is empty (typical pattern in the broken file)
        if new_lines and new_lines[-1].strip() == '':
            new_lines.append(f"```{stripped}")
            in_code_block = True
            pending_lang = stripped
            i += 1
            continue

    # ============================================================
    # FIX 9: Track code fence state
    # ============================================================
    if stripped.startswith('```'):
        if in_code_block:
            in_code_block = False
            pending_lang = None
        else:
            in_code_block = True
        new_lines.append(line)
        i += 1
        continue

    # ============================================================
    # FIX 10: Detect transitions from code to prose
    # If we're in a code block and hit a line that looks like a
    # section header (e.g., "Part 3: Login Redirect Logic"),
    # close the code block first
    # ============================================================
    if in_code_block:
        # Lines that indicate we left a code block without closing it
        exit_patterns = [
            r'^Part \d+:',
            r'^\d+\.\d+ ',
            r'^File: ',
            r'^Location:',
            r'^Change:',
            r'^Add to ',
            r'^\*\*',
            r'^CRITICAL:',
            r'^Step \d+:',
            r'^HOVER STATE',
            r'^SELECTED STATE',
            r'^FOCUS STATE',
            r'^CREATING STATE',
            r'^LIGHT MODE',
            r'^MOBILE \(',
        ]
        
        # Check "File:" pattern more carefully - it's a file specification line
        file_match = re.match(r'^File:\s+apps/', stripped)
        part_match = re.match(r'^Part \d+:', stripped)
        subsec_match2 = re.match(r'^(\d+\.\d+)\s+', stripped)
        
        if file_match or part_match or subsec_match2:
            # Close the code block
            new_lines.append("```")
            in_code_block = False
            pending_lang = None
            new_lines.append("")
        
        # Also check for "Manual DNS Configuration" type headers
        if stripped.startswith("**") and stripped.endswith("**") and not stripped.startswith("**File"):
            new_lines.append("```")
            in_code_block = False
            pending_lang = None
            new_lines.append("")

    # ============================================================
    # FIX 11: "Part X:" sub-headers
    # ============================================================
    part_match = re.match(r'^Part (\d+):\s+(.+)$', stripped)
    if part_match and not in_code_block:
        new_lines.append("")
        new_lines.append(f"### Part {part_match.group(1)}: {part_match.group(2)}")
        new_lines.append("")
        i += 1
        continue

    # ============================================================
    # FIX 12: "File:" lines become bold
    # ============================================================
    file_line_match = re.match(r'^File:\s+(.+)$', stripped)
    if file_line_match and not in_code_block:
        new_lines.append(f"**File:** `{file_line_match.group(1)}`")
        i += 1
        continue

    # ============================================================
    # FIX 13: "Location:" and "Change:" lines
    # ============================================================
    if stripped.startswith("Location:") and not in_code_block:
        new_lines.append(f"**{stripped}**")
        i += 1
        continue
    if stripped.startswith("Change:") and not in_code_block:
        new_lines.append(f"**{stripped}**")
        i += 1
        continue

    # ============================================================
    # DEFAULT: Keep line as-is
    # ============================================================
    new_lines.append(line)
    i += 1

# If we ended while still in a code block, close it
if in_code_block:
    new_lines.append("```")

# Join and write
result = '\n'.join(new_lines)

# Post-processing: Clean up multiple consecutive blank lines (max 2)
result = re.sub(r'\n{4,}', '\n\n\n', result)

# Post-processing: Fix "* " bullet points that should be "- "
# (keep as-is, markdown supports both)

with open(FILE_PATH, 'w', encoding='utf-8') as f:
    f.write(result)

print(f"Fixed markdown formatting in: {os.path.basename(FILE_PATH)}")
print(f"   Original lines: {len(lines)}")
print(f"   New lines: {len(new_lines)}")
