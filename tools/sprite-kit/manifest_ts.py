"""Serialize ordered, fresh-record TypeScript manifests; no bake/install side effects."""
import json

MANIFEST_IMPORT = "import { expandManifest } from './sprite-manifest.ts'\n"

def manifest_expression(values):
    templates, indices, rows = [], {}, []
    for key, value in values.items():
        encoded = json.dumps(value, ensure_ascii=False, separators=(',', ':'))
        if encoded not in indices:
            indices[encoded] = len(templates)
            templates.append(value)
        rows.append([key, indices[encoded]])
    encode = lambda value: json.dumps(value, ensure_ascii=False, separators=(',', ':'))
    return 'expandManifest(' + encode(templates) + ',' + encode(rows) + ')'
