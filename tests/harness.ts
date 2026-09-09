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
}

export async function mount(page: Page, data: powerbi.DataView, options: { width?: number; height?: number; locale?: string; highContrast?: boolean; interactions?: boolean } = {}): Promise<void> {
    const artifact = await readArtifact();
    await page.setContent('<div id="visual"></div>');
    await page.addStyleTag({ content: "html,body { margin:0; }" + artifact.resource.content.css });
    await page.evaluate(({ js, resources, data, options, guid }) => {
        type Id = { parts: string[]; getKey: () => string; includes: (id: Id) => boolean; hasIdentity: () => boolean };
        const state: RecordedHost = { selected: [], contexts: [], tooltips: [], events: [], failures: [], levels: [] };
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
                selections = multi ? [...selections, id] : [id];
                state.selected = selections.map(id => id.getKey());
                callback(selections);
                return Promise.resolve(selections);
            },
            clear: () => { selections = []; state.selected = []; callback([]); return Promise.resolve({}); },
            showContextMenu: (id: Id) => { state.contexts.push(id.getKey()); return Promise.resolve({}); }
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
                show: (payload: { dataItems: unknown; identities: Id[] }) => { state.tooltips.push(JSON.stringify({ dataItems: payload.dataItems, identities: payload.identities.map(id => id.getKey()) })); },
                hide: () => undefined
            },
            eventService: {
                renderingStarted: () => state.events.push("started"),
                renderingFinished: () => state.events.push("finished"),
                renderingFailed: (_options: unknown, reason: string) => { state.events.push("failed"); state.failures.push(reason); }
            }
        };
        const world = window as typeof window & {
            powerbi: { visuals: { plugins: Record<string, { create: (options: unknown) => { update: (options: unknown) => void; destroy: () => void; getFormattingModel: () => unknown } }> } };
            hostState: RecordedHost;
            updateVisual: (data: unknown, width?: number, height?: number) => void;
            destroyVisual: () => void;
            formattingModel: () => unknown;
        };
        Object.defineProperty(window, "powerbi", { value: { visuals: { plugins: {} } }, configurable: true, writable: true });
        // Evaluate only the packaged production script through a script element, as the host loads it.
        const script = document.createElement("script");
        script.textContent = js;
        document.head.append(script);
        const visual = world.powerbi.visuals.plugins[guid]!.create({ element: document.getElementById("visual"), host });
        world.hostState = state;
        world.updateVisual = (input, width = options.width ?? 820, height = options.height ?? 480) => visual.update({ dataViews: input ? [input] : [], viewport: { width, height }, type: 2 });
        world.destroyVisual = () => visual.destroy();
        world.formattingModel = () => visual.getFormattingModel();
        world.updateVisual(data);
    }, { js: artifact.resource.content.js, resources: artifact.resource.stringResources, data, options, guid: artifact.resource.visual.guid });
    await expect(page.locator(".afm")).toBeVisible();
}

export async function hostState(page: Page): Promise<RecordedHost> {
    return page.evaluate(() => (window as typeof window & { hostState: RecordedHost }).hostState);
}

export async function update(page: Page, data: powerbi.DataView | undefined, width?: number, height?: number): Promise<void> {
    await page.evaluate(({ data, width, height }) => {
        (window as typeof window & { updateVisual: (data: unknown, width?: number, height?: number) => void }).updateVisual(data, width, height);
    }, { data, width, height });
}
