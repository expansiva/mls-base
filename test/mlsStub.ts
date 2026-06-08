export interface MlsStubOptions {
  actualProject?: number;
  existingFolders?: string[];
}

export function installMlsStub(options: MlsStubOptions = {}): void {
  const actualProject = options.actualProject ?? 102020;
  const folders = options.existingFolders ?? [];

  (globalThis as typeof globalThis & { mls: Record<string, unknown> }).mls = {
    actualProject,
    stor: {
      files: Object.fromEntries(
        folders.map((folder, index) => [
          `stub-${index}`,
          { project: actualProject, level: 2, folder },
        ]),
      ),
    },
  };
}