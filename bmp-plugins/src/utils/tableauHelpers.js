export function findColumn(columns, patterns) {
    return columns.findIndex((column) =>
        patterns.some(
            (pattern) =>
                pattern.test(column.fieldName || '') ||
                pattern.test(column.caption || '')
        )
    )
}

export function numericValue(value) {
    if (typeof value === 'number') return value
    if (value == null || value === '') return NaN
    let str = String(value).trim()
    if (str.includes(',') && !str.includes('.')) {
        str = str.replace(/\./g, '').replace(',', '.')
    } else {
        str = str.replace(/,/g, '')
    }
    return Number(str)
}

export function extractTableauRow(row, columns, targetDataRef, fieldMappings) {
    Object.entries(fieldMappings).forEach(([key, patterns]) => {
        const idx = findColumn(columns, patterns)
        if (idx >= 0 && row[idx]) {
            const raw = row[idx].formattedValue ?? row[idx].value
            const parsed = numericValue(raw)
            if (!isNaN(parsed)) {
                targetDataRef.value[key] = parsed
            }
        }
    })
}