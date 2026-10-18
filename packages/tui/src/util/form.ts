import type { FormField, FormValue } from "@opencode/client"

export type FormAnswerField = Exclude<FormField, { type: "external" }>

export type FormRow = {
  value: string | boolean
  label: string
  description?: string
}

export function isFormAnswerField(field: FormField): field is FormAnswerField {
  return field.type !== "external"
}

export function formLabel(field: FormField) {
  return field.title ?? (field.type === "external" ? field.url : field.key)
}

export function formInitialValues(fields: ReadonlyArray<FormField>) {
  return {
    answers: Object.fromEntries(
      fields.flatMap((field) =>
        isFormAnswerField(field) && field.default !== undefined ? [[field.key, field.default]] : [],
      ),
    ) as Record<string, FormValue | undefined>,
    custom: Object.fromEntries(
      fields.flatMap((field) => {
        if (field.type !== "string" || !field.options || !field.custom || typeof field.default !== "string") return []
        if (field.options.some((option) => option.value === field.default)) return []
        return [[field.key, field.default]]
      }),
    ) as Record<string, string>,
  }
}

export function formTextual(field: FormField | undefined) {
  if (!field) return false
  return field.type === "number" || field.type === "integer" || (field.type === "string" && !field.options)
}

export function formCustom(field: FormField | undefined) {
  if (!field) return false
  if (field.type === "string" && field.options) return field.custom === true
  return field.type === "multiselect" && field.custom === true
}

export function formRows(field: FormField | undefined): FormRow[] {
  if (!field) return []
  if (field.type === "boolean")
    return [
      { value: true, label: "Yes" },
      { value: false, label: "No" },
    ]
  const options = field.type === "multiselect" ? field.options : field.type === "string" ? field.options : undefined
  if (!options) return []
  return options.map((option) => ({
    value: option.value,
    label: option.label,
    description: option.description,
  }))
}

export function formSelected(field: FormField | undefined, value: FormValue | undefined) {
  if (!field || value === undefined || Array.isArray(value)) return 0
  const rows = formRows(field)
  const index = rows.findIndex((row) => row.value === value)
  if (index !== -1) return index
  if (typeof value === "string" && formCustom(field)) return rows.length
  return 0
}

export function formValidateValue(field: FormAnswerField, value: FormValue | undefined): string | undefined {
  if (value === undefined) return field.required ? "此项必填" : undefined
  if (field.required && (value === "" || (Array.isArray(value) && value.length === 0)))
    return field.type === "multiselect" ? "请至少选择一项" : "此项必填"
  if (field.type === "string") {
    if (typeof value !== "string") return "应为文本"
    if (field.minLength !== undefined && value.length < field.minLength)
      return `至少需要 ${field.minLength} 个字符`
    if (field.maxLength !== undefined && value.length > field.maxLength)
      return `至多 ${field.maxLength} 个字符`
    if (field.pattern !== undefined) {
      try {
        if (!new RegExp(field.pattern).test(value)) return `必须匹配模式：${field.pattern}`
      } catch {
        return `无效的模式：${field.pattern}`
      }
    }
    if (field.format === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "应为电子邮件地址"
    if (field.format === "uri" && !validURL(value)) return "应为 URL"
    if (field.format === "date" && !validDate(value)) return "应为日期 (YYYY-MM-DD)"
    if (field.format === "date-time" && Number.isNaN(new Date(value).getTime())) return "应为日期和时间"
    if (field.options && !field.custom && !field.options.some((option) => option.value === value))
      return "请选择一个可用选项"
    return
  }
  if (field.type === "number" || field.type === "integer") {
    if (typeof value !== "number" || !Number.isFinite(value)) return "应为数字"
    if (field.type === "integer" && !Number.isInteger(value)) return "应为整数"
    if (typeof field.minimum === "number" && value < field.minimum) return `至少为 ${field.minimum}`
    if (typeof field.maximum === "number" && value > field.maximum) return `至多为 ${field.maximum}`
    return
  }
  if (field.type === "boolean") return typeof value === "boolean" ? undefined : "应为是或否"
  if (!Array.isArray(value)) return "应为选项集合"
  if (field.minItems !== undefined && value.length < field.minItems) return `请至少选择 ${field.minItems} 项`
  if (field.maxItems !== undefined && value.length > field.maxItems) return `请至多选择 ${field.maxItems} 项`
  if (!field.custom && value.some((item) => !field.options.some((option) => option.value === item)))
    return "请仅选择可用选项"
}

export function formDisplayValue(field: FormAnswerField, value: FormValue | undefined, emptyMultiselect: string) {
  if (value === undefined) return ""
  const label = (item: string | number | boolean) =>
    formRows(field).find((row) => row.value === item)?.label ?? String(item)
  if (Array.isArray(value)) return value.length === 0 ? emptyMultiselect : value.map(label).join(", ")
  return label(value)
}

export function formToggleMultiselect(value: FormValue | undefined, item: string) {
  const values = Array.isArray(value) ? value : []
  const index = values.indexOf(item)
  return index === -1 ? [...values, item] : values.toSpliced(index, 1)
}

export function formSetMultiselectCustom(value: FormValue | undefined, previous: string | undefined, next: string) {
  const values = Array.isArray(value) ? value : []
  const index = previous ? values.indexOf(previous) : -1
  const current = index === -1 ? [...values] : values.toSpliced(index, 1)
  return next && !current.includes(next) ? [...current, next] : current
}

function validURL(value: string) {
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}
