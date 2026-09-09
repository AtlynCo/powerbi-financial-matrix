export interface Artifact {
    path: string;
    sha256: string;
    size: number;
    manifest: { visual: { guid: string; version: string } };
    resource: {
        visual: { guid: string; version: string };
        apiVersion: string;
        content: { js: string; css: string; iconBase64: string };
        stringResources: Record<string, Record<string, string>>;
        capabilities: Record<string, unknown>;
        externalJS: string[];
    };
}
export function readArtifact(): Promise<Artifact>;
