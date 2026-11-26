#!/usr/bin/env python3
"""fitgap.py - deterministic tooling for fit-gap-analysis runs.

  frame     check the frame: both systems load, objectives are valid, layers line up
  packages  split the baseline into scoring packages; write the target index and evidence CSV
  uncited   list target capabilities that no mark cites (input to the target-only pass)
  merge     scored rows + target-only rows + findings  ->  <a>-<b>-fit-gap-analysis.json
  workbook  merged JSON + both models                  ->  <a>-<b>-fit-gap-analysis.xlsx (needs openpyxl)

Inputs are capability-matrix outputs: a <code>-capability-model.json per system, or for older runs the
<code>-capabilities.csv and <code>-requirements.csv pair. The verdict, fit score and priority are computed
here from the requirement marks, never by an agent. Only `workbook` needs a package outside the standard
library.
"""
import argparse, collections, csv, datetime, glob, json, math, os, re, sys

SCORED_MARKS = ['met', 'configured', 'partly', 'unreleased', 'not_met']
DESCOPED = 'descoped'  # the organisation does not need this requirement in the target; excluded from the fit score
MARKS = SCORED_MARKS + [DESCOPED]
VERDICTS = ['native', 'configurable', 'partial', 'unreleased', 'gap', DESCOPED]
CONF = ['high', 'medium', 'low']
EFFORT = ['none', 'low', 'medium', 'high', 'unknown']
WEIGHTS = ['must', 'should', 'could']
MATURITY = ['proven', 'available', 'partial', 'planned', 'deferred']
WHY = ['decision', 'must_objective_gap', 'live_loss', 'open_question']
CITE_REQUIRED = {'met', 'configured', 'partly'}
NOTE_REQUIRED = {'configured', 'partly', 'unreleased', 'not_met', DESCOPED}
TODO_TYPES = ['decision', 'research', 'build', 'configure', 'vendor_question', 'test', 'data']
SCORING = {
    'mark_points': {'met': 100, 'configured': 90, 'partly': 50, 'unreleased': 25, 'not_met': 0},
    'objective_factor': {'must': 1.0, 'should': 0.6, 'could': 0.3, 'none': 0.2},
    'maturity_factor': {'proven': 1.0, 'available': 0.8, 'partial': 0.6, 'planned': 0.4, 'deferred': 0.2},
}
WHOLE = '-WHOLE'  # requirement id suffix for a baseline capability that has no requirements of its own

VERDICT_MEANING = {
    'native': 'Every baseline requirement is met out of the box.',
    'configurable': 'Every requirement is met, some only after configuration. No code.',
    'partial': 'Part of the capability is covered. Something the baseline needs is missing or weaker.',
    'unreleased': 'The target names every requirement, but none is in the release assessed. Wait, do not build.',
    'gap': 'No requirement is met, even in part. Extension, ISV or process change.',
    DESCOPED: 'The organisation does not need any requirement of this capability in the target. Not scored.',
}
MARK_MEANING = {
    'met': 'The target does this out of the box, at comparable depth.',
    'configured': 'The target does this after setup or configuration, with no code.',
    'partly': 'The target does part of this, or does it in a weaker way.',
    'unreleased': 'The target names this, but it is not in the release assessed.',
    'not_met': 'The target sources have no counterpart.',
    DESCOPED: 'The organisation decided it does not need this in the target. No points; left out of the fit score.',
}
TODO_TYPE_MEANING = {
    'decision': 'A business decision the owner must make before the build can be designed.',
    'research': 'Find and compare options (products, APIs, approaches) and recommend one.',
    'build': 'Custom development: code, plug-ins, integrations, templates.',
    'configure': 'Set up the target with no code: fields, forms, views, rules, roles.',
    'vendor_question': 'A question only the vendor can answer.',
    'test': 'Prove a claimed capability in the target environment before relying on it.',
    'data': 'Gather, clean, map or migrate data.',
}
CONF_MEANING = {
    'high': 'The target sources speak directly to the marks that decide the verdict.',
    'medium': 'Some deciding marks rest on inference from nearby documentation.',
    'low': 'The sources are silent or unclear on the deciding marks. A question, not a conclusion.',
}
EFFORT_MEANING = {
    'none': 'Nothing to do.',
    'low': 'Configuration or a small process change. Days.',
    'medium': 'Several configurations, data work or a small extension. Weeks.',
    'high': 'A custom build, an ISV product or a large process change. Months.',
    'unknown': 'The sources do not say enough to tell.',
}
WHY_MEANING = {
    'decision': 'The business uses this today (maturity proven or available), effort is high or unknown, and the verdict is not native.',
    'must_objective_gap': 'It serves a must objective and its fit score is under 50.',
    'live_loss': 'Verdict gap on a capability with maturity proven.',
    'open_question': 'Confidence is low. Put it to the vendor before deciding.',
}


def load(p):
    with open(p, encoding='utf-8') as f:
        return json.load(f)


def dump(o, p):
    os.makedirs(os.path.dirname(os.path.abspath(p)), exist_ok=True)
    with open(p, 'w', encoding='utf-8') as f:
        json.dump(o, f, indent=1, ensure_ascii=False)


def globs(pats):
    return sorted({f for p in pats or [] for f in (glob.glob(p) or ([p] if os.path.exists(p) else []))})


def split_list(v):
    if isinstance(v, list):
        return v
    return [x.strip() for x in (v or '').split('|') if x.strip()]


def J(v):
    return ' | '.join(v) if v else ''


# Owner names come from the frame (the agent takes them from the project config, .os/config/instance.yaml
# owners[].name). Owner colors come from the frame's optional owner_colors, else from the skill-local palette
# in config/owner-colors.json, in owner order. This file holds no owner name and no owner color.
OWNER_COLORS_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'config', 'owner-colors.json')
HEX_COLOR = re.compile(r'[0-9A-Fa-f]{6}')


def color_pair(v):
    """A {"fill": "RRGGBB", "font": "RRGGBB"} mapping as a (fill, font) pair, or None when it is not one."""
    if isinstance(v, dict) and all(isinstance(v.get(k), str) and HEX_COLOR.fullmatch(v[k]) for k in ('fill', 'font')):
        return v['fill'].upper(), v['font'].upper()
    return None


def owner_color_problems(fr):
    E = []
    given = fr.get('owner_colors')
    if given is None:
        return E
    if not isinstance(given, dict):
        return ['owner_colors must map each owner to {"fill": "RRGGBB", "font": "RRGGBB"}']
    owners = list(fr.get('owners') or [])
    for o, v in given.items():
        if o not in owners:
            E.append(f"owner_colors: '{o}' is not in the frame owners")
        if color_pair(v) is None:
            E.append(f'owner_colors.{o} must be {{"fill": "RRGGBB", "font": "RRGGBB"}}')
    return E


def owner_colors(fr):
    """{owner: (fill, font)} for the frame owners. An owner with no color is left out and shows plain."""
    owners = list(fr.get('owners') or [])
    given = fr.get('owner_colors') if isinstance(fr.get('owner_colors'), dict) else {}
    try:
        palette = [p for p in (color_pair(x) for x in load(OWNER_COLORS_FILE).get('palette') or []) if p]
    except (OSError, ValueError, AttributeError):
        palette = []
    out = {}
    for i, o in enumerate(owners):
        pair = color_pair(given.get(o)) or (palette[i % len(palette)] if palette else None)
        if pair:
            out[o] = pair
    return out


def die(msg):
    sys.exit(f'fitgap: {msg}')


def fail_on(errors, what):
    if not errors:
        return
    print(f'{what}: {len(errors)} problem(s)')
    for e in errors[:60]:
        print('  FAIL  ' + e)
    if len(errors) > 60:
        print(f'  … and {len(errors) - 60} more')
    sys.exit(1)


# ------------------------------------------------------------------------------------------------- loading
def read_frame(path):
    fr = load(path)
    fr['_base'] = os.path.dirname(os.path.abspath(path))
    sc = {k: dict(v) for k, v in SCORING.items()}
    for k, v in (fr.get('scoring') or {}).items():
        if k not in sc:
            die(f"frame scoring: unknown key '{k}' (allowed: {', '.join(sc)})")
        sc[k].update(v)
    fr['_scoring'] = sc
    return fr


def resolve(fr, p):
    return p if os.path.isabs(p) else os.path.normpath(os.path.join(fr['_base'], p))


def read_csv(p):
    with open(p, encoding='utf-8-sig', newline='') as f:
        return list(csv.DictReader(f))


def layer_sort(l):
    m = re.fullmatch(r'L(\d+)', l['id'])
    return int(m.group(1)) if m else 999


def load_system(fr, role):
    spec = fr.get(role) or die(f"frame has no '{role}' entry")
    if spec.get('model'):
        path = resolve(fr, spec['model'])
        m = load(path)
        meta = m.get('meta', {})
        code = spec.get('code') or meta.get('code') or die(f'{role}: model meta has no code')
        name = spec.get('name') or meta.get('name') or meta.get('title') or code
        layers = [{'id': l['id'], 'code': l['code'], 'name': l['name']} for l in m['layers']]
        caps = []
        for c in m['capabilities']:
            caps.append({'id': c['id'], 'parent_id': c.get('parent_id'), 'name': c['name'], 'layer_id': c['layer_id'],
                         'doc_ref': c.get('doc_ref'), 'type': c.get('type'), 'status': c.get('status'),
                         'maturity': c.get('maturity'), 'summary': c.get('summary') or '',
                         'requirements': [{'id': r['id'], 'kind': r.get('kind'), 'status': r.get('status'),
                                           'maturity': r.get('maturity'), 'text': r.get('text') or '',
                                           'option_values': r.get('option_values')} for r in c.get('requirements', [])]})
        source = os.path.basename(spec['model'])
    else:
        for k in ('capabilities_csv', 'requirements_csv', 'code', 'name'):
            if not spec.get(k):
                die(f"{role}: give 'model', or all of capabilities_csv, requirements_csv, code, name")
        code, name, mm = spec['code'], spec['name'], spec.get('maturity_map') or {}
        crow, rrow = read_csv(resolve(fr, spec['capabilities_csv'])), read_csv(resolve(fr, spec['requirements_csv']))

        def mat(row, rid):
            v = (row.get('maturity') or '').strip() or mm.get(row.get('status'))
            if v not in MATURITY:
                die(f"{role} {rid}: status '{row.get('status')}' has no maturity. Add it to {role}.maturity_map in the frame.")
            return v

        lay = {}
        for r in crow:
            lay.setdefault(r['layer_id'], {'id': r['layer_id'], 'code': r['layer_code'], 'name': r['layer_name']})
        layers = sorted(lay.values(), key=layer_sort)
        reqs = collections.defaultdict(list)
        for r in rrow:
            reqs[r['capability_id']].append({'id': r['requirement_id'], 'kind': r.get('requirement_kind'),
                                             'status': r.get('status'), 'maturity': mat(r, r['requirement_id']),
                                             'text': r.get('text') or '', 'option_values': r.get('option_values') or None})
        caps = [{'id': r['capability_id'], 'parent_id': r.get('parent_id') or None, 'name': r['name'],
                 'layer_id': r['layer_id'], 'doc_ref': r.get('doc_ref'), 'type': r.get('capability_type'),
                 'status': r['status'], 'maturity': mat(r, r['capability_id']), 'summary': r.get('summary') or '',
                 'requirements': reqs.get(r['capability_id'], [])} for r in crow]
        source = os.path.basename(spec['capabilities_csv'])
    LM = {l['id']: l for l in layers}
    for c in caps:
        if c['layer_id'] not in LM:
            die(f"{role} {c['id']}: layer '{c['layer_id']}' is not in the layer list")
        if c['maturity'] not in MATURITY:
            die(f"{role} {c['id']}: maturity '{c['maturity']}' is not one of {', '.join(MATURITY)}")
        c['layer_code'], c['layer_name'] = LM[c['layer_id']]['code'], LM[c['layer_id']]['name']
        if role == 'baseline' and not c['requirements']:
            c['requirements'] = [{'id': c['id'] + WHOLE, 'kind': 'capability', 'status': c['status'],
                                  'maturity': c['maturity'], 'option_values': None,
                                  'text': '(No requirements of its own. Mark the capability as a whole.) ' + c['summary']}]
    S = {'code': code, 'name': name, 'source': source, 'layers': layers, 'caps': caps,
         'cap': {c['id']: c for c in caps}}
    if len(S['cap']) != len(caps):
        die(f'{role}: duplicate capability ids')
    return S


def load_prior(fr, B, T):
    p = fr.get('prior_fit_gap')
    if not p:
        return {}
    p = resolve(fr, p)
    if p.endswith('.json'):
        d = load(p)
        rows = d.get('baseline_to_target', d) if isinstance(d, dict) else d
    else:
        rows = read_csv(p)
    bk = ['baseline_capability_id', B['code'].lower() + '_capability_id']
    tk = ['target_capability_ids', T['code'].lower() + '_capability_ids']
    out = {}
    for r in rows:
        bid = next((r[k] for k in bk if r.get(k)), None)
        if bid in B['cap']:
            out[bid] = {'verdict': r.get('verdict'), 'evidence': r.get('evidence'), 'gap_detail': r.get('gap_detail'),
                        'target_capability_ids': split_list(next((r[k] for k in tk if r.get(k)), ''))}
    return out


def load_rows(pats, what):
    rows = []
    for f in globs(pats):
        d = load(f)
        if not isinstance(d, list):
            die(f'{f}: {what} file must hold a JSON array')
        for x in d:
            if isinstance(x, dict):
                x['_file'] = os.path.basename(f)
        rows.extend(d)
    return rows


# ------------------------------------------------------------------------------------------------- frame
def cmd_frame(a):
    fr = read_frame(a.frame)
    B, T = load_system(fr, 'baseline'), load_system(fr, 'target')
    E, W, sc = [], [], fr['_scoring']
    if B['code'] == T['code']:
        E.append('baseline and target have the same code')
    if fr.get('mode', 'replacement') not in ('replacement', 'selection'):
        E.append("mode must be 'replacement' or 'selection'")
    objs = fr.get('objectives') or []
    if not objs:
        W.append('no objectives yet. Draft them and get the person to confirm them before packages.')
    for k, n in collections.Counter(o.get('id') for o in objs).items():
        if n > 1:
            E.append(f'objective id {k} is used {n} times')
    for o in objs:
        oid = o.get('id') or '?'
        if not re.fullmatch(r'OBJ-\d{2,3}', oid):
            E.append(f"objective id '{oid}' must look like OBJ-01")
        if o.get('weight') not in WEIGHTS:
            E.append(f"{oid}: weight '{o.get('weight')}' must be one of {', '.join(WEIGHTS)}")
        for k in ('name', 'statement'):
            if not (o.get(k) or '').strip():
                E.append(f'{oid}: {k} is empty')
        if not (o.get('measure') or '').strip():
            W.append(f'{oid}: no measure of success')
        if o.get('rank') is not None and not isinstance(o.get('rank'), (int, float)):
            E.append(f"{oid}: rank must be a number (1 = most important)")
    for t in fr.get('tracks') or []:
        if not (t.get('id') and t.get('name') and isinstance(t.get('order'), (int, float))):
            E.append(f"track {t.get('id') or '?'}: needs id, name and a numeric order")
    for k, n in collections.Counter(t.get('id') for t in fr.get('tracks') or []).items():
        if n > 1:
            E.append(f'track id {k} is used {n} times')
    if fr.get('tracks') and not fr.get('owners'):
        E.append('the frame has tracks but no owners list')
    E += owner_color_problems(fr)
    for k in SCORED_MARKS:
        if not 0 <= sc['mark_points'].get(k, -1) <= 100:
            E.append(f'scoring.mark_points.{k} must be 0 to 100')
    for k in WEIGHTS + ['none']:
        if not 0 <= sc['objective_factor'].get(k, -1) <= 1:
            E.append(f'scoring.objective_factor.{k} must be 0 to 1')
    for k in MATURITY:
        if not 0 <= sc['maturity_factor'].get(k, -1) <= 1:
            E.append(f'scoring.maturity_factor.{k} must be 0 to 1')
    if not fr.get('objectives_confirmed_by'):
        W.append('objectives_confirmed_by is empty. The person has not confirmed the objectives and weights yet. '
                 'merge refuses a final build until they do.')
    bl, tl = {l['code'] for l in B['layers']}, {l['code'] for l in T['layers']}
    if bl != tl:
        W.append(f'layer codes differ. Baseline only: {sorted(bl - tl) or "-"}. Target only: {sorted(tl - bl) or "-"}. '
                 'Layer views follow the baseline.')
    if fr.get('prior_fit_gap'):
        print(f"prior fit-gap: {len(load_prior(fr, B, T))} baseline rows found")
    for role, S in (('baseline', B), ('target', T)):
        n = sum(len(c['requirements']) for c in S['caps'])
        whole = sum(1 for c in S['caps'] for r in c['requirements'] if r['id'].endswith(WHOLE))
        print(f"{role:8} {S['code']:5} {S['name']}: {len(S['layers'])} layers, {len(S['caps'])} capabilities, "
              f"{n} requirements" + (f' ({whole} whole-capability marks)' if whole else ''))
    print(f"objectives: {len(objs)} ({dict(collections.Counter(o.get('weight') for o in objs))}), "
          f"confirmed by: {fr.get('objectives_confirmed_by') or '-'}")
    if fr.get('tracks'):
        print(f"tracks: {len(fr['tracks'])}; owners: {', '.join(fr.get('owners') or [])}")
    for w in W:
        print('  WARN  ' + w)
    fail_on(E, 'frame')
    print('  frame OK')


# ------------------------------------------------------------------------------------------------- packages
def cmd_packages(a):
    fr = read_frame(a.frame)
    if not fr.get('objectives'):
        die('the frame has no objectives. Draft them, get the person to confirm them, then run packages.')
    B, T = load_system(fr, 'baseline'), load_system(fr, 'target')
    prior = load_prior(fr, B, T)
    groups, cur, n = [], [], 0
    for c in B['caps']:
        k = len(c['requirements'])
        if cur and n + k > a.max_requirements:
            groups.append(cur)
            cur, n = [], 0
        cur.append(c)
        n += k
    if cur:
        groups.append(cur)
    pdir = os.path.join(a.out, 'packages')
    os.makedirs(pdir, exist_ok=True)
    for f in glob.glob(os.path.join(pdir, 'pkg-*.json')):
        os.remove(f)
    for i, caps in enumerate(groups, 1):
        items = [{'id': c['id'], 'name': c['name'], 'layer_code': c['layer_code'], 'layer_name': c['layer_name'],
                  'type': c['type'], 'status': c['status'], 'maturity': c['maturity'], 'summary': c['summary'],
                  'requirements': [{'id': r['id'], 'kind': r['kind'], 'status': r['status'], 'text': r['text'],
                                    'option_values': r['option_values']} for r in c['requirements']],
                  **({'prior': prior[c['id']]} if c['id'] in prior else {})} for c in caps]
        dump(items, os.path.join(pdir, f'pkg-{i:02d}.json'))
        lays = list(dict.fromkeys(c['layer_code'] for c in caps))
        print(f"  pkg-{i:02d}: {len(caps):3} capabilities, {sum(len(c['requirements']) for c in caps):4} requirements, "
              f"layers {', '.join(lays)}")
    dump([{'id': c['id'], 'name': c['name'], 'layer_code': c['layer_code'], 'status': c['status'],
           'maturity': c['maturity'], 'summary': c['summary'], 'requirement_count': len(c['requirements'])}
          for c in T['caps']], os.path.join(a.out, 'target-index.json'))
    with open(os.path.join(a.out, 'target-requirements.csv'), 'w', newline='', encoding='utf-8-sig') as f:
        w = csv.writer(f)
        w.writerow(['requirement_id', 'capability_id', 'capability_name', 'layer_code', 'kind', 'status', 'text', 'option_values'])
        for c in T['caps']:
            for r in c['requirements']:
                w.writerow([r['id'], c['id'], c['name'], c['layer_code'], r['kind'], r['status'], r['text'], r['option_values'] or ''])
    with open(os.path.join(a.out, 'objectives.md'), 'w', encoding='utf-8') as f:
        f.write('| id | weight | name | statement | measure |\n| --- | --- | --- | --- | --- |\n')
        for o in fr.get('objectives') or []:
            f.write(f"| {o['id']} | {o['weight']} | {o['name']} | {o['statement']} | {o.get('measure') or ''} |\n")
    print(f"packages[{B['code']}->{T['code']}]: {len(groups)} packages, prior rows {len(prior)} -> {a.out}")
    print(f"  also wrote target-index.json ({len(T['caps'])} capabilities), target-requirements.csv, objectives.md")


# ------------------------------------------------------------------------------------------------- uncited
def cited_targets(rows):
    return {t for r in rows for m in r.get('marks') or [] for t in m.get('target_capability_ids') or []}


def cmd_uncited(a):
    fr = read_frame(a.frame)
    T = load_system(fr, 'target')
    cited = cited_targets(load_rows(a.rows, 'scored rows'))
    un = [c for c in T['caps'] if c['id'] not in cited]
    for c in un:
        print(f"  {c['id']:14} {c['layer_code']:5} {c['status']:18} {c['name']}")
    print(f'uncited: {len(un)} of {len(T["caps"])} target capabilities have no mark citing them')
    if a.out:
        dump([{'id': c['id'], 'name': c['name'], 'layer_code': c['layer_code'], 'status': c['status'],
               'summary': c['summary']} for c in un], a.out)


# ------------------------------------------------------------------------------------------------- merge
def derive_verdict(marks):
    s = {m['mark'] for m in marks} - {DESCOPED}
    if not s:
        return DESCOPED
    if s == {'met'}:
        return 'native'
    if s <= {'met', 'configured'}:
        return 'configurable'
    if s == {'unreleased'}:
        return 'unreleased'
    if s <= {'not_met', 'unreleased'}:
        return 'gap'
    return 'partial'


def cmd_merge(a):
    fr = read_frame(a.frame)
    sc = fr['_scoring']
    B, T = load_system(fr, 'baseline'), load_system(fr, 'target')
    objs = {o['id']: o for o in fr.get('objectives') or []}
    tracks = {t['id']: t for t in fr.get('tracks') or []}
    owners = list(fr.get('owners') or [])
    E = []
    seen = {}
    for r in load_rows(a.rows, 'scored rows'):
        bid = r.get('baseline_capability_id')
        if bid not in B['cap']:
            E.append(f"'{bid}': not a baseline capability id")
            continue
        if bid in seen:
            E.append(f'{bid}: scored more than once')
            continue
        seen[bid] = r
        c = B['cap'][bid]
        if r.get('confidence') not in CONF:
            E.append(f"{bid}: confidence '{r.get('confidence')}' must be one of {', '.join(CONF)}")
        if r.get('effort') not in EFFORT:
            E.append(f"{bid}: effort '{r.get('effort')}' must be one of {', '.join(EFFORT)}")
        r['objective_ids'] = split_list(r.get('objective_ids'))
        for o in r['objective_ids']:
            if o not in objs:
                E.append(f'{bid}: objective {o} is not in the frame')
        r['owners'] = split_list(r.get('owners'))
        if tracks:
            if r.get('track') not in tracks:
                E.append(f"{bid}: track '{r.get('track')}' is not a frame track ({', '.join(tracks)})")
            if not r['owners']:
                E.append(f'{bid}: owners is empty (the first owner leads)')
            for o in r['owners']:
                if o not in owners:
                    E.append(f"{bid}: owner '{o}' is not in the frame owners ({', '.join(owners)})")
        want = [q['id'] for q in c['requirements']]
        marks = r.get('marks') or []
        got = [m.get('requirement_id') for m in marks]
        missing, extra = [x for x in want if x not in got], [x for x in got if x not in want]
        dup = [x for x, k in collections.Counter(got).items() if k > 1]
        if missing:
            E.append(f"{bid}: no mark for {', '.join(missing[:6])}" + (f' and {len(missing) - 6} more' if len(missing) > 6 else ''))
        if extra:
            E.append(f"{bid}: marks for requirements it does not have: {', '.join(map(str, extra[:6]))}")
        if dup:
            E.append(f"{bid}: requirements marked twice: {', '.join(dup[:6])}")
        for m in marks:
            mk, rid = m.get('mark'), m.get('requirement_id')
            if mk not in MARKS:
                E.append(f"{rid}: mark '{mk}' must be one of {', '.join(MARKS)}")
                continue
            m['target_capability_ids'] = split_list(m.get('target_capability_ids'))
            for t in m['target_capability_ids']:
                if t not in T['cap']:
                    E.append(f"{rid}: cites '{t}', which is not a target capability id")
            if mk in CITE_REQUIRED and not m['target_capability_ids']:
                E.append(f'{rid}: a {mk} mark must cite at least one target capability')
            if mk == 'not_met' and m['target_capability_ids']:
                E.append(f'{rid}: a not_met mark cites no target capabilities')
            if mk == DESCOPED and m['target_capability_ids']:
                E.append(f'{rid}: a descoped mark cites no target capabilities')
            if mk in NOTE_REQUIRED and len((m.get('note') or '').strip()) < 15:
                E.append(f'{rid}: a {mk} mark needs a note (what is configured, missing, coming, or where you looked)')
        if len((r.get('evidence') or '').strip()) < 80:
            E.append(f'{bid}: evidence is missing or under 80 characters')
        if not (r.get('migration_note') or '').strip():
            E.append(f'{bid}: migration_note is empty')
    E += [f"{c['id']}: not scored" for c in B['caps'] if c['id'] not in seen]
    fail_on(E, 'merge (scored rows)')

    rows = []
    for c in B['caps']:
        r = seen[c['id']]
        order = {q['id']: i for i, q in enumerate(c['requirements'])}
        marks = sorted(r['marks'], key=lambda m: order[m['requirement_id']])
        v = derive_verdict(marks)
        scored = [m for m in marks if m['mark'] != DESCOPED]
        fit = round(sum(sc['mark_points'][m['mark']] for m in scored) / len(scored)) if scored else None
        ws = [objs[o]['weight'] for o in r['objective_ids']]
        of = max([sc['objective_factor'][w] for w in ws] or [sc['objective_factor']['none']])
        pr = 0 if fit is None else round((100 - fit) * of * sc['maturity_factor'][c['maturity']])
        tids = list(dict.fromkeys(t for m in marks for t in m['target_capability_ids']))
        why = []
        if c['maturity'] in ('proven', 'available') and r['effort'] in ('high', 'unknown') and v not in ('native', DESCOPED):
            why.append('decision')
        if 'must' in ws and fit is not None and fit < 50:
            why.append('must_objective_gap')
        if v == 'gap' and c['maturity'] == 'proven':
            why.append('live_loss')
        if r['confidence'] == 'low' and v != DESCOPED:
            why.append('open_question')
        if v not in ('native', DESCOPED) and not (r.get('gap_detail') or '').strip():
            E.append(f'{c["id"]}: verdict {v} needs gap_detail (what is missing, in baseline terms)')
        ranks = [objs[o]['rank'] for o in r['objective_ids'] if isinstance(objs[o].get('rank'), (int, float))]
        tr = tracks.get(r.get('track')) or {}
        rows.append({'baseline_capability_id': c['id'], 'baseline_name': c['name'], 'layer_id': c['layer_id'],
                     'layer_code': c['layer_code'], 'baseline_status': c['status'], 'baseline_maturity': c['maturity'],
                     'requirement_count': len(marks), 'verdict': v, 'fit_score': fit, 'priority': pr,
                     'objective_rank': min(ranks) if ranks else None,
                     'track': r.get('track'), 'track_name': tr.get('name'), 'track_order': tr.get('order'),
                     'owners': r['owners'],
                     'confidence': r['confidence'], 'effort': r['effort'], 'objective_ids': r['objective_ids'],
                     'mark_counts': {k: sum(m['mark'] == k for m in marks) for k in MARKS},
                     'target_capability_ids': tids, 'target_capability_names': [T['cap'][t]['name'] for t in tids],
                     'target_statuses': sorted({T['cap'][t]['status'] for t in tids}),
                     'evidence': r['evidence'].strip(), 'gap_detail': (r.get('gap_detail') or '').strip(),
                     'migration_note': r['migration_note'].strip(), 'why_listed': why,
                     'marks': [{'requirement_id': m['requirement_id'], 'mark': m['mark'],
                                'target_capability_ids': m['target_capability_ids'],
                                'note': (m.get('note') or '').strip()} for m in marks]})

    cited = {t for r in rows for t in r['target_capability_ids']}
    expected = [c['id'] for c in T['caps'] if c['id'] not in cited]
    only = {}
    for r in load_rows(a.only, 'target-only rows'):
        tid = r.get('target_capability_id')
        if tid not in T['cap']:
            E.append(f"target-only '{tid}': not a target capability id")
            continue
        if tid in only:
            E.append(f'target-only {tid}: listed twice')
            continue
        only[tid] = r
        r['objective_ids'] = split_list(r.get('objective_ids'))
        for o in r['objective_ids']:
            if o not in objs:
                E.append(f'target-only {tid}: objective {o} is not in the frame')
        if r.get('confidence') not in CONF:
            E.append(f"target-only {tid}: confidence '{r.get('confidence')}' must be one of {', '.join(CONF)}")
        if r.get('effort') not in EFFORT:
            E.append(f"target-only {tid}: effort '{r.get('effort')}' must be one of {', '.join(EFFORT)}")
        if len((r.get('evidence') or '').strip()) < 60:
            E.append(f'target-only {tid}: evidence is missing or under 60 characters')
        if not (r.get('opportunity') or '').strip():
            E.append(f'target-only {tid}: opportunity is empty')
    miss, extra = [t for t in expected if t not in only], [t for t in only if t not in expected and t in T['cap']]
    if a.draft and not a.only:
        print(f'  note: target-only pass not done yet ({len(expected)} uncited target capabilities)')
    elif miss:
        E.append(f"target-only pass: no row for {len(miss)} uncited target capabilities: {', '.join(miss[:8])}"
                 + (' …' if len(miss) > 8 else '') + '. Run uncited to list them.')
    if extra:
        E.append(f"target-only rows for capabilities that marks already cite: {', '.join(extra[:8])}")

    F = load(a.findings) if a.findings else None
    if F is None and not a.draft:
        E.append('no findings file. Pass --findings, or --draft for a working build')
    if F is not None:
        h = [x for x in F.get('headline') or [] if str(x).strip()]
        if not 3 <= len(h) <= 7:
            E.append(f'findings.headline needs 3 to 7 entries (has {len(h)})')
        have = {x.get('layer_code') for x in F.get('layers') or [] if (x.get('text') or '').strip()}
        need = list(dict.fromkeys(c['layer_code'] for c in B['caps']))
        lack = [x for x in need if x not in have]
        if lack:
            E.append(f"findings.layers has no text for baseline layers: {', '.join(lack)}")
        for k in ('opportunities', 'open_questions'):
            if not isinstance(F.get(k, []), list):
                E.append(f'findings.{k} must be a list of strings')
    if not a.draft and not fr.get('objectives_confirmed_by'):
        E.append('objectives_confirmed_by is empty in the frame. The person must confirm the objectives and weights '
                 'before the final build (use --draft until then)')

    R0 = {r['baseline_capability_id']: r for r in rows}
    todos = load_rows(a.todos, 'to-do rows') if getattr(a, 'todos', None) else []
    if tracks and not todos and not a.draft:
        E.append('the frame has tracks and owners but no to-do list. Pass --todos, or --draft for a working build')
    tids_seen = collections.Counter(t.get('id') for t in todos)
    for k, n in tids_seen.items():
        if n > 1:
            E.append(f'to-do id {k} is used {n} times')
    for t in todos:
        tid = t.get('id') or '?'
        if not re.fullmatch(r'TD-\d{2,3}', tid):
            E.append(f"to-do id '{tid}' must look like TD-01")
        if not (t.get('title') or '').strip():
            E.append(f'{tid}: title is empty')
        if len((t.get('detail') or '').strip()) < 30:
            E.append(f'{tid}: detail is missing or under 30 characters')
        if t.get('owner') not in owners:
            E.append(f"{tid}: owner '{t.get('owner')}' is not in the frame owners")
        t['support'] = split_list(t.get('support'))
        for o in t['support']:
            if o not in owners:
                E.append(f"{tid}: support '{o}' is not in the frame owners")
        if t.get('track') not in tracks:
            E.append(f"{tid}: track '{t.get('track')}' is not a frame track")
        if t.get('type') not in TODO_TYPES:
            E.append(f"{tid}: type '{t.get('type')}' must be one of {', '.join(TODO_TYPES)}")
        for k_, ok in (('capability_ids', lambda x: x in B['cap']), ('objective_ids', lambda x: x in objs),
                       ('depends_on', lambda x: x in tids_seen)):
            t[k_] = split_list(t.get(k_))
            for x in t[k_]:
                if not ok(x):
                    E.append(f'{tid}: {k_} has unknown id {x}')
    fail_on(E, 'merge')

    def rank_of(r):
        return r['objective_rank'] if r['objective_rank'] is not None else 99

    def avg(xs):
        xs = [x for x in xs if x is not None]
        return round(sum(xs) / len(xs)) if xs else None

    olist = []
    for o in fr.get('objectives') or []:
        linked = [r for r in rows if o['id'] in r['objective_ids']]
        top = sorted((r for r in linked if r['verdict'] not in ('native', DESCOPED)), key=lambda r: -r['priority'])[:5]
        olist.append({**{k: o.get(k) for k in ('id', 'name', 'weight', 'rank', 'statement', 'measure', 'source')},
                      'linked_capabilities': len(linked),
                      'average_fit': avg(r['fit_score'] for r in linked),
                      'verdicts': {v: sum(r['verdict'] == v for r in linked) for v in VERDICTS},
                      'top_gaps': [r['baseline_capability_id'] for r in top],
                      'target_only': [t for t, x in only.items() if o['id'] in x['objective_ids']]})
    tlist = []
    for t in todos:
        linked = [R0[c] for c in t['capability_ids']]
        tr = tracks[t['track']]
        tlist.append({'id': t['id'], 'title': t['title'].strip(), 'owner': t['owner'], 'support': t['support'],
                      'track': t['track'], 'track_name': tr['name'], 'track_order': tr['order'],
                      'sequence': t.get('sequence'), 'type': t['type'], 'detail': t['detail'].strip(),
                      'capability_ids': t['capability_ids'], 'objective_ids': t['objective_ids'],
                      'depends_on': t['depends_on'], 'max_priority': max([r['priority'] for r in linked] or [None], key=lambda x: x or 0)})
    tlist.sort(key=lambda t: (t['track_order'], t['sequence'] if t['sequence'] is not None else 999, t['id']))
    for r in rows:
        r['todo_ids'] = [t['id'] for t in tlist if r['baseline_capability_id'] in t['capability_ids']]
    tonly = [{'target_capability_id': t, 'target_name': T['cap'][t]['name'], 'layer_code': T['cap'][t]['layer_code'],
              'target_status': T['cap'][t]['status'], 'target_maturity': T['cap'][t]['maturity'],
              'requirement_count': len(T['cap'][t]['requirements']), 'objective_ids': only[t]['objective_ids'],
              'confidence': only[t]['confidence'], 'effort': only[t]['effort'],
              'evidence': only[t]['evidence'].strip(), 'opportunity': only[t]['opportunity'].strip()}
             for t in expected if t in only]
    allm = [m for r in rows for m in r['marks']]
    meta = {'schema': 'fit-gap-analysis/1', 'title': fr.get('title') or f"{B['name']} to {T['name']}",
            'mode': fr.get('mode', 'replacement'), 'generated': a.date, 'draft': bool(a.draft),
            'objectives_confirmed_by': fr.get('objectives_confirmed_by') or '',
            'baseline': {'code': B['code'], 'name': B['name'], 'source': B['source'], 'capabilities': len(B['caps']),
                         'requirements': len(allm)},
            'target': {'code': T['code'], 'name': T['name'], 'source': T['source'], 'capabilities': len(T['caps']),
                       'requirements': sum(len(c['requirements']) for c in T['caps'])},
            'scoring': sc,
            'tracks': sorted(tracks.values(), key=lambda t: t['order']), 'owners': owners,
            'owner_roles': fr.get('owner_roles') or {},
            'counts': {'verdicts': {v: sum(r['verdict'] == v for r in rows) for v in VERDICTS},
                       'marks': {k: sum(m['mark'] == k for m in allm) for k in MARKS},
                       'average_fit': avg(r['fit_score'] for r in rows),
                       'why_listed': {k: sum(k in r['why_listed'] for r in rows) for k in WHY},
                       'target_only': len(tonly),
                       'todos': len(tlist),
                       'todos_by_owner': {o: sum(t['owner'] == o for t in tlist) for o in owners}}}
    out = os.path.join(a.out, f"{B['code'].lower()}-{T['code'].lower()}-fit-gap-analysis.json")
    dump({'meta': meta, 'objectives': olist, 'rows': rows, 'target_only': tonly, 'todos': tlist,
          'findings': F or {'headline': [], 'layers': [], 'opportunities': [], 'open_questions': []}}, out)
    c = meta['counts']
    print(f"merge[{B['code']}->{T['code']}]{' DRAFT' if a.draft else ''}: {len(rows)} rows, {len(allm)} marks, "
          f"{len(tonly)} target-only, {len(tlist)} to-dos -> {out}")
    print(f"  verdicts {c['verdicts']}")
    print(f"  marks    {c['marks']}")
    print(f"  average fit {c['average_fit']}, listed {c['why_listed']}, to-dos by owner {c['todos_by_owner']}")
    by_file = collections.defaultdict(list)
    for r in rows:
        by_file[seen[r['baseline_capability_id']]['_file']].append(r['fit_score'])
    print('  average fit by file (check outliers for grader drift): '
          + ', '.join(f'{f} {avg(v)}' for f, v in sorted(by_file.items())))
    for r in sorted(rows, key=lambda r: (-r['priority'], rank_of(r)))[:5]:
        print(f"  top: {r['priority']:3}  {r['baseline_capability_id']:12} {r['verdict']:12} fit {r['fit_score']}  {r['baseline_name']}")


# ------------------------------------------------------------------------------------------------- workbook
VERDICT_COLORS = {'native': ('C6EFCE', '006100'), 'configurable': ('E2F0D9', '375623'), 'partial': ('FFEB9C', '9C5700'),
                  'unreleased': ('DDEBF7', '1F4E78'), 'gap': ('FFC7CE', '9C0006'), DESCOPED: ('EDEDED', '595959')}
MARK_COLORS = {'met': ('C6EFCE', '006100'), 'configured': ('E2F0D9', '375623'), 'partly': ('FFEB9C', '9C5700'),
               'unreleased': ('DDEBF7', '1F4E78'), 'not_met': ('FFC7CE', '9C0006'), DESCOPED: ('EDEDED', '595959')}
MAX_LINES = 8


def cmd_workbook(a):
    try:
        from openpyxl import Workbook, load_workbook
        from openpyxl.cell.cell import ILLEGAL_CHARACTERS_RE
        from openpyxl.formatting.rule import CellIsRule, ColorScaleRule, DataBarRule
        from openpyxl.styles import Alignment, Font, PatternFill
        from openpyxl.utils import get_column_letter as L
        from openpyxl.worksheet.hyperlink import Hyperlink
        from openpyxl.worksheet.table import Table, TableStyleInfo
    except ImportError:
        die('workbook needs openpyxl. Run it as: uv run --with openpyxl python <skill>/scripts/fitgap.py workbook … '
            '(or install it first: python3 -m pip install openpyxl)')
    fr = read_frame(a.frame)
    B, T = load_system(fr, 'baseline'), load_system(fr, 'target')
    G = load(a.fitgap)
    M, rows, tonly, F = G['meta'], G['rows'], G['target_only'], G['findings']
    todos = G.get('todos') or []
    TRK = M.get('tracks') or []
    OWN = M.get('owners') or []
    has_plan = bool(TRK)
    if M['baseline']['code'] != B['code'] or M['baseline']['capabilities'] != len(B['caps']) \
            or M['target']['capabilities'] != len(T['caps']):
        die('the fit-gap JSON was merged from different models than the frame names now. Run merge again.')
    bc, tc = B['code'], T['code']
    out = a.out or os.path.splitext(a.fitgap)[0] + '.xlsx'
    S_FG, S_RM, S_DEC, S_TO, S_FIND, S_OBJ = 'Fit-Gap', 'Requirement Marks', 'Decisions', 'Target Only', 'Findings', 'Objectives'
    S_MAP, S_TD = 'Roadmap', 'To-Dos'
    S_BC, S_TC, S_TR = f'{bc} Capabilities', f'{tc} Capabilities', f'{tc} Requirements'

    TOP, WRAP = Alignment(vertical='top'), Alignment(vertical='top', wrap_text=True)
    HEAD = Alignment(vertical='center', wrap_text=True)
    LINK = Font(color='0563C1', underline='single')
    H1, H2 = Font(bold=True, size=16), Font(bold=True, size=12, color='FFFFFF')
    SECTION = PatternFill(start_color='1F4E78', end_color='1F4E78', fill_type='solid')
    THEAD = PatternFill(start_color='D9E1F2', end_color='D9E1F2', fill_type='solid')

    def fill(h):
        return PatternFill(start_color=h, end_color=h, fill_type='solid')

    def clean(v):
        if isinstance(v, (list, tuple)):
            v = J([str(x) for x in v])
        if isinstance(v, str):
            v = ILLEGAL_CHARACTERS_RE.sub('', v)
            v = v if len(v) <= 32000 else v[:32000] + ' …'
            return v or None
        return v

    def put(ws, r, c, v):
        cell = ws.cell(row=r, column=c)
        v = clean(v)
        cell.value = v
        if isinstance(v, str) and v.startswith('='):
            cell.data_type = 's'
        return cell

    def lines(text, width):
        cpl = max(8, int(width * 1.2))
        return sum(max(1, math.ceil(len(p) / cpl)) for p in str(text).split('\n'))

    def link(cell, sheet, row):
        cell.hyperlink = Hyperlink(ref=cell.coordinate, location=f"'{sheet}'!A{row}")
        cell.font = LINK

    def table(ws, name, cols, data, start=1, freeze=None):
        """cols: (header, width, wrap). Writes one Excel table; returns {header: column letter} and the row range."""
        for j, (h, w, _) in enumerate(cols, 1):
            c = put(ws, start, j, h)
            c.font, c.alignment = Font(bold=True), HEAD
            ws.column_dimensions[L(j)].width = w
        ws.row_dimensions[start].height = 30
        data = data or [['(none)'] + [None] * (len(cols) - 1)]
        for i, vals in enumerate(data, start + 1):
            n = 1
            for j, ((_, w, wr), v) in enumerate(zip(cols, vals), 1):
                c = put(ws, i, j, v)
                c.alignment = WRAP if wr else TOP
                if wr and isinstance(c.value, str):
                    n = max(n, lines(c.value, w))
            if n > 1:
                ws.row_dimensions[i].height = min(n, MAX_LINES) * 15
        last = start + len(data)
        t = Table(displayName=name, ref=f'A{start}:{L(len(cols))}{last}')
        t.tableStyleInfo = TableStyleInfo(name='TableStyleMedium2', showRowStripes=True)
        ws.add_table(t)
        if freeze:
            ws.freeze_panes = freeze
        return {h: L(j) for j, (h, _, _) in enumerate(cols, 1)}, start + 1, last

    def palette(ws, rng, colors):
        for val, (bg, fg) in colors.items():
            ws.conditional_formatting.add(rng, CellIsRule(operator='equal', formula=[f'"{val}"'], fill=fill(bg), font=Font(color=fg)))

    def fit_scale(ws, rng):
        ws.conditional_formatting.add(rng, ColorScaleRule(start_type='num', start_value=0, start_color='F8696B',
                                                          mid_type='num', mid_value=50, mid_color='FFEB84',
                                                          end_type='num', end_value=100, end_color='63BE7B'))

    def bars(ws, rng):
        ws.conditional_formatting.add(rng, DataBarRule(start_type='num', start_value=0, end_type='num', end_value=100, color='5B9BD5'))

    def landscape(ws):
        ws.page_setup.orientation = 'landscape'
        ws.page_setup.fitToWidth, ws.page_setup.fitToHeight = 1, 0
        ws.sheet_properties.pageSetUpPr.fitToPage = True

    # Row positions, so sheets can link to each other.
    fg_row = {r['baseline_capability_id']: i for i, r in enumerate(rows, 2)}
    rm_row, k = {}, 2
    for r in rows:
        rm_row[r['baseline_capability_id']] = k
        k += len(r['marks'])
    bc_row = {c['id']: i for i, c in enumerate(B['caps'], 2)}
    tc_row = {c['id']: i for i, c in enumerate(T['caps'], 2)}
    R = {r['baseline_capability_id']: r for r in rows}
    cites = collections.Counter(t for r in rows for t in r['target_capability_ids'])
    only_ids = {x['target_capability_id'] for x in tonly}
    objs = G['objectives']
    verb = 'moved to' if M['mode'] == 'replacement' else 'chose'

    wb = Workbook()
    wb.properties.title, wb.properties.creator = M['title'], 'fit-gap-analysis'

    # ---- Read Me
    ws = wb.active
    ws.title = 'Read Me'
    ws.column_dimensions['A'].width, ws.column_dimensions['B'].width = 26, 110
    r = 1
    put(ws, r, 1, M['title'] + (' (DRAFT)' if M['draft'] else '')).font = H1
    r += 1
    put(ws, r, 1, f"Fit-gap analysis, {M['mode']} mode. Built {M['generated']} from {os.path.basename(a.fitgap)}.").font = Font(italic=True, color='595959')
    r += 2

    def section(ws, r, text, span=2):
        for j in range(1, span + 1):
            ws.cell(row=r, column=j).fill = SECTION
        put(ws, r, 1, text).font = H2
        return r + 1

    def pairs(ws, r, items, head=None):
        if head:
            for j, h in enumerate(head, 1):
                c = put(ws, r, j, h)
                c.font, c.fill = Font(bold=True), THEAD
            r += 1
        for k_, v_ in items:
            put(ws, r, 1, k_).alignment = TOP
            c = put(ws, r, 2, v_)
            c.alignment = WRAP
            n = lines(v_ or '', 110)
            if n > 1:
                ws.row_dimensions[r].height = n * 15
            r += 1
        return r + 1

    r = section(ws, r, 'What this workbook answers')
    r = pairs(ws, r, [('Question', f"If this organisation {verb} {T['name']}, what would happen to each capability of "
                                   f"{B['name']}, and how well would the move serve the project's objectives?"),
                      ('Baseline', f"{B['name']} ({bc}): {M['baseline']['capabilities']} capabilities, "
                                   f"{M['baseline']['requirements']} requirements marked. Source: {M['baseline']['source']}"),
                      ('Target', f"{T['name']} ({tc}): {M['target']['capabilities']} capabilities, "
                                 f"{M['target']['requirements']} requirements. Source: {M['target']['source']}"),
                      ('Objectives', f"{len(objs)} objectives, confirmed by {M['objectives_confirmed_by'] or 'nobody yet (draft)'}.")])
    r = section(ws, r, 'Sheets')
    sheet_help = [('Summary', 'Key numbers, headline findings, verdicts by layer, objective coverage and the top priorities.'),
                  (S_OBJ, 'Each objective with its rank, weight, the capabilities that serve it, their average fit and the worst gaps.'),
                  (S_FG, f'One row per {bc} capability: verdict, fit score, priority, track, owners, evidence, gap detail and migration note.'),
                  (S_RM, f'One row per {bc} requirement: the mark, the {tc} capabilities that carry it, and a note.'),
                  (S_DEC, 'The rows that need a decision or a question, ranked by priority, with the reason they are listed.')]
    if has_plan:
        sheet_help += [(S_MAP, f'Every {bc} capability placed in a delivery track, in track order and then priority, with its owners and to-dos.'),
                       (S_TD, 'The to-do list: who owns each item, which track it belongs to, what it is, and the capabilities it unblocks. '
                              'Filter the Owner column for one party\'s list.')]
    sheet_help += [(S_TO, f'{tc} capabilities that no {bc} requirement uses. Opportunities, not risks.'),
                   (S_FIND, 'The analyst findings: headlines, one finding per layer, what the target brings, and open questions.'),
                   (S_BC, f'Reference: every {bc} capability, linked to its fit-gap row.'),
                   (S_TC, f'Reference: every {tc} capability, with how many {bc} rows cite it.'),
                   (S_TR, f'Reference: every {tc} requirement. Use it to check the evidence.')]
    r = pairs(ws, r, sheet_help)
    r = section(ws, r, 'How to read it')
    r = pairs(ws, r, [('Start here', 'Read the Summary, then the Decisions sheet' + (', the Roadmap and the To-Dos' if has_plan else '')
                       + '. Sort Fit-Gap by Priority, largest first.'),
                      ('Fit score', f"0 to 100. The average of the requirement marks: "
                                    + ', '.join(f'{k_} {v_}' for k_, v_ in M['scoring']['mark_points'].items())
                                    + f". Requirements marked {DESCOPED} are left out of the average; a capability with every "
                                      f"requirement {DESCOPED} has no fit score and priority 0."),
                      ('Priority', '0 to 100. (100 minus fit) times the objective factor times the maturity factor. A large gap '
                                   'on something the business uses today, serving a must objective, ranks first. Ties are broken '
                                   'by the best objective rank the capability serves.'),
                      ('Objective factor', 'The highest weight among the objectives the capability serves: '
                                           + ', '.join(f'{k_} {v_}' for k_, v_ in M['scoring']['objective_factor'].items()) + '.'),
                      ('Maturity factor', f'How real the {bc} capability is today: '
                                          + ', '.join(f'{k_} {v_}' for k_, v_ in M['scoring']['maturity_factor'].items()) + '.'),
                      ('Partial', "Partial is common by design: any 'yes, but' on one requirement makes the capability partial. "
                                  'Use the fit score and the marks to tell a small partial from a large one.'),
                      ('Edits', 'Every number here is computed from the fit-gap JSON. Change the JSON and build the workbook '
                                'again. Edits made only in this file do not flow back.')])
    r = section(ws, r, 'Verdicts (read off the marks)')
    r = pairs(ws, r, list(VERDICT_MEANING.items()))
    r = section(ws, r, 'Requirement marks')
    r = pairs(ws, r, list(MARK_MEANING.items()))
    r = section(ws, r, 'Confidence')
    r = pairs(ws, r, list(CONF_MEANING.items()))
    r = section(ws, r, 'Effort to close the gap')
    r = pairs(ws, r, list(EFFORT_MEANING.items()))
    if has_plan:
        r = section(ws, r, 'Delivery tracks')
        r = pairs(ws, r, [(f"{t['order']}. {t['name']}", (t.get('timing') + '. ' if t.get('timing') else '') + (t.get('description') or ''))
                          for t in TRK])
        r = section(ws, r, 'Owners')
        r = pairs(ws, r, [(o, (M.get('owner_roles') or {}).get(o, '')) for o in OWN])
        r = section(ws, r, 'To-do types')
        r = pairs(ws, r, list(TODO_TYPE_MEANING.items()))
    r = section(ws, r, 'Why a row is listed')
    pairs(ws, r, list(WHY_MEANING.items()))

    # ---- Summary
    ws = wb.create_sheet('Summary')
    for j, w in enumerate([16, 44, 13, 13, 13, 13, 13, 13, 13, 44], 1):
        ws.column_dimensions[L(j)].width = w
    r = 1
    put(ws, r, 1, M['title'] + (' (DRAFT)' if M['draft'] else '')).font = H1
    r += 1
    put(ws, r, 1, f"{bc} scored against {tc}. {M['mode'].capitalize()} mode. Built {M['generated']}.").font = Font(italic=True, color='595959')
    r += 2

    def head(ws, r, labels):
        for j, h in enumerate(labels, 1):
            c = put(ws, r, j, h)
            c.font, c.fill, c.alignment = Font(bold=True), THEAD, HEAD
        return r + 1

    r = section(ws, r, 'Key numbers', 10)
    C = M['counts']

    def avg(xs):
        xs = [x for x in xs if x is not None]
        return round(sum(xs) / len(xs)) if xs else None

    def rank_of(x):
        return x.get('objective_rank') if x.get('objective_rank') is not None else 99

    key_numbers = [(f'{bc} capabilities scored', M['baseline']['capabilities']),
                   (f'{bc} requirements marked', M['baseline']['requirements']),
                   (f'{bc} requirements descoped (not needed in {tc})', C['marks'].get(DESCOPED, 0)),
                   (f'{tc} capabilities', M['target']['capabilities']),
                   ('Average fit score (descoped excluded)', C['average_fit']),
                   ('Rows listed for a decision', sum(1 for x in rows if x['why_listed'])),
                   ('Open questions (low confidence)', C['why_listed']['open_question']),
                   (f'{tc}-only capabilities', C['target_only'])]
    if has_plan:
        key_numbers += [('To-dos', len(todos))] + [(f'  owned by {o}', C.get('todos_by_owner', {}).get(o, 0)) for o in OWN]
    for label, val in key_numbers:
        ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=2)
        put(ws, r, 1, label)
        put(ws, r, 3, val).font = Font(bold=True, size=13)
        r += 1
    r += 1
    r = section(ws, r, 'Headline findings', 10)
    for i, h in enumerate(F.get('headline') or ['(draft: no findings yet)'], 1):
        put(ws, r, 1, i).alignment = TOP
        ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=10)
        c = put(ws, r, 2, h)
        c.alignment = WRAP
        ws.row_dimensions[r].height = max(15, lines(h, 200) * 15)
        r += 1
    r += 1
    r = section(ws, r, 'Verdicts', 10)
    r = head(ws, r, ['Verdict', 'Meaning', 'Capabilities', 'Share'])
    for v in VERDICTS:
        n = C['verdicts'][v]
        c = put(ws, r, 1, v)
        c.fill, c.font = fill(VERDICT_COLORS[v][0]), Font(color=VERDICT_COLORS[v][1], bold=True)
        put(ws, r, 2, VERDICT_MEANING[v]).alignment = WRAP
        ws.row_dimensions[r].height = 30
        put(ws, r, 3, n)
        put(ws, r, 4, n / len(rows)).number_format = '0%'
        r += 1
    r += 1
    r = head(ws, r, ['Mark', 'Meaning', 'Requirements', 'Share'])
    nm = sum(C['marks'].values())
    for k_ in MARKS:
        c = put(ws, r, 1, k_)
        c.fill, c.font = fill(MARK_COLORS[k_][0]), Font(color=MARK_COLORS[k_][1], bold=True)
        put(ws, r, 2, MARK_MEANING[k_]).alignment = WRAP
        put(ws, r, 3, C['marks'][k_])
        put(ws, r, 4, C['marks'][k_] / nm).number_format = '0%'
        r += 1
    r += 1
    r = section(ws, r, 'Verdicts by layer', 10)
    r = head(ws, r, ['Layer', 'Name', 'Capabilities'] + VERDICTS + ['Average fit'])
    first = r
    for lay in B['layers']:
        lr = [x for x in rows if x['layer_code'] == lay['code']]
        if not lr:
            continue
        vals = [lay['code'], lay['name'], len(lr)] + [sum(x['verdict'] == v for x in lr) for v in VERDICTS] \
            + [avg(x['fit_score'] for x in lr)]
        for j, v in enumerate(vals, 1):
            put(ws, r, j, v)
        r += 1
    if r > first:
        lv, lf = L(3 + len(VERDICTS)), L(4 + len(VERDICTS))
        ws.conditional_formatting.add(f'D{first}:{lv}{r - 1}', ColorScaleRule(start_type='min', start_color='FFFFFF',
                                                                              end_type='max', end_color='F4B183'))
        fit_scale(ws, f'{lf}{first}:{lf}{r - 1}')
    r += 1
    if has_plan:
        r = section(ws, r, 'To-dos by track and owner', 10)
        r = head(ws, r, ['Order', 'Track'] + OWN + ['Total'])
        for t in TRK:
            tt = [x for x in todos if x['track'] == t['id']]
            vals = [t['order'], t['name']] + [sum(x['owner'] == o for x in tt) for o in OWN] + [len(tt)]
            for j, v in enumerate(vals, 1):
                put(ws, r, j, v).alignment = WRAP if j == 2 else TOP
            r += 1
        r += 1
    r = section(ws, r, 'Objective coverage', 10)
    r = head(ws, r, ['Objective', 'Name', 'Rank', 'Weight', 'Capabilities', 'Average fit', 'Partial', 'Gap',
                     DESCOPED.capitalize(), 'Worst gaps'])
    first = r
    for o in sorted(objs, key=lambda o: (o.get('rank') if o.get('rank') is not None else 99, o['id'])):
        vals = [o['id'], o['name'], o.get('rank'), o['weight'], o['linked_capabilities'], o['average_fit'],
                o['verdicts']['partial'], o['verdicts']['gap'], o['verdicts'].get(DESCOPED, 0), o['top_gaps'][:3]]
        for j, v in enumerate(vals, 1):
            put(ws, r, j, v).alignment = WRAP if j in (2, 10) else TOP
        r += 1
    if r > first:
        fit_scale(ws, f'F{first}:F{r - 1}')
    r += 1
    r = section(ws, r, 'Top 15 priorities', 10)
    if has_plan:
        r = head(ws, r, ['Capability', 'Name', 'Track', 'Verdict', 'Fit', 'Priority', 'Effort', 'Owners', 'Confidence', 'Objectives'])
    else:
        r = head(ws, r, ['Capability', 'Name', 'Layer', 'Verdict', 'Fit', 'Priority', 'Effort', 'Confidence', 'Maturity', 'Objectives'])
    first = r
    for x in sorted(rows, key=lambda x: (-x['priority'], rank_of(x), x['baseline_capability_id']))[:15]:
        if has_plan:
            vals = [x['baseline_capability_id'], x['baseline_name'], x.get('track_name'), x['verdict'], x['fit_score'],
                    x['priority'], x['effort'], x.get('owners'), x['confidence'], x['objective_ids']]
        else:
            vals = [x['baseline_capability_id'], x['baseline_name'], x['layer_code'], x['verdict'], x['fit_score'],
                    x['priority'], x['effort'], x['confidence'], x['baseline_maturity'], x['objective_ids']]
        for j, v in enumerate(vals, 1):
            put(ws, r, j, v).alignment = WRAP if j in (2, 3) else TOP
        link(ws.cell(row=r, column=1), S_FG, fg_row[x['baseline_capability_id']])
        r += 1
    if r > first:
        palette(ws, f'D{first}:D{r - 1}', VERDICT_COLORS)
        fit_scale(ws, f'E{first}:E{r - 1}')
        bars(ws, f'F{first}:F{r - 1}')

    # ---- Objectives
    ws = wb.create_sheet(S_OBJ)
    cols = [('Objective', 11, False), ('Name', 28, True), ('Rank', 7, False), ('Weight', 9, False), ('Statement', 60, True),
            ('Measure', 40, True), ('Source', 24, True), ('Capabilities', 12, False), ('Average Fit', 10, False)] \
        + [(v.capitalize(), 12, False) for v in VERDICTS] + [('Worst Gaps', 60, True), (f'{tc}-Only Opportunities', 30, True)]
    data = [[o['id'], o['name'], o.get('rank'), o['weight'], o['statement'], o.get('measure'), o.get('source'),
             o['linked_capabilities'], o['average_fit']] + [o['verdicts'].get(v, 0) for v in VERDICTS]
            + [' | '.join(f"{g} {R[g]['baseline_name']} ({R[g]['priority']})" for g in o['top_gaps']), o['target_only']]
            for o in objs]
    cm, a0, a1 = table(ws, 'tblObjectives', cols, data, freeze='C2')
    fit_scale(ws, f"{cm['Average Fit']}{a0}:{cm['Average Fit']}{a1}")
    landscape(ws)

    # ---- Fit-Gap
    ws = wb.create_sheet(S_FG)
    plan_cols = [('Track', 24, True), ('Owners', 18, True), ('To-Dos', 16, True)] if has_plan else []
    cols = [('Layer', 8, False), ('Layer Name', 20, True), ('Capability ID', 13, False), ('Capability', 32, True),
            ('Status', 13, False), ('Maturity', 11, False), ('Reqs', 7, False), ('Verdict', 13, False), ('Fit', 7, False),
            ('Priority', 9, False), ('Confidence', 11, False), ('Effort', 10, False), ('Objectives', 14, True)] + plan_cols \
        + [('Met', 7, False), ('Configured', 8, False), ('Partly', 7, False), ('Unreleased', 8, False), ('Not Met', 7, False),
           ('Descoped', 8, False),
           (f'{tc} IDs', 24, True), (f'{tc} Capabilities', 38, True), (f'{tc} Statuses', 16, True),
           ('Evidence', 80, True), ('Gap Detail', 60, True), ('Migration Note', 60, True), ('Why Listed', 20, True)]

    def plan_vals(x):
        return [x.get('track_name'), x.get('owners'), x.get('todo_ids')] if has_plan else []

    data = [[x['layer_code'], B['cap'][x['baseline_capability_id']]['layer_name'], x['baseline_capability_id'],
             x['baseline_name'], x['baseline_status'], x['baseline_maturity'], x['requirement_count'], x['verdict'],
             x['fit_score'], x['priority'], x['confidence'], x['effort'], x['objective_ids']] + plan_vals(x)
            + [x['mark_counts'].get(k_, 0) for k_ in MARKS]
            + [x['target_capability_ids'], x['target_capability_names'], x['target_statuses'], x['evidence'],
               x['gap_detail'], x['migration_note'], x['why_listed']] for x in rows]
    cm, a0, a1 = table(ws, 'tblFitGap', cols, data, freeze='E2')
    for i, x in enumerate(rows, a0):
        link(ws[f"{cm['Capability ID']}{i}"], S_RM, rm_row[x['baseline_capability_id']])
    palette(ws, f"{cm['Verdict']}{a0}:{cm['Verdict']}{a1}", VERDICT_COLORS)
    fit_scale(ws, f"{cm['Fit']}{a0}:{cm['Fit']}{a1}")
    bars(ws, f"{cm['Priority']}{a0}:{cm['Priority']}{a1}")
    landscape(ws)

    # ---- Requirement Marks
    ws = wb.create_sheet(S_RM)
    cols = [('Layer', 8, False), ('Capability ID', 13, False), ('Capability', 28, True), ('Requirement ID', 17, False),
            ('Kind', 10, False), ('Status', 13, False), ('Requirement', 70, True), ('Mark', 12, False),
            ('Points', 8, False), (f'{tc} IDs', 24, True), ('Note', 60, True)]
    data, refs = [], []
    for x in rows:
        c = B['cap'][x['baseline_capability_id']]
        rq = {q['id']: q for q in c['requirements']}
        for m in x['marks']:
            q = rq[m['requirement_id']]
            data.append([x['layer_code'], c['id'], c['name'], q['id'], q['kind'], q['status'], q['text'], m['mark'],
                         M['scoring']['mark_points'].get(m['mark']), m['target_capability_ids'], m['note']])
            refs.append(c['id'])
    cm, a0, a1 = table(ws, 'tblMarks', cols, data, freeze='E2')
    for i, cid in enumerate(refs, a0):
        link(ws[f"{cm['Capability ID']}{i}"], S_FG, fg_row[cid])
    palette(ws, f"{cm['Mark']}{a0}:{cm['Mark']}{a1}", MARK_COLORS)
    landscape(ws)

    # ---- Decisions
    ws = wb.create_sheet(S_DEC)
    listed = sorted((x for x in rows if x['why_listed']), key=lambda x: (-x['priority'], rank_of(x), x['baseline_capability_id']))
    cols = [('Priority', 9, False), ('Why Listed', 22, True), ('Capability ID', 13, False), ('Capability', 32, True),
            ('Layer', 8, False), ('Maturity', 11, False), ('Verdict', 13, False), ('Fit', 7, False), ('Effort', 10, False),
            ('Confidence', 11, False), ('Objectives', 14, True)] + plan_cols \
        + [('Gap Detail', 60, True), ('Migration Note', 60, True)]
    data = [[x['priority'], x['why_listed'], x['baseline_capability_id'], x['baseline_name'], x['layer_code'],
             x['baseline_maturity'], x['verdict'], x['fit_score'], x['effort'], x['confidence'], x['objective_ids']]
            + plan_vals(x) + [x['gap_detail'], x['migration_note']] for x in listed]
    cm, a0, a1 = table(ws, 'tblDecisions', cols, data, freeze='E2')
    for i, x in enumerate(listed, a0):
        link(ws[f"{cm['Capability ID']}{i}"], S_FG, fg_row[x['baseline_capability_id']])
    if listed:
        palette(ws, f"{cm['Verdict']}{a0}:{cm['Verdict']}{a1}", VERDICT_COLORS)
        fit_scale(ws, f"{cm['Fit']}{a0}:{cm['Fit']}{a1}")
        bars(ws, f"{cm['Priority']}{a0}:{cm['Priority']}{a1}")
    landscape(ws)

    if has_plan:
        # ---- Roadmap
        ws = wb.create_sheet(S_MAP)
        mapped = sorted(rows, key=lambda x: (x.get('track_order') if x.get('track_order') is not None else 999,
                                             -x['priority'], rank_of(x), x['baseline_capability_id']))
        cols = [('Order', 7, False), ('Track', 26, True), ('Capability ID', 13, False), ('Capability', 34, True),
                ('Layer', 8, False), ('Verdict', 13, False), ('Fit', 7, False), ('Priority', 9, False), ('Effort', 10, False),
                ('Owners', 18, True), ('Objectives', 14, True), ('To-Dos', 18, True), ('Migration Note', 70, True)]
        data = [[x.get('track_order'), x.get('track_name'), x['baseline_capability_id'], x['baseline_name'], x['layer_code'],
                 x['verdict'], x['fit_score'], x['priority'], x['effort'], x.get('owners'), x['objective_ids'],
                 x.get('todo_ids'), x['migration_note']] for x in mapped]
        cm, a0, a1 = table(ws, 'tblRoadmap', cols, data, freeze='D2')
        for i, x in enumerate(mapped, a0):
            link(ws[f"{cm['Capability ID']}{i}"], S_FG, fg_row[x['baseline_capability_id']])
        palette(ws, f"{cm['Verdict']}{a0}:{cm['Verdict']}{a1}", VERDICT_COLORS)
        fit_scale(ws, f"{cm['Fit']}{a0}:{cm['Fit']}{a1}")
        bars(ws, f"{cm['Priority']}{a0}:{cm['Priority']}{a1}")
        landscape(ws)

        # ---- To-Dos
        ws = wb.create_sheet(S_TD)
        own_order = {o: i for i, o in enumerate(OWN)}
        tsorted = sorted(todos, key=lambda t: (own_order.get(t['owner'], 99), t['track_order'],
                                               t['sequence'] if t.get('sequence') is not None else 999, t['id']))
        cols = [('Owner', 12, False), ('ID', 8, False), ('Order', 7, False), ('Track', 26, True), ('Seq', 6, False),
                ('Type', 15, False), ('Title', 44, True), ('Detail', 80, True), ('Support', 16, True),
                ('Capabilities', 22, True), ('Objectives', 14, True), ('Max Priority', 9, False), ('Depends On', 12, True)]
        data = [[t['owner'], t['id'], t['track_order'], t['track_name'], t.get('sequence'), t['type'], t['title'], t['detail'],
                 t.get('support'), t.get('capability_ids'), t.get('objective_ids'), t.get('max_priority'), t.get('depends_on')]
                for t in tsorted]
        cm, a0, a1 = table(ws, 'tblToDos', cols, data, freeze='C2')
        ocol = owner_colors({'owners': OWN, 'owner_colors': fr.get('owner_colors')})
        if ocol:
            palette(ws, f"{cm['Owner']}{a0}:{cm['Owner']}{a1}", ocol)
        bars(ws, f"{cm['Max Priority']}{a0}:{cm['Max Priority']}{a1}")
        landscape(ws)

    # ---- Target Only
    ws = wb.create_sheet(S_TO)
    cols = [('Capability ID', 14, False), ('Capability', 32, True), ('Layer', 8, False), ('Status', 16, False),
            ('Maturity', 11, False), ('Reqs', 7, False), ('Objectives', 14, True), ('Confidence', 11, False),
            ('Effort', 10, False), ('Evidence', 70, True), ('Opportunity', 60, True)]
    data = [[x['target_capability_id'], x['target_name'], x['layer_code'], x['target_status'], x['target_maturity'],
             x['requirement_count'], x['objective_ids'], x['confidence'], x['effort'], x['evidence'], x['opportunity']]
            for x in tonly]
    cm, a0, a1 = table(ws, 'tblTargetOnly', cols, data, freeze='C2')
    for i, x in enumerate(tonly, a0):
        link(ws[f"{cm['Capability ID']}{i}"], S_TC, tc_row[x['target_capability_id']])
    landscape(ws)

    # ---- Findings
    ws = wb.create_sheet(S_FIND)
    LN = {l['code']: l['name'] for l in B['layers']}
    data = [['Headline', None, None, h] for h in F.get('headline') or []] \
        + [['Layer', x['layer_code'], LN.get(x['layer_code']), x['text']] for x in F.get('layers') or []] \
        + [[f'What {tc} brings', None, None, h] for h in F.get('opportunities') or []] \
        + [['Open question', None, None, h] for h in F.get('open_questions') or []]
    table(ws, 'tblFindings', [('Section', 18, False), ('Layer', 8, False), ('Layer Name', 24, True), ('Finding', 130, True)],
          data, freeze='A2')
    landscape(ws)

    # ---- Reference sheets
    ws = wb.create_sheet(S_BC)
    cols = [('Capability ID', 13, False), ('Parent ID', 10, False), ('Layer', 8, False), ('Layer Name', 20, True),
            ('Doc Ref', 8, False), ('Type', 14, False), ('Status', 13, False), ('Maturity', 11, False),
            ('Capability', 32, True), ('Summary', 80, True), ('Reqs', 7, False), ('Verdict', 13, False), ('Fit', 7, False)]
    data = [[c['id'], c['parent_id'], c['layer_code'], c['layer_name'], c['doc_ref'], c['type'], c['status'], c['maturity'],
             c['name'], c['summary'], len(c['requirements']), R[c['id']]['verdict'], R[c['id']]['fit_score']] for c in B['caps']]
    cm, a0, a1 = table(ws, 'tblBaselineCaps', cols, data, freeze='B2')
    for i, c in enumerate(B['caps'], a0):
        link(ws[f"{cm['Capability ID']}{i}"], S_FG, fg_row[c['id']])
    palette(ws, f"{cm['Verdict']}{a0}:{cm['Verdict']}{a1}", VERDICT_COLORS)
    fit_scale(ws, f"{cm['Fit']}{a0}:{cm['Fit']}{a1}")
    landscape(ws)

    ws = wb.create_sheet(S_TC)
    cols = [('Capability ID', 14, False), ('Parent ID', 10, False), ('Layer', 8, False), ('Layer Name', 20, True),
            ('Doc Ref', 8, False), ('Type', 14, False), ('Status', 16, False), ('Maturity', 11, False),
            ('Capability', 32, True), ('Summary', 80, True), ('Reqs', 7, False), (f'Cited By {bc}', 10, False),
            (f'{tc} Only', 8, False)]
    data = [[c['id'], c['parent_id'], c['layer_code'], c['layer_name'], c['doc_ref'], c['type'], c['status'], c['maturity'],
             c['name'], c['summary'], len(c['requirements']), cites.get(c['id'], 0), 'yes' if c['id'] in only_ids else None]
            for c in T['caps']]
    table(ws, 'tblTargetCaps', cols, data, freeze='B2')
    landscape(ws)

    ws = wb.create_sheet(S_TR)
    cols = [('Requirement ID', 18, False), ('Capability ID', 14, False), ('Capability', 28, True), ('Layer', 8, False),
            ('Kind', 10, False), ('Status', 16, False), ('Maturity', 11, False), ('Requirement', 80, True),
            ('Option Values', 30, True)]
    trefs = [(c, q) for c in T['caps'] for q in c['requirements']]
    data = [[q['id'], c['id'], c['name'], c['layer_code'], q['kind'], q['status'], q['maturity'], q['text'],
             q['option_values']] for c, q in trefs]
    cm, a0, a1 = table(ws, 'tblTargetReqs', cols, data, freeze='C2')
    for i, (c, _) in enumerate(trefs, a0):
        link(ws[f"{cm['Capability ID']}{i}"], S_TC, tc_row[c['id']])
    landscape(ws)

    wb.active = 1
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    wb.save(out)

    # ---- Check what was written
    wb2 = load_workbook(out)
    fails = []

    def chk(ok, msg):
        print(('  PASS  ' if ok else '  FAIL  ') + msg)
        if not ok:
            fails.append(msg)

    want = ['Read Me', 'Summary', S_OBJ, S_FG, S_RM, S_DEC] + ([S_MAP, S_TD] if has_plan else []) \
        + [S_TO, S_FIND, S_BC, S_TC, S_TR]
    chk(wb2.sheetnames == want, 'sheets present in order')
    if has_plan:
        chk(wb2[S_MAP].max_row == len(rows) + 1, f'{S_MAP} has one row per {bc} capability ({len(rows)})')
        chk(wb2[S_TD].max_row == max(1, len(todos)) + 1, f'{S_TD} lists {len(todos)} to-dos')
        chk(all(x.get('track') for x in rows), 'every capability has a track')
    chk(wb2[S_FG].max_row == len(rows) + 1, f'{S_FG} has one row per {bc} capability ({len(rows)})')
    chk(wb2[S_RM].max_row == len(refs) + 1, f'{S_RM} has one row per {bc} requirement ({len(refs)})')
    chk(wb2[S_TR].max_row == len(trefs) + 1, f'{S_TR} has one row per {tc} requirement ({len(trefs)})')
    chk(wb2[S_DEC].max_row == max(1, len(listed)) + 1, f'{S_DEC} lists {len(listed)} rows')
    chk(wb2[S_TO].max_row == max(1, len(tonly)) + 1, f'{S_TO} lists {len(tonly)} rows')
    chk(sum(1 for x in wb2[S_FG].iter_rows(min_row=2, values_only=True) if x[7] not in VERDICTS) == 0, 'every verdict in vocabulary')
    print(f"workbook[{bc}->{tc}]{' DRAFT' if M['draft'] else ''}: {len(want)} sheets -> {out}")
    sys.exit(1 if fails else 0)


# ------------------------------------------------------------------------------------------------- main
if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    sp = p.add_subparsers(dest='cmd', required=True)
    s = sp.add_parser('frame', help='check the frame')
    s.add_argument('--frame', required=True)
    s = sp.add_parser('packages', help='split the baseline into scoring packages')
    s.add_argument('--frame', required=True)
    s.add_argument('--out', required=True, help='working folder; packages go in <out>/packages/')
    s.add_argument('--max-requirements', type=int, default=180, help='requirements per package (default 180)')
    s = sp.add_parser('uncited', help='list target capabilities no mark cites')
    s.add_argument('--frame', required=True)
    s.add_argument('--rows', nargs='+', required=True)
    s.add_argument('--out', help='also write the list to this JSON file')
    s = sp.add_parser('merge', help='merge and score into the fit-gap JSON')
    s.add_argument('--frame', required=True)
    s.add_argument('--rows', nargs='+', required=True)
    s.add_argument('--only', nargs='*', default=[])
    s.add_argument('--findings')
    s.add_argument('--todos', nargs='*', default=[], help='to-do list JSON (needed when the frame has tracks)')
    s.add_argument('--out', required=True, help='output folder')
    s.add_argument('--date', default=datetime.date.today().isoformat())
    s.add_argument('--draft', action='store_true', help='allow a build without findings or confirmed objectives')
    s = sp.add_parser('workbook', help='build the Excel workbook')
    s.add_argument('--frame', required=True)
    s.add_argument('--fitgap', required=True)
    s.add_argument('--out', help='default: the fit-gap JSON path with .xlsx')
    a = p.parse_args()
    {'frame': cmd_frame, 'packages': cmd_packages, 'uncited': cmd_uncited, 'merge': cmd_merge,
     'workbook': cmd_workbook}[a.cmd](a)
