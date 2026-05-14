import { readFileSync } from 'fs';
import { join } from 'path';
const dataDir = join(process.cwd(), 'data');
function parseCSV(content) {
    const rows = [];
    for (const line of content.split('\n')) {
        if (!line.trim())
            continue;
        const fields = [];
        let inQuote = false;
        let current = '';
        for (const char of line) {
            if (char === '"') {
                inQuote = !inQuote;
            }
            else if (char === ',' && !inQuote) {
                fields.push(current.trim());
                current = '';
            }
            else {
                current += char;
            }
        }
        fields.push(current.trim());
        rows.push(fields);
    }
    return rows;
}
function load(filename) {
    try {
        return parseCSV(readFileSync(join(dataDir, filename), 'utf-8')).slice(1);
    }
    catch (e) {
        console.warn(`Could not load taxonomy file: ${filename}`);
        return [];
    }
}
const locations = load('location_taxonomy.csv')
    .filter(r => r[0]?.trim() && r[1]?.trim())
    .map(r => `${r[0].replace(/_/g, ' ')} > ${r[1].replace(/_/g, ' ')}`);
const transactions = load('transaction_taxonomy.csv')
    .filter(r => r[0]?.trim())
    .map(r => [r[0], r[1], r[2], r[3]].filter(s => s?.trim()).join(' > '));
const cgFields = load('cg_data_dictionary.csv')
    .filter(r => r[0]?.trim() && r[1]?.trim())
    .map(r => `${r[0]} [field: ${r[1]}]`);
const cgValues = load('cg_field_values.csv')
    .filter(r => r[0]?.trim() && r[2]?.trim())
    .map(r => `${r[0]}=${r[1]}: ${r[2]}`);
function match(entries, keywords, limit = 15) {
    return entries
        .filter(e => keywords.some(k => e.toLowerCase().includes(k)))
        .slice(0, limit);
}
export function searchTaxonomy(query) {
    const keywords = query
        .toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 3)
        .map(w => w.replace(/[^a-z]/g, ''))
        .filter(Boolean);
    if (!keywords.length)
        return '';
    const parts = [];
    const locs = match(locations, keywords);
    if (locs.length)
        parts.push(`Location signals (where people go):\n${locs.join('\n')}`);
    const txns = match(transactions, keywords);
    if (txns.length)
        parts.push(`Purchase signals (what people buy):\n${txns.join('\n')}`);
    const fields = match(cgFields, keywords);
    if (fields.length)
        parts.push(`Consumer graph fields (who people are):\n${fields.join('\n')}`);
    const vals = match(cgValues, keywords);
    if (vals.length)
        parts.push(`Field values:\n${vals.join('\n')}`);
    return parts.join('\n\n');
}
export function getTaxonomySummary() {
    return { locations: locations.length, transactions: transactions.length, cgFields: cgFields.length, cgValues: cgValues.length };
}
//# sourceMappingURL=taxonomy.js.map