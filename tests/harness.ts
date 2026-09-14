import { Page, expect } from "@playwright/test";
import type powerbi from "powerbi-visuals-api";
import { readArtifact } from "../scripts/artifact.mjs";

export interface RecordedHost {
    selected: string[];
    contexts: string[];
    tooltips: string[];
    events: string[];
    failures: string[];
    levels: number[];
    renderDurations: number[];
    tooltipTouch: boolean[];
    tooltipHides: boolean[];
    clears: number;
    rejectNext: boolean;
}

export interface MountOptions {
    width?: number; height?: number; locale?: string; highContrast?: boolean; interactions?: boolean;
    instance?: string; append?: boolean;
}

export async function mount(page: Page, data: powerbi.DataView | undefined, options: MountOptions = {}): Promise<void> {
    const artifact = await readArtifact();
    if (!options.append) await page.setContent("");
    await page.addStyleTag({ content: "html,body { margin:0; }" + artifact.resource.content.css });
    await page.evaluate(({ js, resources, data, options, guid }) => {
        type Id = { parts: string[]; getKey: () => string; includes: (id: Id) => boolean; hasIdentity: () => boolean };
        const state: RecordedHost = { selected: [], contexts: [], tooltips: [], events: [], failures: [], levels: [], renderDurations: [], tooltipTouch: [], tooltipHides: [], clears: 0, rejectNext: false };
        let renderStart = 0;
        let selections: Id[] = [];
        let callback: (ids: Id[]) => void = () => undefined;
        const makeId = (parts: string[]): Id => ({
            parts, getKey: () => JSON.stringify(parts),
            includes: id => parts.every(part => id.parts.includes(part)),
            hasIdentity: () => parts.some(part => part.startsWith("node:"))
        });
        const selection = {
            registerOnSelectCallback: (cb: (ids: Id[]) => void) => { callback = cb; },
            getSelectionIds: () => selections,
            hasSelection: () => selections.length > 0,
            select: (id: Id, multi: boolean) => {
                if (state.rejectNext) { state.rejectNext = false; return Promise.reject(new Error("Mock host rejected selection")); }
                selections = multi ? [...selections, id] : [id];
                state.selected = selections.map(id => id.getKey());
                callback(selections);
                return Promise.resolve(selections);
            },
            clear: () => { state.clears++; selections = []; state.selected = []; callback([]); return Promise.resolve({}); },
            showContextMenu: (id: Id) => { state.contexts.push(typeof id?.getKey === "function" ? id.getKey() : JSON.stringify(id)); return Promise.resolve({}); }
        };
        const host = {
            createSelectionManager: () => selection,
            createSelectionIdBuilder: () => {
                const parts: string[] = [];
                const builder = {
                    withMatrixNode: (node: { identity?: { key: string }; level?: number }, levels: { sources: { queryName: string }[] }[]) => {
                        state.levels.push(levels.length);
                        if (node.identity && node.level !== undefined) parts.push(`node:${levels[node.level]?.sources[0]?.queryName}:${node.identity.key}`);
                        return builder;
                    },
                    withMeasure: (name: string) => { parts.push(`measure:${name}`); return builder; },
                    createSelectionId: () => makeId(parts)
                };
                return builder;
            },
            createLocalizationManager: () => ({ getDisplayName: (key: string) => resources[options.locale ?? "en-US"]?.[key] ?? resources["en-US"]?.[key] ?? key }),
            locale: options.locale ?? "en-US",
            colorPalette: {
                isHighContrast: options.highContrast ?? false,
                foreground: { value: "#ffff00" }, background: { value: "#000000" }, foregroundSelected: { value: "#00ffff" }
            },
            hostCapabilities: { allowInteractions: options.interactions ?? true },
            tooltipService: {
                enabled: () => true,
                show: (payload: { dataItems: unknown; identities: Id[]; isTouchEvent: boolean }) => {
                    state.tooltipTouch.push(payload.isTouchEvent);
                    state.tooltips.push(JSON.stringify({ dataItems: payload.dataItems, identities: payload.identities.map(id => id.getKey()) }));
                },
                hide: (payload: { isTouchEvent: boolean }) => state.tooltipHides.push(payload.isTouchEvent)
            },
            eventService: {
                renderingStarted: () => { renderStart = performance.now(); state.events.push("started"); },
                renderingFinished: () => { state.renderDurations.push(performance.now() - renderStart); state.events.push("finished"); },
                renderingFailed: (_options: unknown, reason: string) => { state.events.push("failed"); state.failures.push(reason); }
            }
        };
        const world = window as typeof window & {
            powerbi: { visuals: { plugins: Record<string, { create: (options: unknown) => { update: (options: unknown) => void; destroy: () => void; getFormattingModel: () => unknown } }> } };
            hostState: RecordedHost;
            updateVisual: (data: unknown, width?: number, height?: number) => void;
            destroyVisual: () => void;
            formattingModel: () => unknown;
            instances: Record<string, {
                state: RecordedHost;
                update: (data: unknown, width?: number, height?: number) => void;
                destroy: () => void;
                formattingModel: () => unknown;
                clearFromHost: () => void;
            }>;
        };
        if (!options.append || !world.powerbi?.visuals?.plugins[guid]) {
            Object.defineProperty(window, "powerbi", { value: { visuals: { plugins: {} } }, configurable: true, writable: true });
            // Load the official package once; appended instances share the same runtime module.
            const script = document.createElement("script");
            script.textContent = js;
            document.head.append(script);
            world.instances = {};
        }
        const instance = options.instance ?? "default";
        const container = document.createElement("div");
        container.id = `visual-${instance}`;
        document.body.append(container);
        const visual = world.powerbi.visuals.plugins[guid]!.create({ element: container, host });
        world.hostState = state;
        world.updateVisual = (input, width = options.width ?? 820, height = options.height ?? 480) => visual.update({ dataViews: input ? [input] : [], viewport: { width, height }, type: 2 });
        world.destroyVisual = () => visual.destroy();
        world.formattingModel = () => visual.getFormattingModel();
        world.instances[instance] = {
            state, update: world.updateVisual, destroy: world.destroyVisual, formattingModel: world.formattingModel,
            clearFromHost: () => { selections = []; state.selected = []; callback([]); }
        };
        world.updateVisual(data);
    }, { js: artifact.resource.content.js, resources: artifact.resource.stringResources, data, options, guid: artifact.resource.visual.guid });
    await expect(page.locator(`#visual-${options.instance ?? "default"} .afm`)).toBeVisible();
}

export async function hostState(page: Page, instance?: string): Promise<RecordedHost> {
    return page.evaluate(instance => {
        const world = window as typeof window & { hostState: RecordedHost; instances: Record<string, { state: RecordedHost }> };
        return instance ? world.instances[instance]!.state : world.hostState;
    }, instance);
}

export async function update(page: Page, data: powerbi.DataView | undefined, width?: number, height?: number): Promise<void> {
    await page.evaluate(({ data, width, height }) => {
        (window as typeof window & { updateVisual: (data: unknown, width?: number, height?: number) => void }).updateVisual(data, width, height);
    }, { data, width, height });
}

export async function assertBrowserClean(page: Page): Promise<void> {
    expect((await page.pageErrors()).map(error => error.message)).toEqual([]);
    expect((await page.consoleMessages()).filter(message => message.type() === "error").map(message => message.text())).toEqual([]);
}
