import type powerbi from "powerbi-visuals-api";

export const LIMITS = Object.freeze({ rows: 1000, periods: 24, columns: 168, cells: 24000, config: 256000 });
export type Scenario = "Actual" | "Budget" | "Prior";
export type Issue = { key: string; detail?: string };
export interface Line {
    id: string;
    label: string;
    order: number;
    type: "detail" | "subtotal" | "heading";
    unit: "currency" | "percent" | "number";
    format?: string;
    sign: 1 | -1;
    favorable: "higher" | "lower" | "neutral";
    variance: "none" | "absolute" | "both";
}
export interface StatementRow {
    line: Line;
    node: powerbi.DataViewMatrixNode;
    path: powerbi.DataViewMatrixNode[];
    depth: number;
    parent?: string;
    hasChildren: boolean;
    values: powerbi.DataViewMatrixNode["values"];
}
export interface StatementColumn {
    key: string;
    period: string;
    path: powerbi.DataViewMatrixNode[];
    scenario: Scenario;
    kind: "value" | "absolute" | "relative";
    slot: number;
    actualSlot?: number;
    source: powerbi.DataViewMetadataColumn;
}
export interface Statement {
    rows: StatementRow[];
    columns: StatementColumn[];
    issues: Issue[];
    partial: boolean;
    hasHighlights: boolean;
}
export type NumberState = { state: "number"; value: number } | { state: "missing" | "invalid" | "zeroReference" | "ineligible" };
export interface Cell {
    number: NumberState;
    raw: NumberState;
    reference?: NumberState;
    highlight?: NumberState;
    format?: string;
    favorable: "favorable" | "unfavorable" | "neutral";
}

export class ContractError extends Error {
    constructor(public readonly key: string, public readonly detail = "") { super(`${key}: ${detail}`); }
}

function record(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rejectDuplicateProperties(json: string): void {
    const objects: Set<string>[] = [];
    for (let index = 0; index < json.length; index++) {
        const char = json[index];
        if (char === "{") objects.push(new Set());
        else if (char === "}") objects.pop();
        else if (char === '"') {
            const start = index++;
            while (index < json.length && json[index] !== '"') {
                if (json[index] === "\\") index++;
                index++;
            }
            let next = index + 1;
            while (/\s/.test(json[next] ?? "") && next < json.length) next++;
            if (json[next] === ":" && objects.length) {
                const key: string = JSON.parse(json.slice(start, index + 1));
                const keys = objects[objects.length - 1]!;
                if (keys.has(key)) throw new ContractError("Error_DuplicateProperty", key.slice(0, 100));
                keys.add(key);
            }
        }
    }
}

function assertLine(item: unknown, index: number): asserts item is Line {
    const context = `[${index + 1}]`;
    if (!record(item)) throw new ContractError("Error_Metadata", `${context}: object`);
    const allowed = new Set(["id", "label", "order", "type", "unit", "format", "sign", "favorable", "variance"]);
    const errors = Object.keys(item).filter(key => !allowed.has(key)).map(key => `unknown ${key.slice(0, 40)}`);
    if (typeof item.id !== "string" || !item.id.trim() || item.id.length > 100) errors.push("id");
    if (typeof item.label !== "string" || !item.label.trim() || item.label.length > 200) errors.push("label");
    if (typeof item.order !== "number" || !Number.isSafeInteger(item.order)) errors.push("order");
    if (item.type !== "detail" && item.type !== "subtotal" && item.type !== "heading") errors.push("type");
    if (item.unit !== "currency" && item.unit !== "percent" && item.unit !== "number") errors.push("unit");
    if (item.format !== undefined && (typeof item.format !== "string" || !item.format || item.format.length > 100)) errors.push("format");
    if (item.sign !== 1 && item.sign !== -1) errors.push("sign");
    if (item.favorable !== "higher" && item.favorable !== "lower" && item.favorable !== "neutral") errors.push("favorable");
    if (item.variance !== "none" && item.variance !== "absolute" && item.variance !== "both") errors.push("variance");
    if (errors.length) throw new ContractError("Error_Metadata", `${context}${typeof item.id === "string" ? ` ${item.id.slice(0, 100)}` : ""}: ${errors.join(", ")}`);
}

export function parseLines(json: string): Map<string, Line> {
    if (json.length > LIMITS.config) throw new ContractError("Error_ConfigSize");
    let input: unknown;
    try { input = JSON.parse(json); }
    catch (error) {
        if (error instanceof SyntaxError) throw new ContractError("Error_Json", error.message.slice(0, 180));
        throw error;
    }
    if (!Array.isArray(input) || input.length === 0 || input.length > LIMITS.rows) throw new ContractError("Error_ConfigArray");
    rejectDuplicateProperties(json);
    const result = new Map<string, Line>();
    for (const [index, item] of input.entries()) {
        assertLine(item, index);
        if (result.has(item.id)) throw new ContractError("Error_DuplicateMetadata", item.id);
        if ((item.unit === "percent" && item.variance === "both") || (item.type === "heading" && item.variance !== "none")) {
            throw new ContractError("Error_VariancePolicy", item.id);
        }
        result.set(item.id, {
            id: item.id, label: item.label, order: item.order, type: item.type, unit: item.unit,
            format: item.format, sign: item.sign, favorable: item.favorable, variance: item.variance
        });
    }
    return result;
}

function groupValue(node: powerbi.DataViewMatrixNode): powerbi.PrimitiveValue | undefined {
    if (node.levelValues && (node.levelValues.length !== 1 || node.levelValues[0]?.levelSourceIndex !== 0)) {
        throw new ContractError("Error_CompositeGroup");
    }
    return node.levelValues ? node.levelValues[0]?.value : node.value;
}

export function numeric(value: unknown): NumberState {
    if (value === null || value === undefined) return { state: "missing" };
    return typeof value === "number" && Number.isFinite(value)
        ? { state: "number", value: Object.is(value, -0) ? 0 : value } : { state: "invalid" };
}

function signed(value: NumberState, sign: 1 | -1): NumberState {
    return value.state === "number" ? numeric(value.value * sign) : value;
}

function cellFormat(value: powerbi.DataViewMatrixNodeValue | undefined): string | undefined {
    const format = value?.objects?.general?.formatString;
    return typeof format === "string" ? format : undefined;
}

export function getCell(row: StatementRow, column: StatementColumn): Cell {
    const source = row.values?.[column.slot];
    const raw = numeric(source?.value);
    const display = signed(raw, row.line.sign);
    const cell: Cell = { number: display, raw, format: row.line.format ?? cellFormat(source) ?? column.source.format, favorable: "neutral" };
    if (row.line.type === "heading") return { ...cell, number: { state: "ineligible" } };
    if (column.kind === "value") {
        if (source && Object.hasOwn(source, "highlight")) cell.highlight = signed(numeric(source.highlight), row.line.sign);
        return cell;
    }
    if (row.line.variance === "none" || (column.kind === "relative" && row.line.variance !== "both")) {
        return { ...cell, number: { state: "ineligible" } };
    }
    const actual = signed(numeric(column.actualSlot === undefined ? undefined : row.values?.[column.actualSlot]?.value), row.line.sign);
    cell.reference = display;
    if (actual.state === "invalid" || display.state === "invalid") return { ...cell, number: { state: "invalid" } };
    if (actual.state !== "number" || display.state !== "number") return { ...cell, number: { state: "missing" } };
    const delta = actual.value - display.value;
    cell.number = column.kind === "relative"
        ? display.value === 0 ? { state: "zeroReference" } : numeric(delta / Math.abs(display.value))
        : numeric(row.line.unit === "percent" ? delta * 100 : delta);
    const favor = row.line.favorable === "lower" ? -delta : delta;
    if (cell.number.state === "number") {
        cell.favorable = row.line.favorable === "neutral" || delta === 0 ? "neutral" : favor > 0 ? "favorable" : "unfavorable";
    }
    cell.format = column.kind === "relative" ? "0.0%;(0.0%);0.0%"
        : row.line.unit === "percent" ? '0.0" pp";(0.0" pp");0.0" pp"' : cell.format;
    return cell;
}

function suppliedValues(node: powerbi.DataViewMatrixNode, subtotal: powerbi.DataViewMatrixNode | undefined, id: string): StatementRow["values"] {
    if (!subtotal?.values) return node.values;
    const values = { ...subtotal.values };
    for (const [slot, primary] of Object.entries(node.values ?? {})) {
        const secondary = values[Number(slot)];
        if (secondary && (numeric(primary.value).state !== numeric(secondary.value).state
            || (primary.value !== null && primary.value !== undefined && primary.value !== secondary.value && !Object.is(primary.value, secondary.value))
            || (primary.valueSourceIndex ?? 0) !== (secondary.valueSourceIndex ?? 0)
            || (primary.highlight !== undefined && secondary.highlight !== undefined && !Object.is(primary.highlight, secondary.highlight)))) {
            throw new ContractError("Error_Subtotals", id);
        }
        values[Number(slot)] = { ...secondary, ...primary };
    }
    return values;
}

export function visibleRows(rows: StatementRow[], collapsed: ReadonlySet<string>): StatementRow[] {
    const hidden = new Set<string>();
    return rows.filter(row => {
        if (row.parent && (collapsed.has(row.parent) || hidden.has(row.parent))) {
            hidden.add(row.line.id);
            return false;
        }
        return true;
    });
}

export function convert(dataView: powerbi.DataView | undefined, lines: Map<string, Line>, variances: boolean, locale = "en-US"): Statement {
    const matrix = dataView?.matrix;
    const result: Statement = { rows: [], columns: [], issues: [], partial: !!dataView?.metadata.segment, hasHighlights: false };
    if (!matrix || !matrix.rows.root.children?.length) {
        result.issues.push({ key: "Status_Empty" });
        return result;
    }
    if (matrix.rows.levels.length < 1 || matrix.rows.levels.length > 6
        || matrix.rows.levels.some(level => level.sources.length !== 1 || !level.sources[0]?.roles?.Lines)) {
        throw new ContractError("Error_RowRoles");
    }
    const scenarios = new Map<Scenario, number>();
    const measureNames = new Set<string>();
    const roles: Scenario[] = ["Actual", "Budget", "Prior"];
    matrix.valueSources.forEach((source, index) => {
        const matches = roles.filter(role => source.roles?.[role]);
        const role = matches[0];
        if (matches.length !== 1 || !role || scenarios.has(role) || !source.queryName || measureNames.has(source.queryName)) throw new ContractError("Error_Measures");
        scenarios.set(role, index);
        measureNames.add(source.queryName);
    });
    if (!scenarios.has("Actual")) throw new ContractError("Error_Measures");
    const periods: { key: string; label: string; path: powerbi.DataViewMatrixNode[]; slots: Map<number, number> }[] = [];
    const periodKeys = new Set<string>();
    const columnLevels = matrix.columns.levels;
    const periodLevels = columnLevels.filter(level => level.sources.some(source => source.roles?.Period));
    if (periodLevels.length > 1 || periodLevels.some(level => level.sources.length !== 1)) throw new ContractError("Error_PeriodRoles");
    let slot = 0;
    let periodOverflow = false;
    const addPeriod = (node: powerbi.DataViewMatrixNode, path: powerbi.DataViewMatrixNode[], label: string) => {
        const value = path.length ? groupValue(node) : undefined;
        const key = path.length ? JSON.stringify([typeof value, value]) : "all";
        if (periodKeys.has(key)) throw new ContractError("Error_Columns");
        periodKeys.add(key);
        const slots = new Map<number, number>();
        // Desktop omits a measure hierarchy beneath a period group. In that shape,
        // valueSources remain in projection order and the row cells retain their source indexes.
        if (!node.children?.length) {
            matrix.valueSources.forEach((_, sourceIndex) => slots.set(sourceIndex, slot++));
        }
        const leaves = node.children ?? [];
        for (const leaf of leaves) {
            if (leaf.children?.length) throw new ContractError("Error_PeriodRoles");
            const sourceIndex = leaf.levelSourceIndex ?? 0;
            if (sourceIndex >= matrix.valueSources.length || slots.has(sourceIndex)) throw new ContractError("Error_Columns");
            slots.set(sourceIndex, slot++);
        }
        if (periods.length < LIMITS.periods) periods.push({ key, label, path, slots });
        else periodOverflow = true;
    };
    if (periodLevels.length) {
        const nodes = matrix.columns.root.children ?? [];
        // Count one extra period to disclose a reduction boundary without traversing an unbounded input.
        for (const node of nodes.slice(0, LIMITS.periods + 1)) {
            if (node.isSubtotal) {
                slot += node.children?.length || matrix.valueSources.length;
                continue;
            }
            const value = groupValue(node);
            const label = value instanceof Date ? value.toLocaleDateString(locale) : String(value ?? "");
            addPeriod(node, [node], label);
        }
        if (nodes.length > LIMITS.periods) periodOverflow = true;
    } else {
        const children = matrix.columns.root.children;
        if (children?.length) addPeriod(matrix.columns.root, [], "");
        else {
            periods.push({ key: "all", label: "", path: [], slots: new Map(matrix.valueSources.map((_, index) => [index, index])) });
        }
    }
    if (!periods.length) throw new ContractError("Error_Columns");
    periods.forEach(period => {
        for (const scenario of roles) {
            const index = scenarios.get(scenario);
            if (index === undefined) continue;
            const source = matrix.valueSources[index];
            const valueSlot = period.slots.get(index);
            if (!source || valueSlot === undefined) throw new ContractError("Error_Columns");
            const base: StatementColumn = { key: `${period.key}:${scenario}`, period: period.label, path: period.path, scenario, kind: "value", slot: valueSlot, source };
            result.columns.push(base);
        }
        if (variances) for (const scenario of ["Budget", "Prior"] as const) {
            const base = result.columns.find(column => column.key === `${period.key}:${scenario}`);
            if (!base) continue;
            const actualSlot = period.slots.get(scenarios.get("Actual") ?? 0);
            result.columns.push({ ...base, key: `${base.key}:absolute`, kind: "absolute", actualSlot });
            result.columns.push({ ...base, key: `${base.key}:relative`, kind: "relative", actualSlot });
        }
    });
    const maxRows = Math.min(LIMITS.rows, Math.floor(LIMITS.cells / result.columns.length));
    const seen = new Set<string>();
    let visited = 0;
    const visit = (nodes: powerbi.DataViewMatrixNode[], path: powerbi.DataViewMatrixNode[], parent?: string) => {
        if (path.length >= 6) {
            if (nodes.some(node => !node.isSubtotal)) throw new ContractError("Error_RowRoles");
            return;
        }
        const siblings: { node: powerbi.DataViewMatrixNode; line: Line }[] = [];
        const orders = new Set<number>();
        for (const node of nodes) {
            if (++visited > LIMITS.rows * 2 + 1) { result.partial = true; break; }
            if (node.isSubtotal) continue;
            if (seen.size >= LIMITS.rows) { result.partial = true; break; }
            const id = groupValue(node);
            if (typeof id !== "string" || !id || node.level !== path.length) throw new ContractError("Error_LineId");
            const line = lines.get(id);
            if (!line) throw new ContractError("Error_MissingMetadata", id.slice(0, 100));
            if (seen.has(id)) throw new ContractError("Error_RepeatedLine", id);
            if (orders.has(line.order)) throw new ContractError("Error_Order", id);
            seen.add(id);
            orders.add(line.order);
            siblings.push({ node, line });
        }
        siblings.sort((a, b) => a.line.order - b.line.order);
        for (const { node, line } of siblings) {
            if (result.rows.length >= maxRows) { result.partial = true; break; }
            const subtotals = node.children?.filter(child => child.isSubtotal) ?? [];
            if (subtotals.length > 1) throw new ContractError("Error_Subtotals", line.id);
            // A subtotal child represents the host's aggregate for this parent, never a new report line.
            const values = suppliedValues(node, subtotals[0], line.id);
            const nextPath = [...path, node];
            const hasChildren = !!node.children?.some(child => !child.isSubtotal);
            if (node.isCollapsed && !result.issues.some(issue => issue.key === "Status_HostCollapsed")) result.issues.push({ key: "Status_HostCollapsed" });
            for (const column of result.columns) {
                const value = values?.[column.slot];
                const expectedSource = scenarios.get(column.scenario);
                if (value && (value.valueSourceIndex ?? 0) !== expectedSource) throw new ContractError("Error_Columns");
                if (value && Object.hasOwn(value, "highlight")) result.hasHighlights = true;
            }
            result.rows.push({ node, line, path: nextPath, depth: path.length, parent, hasChildren, values });
            if (node.children) visit(node.children, nextPath, line.id);
        }
    };
    visit(matrix.rows.root.children, []);
    if (periodOverflow) result.partial = true;
    if (result.partial) result.issues.push({ key: "Status_Partial" });
    if (matrix.rows.root.values || matrix.rows.root.children.some(node => node.isSubtotal)) result.issues.push({ key: "Status_GrandTotal" });
    return result;
}
