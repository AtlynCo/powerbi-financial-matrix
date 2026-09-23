import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import { valueFormatter } from "powerbi-visuals-utils-formattingutils";
import { Cell, ContractError, convert, getCell, NumberState, parseLines, Statement, StatementColumn, StatementRow, visibleRows } from "./model";
import { Settings } from "./settings";
import "../style/visual.less";

type Host = powerbi.extensibility.visual.IVisualHost;
type SelectionId = powerbi.visuals.ISelectionId;
type Update = powerbi.extensibility.visual.VisualUpdateOptions;
type CellElement = { element: HTMLTableCellElement; row: StatementRow; column?: StatementColumn; rowIndex: number; columnIndex: number };
const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 64;
const OVERSCAN = 4;
const EXAMPLE = JSON.stringify([{
    id: "revenue", label: "Revenue", order: 10, type: "subtotal", unit: "currency",
    format: "$#,0;($#,0);$0", sign: 1, favorable: "higher", variance: "both"
}], null, 2);

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

export class Visual implements powerbi.extensibility.visual.IVisual {
    private readonly host: Host;
    private readonly element: HTMLElement;
    private readonly root: HTMLDivElement;
    private readonly status: HTMLDivElement;
    private readonly scroll: HTMLDivElement;
    private readonly footer: HTMLDivElement;
    private readonly selection: powerbi.extensibility.ISelectionManager;
    private readonly localization: powerbi.extensibility.ILocalizationManager;
    private readonly formatting: FormattingSettingsService;
    private readonly onContextMenu: (event: MouseEvent) => void;
    private settings = new Settings();
    private statement: Statement = { rows: [], columns: [], issues: [], partial: false, hasHighlights: false };
    private displayRows: StatementRow[] = [];
    private collapsed = new Set<string>();
    private cells: CellElement[] = [];
    private identityCache = new Map<string, SelectionId>();
    private formatCache = new Map<string, valueFormatter.IValueFormatter>();
    private focused = { id: "", column: "" };
    private activeElement?: HTMLElement;
    private selectionIds: SelectionId[] = [];
    private levels: { rows: powerbi.DataViewHierarchyLevel[]; columns: powerbi.DataViewHierarchyLevel[] } = { rows: [], columns: [] };
    private body?: HTMLTableSectionElement;
    private windowKey = "";
    private frame = 0;
    private disposed = false;
    private tooltipTouch = false;
    private mode: "grid" | "small" | "setup" = "setup";
    private width = 0;
    private height = 0;
    private labelWidth = 280;
    private savedScroll = { top: 0, left: 0 };

    constructor(options?: powerbi.extensibility.visual.VisualConstructorOptions) {
        if (!options) throw new Error("Visual constructor requires host options.");
        this.host = options.host;
        this.selection = this.host.createSelectionManager();
        this.localization = this.host.createLocalizationManager();
        this.formatting = new FormattingSettingsService(this.localization);
        this.root = element("div", "afm");
        this.status = element("div", "afm-status");
        this.status.setAttribute("role", "status");
        this.status.setAttribute("aria-live", "polite");
        this.scroll = element("div", "afm-scroll");
        this.footer = element("div", "afm-footer");
        this.root.append(this.status, this.scroll, this.footer);
        this.element = options.element;
        this.element.append(this.root);
        this.selection.registerOnSelectCallback(ids => {
            if (!this.disposed) { this.setSelectionIds(ids); this.applySelection(); }
        });
        this.onContextMenu = (event: MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();
            if (this.host.hostCapabilities.allowInteractions === false) return;
            this.selection.showContextMenu({}, { x: event.clientX, y: event.clientY });
        };
        this.root.addEventListener("contextmenu", this.onContextMenu);
        this.element.addEventListener("contextmenu", this.onContextMenu);
        this.scroll.addEventListener("scroll", () => {
            this.hideTooltip();
            if (this.mode !== "grid") return;
            this.savedScroll = { top: this.scroll.scrollTop, left: this.scroll.scrollLeft };
            if (!this.frame) this.frame = requestAnimationFrame(() => {
                this.frame = 0;
                if (!this.disposed) this.renderWindow();
            });
        }, { passive: true });
    }

    private t(key: string): string { return this.localization.getDisplayName(key) || key; }

    public update(options: Update): void {
        if (this.disposed) return;
        this.host.eventService.renderingStarted(options);
        try {
            this.width = Number.isFinite(options.viewport.width) ? Math.max(0, options.viewport.width) : 0;
            this.height = Number.isFinite(options.viewport.height) ? Math.max(0, options.viewport.height) : 0;
            this.root.style.width = `${this.width}px`;
            this.root.style.height = `${this.height}px`;
            this.root.style.setProperty("--afm-viewport-width", `${this.width}px`);
            this.labelWidth = Math.max(96, Math.min(280, Math.floor(this.width * 0.4)));
            this.root.style.setProperty("--afm-label-width", `${this.labelWidth}px`);
            this.root.classList.toggle("afm-compact", this.width < 500 || this.height < 300);
            const dataView = options.dataViews?.[0];
            this.levels = { rows: dataView?.matrix?.rows.levels ?? [], columns: dataView?.matrix?.columns.levels ?? [] };
            this.settings = dataView ? this.formatting.populateFormattingSettingsModel(Settings, dataView) : new Settings();
            this.root.dir = this.settings.statement.direction.value ? "rtl" : "ltr";
            const palette = this.host.colorPalette;
            this.root.classList.toggle("afm-high-contrast", palette.isHighContrast);
            const colors = {
                fg: palette.isHighContrast ? palette.foreground.value : "#192d3d",
                bg: palette.isHighContrast ? palette.background.value : "#ffffff",
                selected: palette.isHighContrast ? palette.background.value : "#e5f0f8",
                accent: palette.isHighContrast ? palette.foregroundSelected.value : "#176b99",
                muted: palette.isHighContrast ? palette.foreground.value : "#536573",
                line: palette.isHighContrast ? palette.foreground.value : "#d8e0e6",
                band: palette.isHighContrast ? palette.background.value : "#f3f6f8",
                good: palette.isHighContrast ? palette.foreground.value : "#18613d",
                bad: palette.isHighContrast ? palette.foreground.value : "#9d2525"
            };
            for (const [name, color] of Object.entries(colors)) this.root.style.setProperty(`--afm-${name}`, color);
            this.identityCache.clear();
            this.formatCache.clear();
            this.hideTooltip();
            const columnLevels = dataView?.matrix?.columns?.levels ?? [];
            const periodLevels = columnLevels.filter(level => level.sources?.some(source => source.roles?.Period));
            const hasLines = Boolean(dataView?.matrix?.rows?.root?.children?.some(n => !n.isSubtotal) && dataView?.matrix?.rows?.levels?.some(l => l.sources?.some(s => s.roles?.Lines)));
            const hasActual = Boolean(dataView?.matrix?.valueSources?.some(s => s.roles?.Actual));
            const hasPeriodWhenMapped = !periodLevels.length || Boolean(dataView?.matrix?.columns?.root?.children?.some(n => !n.isSubtotal));
            if (!hasLines || !hasActual || !hasPeriodWhenMapped) {
                this.statement = { rows: [], columns: [], issues: [], partial: false, hasHighlights: false };
                this.displayRows = [];
                this.render();
                this.host.eventService.renderingFinished(options);
                return;
            }
            const lines = dataView?.matrix?.rows.root.children?.length ? parseLines(this.settings.statement.lines.value) : new Map();
            this.statement = convert(dataView, lines, this.settings.statement.variances.value, this.host.locale);
            const currentIds = new Set(this.statement.rows.map(row => row.line.id));
            this.collapsed = new Set([...this.collapsed].filter(id => currentIds.has(id)));
            this.setSelectionIds(this.selection.getSelectionIds());
            this.render();
            this.host.eventService.renderingFinished(options);
        } catch (error) {
            this.statement = { rows: [], columns: [], issues: [], partial: false, hasHighlights: false };
            this.showSetup(error instanceof ContractError
                ? `${this.t(error.key)}${error.detail ? ` (${error.detail})` : ""}` : this.t("Error_Render"), true);
            this.host.eventService.renderingFailed(options, error instanceof ContractError ? error.key : "Render failure");
            if (!(error instanceof ContractError)) console.error("Atlyn Financial Matrix rendering failed", error);
        }
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formatting.buildFormattingModel(this.settings);
    }

    private columnLabel(column: StatementColumn, includePeriod = true): string {
        const scenario = this.t(`Role_${column.scenario}`);
        const label = column.kind === "value" ? scenario
            : `${this.t("Column_Versus")} ${scenario} ${column.kind === "relative" ? "%" : this.t("Column_Absolute")}`;
        return includePeriod && column.period ? `${column.period} | ${label}` : label;
    }

    private numberText(state: NumberState, format?: string): string {
        if (state.state !== "number") {
            return state.state === "ineligible" ? "" : state.state === "missing" ? "-" : state.state === "zeroReference" ? this.t("Value_NA") : "!";
        }
        const pattern = format ?? "#,0.##;(#,0.##);0";
        let formatter = this.formatCache.get(pattern);
        if (!formatter) {
            // Statement formats must not inherit chart-axis scientific/display-unit fallbacks.
            formatter = valueFormatter.createDefaultFormatter(pattern, false, this.host.locale);
            this.formatCache.set(pattern, formatter);
        }
        return formatter.format(state.value);
    }

    private description(row: StatementRow, column: StatementColumn, cell: Cell, text = this.numberText(cell.number, cell.format)): string {
        const pieces = [row.line.label, this.columnLabel(column), text];
        if (cell.number.state !== "number") pieces.push(this.t(`Value_${cell.number.state}`));
        if (column.kind !== "value") {
            if (cell.number.state === "number") pieces.push(this.t(cell.favorable === "favorable" ? "Value_Favorable" : cell.favorable === "unfavorable" ? "Value_Unfavorable" : "Value_Neutral"));
            pieces.push(this.t(column.kind === "relative" ? "Formula_Relative" : row.line.unit === "percent" ? "Formula_Points" : "Formula_Absolute"));
        }
        if (column.kind === "value" && this.statement.hasHighlights && row.line.type !== "heading") {
            pieces.push(`${this.t("Value_Highlight")}: ${this.numberText(cell.highlight ?? { state: "missing" }, cell.format)}`);
        }
        return pieces.join("; ");
    }

    private showSetup(message?: string, error = false): void {
        this.mode = "setup";
        this.root.dataset.mode = this.mode;
        this.body = undefined;
        this.cells = [];
        this.displayRows = [];
        this.footer.replaceChildren();
        this.status.hidden = !message;
        this.status.textContent = message ?? "";
        this.status.setAttribute("role", error ? "alert" : "status");
        this.status.tabIndex = message ? 0 : -1;
        const panel = element("div", "afm-setup");
        panel.append(element("h2", "", this.t("Setup_Title")));
        const steps = element("ol", "afm-steps");
        for (const key of ["Setup_Fields", "Setup_Metadata", "Setup_Model"]) steps.append(element("li", "", this.t(key)));
        panel.append(steps);
        const details = element("details", "afm-example");
        details.append(element("summary", "", this.t("Setup_Example")));
        const example = element("textarea", "");
        example.value = EXAMPLE;
        example.readOnly = true;
        example.spellcheck = false;
        example.setAttribute("aria-label", this.t("Setting_Lines"));
        details.append(element("p", "", this.t("Setup_ExampleNote")), example);
        panel.append(details);
        this.scroll.replaceChildren(panel);
    }

    private render(): void {
        const hadFocus = this.scroll.contains(document.activeElement);
        if (!this.statement.rows.length) {
            this.showSetup();
            return;
        }
        this.displayRows = visibleRows(this.statement.rows, this.collapsed);
        this.status.setAttribute("role", "status");
        this.status.textContent = this.statement.issues.map(issue => this.t(issue.key)).join(" ");
        this.status.hidden = !this.status.textContent;
        this.status.tabIndex = this.status.hidden ? -1 : 0;
        if (this.width < 256 || this.height < 160) {
            this.mode = "small";
            this.root.dataset.mode = this.mode;
            this.body = undefined;
            this.cells = [];
            this.footer.replaceChildren();
            const small = element("div", "afm-small");
            small.append(element("span", "", this.t("Status_EnlargeShort")), element("span", "afm-minimum", "256 x 160"));
            small.setAttribute("role", "status");
            small.setAttribute("aria-label", this.t("Status_Enlarge"));
            small.title = this.t("Status_Enlarge");
            small.tabIndex = 0;
            this.scroll.replaceChildren(small);
            return;
        }
        this.mode = "grid";
        this.root.dataset.mode = this.mode;
        this.renderFooter();
        const table = element("table", "afm-table");
        const labelWidth = this.labelWidth;
        table.style.width = `${labelWidth + this.statement.columns.length * 136}px`;
        const colgroup = element("colgroup", "");
        for (const width of [labelWidth, ...this.statement.columns.map(() => 136)]) {
            const column = element("col", "");
            column.style.width = `${width}px`;
            colgroup.append(column);
        }
        table.append(colgroup);
        table.setAttribute("role", "grid");
        table.setAttribute("aria-label", this.t("Grid_Label"));
        table.setAttribute("aria-rowcount", String(this.displayRows.length + 2));
        table.setAttribute("aria-colcount", String(this.statement.columns.length + 1));
        table.setAttribute("aria-multiselectable", "true");
        const group = table.createTHead().insertRow();
        group.className = "afm-period-row";
        group.setAttribute("role", "row");
        group.setAttribute("aria-rowindex", "1");
        const corner = element("th", "afm-corner", this.t("Column_Line"));
        corner.rowSpan = 2;
        corner.scope = "col";
        corner.setAttribute("role", "columnheader");
        group.append(corner);
        let periodHeader: HTMLTableCellElement | undefined;
        let periodKey: string | undefined;
        for (const column of this.statement.columns) {
            const key = column.key.substring(0, column.key.lastIndexOf(`:${column.scenario}`));
            if (key !== periodKey) {
                periodHeader = element("th", "afm-period");
                periodHeader.scope = "colgroup";
                periodHeader.setAttribute("role", "columnheader");
                periodHeader.title = column.period || this.t("Column_CurrentContext");
                periodHeader.append(element("span", "", column.period || this.t("Column_CurrentContext")));
                group.append(periodHeader);
                periodKey = key;
            } else if (periodHeader) periodHeader.colSpan++;
        }
        const head = table.tHead!.insertRow();
        head.className = "afm-scenario-row";
        head.setAttribute("role", "row");
        head.setAttribute("aria-rowindex", "2");
        for (const column of this.statement.columns) {
            const th = element("th", "afm-column", this.columnLabel(column, false));
            th.scope = "col";
            th.setAttribute("role", "columnheader");
            th.title = this.columnLabel(column);
            if (column.kind === "absolute") th.title += `; ${this.t("Column_AbsoluteHelp")}`;
            head.append(th);
        }
        this.body = table.createTBody();
        this.scroll.replaceChildren(table);
        this.windowKey = "";
        this.renderWindow(true, this.savedScroll.top, hadFocus);
        this.scroll.scrollTop = this.savedScroll.top;
        this.scroll.scrollLeft = this.savedScroll.left;
    }

    private renderFooter(): void {
        this.footer.replaceChildren();
        const count = element("span", "afm-count", `${this.displayRows.length}/${this.statement.rows.length} ${this.t("Status_Rows")}`);
        count.title = this.t("Status_CountHelp");
        this.footer.append(count, element("span", "afm-export", this.t("Status_ViewportShort")));
        const help = element("details", "afm-help");
        help.append(element("summary", "", this.t("Action_Help")));
        const contents = element("div", "afm-help-content");
        contents.append(element("p", "", this.t("Status_Legend")), element("p", "", this.t("Column_AbsoluteHelp")), element("p", "", this.t("Status_Viewport")));
        if (this.statement.hasHighlights) contents.append(element("p", "", this.t("Status_Highlights")));
        help.append(contents);
        this.footer.append(help);
    }

    private renderWindow(force = false, position = this.scroll.scrollTop, hasFocus = this.scroll.contains(document.activeElement)): void {
        if (this.mode !== "grid" || !this.body) return;
        const top = Math.max(0, Math.min(position, HEADER_HEIGHT + this.displayRows.length * ROW_HEIGHT - this.scroll.clientHeight));
        const start = Math.max(0, Math.floor(top / ROW_HEIGHT) - OVERSCAN);
        const end = Math.min(this.displayRows.length, Math.ceil((top + this.scroll.clientHeight) / ROW_HEIGHT) + OVERSCAN);
        const focusedRow = this.displayRows.findIndex(row => row.line.id === this.focused.id);
        const keepFocus = hasFocus && focusedRow >= 0 && (focusedRow < start || focusedRow >= end) ? focusedRow : -1;
        const key = `${start}:${end}:${keepFocus}`;
        if (!force && this.windowKey === key) return;
        this.windowKey = key;
        const indexes = new Set(Array.from({ length: Math.max(0, end - start) }, (_, index) => start + index));
        if (keepFocus >= 0) indexes.add(keepFocus);
        const rows = [...indexes].sort((a, b) => a - b);
        const fragment = document.createDocumentFragment();
        this.cells = [];
        let previous = 0;
        const spacer = (count: number) => {
            if (count <= 0) return;
            const row = element("tr", "afm-spacer");
            row.setAttribute("aria-hidden", "true");
            row.setAttribute("role", "presentation");
            const cell = row.insertCell();
            cell.colSpan = this.statement.columns.length + 1;
            cell.style.height = `${count * ROW_HEIGHT}px`;
            fragment.append(row);
        };
        for (const index of rows) {
            spacer(index - previous);
            fragment.append(this.renderRow(this.displayRows[index]!, index));
            previous = index + 1;
        }
        spacer(this.displayRows.length - previous);
        this.body.replaceChildren(fragment);
        this.activeElement = undefined;
        const active = this.cells.find(cell => cell.row.line.id === this.focused.id && (cell.column?.key ?? "") === this.focused.column) ?? this.cells[0];
        if (active) {
            active.element.tabIndex = 0;
            this.activeElement = active.element;
            if (hasFocus) active.element.focus({ preventScroll: true });
        }
        this.applySelection();
    }

    private renderRow(row: StatementRow, rowIndex: number): HTMLTableRowElement {
        const tr = element("tr", `afm-row afm-${row.line.type}`);
        tr.dataset.lineId = row.line.id;
        tr.setAttribute("role", "row");
        tr.setAttribute("aria-rowindex", String(rowIndex + 3));
        const th = element("th", "afm-row-header");
        th.scope = "row";
        th.setAttribute("role", "rowheader");
        th.title = `${row.line.label} (${row.line.id})`;
        const wrap = element("span", "afm-row-label");
        wrap.style.paddingInlineStart = `${Math.min(row.depth * 14, this.labelWidth * 0.4)}px`;
        if (row.hasChildren) {
            const toggle = element("button", "afm-toggle", this.collapsed.has(row.line.id) ? "+" : "-");
            toggle.tabIndex = -1;
            toggle.setAttribute("aria-label", `${this.t(this.collapsed.has(row.line.id) ? "Action_Expand" : "Action_Collapse")} ${row.line.label}`);
            th.setAttribute("aria-expanded", String(!this.collapsed.has(row.line.id)));
            toggle.setAttribute("aria-expanded", String(!this.collapsed.has(row.line.id)));
            toggle.addEventListener("click", event => { event.stopPropagation(); this.toggle(row); });
            wrap.append(toggle);
        }
        wrap.append(element("span", "afm-label", row.line.label));
        th.append(wrap);
        tr.append(th);
        this.wireCell({ element: th, row, rowIndex, columnIndex: 0 });
        this.statement.columns.forEach((column, columnIndex) => {
            const cell = getCell(row, column);
            const td = element("td", `afm-cell afm-${cell.favorable}`);
            const text = this.numberText(cell.number, cell.format);
            const description = this.description(row, column, cell, text);
            td.setAttribute("role", "gridcell");
            td.setAttribute("aria-label", description);
            td.dataset.columnKey = column.key;
            td.dataset.state = cell.number.state;
            const flag = column.kind !== "value" && cell.number.state === "number" && cell.favorable !== "neutral"
                ? this.t(cell.favorable === "favorable" ? "Mark_Favorable" : "Mark_Unfavorable") : "";
            if (flag) {
                const mark = element("span", "afm-mark", flag);
                mark.setAttribute("aria-hidden", "true");
                td.append(mark, document.createTextNode(" "));
            }
            td.append(element("span", "afm-value", text));
            if (column.kind === "value" && this.statement.hasHighlights && row.line.type !== "heading") {
                const value = cell.highlight ?? { state: "missing" };
                td.append(element("span", "afm-highlight", `${this.t("Mark_Highlight")}: ${this.numberText(value, cell.format)}`));
                td.classList.toggle("afm-not-highlighted", value.state !== "number");
            }
            td.title = description;
            tr.append(td);
            this.wireCell({ element: td, row, column, rowIndex, columnIndex: columnIndex + 1 });
        });
        return tr;
    }

    private identity(row: StatementRow, column?: StatementColumn): SelectionId | undefined {
        if (row.path.some(node => !node.identity) || column?.path.some(node => !node.identity)) return undefined;
        const key = JSON.stringify([row.line.id, column?.key ?? null]);
        const existing = this.identityCache.get(key);
        if (existing) return existing;
        const builder = this.host.createSelectionIdBuilder();
        for (const node of row.path) builder.withMatrixNode(node, this.levels.rows);
        if (column) {
            for (const node of column.path) builder.withMatrixNode(node, this.levels.columns);
            if (column.kind === "value" && column.source.queryName) builder.withMeasure(column.source.queryName);
        }
        const id = builder.createSelectionId();
        this.identityCache.set(key, id);
        return id;
    }

    private wireCell(cell: CellElement): void {
        const target = cell.element;
        target.tabIndex = -1;
        target.setAttribute("aria-colindex", String(cell.columnIndex + 1));
        target.addEventListener("focus", () => {
            if (this.activeElement) this.activeElement.tabIndex = -1;
            target.tabIndex = 0;
            this.activeElement = target;
            this.focused = { id: cell.row.line.id, column: cell.column?.key ?? "" };
        });
        target.addEventListener("click", event => { target.focus({ preventScroll: true }); this.select(cell, event.ctrlKey || event.metaKey); });
        target.addEventListener("keydown", event => this.keydown(event, cell));
        target.addEventListener("contextmenu", event => { event.preventDefault(); event.stopPropagation(); this.contextMenu(cell, event.clientX, event.clientY); });
        target.addEventListener("pointerenter", event => { if (event.pointerType !== "touch") this.showTooltip(event, cell); });
        target.addEventListener("pointerleave", () => this.hideTooltip());
        let touchStart: { x: number; y: number } | undefined;
        target.addEventListener("pointerdown", event => { if (event.pointerType === "touch") touchStart = { x: event.clientX, y: event.clientY }; });
        target.addEventListener("pointerup", event => {
            if (event.pointerType === "touch" && touchStart && Math.hypot(event.clientX - touchStart.x, event.clientY - touchStart.y) < 8) this.showTooltip(event, cell);
            touchStart = undefined;
        });
        target.addEventListener("pointercancel", () => { touchStart = undefined; this.hideTooltip(); });
        this.cells.push(cell);
    }

    private toggle(row: StatementRow, collapse?: boolean): void {
        if (!row.hasChildren) return;
        if (collapse ?? !this.collapsed.has(row.line.id)) this.collapsed.add(row.line.id);
        else this.collapsed.delete(row.line.id);
        this.focused = { id: row.line.id, column: "" };
        this.render();
        this.cells.find(cell => cell.row.line.id === row.line.id && !cell.column)?.element.focus({ preventScroll: true });
    }

    private keydown(event: KeyboardEvent, cell: CellElement): void {
        let row = cell.rowIndex;
        let column = cell.columnIndex;
        const direction = this.root.dir === "rtl" ? -1 : 1;
        const page = Math.max(1, Math.floor((this.scroll.clientHeight - HEADER_HEIGHT) / ROW_HEIGHT));
        const maxRow = Math.max(0, this.displayRows.length - 1);
        switch (event.key) {
            case "ArrowDown": row++; break;
            case "ArrowUp": row--; break;
            case "ArrowRight": column += direction; break;
            case "ArrowLeft": column -= direction; break;
            case "Home": column = 0; if (event.ctrlKey || event.metaKey) row = 0; break;
            case "End": column = this.statement.columns.length; if (event.ctrlKey || event.metaKey) row = maxRow; break;
            case "PageDown": row += page; break;
            case "PageUp": row -= page; break;
            case "Enter": case " ": event.preventDefault(); this.select(cell, event.ctrlKey || event.metaKey); return;
            case "Escape":
                event.preventDefault();
                if (this.host.hostCapabilities.allowInteractions !== false) this.runInteraction(this.selection.clear());
                return;
            case "+": case "-": event.preventDefault(); this.toggle(cell.row, event.key === "-"); return;
            case "F10":
                if (!event.shiftKey) return;
                event.preventDefault();
                this.contextMenu(cell, cell.element.getBoundingClientRect().x, cell.element.getBoundingClientRect().bottom);
                return;
            case "ContextMenu":
                event.preventDefault();
                this.contextMenu(cell, cell.element.getBoundingClientRect().x, cell.element.getBoundingClientRect().bottom);
                return;
            default: return;
        }
        event.preventDefault();
        row = Math.max(0, Math.min(maxRow, row));
        column = Math.max(0, Math.min(this.statement.columns.length, column));
        let next = this.cells.find(candidate => candidate.rowIndex === row && candidate.columnIndex === column);
        if (!next) {
            const target = this.displayRows[row];
            if (!target) return;
            this.focused = { id: target.line.id, column: this.statement.columns[column - 1]?.key ?? "" };
            this.scroll.scrollTop = row * ROW_HEIGHT;
            this.renderWindow(true);
            next = this.cells.find(candidate => candidate.rowIndex === row && candidate.columnIndex === column);
        }
        if (next) { next.element.focus({ preventScroll: true }); this.reveal(next.element, column === 0); }
    }

    private reveal(target: HTMLElement, isHeader: boolean): void {
        const viewport = this.scroll.getBoundingClientRect();
        const box = target.getBoundingClientRect();
        const headerHeight = this.scroll.querySelector("thead")?.getBoundingClientRect().height ?? HEADER_HEIGHT;
        const labelWidth = this.scroll.querySelector(".afm-row-header")?.getBoundingClientRect().width ?? 112;
        if (box.top < viewport.top + headerHeight) this.scroll.scrollTop -= viewport.top + headerHeight - box.top;
        else if (box.bottom > viewport.bottom) this.scroll.scrollTop += box.bottom - viewport.bottom;
        if (!isHeader) {
            const start = viewport.left + (this.root.dir === "rtl" ? 0 : labelWidth);
            const end = viewport.left + this.scroll.clientWidth - (this.root.dir === "rtl" ? labelWidth : 0);
            if (box.left < start) this.scroll.scrollLeft -= start - box.left;
            else if (box.right > end) this.scroll.scrollLeft += box.right - end;
        }
    }

    private select(cell: CellElement, multi: boolean): void {
        if (this.host.hostCapabilities.allowInteractions === false) return;
        const id = this.identity(cell.row, cell.column);
        if (!id?.hasIdentity()) { this.interactionError("Error_Identity"); return; }
        this.runInteraction(this.selection.select(id, multi));
    }

    private contextMenu(cell: CellElement, x: number, y: number): void {
        if (this.host.hostCapabilities.allowInteractions === false) return;
        const id = this.identity(cell.row, cell.column);
        if (!id?.hasIdentity()) { this.interactionError("Error_Identity"); return; }
        this.runInteraction(this.selection.showContextMenu(id, { x, y }));
    }

    private runInteraction(promise: powerbi.IPromise<unknown>): void {
        Promise.resolve(promise).then(() => {
            if (!this.disposed) { this.setSelectionIds(this.selection.getSelectionIds()); this.applySelection(); }
        }, () => { if (!this.disposed) this.interactionError("Error_Interaction"); });
    }

    private setSelectionIds(ids: powerbi.extensibility.ISelectionId[]): void {
        const valid = (id: powerbi.extensibility.ISelectionId): id is SelectionId =>
            "includes" in id && typeof id.includes === "function" && "getKey" in id && typeof id.getKey === "function" && "hasIdentity" in id && typeof id.hasIdentity === "function";
        this.selectionIds = ids.filter(valid);
        if (ids.length !== this.selectionIds.length) this.interactionError("Error_Identity");
    }

    private interactionError(key: string): void {
        this.status.hidden = false;
        this.status.tabIndex = 0;
        this.status.setAttribute("role", "alert");
        this.status.textContent = [...this.statement.issues.map(issue => this.t(issue.key)), this.t(key)].join(" ");
    }

    private applySelection(): void {
        for (const cell of this.cells) {
            const identity = this.selectionIds.length ? this.identity(cell.row, cell.column) : undefined;
            const selected = !!identity && this.selectionIds.some(id => id.includes(identity));
            cell.element.classList.toggle("afm-selected-cell", selected);
            cell.element.setAttribute("aria-selected", String(selected));
        }
    }

    private showTooltip(event: PointerEvent, cell: CellElement): void {
        if (!this.host.tooltipService.enabled()) return;
        const items: powerbi.extensibility.VisualTooltipDataItem[] = [{ displayName: this.t("Column_Line"), value: `${cell.row.line.label} (${cell.row.line.id})` }];
        if (cell.column) {
            const value = getCell(cell.row, cell.column);
            items.push({ displayName: this.columnLabel(cell.column), value: this.numberText(value.number, value.format) });
            items.push({ displayName: this.t("Value_Details"), value: this.description(cell.row, cell.column, value) });
            if (cell.column.kind === "value") items.push({ displayName: this.t("Value_Raw"), value: value.raw.state === "number" ? String(value.raw.value) : this.t(`Value_${value.raw.state}`) });
            else if (value.number.state === "number") items.push({ displayName: this.t("Value_Unrounded"), value: String(value.number.value) });
        }
        items.push({ displayName: this.t("Value_Sign"), value: String(cell.row.line.sign) });
        const id = this.identity(cell.row, cell.column);
        this.tooltipTouch = event.pointerType === "touch";
        this.host.tooltipService.show({ coordinates: [event.clientX, event.clientY], isTouchEvent: this.tooltipTouch, dataItems: items, identities: id?.hasIdentity() ? [id] : [] });
    }

    private hideTooltip(): void { this.host.tooltipService.hide({ immediately: true, isTouchEvent: this.tooltipTouch }); }

    public destroy(): void {
        this.disposed = true;
        cancelAnimationFrame(this.frame);
        this.hideTooltip();
        this.element.removeEventListener("contextmenu", this.onContextMenu);
        this.root.removeEventListener("contextmenu", this.onContextMenu);
        this.root.remove();
        this.cells = [];
        this.identityCache.clear();
        this.formatCache.clear();
    }
}
