export interface MlsStubOptions {
  actualProject?: number;
  existingFolders?: string[];
  /** Extra `mls.stor.files` entries, merged over the ones built from `existingFolders`. */
  files?: Record<string, unknown>;
  /** What `mls.l5.getProjectDependencies` returns. Default: no dependencies. */
  projectDependencies?: number[];
  /** Extra `mls.l5` members, merged over the stub's own. */
  l5?: Record<string, unknown>;
  /** Extra `mls.events` members, merged over the stub's own. */
  events?: Record<string, unknown>;
}

const fileActionCalls: unknown[][] = [];

/** Every `mls.events.fireFileAction` call since the last `installMlsStub`, oldest first. */
export function mlsStubEvents(): readonly unknown[][] {
  return fileActionCalls;
}

export function installMlsStub(options: MlsStubOptions = {}): void {
  const actualProject = options.actualProject ?? 102020;
  const folders = options.existingFolders ?? [];
  const projectDependencies = options.projectDependencies ?? [];
  fileActionCalls.length = 0;

  (globalThis as typeof globalThis & { mls: Record<string, unknown> }).mls = {
    actualProject,
    stor: {
      files: {
        ...Object.fromEntries(
          folders.map((folder, index) => [
            `stub-${index}`,
            { project: actualProject, level: 2, folder },
          ]),
        ),
        ...options.files,
      },
    },
    events: {
      // No effect, but the call is kept so a test can assert on it.
      fireFileAction: (...args: unknown[]): void => {
        fileActionCalls.push(args);
      },
      ...options.events,
    },
    l5: {
      getProjectDependencies: (): number[] => [...projectDependencies],
      ...options.l5,
    },
  };
}
