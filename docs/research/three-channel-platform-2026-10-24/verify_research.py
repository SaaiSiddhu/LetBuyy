"""Offline integrity checks for this research package; no runtime, network or DB actions."""
from pathlib import Path
from urllib.parse import urlsplit, unquote
from decimal import Decimal, ROUND_CEILING
from collections import Counter
import csv, hashlib, json, math, re

FOLDER = Path(__file__).resolve().parent
ROOT = FOLDER.parents[2]
errors = []
def check(condition, message):
    if not condition:
        errors.append(message)
def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()
def read(name):
    return json.loads((FOLDER / name).read_text())
def heading_id(value):
    value = re.sub(r'[`*_]', '', value.lower())
    value = re.sub(r'[^\w\- ]', '', value)
    return value.replace(' ', '-')

sources = read('SOURCE_REGISTER.json')['sources']
requirements = read('REQUIREMENTS.json')['requirements']
source_ids = {s['id'] for s in sources}
requirement_ids = {r['id'] for r in requirements}
check(len(sources) >= 500, 'Fewer than 500 qualifying sources')
check(len(requirements) >= 500, 'Fewer than 500 requirements')
check(len(source_ids) == len(sources), 'Duplicate source IDs')
check(len(requirement_ids) == len(requirements), 'Duplicate requirement IDs')
check(len({s['url'].rstrip('/') for s in sources}) == len(sources), 'Duplicate canonical source URLs')
check(len({s['text_sha256'] for s in sources}) == len(sources), 'Duplicate source content hashes')
check(len({r['requirement'] for r in requirements}) == len(requirements), 'Duplicate requirement wording')
check(len({r['acceptance'] for r in requirements}) == len(requirements), 'Duplicate acceptance wording')
for s in sources:
    check(s['http_status'] == 200, 'Source not successfully retrieved: ' + s['id'])
    check(s['readable_characters'] >= 1000, 'Source below final substantive-text threshold: ' + s['id'])
    check(urlsplit(s['url']).scheme == 'https', 'Non-HTTPS source: ' + s['id'])
    check(s['counted_toward_500'] is True, 'Source count flag mismatch: ' + s['id'])
    check(bool(s['title'].strip()), 'Empty source title: ' + s['id'])
    for rid in s['candidate_related_requirements']:
        check(rid in requirement_ids, 'Broken source-to-requirement relation: ' + s['id'])
for r in requirements:
    check(bool(r['acceptance'].strip()), 'Missing requirement acceptance: ' + r['id'])
    check((FOLDER / r['local_design_volume']).is_file(), 'Missing design volume: ' + r['id'])
    for sid in r['external_context_source_ids']:
        check(sid in source_ids, 'Broken requirement source context: ' + r['id'])

local_links = 0
internal_anchors = 0
tables = 0
diagrams = 0
markdown_words = 0
json_examples = 0
for file in sorted(FOLDER.glob('*.md')):
    text = file.read_text()
    markdown_words += len(text.split())
    for block in re.findall(r'~~~json\n(.*?)\n~~~', text, re.S):
        json_examples += 1
        try:
            json.loads(block)
        except json.JSONDecodeError as exc:
            errors.append('Invalid JSON example: ' + file.name + ': ' + str(exc))
    fences = re.findall(r'^(```|~~~)', text, re.M)
    check(len(fences) % 2 == 0, 'Unpaired code fence: ' + file.name)
    for diagram in re.findall(r'~~~mermaid\n(.*?)\n~~~', text, re.S):
        diagrams += 1
        check(bool(re.match(r'(flowchart|sequenceDiagram|stateDiagram-v2|erDiagram)\b', diagram.strip())), 'Invalid Mermaid declaration: ' + file.name)
    width = None
    for n, line in enumerate(text.splitlines(), 1):
        check(not line.endswith((' ', '\t')), f'Trailing whitespace: {file.name}:{n}')
        if line.startswith('|'):
            safe = re.sub(r'`[^`]*`', 'CODE', line)
            columns = len(re.split(r'(?<!\\)\|', safe)) - 2
            if width is None:
                width = columns
                tables += 1
            else:
                check(columns == width, f'Table width mismatch: {file.name}:{n}')
        else:
            width = None
    for raw in re.findall(r'\]\((<[^>]+>|[^\s]+?)\)', text):
        target = raw.strip('<>')
        if target.startswith(('https://', 'http://')):
            continue
        target, _, anchor = target.partition('#')
        line = None
        match = re.match(r'^(.*):(\d+)$', target)
        if match:
            target, line = match[1], int(match[2])
        path = Path(unquote(target)) if target.startswith('/') else file.parent / unquote(target)
        path = path.resolve()
        if not target:
            path = file
        local_links += 1
        check(path.is_file(), 'Missing local linked file: ' + str(path))
        if not path.is_file():
            continue
        if line:
            check(0 < line <= len(path.read_text().splitlines()), 'Local line out of bounds: ' + str(path) + ':' + str(line))
        if anchor:
            internal_anchors += 1
            headings = {heading_id(h) for h in re.findall(r'^#{1,6} (.+)$', path.read_text(), re.M)}
            check(unquote(anchor).lower() in headings, 'Missing Markdown anchor: ' + str(path) + '#' + anchor)

observations = read('SOURCE_OBSERVATIONS.json')['sources']
for relative, record in observations.items():
    p = ROOT / relative
    check(p.is_file(), 'Observed source disappeared: ' + relative)
    if p.is_file():
        check(sha(p) == record['sha256'], 'Observed source changed: ' + relative)

with (FOLDER / 'FINANCIAL_SCENARIOS.csv').open() as f:
    scenarios = list(csv.DictReader(f))
D = Decimal
for s in scenarios:
    basket = D(s['basket_net'])
    contribution = (basket * D(s['gross_margin_rate']) - D(s['packaging']) - D(s['payment_cost'])
                    - D(s['net_delivery_subsidy']) - D(s['marketing_allocation'])
                    - basket * D(s['spoilage_rate']) - D(s['support_return_allowance'])
                    - basket * D(s['variable_platform_fee_rate']))
    check(contribution == D(s['contribution_per_order']), 'Contribution arithmetic: ' + s['scenario'])
    result = D(s['orders_per_day']) * D(s['operating_days']) * contribution - D(s['fixed_operating_monthly']) - D(s['software_monthly'])
    check(result == D(s['monthly_operating_result']), 'Monthly result arithmetic: ' + s['scenario'])
    if contribution > 0:
        break_even = ((D(s['fixed_operating_monthly']) + D(s['software_monthly'])) / (D(s['operating_days']) * contribution)).to_integral_value(rounding=ROUND_CEILING)
        check(break_even == D(s['break_even_orders_per_day_rounded_up']), 'Break-even arithmetic: ' + s['scenario'])
    else:
        check(s['break_even_orders_per_day_rounded_up'] == 'NO_FINITE_POSITIVE_BREAK_EVEN', 'Negative-contribution break-even incorrectly finite')
    check(s['status'] == 'ILLUSTRATIVE_NOT_APPROVED_RATE', 'Missing financial assumption label')

with (FOLDER / 'IMPLEMENTATION_BACKLOG.csv').open() as f:
    tasks = list(csv.DictReader(f))
ids = {t['id'] for t in tasks}
graph = {t['id']: [x for x in t['dependencies'].split(';') if x] for t in tasks}
for task, dependencies in graph.items():
    check(set(dependencies).issubset(ids), 'Missing dependency: ' + task)
visited, active = set(), set()
def visit(task):
    if task in active:
        errors.append('Dependency cycle: ' + task)
        return
    if task in visited:
        return
    active.add(task)
    for dep in graph[task]:
        if dep in graph:
            visit(dep)
    active.remove(task)
    visited.add(task)
for task in graph:
    visit(task)
low = sum(int(t['focused_days_low']) for t in tasks)
high = sum(int(t['focused_days_high']) for t in tasks)
check((low, high) == (183, 284), 'Roadmap base totals disagree with narrative')
check((math.ceil(low * 1.2), math.ceil(high * 1.2)) == (220, 341), 'Roadmap contingency arithmetic')
check(len([t for t in tasks if t['id'] == 'P7a' and t['focused_days_low'] == '0']) == 1, 'P7a must be a nonadditional budget subset')

receipt_check = read('RETRIEVAL_RECEIPT_VERIFICATION.json')
check(receipt_check['passed'] is True, 'Retrieval receipt verification failed')
check(receipt_check['receipts_checked'] == len(sources), 'Retrieval receipt count mismatch')
check(D('20000') / D('0.80') == D('25000'), 'Illustrative one-time service margin arithmetic')
check(D('516') * D('200') * D('12') == D('1238400'), 'Illustrative inventory working-capital arithmetic')
check(D('72000') + D('3999') - D('3') * D('6000') - D('10000') == D('47999'), 'Illustrative platform contribution arithmetic')

scope = read('RESEARCH_RESUME_SCOPE.json')
check(scope['other_LetBuyy_chats'] == 'REMAIN_PAUSED', 'Resume scope broadened')
check(scope['shared_project_pause_record_modified'] is False, 'Shared project pause record changed by research')
check(len({s['publisher_host'] for s in sources}) >= 20, 'Insufficient publisher breadth')

verification = {
    'kind': 'research_document_integrity_not_runtime_acceptance',
    'date': '2026-10-24',
    'qualifying_distinct_external_primary_sources': len(sources),
    'source_count_unit': 'Distinct substantive retrieved documents/pages, not searches or companies',
    'minimum_readable_source_characters': 1000,
    'publisher_hosts': len({s['publisher_host'] for s in sources}),
    'source_categories': dict(Counter(s['category'] for s in sources)),
    'source_review_depth': dict(Counter(s['review_depth'] for s in sources)),
    'distinct_implementation_requirements': len(requirements),
    'requirements_with_acceptance': sum(bool(r['acceptance']) for r in requirements),
    'requirement_domains': len({r['area'] for r in requirements}),
    'markdown_documents': len(list(FOLDER.glob('*.md'))),
    'markdown_words': markdown_words,
    'markdown_tables': tables,
    'json_examples_parsed': json_examples,
    'local_file_links_checked': local_links,
    'internal_anchor_links_checked': internal_anchors,
    'observed_working_source_hashes_checked': len(observations),
    'financial_scenarios_recalculated': len(scenarios),
    'retrieval_receipts_verified': receipt_check['receipts_checked'],
    'roadmap_focused_days_before_contingency': [low, high],
    'roadmap_focused_days_with_20_percent_contingency': [220, 341],
    'backlog_dependency_graph_acyclic': not any('Dependency cycle' in e for e in errors),
    'mermaid_diagrams_source_checked': diagrams,
    'mermaid_pixel_rendering': 'NOT_VERIFIED_NO_RENDERER_USED',
    'runtime_tests_run': False,
    'database_migrations_applied': False,
    'private_cloud_changes': False,
    'deployments_performed': False,
    'other_chats_resumed': False,
    'document_checks_passed': not errors,
    'errors': errors,
    'artifact_hashes': {p.name: sha(p) for p in sorted(FOLDER.iterdir()) if p.is_file() and p.name != 'VERIFICATION.json'},
}
(FOLDER / 'VERIFICATION.json').write_text(json.dumps(verification, indent=2) + '\n')
print(json.dumps({k: verification[k] for k in ['qualifying_distinct_external_primary_sources', 'distinct_implementation_requirements', 'markdown_documents', 'markdown_words', 'local_file_links_checked', 'internal_anchor_links_checked', 'financial_scenarios_recalculated', 'document_checks_passed', 'errors']}, indent=2))
raise SystemExit(0 if not errors else 1)
