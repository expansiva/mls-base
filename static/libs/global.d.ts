
// import * as cbe from "@common/global.cbe.types";
// import * as l5_common from "@common/l5-common";
declare global {
    export interface Window {
        collabMessages: cbe.ICollabMessages;
        traceLifeCycle: boolean;
        project_config: l5_common.ProjectConfig;
        latest: {
            libs: string;
            www: string;
            monaco: string;
            indexHTML: string;
        };
    }
}
export {};
