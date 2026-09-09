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

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

export class Visual implements powerbi.extensibility.visual.IVisual {
    private readonly host: Host;
    private readonly root: HTMLDivElement;
    private readonly status: HTMLDivElement;
    private readonly scroll: HTMLDivElement;
    private readonly footer: HTMLDivElement;
    private readonly selection: powerbi.extensibility.ISelectionManager;
    private readonly localization: powerbi.extensibility.ILocalizationManager;
    private readonly formatting: FormattingSettingsService;
    private settings = new Settings();
    private statement: Statement = { rows: [], columns: [], issues: [], partial: false, hasHighlights: false };
    private collapsed = new Set<string>();
    private cells: CellElement[] = [];
    private identityCache = new Map<string, SelectionId>();
    private formatCache = new Map<string, valueFormatter.IValueFormatter>();
    private focused = { id: "", column: "" };
    private disposed = false;
    private selectionIds: SelectionId[] = [];

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
        options.element.append(this.root);
        this.selection.registerOnSelectCallback(ids => {
            if (!this.disposed) { this.setSelectionIds(ids); this.applySelection(); }
        });
        this.scroll.addEventListener("scroll", () => this.hideTooltip(), { passive: true });
    }

    private t(key: string): string { return this.localization.getDisplayName(key) || key; }

    public update(options: Update): void {
        this.host.eventService.renderingStarted(options);
        try {
            this.root.style.width = `${Math.max(0, options.viewport.width)}px`;
            this.root.style.height = `${Math.max(0, options.viewport.height)}px`;
            const dataView = options.dataViews?.[0];
            this.levels = { rows: dataView?.matrix?.rows.levels ?? [], columns: dataView?.matrix?.columns.levels ?? [] };
            this.settings = dataView ? this.formatting.populateFormattingSettingsModel(Settings, dataView) : new Settings();
            this.root.dir = this.settings.statement.direction.value ? "rtl" : "ltr";
            const palette = this.host.colorPalette;
            this.root.classList.toggle("afm-high-contrast", palette.isHighContrast);
            this.root.style.setProperty("--afm-fg", palette.isHighContrast ? palette.foreground.value : "#192d3d");
            this.root.style.setProperty("--afm-bg", palette.isHighContrast ? palette.background.value : "#ffffff");
            this.root.style.setProperty("--afm-selected", palette.isHighContrast ? palette.background.value : "#e5f0f8");
            this.root.style.setProperty("--afm-accent", palette.isHighContrast ? palette.foregroundSelected.value : "#176b99");
            this.root.style.setProperty("--afm-muted", palette.isHighContrast ? palette.foreground.value : "#566673");
            this.root.style.setProperty("--afm-line", palette.isHighContrast ? palette.foreground.value : "#cbd4dc");
            this.root.style.setProperty("--afm-good", palette.isHighContrast ? palette.foreground.value : "#18613d");
            this.root.style.setProperty("--afm-bad", palette.isHighContrast ? palette.foreground.value : "#9d2525");
            this.identityCache.clear();
            this.formatCache.clear();
            this.hideTooltip();
            const lines = dataView?.matrix?.rows.root.children?.length ? parseLines(this.settings.statement.lines.value) : new Map();
            this.statement = convert(dataView, lines, this.settings.statement.variances.value, this.host.locale);
            const currentIds = new Set(this.statement.rows.map(row => row.line.id));
            this.collapsed = new Set([...this.collapsed].filter(id => currentIds.has(id)));
            this.setSelectionIds(this.selection.getSelectionIds());
            this.render();
            this.host.eventService.renderingFinished(options);
        } catch (error) {
            this.cells = [];
            this.scroll.replaceChildren();
            this.footer.replaceChildren();
            this.status.hidden = false;
            this.status.textContent = error instanceof ContractError
                ? `${this.t(error.key)}${error.detail ? ` (${error.detail})` : ""}` : this.t("Error_Render");
            this.status.setAttribute("role", "alert");
            this.host.eventService.renderingFailed(options, error instanceof ContractError ? error.key : "Render failure");
            // Contract errors are actionable author diagnostics; unexpected failures must remain visible to diagnostics.
            if (!(error instanceof ContractError)) console.error("Atlyn Financial Matrix rendering failed", error);
        }
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formatting.buildFormattingModel(this.settings);
    }

    private columnLabel(column: StatementColumn): string {
        const scenario = this.t(`Role_${column.scenario}`);
        const kind = column.kind === "value" ? "" : ` ${this.t(column.kind === "absolute" ? "Column_Delta" : "Column_Relative")}`;
        return [column.period, `${scenario}${kind}`].filter(Boolean).join(" | ");
    }

    private numberText(state: NumberState, format?: string): string {
        if (state.state !== "number") {
            return state.state === "ineligible" ? "" : state.state === "missing" ? "-" : state.state === "zeroReference" ? this.t("Value_NA") : "!";
        }
        const pattern = format ?? "#,0.##;(#,0.##);0";
        let formatter = this.formatCache.get(pattern);
        if (!formatter) {
            formatter = valueFormatter.create({ format: pattern, value: 0, cultureSelector: this.host.locale, allowFormatBeautification: false });
            this.formatCache.set(pattern, formatter);
        }
        return formatter.format(state.value);
    }

    private description(row: StatementRow, column: StatementColumn, cell: Cell): string {
        const pieces = [row.line.label, this.columnLabel(column), this.numberText(cell.number, cell.format)];
        if (cell.number.state !== "number") pieces.push(this.t(`Value_${cell.number.state}`));
        if (column.kind !== "value") {
            pieces.push(this.t(cell.favorable === "favorable" ? "Value_Favorable" : cell.favorable === "unfavorable" ? "Value_Unfavorable" : "Value_Neutral"));
            pieces.push(this.t(column.kind === "relative" ? "Formula_Relative" : row.line.unit === "percent" ? "Formula_Points" : "Formula_Absolute"));
        }
        if (column.kind === "value" && this.statement.hasHighlights && row.line.type !== "heading") {
            pieces.push(`${this.t("Value_Highlight")}: ${this.numberText(cell.highlight ?? { state: "missing" }, cell.format)}`);
        }
        return pieces.join("; ");
    }

    private render(): void {
        const top = this.scroll.scrollTop;
        const left = this.scroll.scrollLeft;
        const hadFocus = this.scroll.contains(document.activeElement);
        const rows = visibleRows(this.statement.rows, this.collapsed);
        this.cells = [];
        this.status.setAttribute("role", "status");
        this.status.textContent = this.statement.issues.map(issue => this.t(issue.key)).join(" ");
        this.status.hidden = !this.status.textContent;
        this.footer.replaceChildren();
        const legend = element("span", "afm-legend", this.t("Status_Legend"));
        this.footer.append(legend);
        if (this.statement.hasHighlights) this.footer.append(element("span", "afm-legend", this.t("Status_Highlights")));
        this.footer.append(element("span", "afm-count", `${rows.length}/${this.statement.rows.length} ${this.t("Status_Rows")} | ${this.t("Status_Viewport")}`));
        const table = element("table", "afm-table");
        table.setAttribute("role", "grid");
        table.setAttribute("aria-label", this.t("Grid_Label"));
        table.setAttribute("aria-rowcount", String(rows.length + 1));
        table.setAttribute("aria-colcount", String(this.statement.columns.length + 1));
        table.setAttribute("aria-multiselectable", "true");
        const head = table.createTHead().insertRow();
        head.setAttribute("role", "row");
        head.setAttribute("aria-rowindex", "1");
        const corner = element("th", "afm-corner", this.t("Column_Line"));
        corner.scope = "col";
        corner.setAttribute("role", "columnheader");
        head.append(corner);
        for (const column of this.statement.columns) {
            const th = element("th", "afm-column", this.columnLabel(column));
            th.scope = "col";
            th.setAttribute("role", "columnheader");
            th.title = this.columnLabel(column);
            head.append(th);
        }
        const body = table.createTBody();
        rows.forEach((row, rowIndex) => {
            const tr = body.insertRow();
            tr.className = `afm-row afm-${row.line.type}`;
            tr.dataset.lineId = row.line.id;
            tr.setAttribute("role", "row");
            tr.setAttribute("aria-rowindex", String(rowIndex + 2));
            const th = element("th", "afm-row-header");
            th.scope = "row";
            th.setAttribute("role", "rowheader");
            th.style.paddingInlineStart = `${10 + row.depth * 16}px`;
            th.title = `${row.line.label} (${row.line.id})`;
            const label = element("span", "afm-label", row.line.label);
            if (row.hasChildren) {
                const toggle = element("button", "afm-toggle", this.collapsed.has(row.line.id) ? "+" : "-");
                toggle.tabIndex = -1;
                toggle.setAttribute("aria-label", `${this.t(this.collapsed.has(row.line.id) ? "Action_Expand" : "Action_Collapse")} ${row.line.label}`);
                th.setAttribute("aria-expanded", String(!this.collapsed.has(row.line.id)));
                toggle.addEventListener("click", event => { event.stopPropagation(); this.toggle(row); });
                th.append(toggle);
            }
            th.append(label);
            tr.append(th);
            this.wireCell({ element: th, row, rowIndex, columnIndex: 0 });
            this.statement.columns.forEach((column, columnIndex) => {
                const cell = getCell(row, column);
                const td = element("td", `afm-cell afm-${cell.favorable}`);
                td.setAttribute("role", "gridcell");
                td.setAttribute("aria-label", this.description(row, column, cell));
                td.dataset.columnKey = column.key;
                td.dataset.state = cell.number.state;
                const text = this.numberText(cell.number, cell.format);
                const flag = column.kind !== "value" && cell.number.state === "number" && cell.favorable !== "neutral"
                    ? this.t(cell.favorable === "favorable" ? "Mark_Favorable" : "Mark_Unfavorable") + " " : "";
                td.append(element("span", "afm-value", flag + text));
                if (column.kind === "value" && this.statement.hasHighlights && row.line.type !== "heading") {
                    const value = cell.highlight ?? { state: "missing" };
                    td.append(element("span", "afm-highlight", `${this.t("Mark_Highlight")}: ${this.numberText(value, cell.format)}`));
                    td.classList.toggle("afm-not-highlighted", value.state !== "number");
                }
                tr.append(td);
                this.wireCell({ element: td, row, column, rowIndex, columnIndex: columnIndex + 1 });
            });
        });
        this.scroll.replaceChildren(table);
        const active = this.cells.find(cell => cell.row.line.id === this.focused.id && (cell.column?.key ?? "") === this.focused.column) ?? this.cells[0];
        if (active) {
            active.element.tabIndex = 0;
            if (hadFocus) active.element.focus({ preventScroll: true });
        }
        this.scroll.scrollTop = top;
        this.scroll.scrollLeft = left;
        this.applySelection();
    }

    private identity(row: StatementRow, column?: StatementColumn): SelectionId | undefined {
        if (row.path.some(node => !node.identity) || column?.path.some(node => !node.identity)) return undefined;
        const key = JSON.stringify([row.line.id, column?.key ?? null]);
        const existing = this.identityCache.get(key);
        if (existing) return existing;
        const builder = this.host.createSelectionIdBuilder();
        for (const node of row.path) builder.withMatrixNode(node, this.rowLevels());
        if (column) {
            for (const node of column.path) builder.withMatrixNode(node, this.columnLevels());
            if (column.kind === "value" && column.source.queryName) builder.withMeasure(column.source.queryName);
        }
        const id = builder.createSelectionId();
        this.identityCache.set(key, id);
        return id;
    }

    private rowLevels(): powerbi.DataViewHierarchyLevel[] { return this.matrixLevels("rows"); }
    private columnLevels(): powerbi.DataViewHierarchyLevel[] { return this.matrixLevels("columns"); }
    private levels: { rows: powerbi.DataViewHierarchyLevel[]; columns: powerbi.DataViewHierarchyLevel[] } = { rows: [], columns: [] };
    private matrixLevels(axis: "rows" | "columns"): powerbi.DataViewHierarchyLevel[] { return this.levels[axis]; }

    private wireCell(cell: CellElement): void {
        const target = cell.element;
        target.tabIndex = -1;
        target.setAttribute("aria-colindex", String(cell.columnIndex + 1));
        target.addEventListener("focus", () => {
            for (const other of this.cells) if (other.element.tabIndex === 0) other.element.tabIndex = -1;
            target.tabIndex = 0;
            this.focused = { id: cell.row.line.id, column: cell.column?.key ?? "" };
        });
        target.addEventListener("click", event => {
            target.focus();
            this.select(cell, event.ctrlKey || event.metaKey);
        });
        target.addEventListener("keydown", event => this.keydown(event, cell));
        target.addEventListener("contextmenu", event => {
            event.preventDefault();
            this.contextMenu(cell, event.clientX, event.clientY);
        });
        target.addEventListener("pointerenter", event => this.showTooltip(event, cell));
        target.addEventListener("pointerleave", () => this.hideTooltip());
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
        const page = Math.max(1, Math.floor((this.scroll.clientHeight - 44) / 36));
        const maxRow = Math.max(0, visibleRows(this.statement.rows, this.collapsed).length - 1);
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
        const next = this.cells.find(candidate => candidate.rowIndex === row && candidate.columnIndex === column);
        if (!next) return;
        next.element.focus({ preventScroll: true });
        this.reveal(next.element, column === 0);
    }

    private reveal(target: HTMLElement, isHeader: boolean): void {
        const viewport = this.scroll.getBoundingClientRect();
        const box = target.getBoundingClientRect();
        const headerHeight = this.scroll.querySelector("thead")?.getBoundingClientRect().height ?? 44;
        const labelWidth = this.scroll.querySelector(".afm-row-header")?.getBoundingClientRect().width ?? 280;
        if (box.top < viewport.top + headerHeight) this.scroll.scrollTop -= viewport.top + headerHeight - box.top;
        else if (box.bottom > viewport.bottom) this.scroll.scrollTop += box.bottom - viewport.bottom;
        if (!isHeader) {
            const start = viewport.left + (this.root.dir === "rtl" ? 0 : labelWidth);
            const end = viewport.right - (this.root.dir === "rtl" ? labelWidth : 0);
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
            "includes" in id && typeof id.includes === "function"
            && "getKey" in id && typeof id.getKey === "function"
            && "hasIdentity" in id && typeof id.hasIdentity === "function";
        this.selectionIds = ids.filter(valid);
        if (ids.length !== this.selectionIds.length) this.interactionError("Error_Identity");
    }

    private interactionError(key: string): void {
        this.status.hidden = false;
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
        }
        items.push({ displayName: this.t("Value_Sign"), value: String(cell.row.line.sign) });
        const id = this.identity(cell.row, cell.column);
        this.host.tooltipService.show({ coordinates: [event.clientX, event.clientY], isTouchEvent: event.pointerType === "touch", dataItems: items, identities: id?.hasIdentity() ? [id] : [] });
    }

    private hideTooltip(): void { this.host.tooltipService.hide({ immediately: true, isTouchEvent: false }); }

    public destroy(): void {
        this.disposed = true;
        this.hideTooltip();
        this.root.remove();
        this.cells = [];
        this.identityCache.clear();
        this.formatCache.clear();
    }
}
