export function findColumn(columns, patterns) {
    return columns.findIndex((column) => {
        const name = column.fieldName || column.caption || ''
        return patterns.some((pattern) => pattern.test(name))
    })
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

export function extractTableauRow(row, columns, targetDataRef, fieldMappings, addLog = () => { }) {
    columns.forEach((col, idx) => {
        const colName = col.fieldName || col.caption || ''
        Object.entries(fieldMappings).forEach(([key, patterns]) => {
            if (patterns.some((pat) => pat.test(colName))) {
                if (row[idx] !== undefined && row[idx] !== null) {
                    const cell = row[idx]
                    const raw = cell.value !== undefined ? cell.value : (cell.formattedValue ?? cell)
                    const parsed = numericValue(raw)

                    if (!isNaN(parsed)) {
                        targetDataRef.value[key] = parsed
                        addLog(`Extracted ${key} from [${colName}]: ${parsed}`)
                    }
                }
            }
        })
    })
}