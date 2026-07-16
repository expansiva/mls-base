
declare namespace mls {

// export * as l0 from "./l0/l0";
// export * as l1 from "./l1/l1";
// export * as l2 from "./l2/l2";
// export * as l3 from "./l3/l3";
// export * as l4 from "./l4/l4";
// export * as l5 from "./l5/l5";
// export * as l6 from "./l6/l6";
// export * as l7 from "./l7/l7";
// export * as defs from "./defs/defs";
// import * as stor from "./stor/stor";
// export * as stor from "./stor/stor";
// export * as api from "./api/api";
// export * as main from "./main/main";
// export * as plugin from "./plugin/plugin";
// export * as editor from "./editor/editor";
// export * as events from "./events/events";
// export * as common from "./common/common";
// export * as mindmap from "./mindmap/mindmap";
// export * as bots from "./bots/bots";
// export * as sites from "./sites/sites";
// export * as l5_common from "@common/l5-common";
export type * as msg from "@msg/global";
// import * as cbe from "@common/global.cbe.types";
// export * as cbe from "@common/global.cbe.types";
export const version: string;
export const contributions: {
    [key: string]: any;
};
export const setContributions: (key: string, value: any) => void;
export const services: {
    [key: string]: any;
};
export const setServices: (key: string, value: any) => void;
export let istrace: boolean;
export let isTraceUI: boolean;
export let isTraceEvents: boolean;
export let isTraceAgent: boolean;
export let baseMonaco: string;
export const showLibVersions: () => void;
declare global {
    export interface Window {
        collabMessages: cbe.ICollabMessages;
        traceLifeCycle: boolean;
        latest: {
            libs: string;
            www: string;
            monaco: string;
            indexHTML: string;
        };
    }
}
export interface IActual {
    level: number;
    project?: number;
    path?: string;
    getFullName: Function;
    getStorFileBase: (this: IActual) => stor.IFileInfoBase;
    getStorFile: (this: IActual) => stor.IFileInfo | undefined;
    setFullName: (this: IActual, value: string) => IActual;
    left?: stor.IFileInfo;
    right?: stor.IFileInfo;
}
export type Level = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export let actualLevel: Level;
export const setActualLevel: (level: Level) => void;
export type IPosition = 'left' | 'right';
export let actualPosition: IPosition;
export const setActualPosition: (position: IPosition) => void;
export type IProject = number | undefined;
export let actualProject: IProject;
export const setActualProject: (project: IProject) => void;
export let actualModule: string | undefined;
export const setActualModule: (module: string) => void;
export const getActualUser: () => string;
export let actualService: string | undefined;
export const setActualService: (service: string) => void;
export let actualNav3: string | undefined;
export const setActualNav3: (nav3: string) => void;
export const actual: IActual[];

}

declare namespace mls.main {

// export {};

}

declare namespace mls.editor {

// import { mls } from "../../src/index";
// export * as diff from "./editor.diff";
// export * as localHistory from "./editor.localHistory";
// export * as diffPatience from "./editor.diffPatience";
export interface IMFiles {
    [key: string]: IModels;
}
/** memory file */
export const models: IMFiles;
export const editors: Record<mls.IPosition, IModels | undefined>;
export type ModelType = 'ts' | 'html' | 'style' | 'test' | 'defs';
export interface IModels {
    ts?: IModelTS;
    test?: IModelTest;
    html?: IModelHTML;
    style?: IModelStyle;
    defs?: IModelDefs;
}
export interface IModelBase {
    originalShortName?: string;
    originalProject?: number;
    originalCRC?: string;
    model: monaco.editor.ITextModel;
    storFile: mls.stor.IFileInfo;
    codeLens: mls.l2.codeLens.ICodeLen;
    history?: mls.editor.localHistory.ModelHistory[];
}
export interface IModelTS extends IModelBase {
    compilerResults?: mls.l2.typescript.ICompilerResult;
}
export interface IModelTest extends IModelTS {
}
export interface IModelDefs extends IModelTS {
}
export interface IModelHTML extends IModelBase {
}
export interface IModelStyle extends IModelBase {
    styleResults?: mls.l2.less.IStyleResult;
}
export const createModelTS: (storFile: mls.stor.IFileInfo, content: string) => Promise<IModelTS>;
export const createModelTest: (storFile: mls.stor.IFileInfo, content: string) => Promise<IModelTest>;
export const createModelDefs: (storFile: mls.stor.IFileInfo, content: string) => Promise<IModelDefs>;
export const createModelProjectDefinition: (project: number, content: string) => Promise<IModelTS>;
export const createModelHTML: (storFile: mls.stor.IFileInfo, content: string) => Promise<IModelHTML>;
export const createModelStyle: (storFile: mls.stor.IFileInfo, content: string) => Promise<IModelTS>;
export const getKeyModel: (project: number, shortName: string, folder: string, level: number) => string;
/**
 * load all files from ShortName, and create models in memory
 */
export const addModels: (project: number, shortName: string, folder: string, level: number) => Promise<mls.editor.IModels | undefined>;
/**
 * load one file and create models in memory
 */
export const addModel: (file: mls.stor.IFileInfoBase, content: string) => Promise<mls.editor.IModelBase | undefined>;
/**
 * delete model from memory and optionally release monaco model
 */
export const deleteModels: (project: number, shortName: string, folder: string, releaseMonacoModel: boolean, level: number) => boolean;
/**
 *  get model from memory
 */
export const getModels: (project: number, shortName: string, folder: string, level?: number) => mls.editor.IModels | undefined;
export const getModel: (storFile: mls.stor.IFileInfoBase) => mls.editor.IModelBase | undefined;
export const getModelById: (modelId: string) => mls.editor.IModelHTML | mls.editor.IModelStyle | mls.editor.IModelTS | mls.editor.IModelDefs | undefined;
/**
 * instances of monaco editor, ex mls.editor.instances.l2_left. xxxx
 */
export const instances: {
    [label: string]: monaco.editor.IStandaloneCodeEditor;
};
export let activeInstance: '' | 'l2_left' | 'l2_right';
export const setActiveInstance: (level: number, position: "left" | "right") => void;
/**
 * get level and position from active editor
 */
export const getInfoFromActiveInstance: () => {
    level: number;
    position: "left" | "right";
};
/**
 * return 'left' or 'right', from side of editor, default='left'
 */
export const findPositionOfEditor: (editor: monaco.editor.ICodeEditor) => "left" | "right";
/**
 * find all editors with model1 attached
 */
export const findEditorsByModel: (model: monaco.editor.ITextModel) => monaco.editor.ICodeEditor[];
export const InitMonaco: () => Promise<void>;
/**
 * init editor, call for each editor with typescript
 */
export const InitEditor: (editor: monaco.editor.IStandaloneCodeEditor) => void;
export let conf: {
    [label: string]: monaco.editor.IEditorOptions | string;
};
export const loadConfFromJSON: (json: string) => void;
export const loadConf: (key: string, value: monaco.editor.IEditorOptions | string) => void;
export let themeName: string;
export const setThemeName: (theme: string | null) => void;
export interface IChangeds {
    str: number;
    end: number;
}
export const convertTypescriptPosToMonacoRange: (model: monaco.editor.ITextModel, diagStart?: number, diagLength?: number) => monaco.Range;
/**
 * replace or add markers
 * @param addMarkers default false, if true, add markers, if false, replace markers
 */
export const showModelDecorations: (model: monaco.editor.ITextModel, diags: monaco.languages.typescript.Diagnostic[], addMarkers?: boolean) => void;
export const addError: (model: monaco.editor.ITextModel, range: monaco.Range, msg: string) => void;
export const addInfo: (model: monaco.editor.ITextModel, range: monaco.Range, msg: string) => void;
export const addWarning: (model: monaco.editor.ITextModel, range: monaco.Range, msg: string) => void;
export const addHint: (model: monaco.editor.ITextModel, range: monaco.Range, msg: string) => void;
/**
 * force typescript compile and show errors
 * ex, after a imported file change
 */
export const forceModelUpdate: (model: monaco.editor.ITextModel) => void;

}

declare namespace mls.api {

// export * as common from "./api.common";
// export * as base from "./api.base";
// import { cbe } from "../mls";
export const cbeLogin: () => Promise<cbe.ResponseBase | undefined>;
export const cbeChangeUserPreferences: (services: cbe.Service[]) => Promise<cbe.ResponseChangeUserPreferences>;
export const cbeUpdateIndexHtml: () => Promise<cbe.ResponseBase>;
/**
 * save settings in project or
 * move project to another organization or
 * archive project (change archived_at)
 * 1. prepare the data in memory , aka mls.stor.orgs
 * 2. call the server to save the data
 * 3. see response if ok or not
 * @param project project number
 */
export const cbeSavePrjSettings: (project: number) => Promise<cbe.ResponseSavePrjSettings>;
export const cbeAddOrUpdateOrgValue: (orgName: string, value: string) => Promise<cbe.ResponseAddOrUpdateOrgValue>;
/**
 * save new project information
 * get new unique project id
 * user have to be in team 'admin' on existent organization
 * set team 'admin'
 * update orgs in memory after save
 * @returns projectID or error message
 */
export const cbeSaveNewPrj: ({ orgName, info, settings }: {
    orgName: string;
    info: cbe.IProjectInfo;
    settings: cbe.IPrj_settingsApi;
}) => Promise<number | string>;

}

declare namespace mls.api.common {

// import { mls } from "../../src/index";
export function processOrgs(orgs: {
    [org: string]: mls.cbe.IOrgInfo;
}): Promise<void>;
export function processProviders(providers: mls.cbe.Provider[]): Promise<void>;
export function processInits(inits: {
    [widget: string]: string;
}): Promise<void>;
export const clearQueryString: () => void;
export function getCookie(name: string): string | null;

}

declare namespace mls.api.base {

// import { cbe } from "../mls";
export const prepareUrl: (base: string, args: any) => string;
type OnMessage = (msg: string, error: boolean) => void;
/**
 * use to get static files, ex: /ping, /mlsServiceWorker.js, /libs/*, /www/*, /monaco/*, / (index.html)
 */
export const get: (command: string, args: any | undefined, onMessage: OnMessage) => void;
/**
 * use to get static files, ex: /ping, /mlsServiceWorker.js, /libs/*, /www/*, /monaco/*, / (index.html)
 */
export const getAsync: (command: string, args?: any) => Promise<string>;
export const cbePost: (args: cbe.RequestBase) => Promise<cbe.ResponseBase>;
// export {};

}

declare namespace mls.bots {

// import { mls } from "../index";
export function getBotContextVarsBeforeMessageSend(thread: mls.msg.Thread, messageText: string): string[];
export interface ToolsBeforeSendMessage {
    toolName: string;
    args: Record<string, any>;
}
/**
 * Verifies which tools must be executed before sending a message to the bot.
 *
 * @param vars List of required tool calls for LLM prompt.
 *   Each item must follow one of these formats:
 *   - "toolName" → calls tool with no arguments (example: "getSystemInfo")
 *   - "toolName(arg1,arg2,...)" → calls tool with named arguments
 *     The arguments are resolved using keys from `myArgs`.
 *     Example: "toolGetDefs(shortName,projectId)"
 *
 * @param myArgs A dictionary of values used to resolve the argument names.
 *   Example: { shortName: "organismNav", projectId: "001" }
 *
 * @returns A list of tools with their resolved arguments to be executed.
 */
export function getBotContextVarsBeforeMessageSend2(vars: string[], myArgs: Record<string, any>): ToolsBeforeSendMessage[];

}

declare namespace mls.defs {

export interface AsIs {
    meta: {
        fileReference: string;
        componentType: ComponentType;
        componentScope: ComponentScope;
        group?: string;
        languages?: string[];
        /**
         * Development fidelity level, indicating the stage of development.
         * - 'draft': Initial concept, not functional.
         * - 'wireframe': Basic layout, no functionality.
         * - 'scaffold': Functional skeleton, minimal features.
         * - 'final': Fully functional, ready for production.
         */
        devFidelity?: 'draft' | 'wireframe' | 'scaffold' | 'final';
    };
    references?: {
        webComponents?: string[];
        imports?: DefsImports[];
        statesRO?: string[];
        statesRW?: string[];
        statesWO?: string[];
    };
    codeInsights?: {
        todos?: string[];
        securityWarnings?: string[];
        unusedImports?: string[];
        deadCodeBlocks?: string[];
        accessibilityIssues?: string[];
        i18nWarnings?: string[];
        performanceHints?: string[];
    };
    auth?: {
        view?: UserRole[];
        edit?: UserRole[];
        use?: UserRole[];
        restrictReason?: string;
    };
    asIs: {
        semantic: {
            generalDescription: string;
            businessCapabilities: string[];
            technicalCapabilities: string[];
            implementedFeatures: string[];
            constraints?: string[];
        };
    };
}
export type ComponentScope = 'appFrontEnd' | // shipped to customer application
'appBackEnd' | // shipped to customer application
'editor';
export type ComponentType = 'page' | // (appFrontEnd) Full-screen view with its own route (e.g. /petshop/dashboard). Contains front-end business logic and calls back-end services.
'organism' | // (appFrontEnd) Sections inside page. Contains front-end business logic and calls back-end services.
'molecule' | // (appFrontEnd) reusable web component. Used inside organisms.
'miniapp' | // (appFrontEnd) Self-contained application with its own navigation, usually one page, e.g., temperature converter, calculator.
'pluginUI' | // (appFrontEnd) Front-end part of a plugin (buttons, widgets, config pages visible to the customer)
'pluginSettings' | // (editor) Editor panel to configure a plugin (icon in toolbar, never shipped)
'entity' | // (appBackEnd) data model (DB schema, ORM entity). Defines tables, fields, relations.
'controller' | // (appBackEnd) Handles API endpoint requests: validates input and authorization, then executes the appropriate use case.
'useCase' | // (appBackEnd) business logic unit. Encapsulates specific operations, called by controllers.
'repository' | // (appBackEnd) data access layer. Interfaces with the database, performs CRUD operations.
'hook' | // (appBackEnd) event handler or middleware (e.g., webhooks, auth guards).
'editorService' | // (editor) Editor-only panel or toolbar.
'agent' | // (editor) Specialized LLM orchestrator (prepares prompts, chains tools, etc.).
'tool' | // (editor) Reusable function or module (e.g., data processing, integrations).
'service' | // (editor) tool UI
'other';
export interface DefsImports {
    ref: string;
    dependencies?: {
        name: string;
        type?: "function" | "service" | "constant" | "interface" | "type" | "class" | "hook" | "component" | "?";
        purpose?: string;
    }[];
}
export type UserRole = string;
export interface ChangeHistoryItem {
    version: number;
    type: 'create' | 'change' | 'fix' | 'warning' | 'rollback';
    summary: string;
    details: string;
    status: 'done' | 'active' | 'replaced';
}
/**
 * Identifies which agent is responsible for processing a materialize entry.
 * Maps to a specific generation strategy.
 * Extensible — new agents can be added as the platform evolves.
 */
export type MaterializeAgent = 'agentMaterializeContract' | 'agentMaterializeSharedPage' | 'agentMaterializePageLit' | 'agentMaterializeLess' | 'agentMaterializeBffHandler' | 'agentMaterializeTest' | (string & {});
/**
 * One entry in the materialize index.
 * Each entry represents a single file to be generated from this .defs.ts.
 */
export interface MaterializeEntry {
    /** Unique id within this .defs.ts — used for dependsOn references */
    id: string;
    /** Name of the exported variable in this .defs.ts that holds the spec */
    specVar: string;
    /** Absolute output path of the generated file */
    outputPath: string;
    /** Path to the skill file that describes HOW to generate this file */
    skillPath: string;
    /** Agent responsible for processing this entry */
    agent: MaterializeAgent;
    /**
     * Ids of other entries in this index that must be generated before this one.
     * Empty array means no dependencies — can be generated first.
     */
    dependsOn: string[];
    /** ISO date — last time the spec (specVar content) was modified */
    specUpdatedAt: string;
}
/**
 * The full materialize index exported by a page .defs.ts.
 * Read by the orchestrator to plan the generation sequence.
 */
export type MaterializeIndex = MaterializeEntry[];

}

declare namespace mls.common {

// export * as tripleslash from './common.tripleslash';
// export * as crc from './common.crc';
// export * as deps from './common.deps';
// export * as zip from './common.zip';
export const tryParseNumber: (value: string | undefined | null, defaultValue: number) => number;
export function safeParseArgs(args: string): Record<string, any>;
export function argsValidator(args: Record<string, any>, schema: Record<string, {
    type: string;
    description?: string;
    optional?: boolean;
}>): void;

}

declare namespace mls.common.tripleslash {

// import { mls } from "../../src/index";
export interface ITripleSlashVariables {
    [key: string]: string;
}
export interface ITripleSlash {
    tagName: string;
    variables: ITripleSlashVariables;
}
export const parseXMLTripleSlash: (line: string) => ITripleSlash;
/**
 * Changes the value of a variable in an XML/HTML string.
 * @param mfile - The model, will change first line
 * @param variableName - The name of the variable to change.
 * @param newValue - The new value for the variable.
 * @returns An object containing the modified string and a boolean indicating if the variable was successfully changed.
 * @example
 * ```
 * const input = "<tagName variable='text' variable2=\"text\" />";
 * const { modifiedString, success } = changeVariable(input, "variable", "newValue");
 * console.log(modifiedString); // Output: "<tagName variable='newValue' variable2=\"text\" />"
 * console.log(success); // Output: true
 * ```
 */
export const changeVariable: (model: mls.editor.IModelBase, variableName: string, newValue: string) => boolean;

}

declare namespace mls.common.crc {

/**
 * Calculates the CRC32 of a given text.
 * @param text - The input text for which the CRC32 should be calculated.
 * @returns The CRC32 value as an unsigned number.
 * @example
 * ```
 * import { crc32 } from "./crc32";
 *
 * const text = "Sample text for CRC32 calculation";
 * const crcValue = crc32(text);
 *
 * console.log("CRC32:", crcValue.toString(16));
 * ```
 */
export const crc32: (text: string) => number;

}

declare namespace mls.common.deps {

export const loadScriptOnDOM: (ref: string, context: string, parentElement: HTMLHeadElement | HTMLBodyElement, scriptID?: string) => Promise<boolean>;

}

declare namespace mls.common.zip {

/**
 * Compresses a JSON object, string, or Uint8Array and encodes it in base64.
 * @param data - The JSON object, string, or Uint8Array to be compressed.
 * @returns The compressed data encoded in base64.
 */
export const compressAndEncodeBase64: (data: object | string | Uint8Array) => string;
/**
 * Decodes a base64 string and decompresses it to retrieve the original data.
 * @param base64Data - The base64 encoded compressed string.
 * @returns The original JSON object, string, or Uint8Array.
 */
export const decodeAndDecompressBase64: (base64Data: string) => string | object;
export const base64ToArrayBuffer: (base64: string) => ArrayBuffer;
export const unzipBase64: (base64: string) => Promise<{
    key: string;
    value: string;
}[]>;

}

declare namespace mls.events {

// import { mls } from "../index";
export interface ITimeout {
    str: number;
    timeout: number;
    events: IEvents[];
}
export type Listener = (ev: IEvent) => void | Promise<void>;
export let delays: {
    [handle: number]: ITimeout;
};
export let subscribers: {
    [key: string]: Listener[];
};
export type FileActions = 'preInit' | 'projectListChanged' | 'new' | 'open' | 'clone' | 'rename' | 'delete' | 'updatedOnServer' | 'modeCreated' | 'undo' | 'changed' | 'statusOrErrorChanged' | 'fileReference' | 'reference' | 'editorChanged';
export interface IFileAction {
    action: FileActions;
    level: number;
    position: 'right' | 'left';
    project: number;
    shortName: string;
    folder: string;
    extension: string;
    newProject?: number;
    newshortName?: string;
    newfolder?: string;
    newEnhancement?: string;
    newTSSource?: string;
    newHtmlSource?: string;
}
export interface IWidgetAction {
    level: number;
    position: 'right' | 'left';
    id: string;
    action: 'selected' | 'unselected' | 'changed';
}
export interface IProjectLoaded {
    level: number;
    needCompile: boolean;
    project: number;
}
export interface IMonacoAction {
    action: 'gotoPosition' | 'helpAssistant';
    codeLenCommand?: mls.l2.codeLens.ICodeLenCommand;
    level: number;
    position: 'right' | 'left';
    filePosition: number;
    project: number;
    shortName: string;
    folder: string;
    extension: string;
}
export interface IPluginDetail {
    shortName: string;
    project: number;
    htmlText?: string; /** force html string or get html from widget */
}
export type TypeEvent = "ProjectSelected" | "ProjectChanged" | "ProjectLoaded" | "ProjectCreate" | "ProjectExplore" | "FileAction" | 'DomAction' | 'ProjectCompilationComplete' | "CSSSelectChanged" | "WidgetAction" | 'PluginDetails' | "MonacoAction" | "MonacoModelCreated" | "ToolBarSelected" | "ToolBarUnSelected";
export interface IEvents {
    levels: mls.Level[];
    types: TypeEvent[];
    desc?: string;
}
export interface IEvent {
    level: mls.Level;
    type: TypeEvent;
    desc?: string;
}
/**
 * fire a event , use Publish-Subscribe Pattern
 * @param levels ex [2,3]
 * @param types ex ['TSSourceChanged']
 * @param desc optional , use to pass parameters
 * @param timeout optional, default 200ms, use 0 to fire immediately
 */
export const fire: (levels: mls.Level[] | mls.Level, types: TypeEvent[] | TypeEvent, desc?: string, timeout?: number) => Promise<void>;
/**
 * add subscriber , , ex mls.events.addListener(2, 'foo', onFoo)
 * @param level level from mls, ex 2
 * @param type type , ex 'TSSourceChanged'
 * @param listener Function to receive event , ex const onMyEvent = (ev: mls.events.IEvent) => void { }
 */
export const addListener: (level: mls.Level, type: TypeEvent, listener: Listener) => void;
/**
 * add subscriber , , ex addEventListener([2],['foo'], onFoo)
 * @param levels one or more levels from mls
 * @param types one or more types , ex ['TSSourceChanged']
 * @param listener Function to receive event , ex const onMyEvent = (ev: mls.events.IEvent) => void { }
 */
export const addEventListener: (levels: mls.Level[], types: TypeEvent[], listener: Listener) => void;
/**
 * remove subscriber , ex addEventListener([2,3],['foo'], onFoo); removeEventListener(undefined,undefined,onFoo)
 * to remove all from onFoo, ex removeEventListener(undefined, undefined, onFoo);
 * @param levels one or more levels from mls or undefined for remove all levels
 * @param types one or more types or undefined for remove all types
 * @param listener Function to receive event , ex const onMyEvent = (ev: mls.events.IEvent) => void { }
 */
export const removeEventListener: (levels: mls.Level[] | undefined, types: TypeEvent[] | undefined, listener: Listener) => void;
/**
 * fire a specific action
 * @param newProject optional for rename
 * @param newshortName optional for rename
 * @param newfolder optional for rename
 * @param newEnhancement optional for rename
 */
export const fireFileAction: (action: mls.events.FileActions, storFile: mls.stor.IFileInfo, position: "left" | "right", newProject?: number, newshortName?: string, newfolder?: string, newEnhancement?: string, timeout?: number) => Promise<void>;
/**
 * fire a Monaco action, example, after a codeLen link
 */
export const fireMonacoAction: (action: "gotoPosition" | "helpAssistant", storFile: mls.stor.IFileInfo, codeLenCommand: mls.l2.codeLens.ICodeLenCommand | undefined, position: "left" | "right", filePosition: number, timeout?: number) => Promise<void>;
declare global {
    interface Window {
        firebase: {
            apps: any[];
            initializeApp: (config: object) => void;
            messaging: () => any;
        };
    }
}
/**
 * Get Firebase Cloud Messaging token for backend registration
 * @returns Promise<string | null> - FCM token or null if failed
 */
export const getFCMTokenForBackend: () => Promise<string | null>;

}

declare namespace mls.mindmap {

export type MindMapNodePosition = 'left' | 'right' | 'top' | 'bottom';
/**
 * Size hints for mind map nodes.
 * - 'line': Node is a single line, typically used for small labels or titles.
 * - 'panel': Node is a panel, suitable for displaying more information.
 * - 'full': Node occupies full space, used for larger content or detailed views.
 *   in full mode, the component have to handle scrolling, search and filtering.
 */
export type MindMapNodeSizeHint = 'line' | 'panel' | 'full';
export interface MindMapNodeItem {
    id: string;
    label: string;
    position?: MindMapNodePosition;
    sizeHint?: MindMapNodeSizeHint;
    children?: string[];
}
export interface MindMapNodeBase {
    id: string;
    label: string;
    related?: string[];
    element?: string;
}
/**
 * Helper class for mind map node path parsing and formatting.
 */
export class MindMapNodePathInput {
    domain: string;
    entity?: string;
    relation?: string;
    constructor(domain: string, entity?: string, relation?: string);
    toString(): string;
}
/**
 * Get mind map nodes based on the provided path.
 *
 * This function resolves the mind map nodes based on the domain and optional entity/relation.
 * It uses registered resolvers to fetch the appropriate nodes.
 * @param path Path input for mind map nodes, should follow the structure: domain[/entity][/relation]
 * @returns
 */
export function getMindMapNodes(path: MindMapNodePathInput): Promise<(MindMapNodeItem[])>;
export const baseResolvers: Record<string, MindMapNodeBase>;
export const dynamicResolvers: Record<string, ((path: MindMapNodePathInput) => Promise<MindMapNodeItem[]>)>;
export function addBase(type: string, node: MindMapNodeBase): void;
export function addDynamic(type: string, fn: (path: MindMapNodePathInput) => Promise<MindMapNodeItem[]>): void;

}

declare namespace mls.l0 {

// import { mls } from "../../src/index";
export const init: (mode: "preLoading" | "enterLevel") => Promise<void>;
export const providersConnected: mls.cbe.Provider[];
export const addProviderConnected: (provider: mls.cbe.Provider) => void;

}

declare namespace mls.l1 {

export const init: (mode: "preLoading" | "enterLevel") => Promise<void>;

}

declare namespace mls.l2 {

// export * as enhancement from "./l2.enhancement";
// export * as codeLens from "./l2.codeLens";
// export * as typescript from "./l2.typescript";
// export * as less from "./l2.less";
// export * as html from "./l2.html";
export const init: (mode: "preLoading" | "enterLevel") => Promise<void>;

}

declare namespace mls.l2.codeLens {

// import { mls } from "../index";
export type CodeLenID = 'fileReferences' | 'helpAssistant';
export interface ICodeLenCommand {
    id: CodeLenID;
    title: string;
    jsComm?: string;
    refs?: string;
}
export interface ICodeLen {
    [line: number]: ICodeLenCommand[];
}
interface ICommands {
    [key: string]: string | null;
}
export const commands: ICommands;
/**
 * add a line in monaco editor, 'codeLens' to Help user , ex '4 References'
 */
export const addCodeLen: (model: monaco.editor.ITextModel, lineNr: number, args: ICodeLenCommand) => void;
/**
 * remove all lens in line
 */
export const removeCodeLen: (model: monaco.editor.ITextModel, lineNr: number) => void;
// export {};

}

declare namespace mls.l2.enhancement {

// import { mls } from "../index";
export type IAfterCompile = (modelTS: mls.editor.IModelTS) => Promise<void>;
export type IAfterChange = (modelTS: mls.editor.IModelTS) => string;
export type ISectionName = 'principal' | 'optional' | 'advanced';
export interface IProperties {
    sectionName: ISectionName;
    propertyName: string;
    propertyType: string;
    hint?: string;
    defaultValue?: string;
    pattern?: string;
    maxLength?: number;
    max?: number;
    min?: number;
    step?: number;
    rows?: number;
    cols?: number;
    items?: string[];
    alias?: string;
}
export interface IDesignDetailsReturn {
    defaultHtmlExamplePreview: string;
    defaultGroupName: string;
    webComponentDependencies: string[];
    properties: IProperties[];
    servicePreviewDefault?: string;
}
export interface IRequire {
    type: 'import' | "tspath" | 'widget' | 'cdn' | 'link';
    name: string;
    ref: string;
    args?: string;
}
export type IDesignDetails = (modelTS: mls.editor.IModelTS) => Promise<IDesignDetailsReturn>;
export type IPublishDetails = (modelTS: mls.editor.IModelTS) => IRequire[];
export type IPromptDefault = () => string;
export type IRequires = IRequire[];
export interface IEnhancementInstance {
    requires: IRequires;
    onAfterCompile: IAfterCompile;
    onAfterChange: IAfterChange;
    getDesignDetails: IDesignDetails;
}
/**
 * find enhancement and return module , or throw Error
 */
/**
 * return module or throw
 */
export const getEnhancementModule: (file: mls.stor.IFileInfoBase) => Promise<IEnhancementInstance>;

}

declare namespace mls.l2.typescript {

// import { mls } from "../index";
export interface ICompilerResult {
    errors: monaco.languages.typescript.Diagnostic[];
    prodJS: string;
    prodDTS: string;
    prodMap: string;
    devDoc: string; /** json doc - jsDoc */
    trace: string[];
    modelVersion: number;
    cacheVersion: string;
    modelNeedCompile: boolean;
    errorEnhancementNotFound: boolean;
    imports: string[];
    decorators: string;
    tripleSlashMLS?: mls.common.tripleslash.ITripleSlash;
}
export const getModelTS: (project: number, shortName: string, folder: string) => mls.editor.IModelTS | undefined;
/**
 * get imports from a modelTS
 * if deep is true, get imports from imports
 */
export const compileAndGetImports: (modelTS: mls.editor.IModelTS, deep: boolean) => Promise<string[]>;
/**
 * compile and exec post process
 */
export const compileAndPostProcess: (modelTS: mls.editor.IModelTS, runAfterCompile: boolean, saveCache: boolean) => Promise<boolean>;
/**
 * compile a modelTS
 * use to verify errors in source code
 * do not compile if model is not changed
 * do not update errors in editor, only report errors in modelTS.compilerResults.errors
 * do not process afterCompile in enhancement
 * do not calculate all imports, only imports this file, use compileAndGetImports instead
 * do not set cache in service worker
 * update emit files (.js, .d.ts, .js.map) in modelTS.compilerResults
 */
export const compile: (modelTS: mls.editor.IModelTS) => Promise<boolean>;
/**
 * Compiles all TypeScript files in a project.
 * Provides error detection with customizable verbosity.
 *
 * @param project - The project ID to compile.
 * @param onProgress - A callback optional function that is called after each file is compiled.
 * If the callback returns `false`, the compilation process is stopped.
 * @returns An array of strings containing the results of the compilation.
 */
export const compileAll: (project: number, onProgress?: (current: number, total: number, results: string[]) => boolean) => Promise<string[]>;
/**
 * Stores information about a file in `mls.editor.models.ts`.
 * If there are errors in triple-slash references, logs the errors.
 *
 * @param modelsTS - An array of TypeScript models (`mls.editor.IModelTS[]`) to parse for triple-slash references.
 */
export const parseTripleSlash: (modelTS: mls.editor.IModelTS) => void;
export const addError: (modelTS: mls.editor.IModelTS, message: string, start: number, length: number) => void;
export const initCompilerResultsIfNeed: (modelTS: mls.editor.IModelTS) => void;
export const initCompilerResults: (modelTS: mls.editor.IModelTS) => void;
export const getTypeScriptWorker: (model: monaco.editor.ITextModel, step?: number) => Promise<monaco.languages.typescript.TypeScriptWorker>;
export const translateImportPaths: (compilerResults: ICompilerResult) => void;
export const getDiagnostics: (fileName: string, tsworker: monaco.languages.typescript.TypeScriptWorker) => Promise<monaco.languages.typescript.Diagnostic[]>;
export const getRef: (model: monaco.editor.ITextModel, word: string) => Promise<mls.cbe.IGetRefReturn | undefined>;

}

declare namespace mls.l2.less {

// import { mls } from "../index";
export interface IStyleResult {
    errors: monaco.languages.typescript.Diagnostic[];
    css: string;
    trace: string[];
    modelVersion: number;
    compiledVersion: number;
    tripleSlashMLS?: mls.common.tripleslash.ITripleSlash;
}
/**
 * Compiles a LESS document into CSS.
 *
 * This function takes a LESS document as a string input and compiles it to CSS.
 * If the document is empty or only whitespace, it returns an empty string.
 * Errors during compilation are caught and returned in the rejected promise.
 *
 * @param {string} doc - The LESS document to be compiled.
 * @returns {Promise<string>} A promise that resolves to the compiled CSS string.
 *
 * @example
 * compile(".myClass { color: @primaryColor; }")
 *   .then(css => console.log(css))
 *   .catch(error => console.error(error));
 */
export const compile: (doc: string, compress?: boolean) => Promise<string>;
/**
 * compile a model style,
 * return true if success, false if error
 * see modelStyle.styleResults for results
 */
export const compileStyle: (modelStyle: mls.editor.IModelStyle) => Promise<boolean>;
/**
 * Stores information about a file in `mls.editor.models.style`.
 * If there are errors in triple-slash references, logs the errors.
 *
 */
export const parseTripleSlash: (modelStyle: mls.editor.IModelStyle) => void;
export const addError: (modelStyle: mls.editor.IModelStyle, message: string, start: number, length: number) => void;
export const initStyleResultsIfNeed: (modelStyle: mls.editor.IModelStyle) => void;
export const initCompilerResults: (modelStyle: mls.editor.IModelStyle) => void;

}

declare namespace mls.l2.html {

// export {};

}

declare namespace mls.l3 {

// import { mls } from "../../src/index";
export const init: (mode: "preLoading" | "enterLevel") => Promise<void>;
export const nodeScriptReplace: (node: HTMLElement) => HTMLElement;
export abstract class Doc {
    _ds: DesignSystemIO;
    abstract list: IDocInfos;
    constructor(ds: DesignSystemIO);
    /**
    * find a document to the system.
    * @param {number} id - sequencial , start in 1
    * @returns {IDocInfo | null} return information about the document or null.
    */
    abstract find: (id: number) => IDocInfo | null;
    /**
    * Adds content to a specified path.
    *
    * @param parentID - The id of the parent or 0 (root)
    * @param title - The title of doc
    * @param content - The content to be added.
    * @returns sequencial (id) of added document.
    */
    abstract add: (parentID: number, title: string, content: string) => Promise<number>;
    /**
     * Updates an existing document in the system.
     * @param id - The id to find in list
     * @param parentID - The id of the parent or 0 (root)
     * @param title - The title of the document to update.
     * @param content - The new content of the document.
     * @returns {Promise<boolean>} A Promise that resolves when the content has been successfully updated.
     */
    abstract update: (id: number, parentID: number, title: string, content: string) => Promise<void>;
    /**
     * Removes a document from the system.
     * @param id - The id to find in list
     * @returns {Promise<boolean>}  A Promise that resolves when the doc has been successfully removed.
     */
    abstract remove: (id: number) => Promise<void>;
}
export abstract class Token {
    _ds: DesignSystemIO;
    abstract list: ITokenInfos;
    constructor(ds: DesignSystemIO);
    /**
     * Adds a token to the system.
     * @param {string} key - The key of the token to be added.
     * @param {string} value - The value of the token to be added.
     * @param {TokensCategories} category - The category of the token.
     * @returns {Promise<void>}  A Promise that resolves when the token has been successfully added.
     */
    abstract add: (key: string, value: string, category: TokensCategories) => Promise<void>;
    /**
     * Retrieves the tokens in LESS format.
     * @returns {Promise<string>} A promise that resolves to a string representing the tokens in LESS format.
     */
    abstract getTokensLess: () => Promise<string>;
    /**
     * Updates the value of a specific token.
     * @param {string} path - The path of the token to update.
     * @param {string} newValue - The new value for the token.
      * @returns {Promise<void>}  A Promise that resolves when the token has been successfully updated.
     */
    abstract update: (path: string, newValue: string) => Promise<void>;
    /**
     * Removes a specific token.
     * @param {string} key - The key of the token to remove.
     * @returns {Promise<void>}  A Promise that resolves when the token has been successfully removed.
     */
    abstract remove: (key: string) => Promise<void>;
}
export abstract class Asset {
    _ds: DesignSystemIO;
    abstract list: IAssetInfos;
    constructor(ds: DesignSystemIO);
    /**
    * add an asset to the design system
    * an asset can be a image, a icon or other type of asset
    * @returns {Promise<void>}  A Promise that resolves when the asset has been successfully added.
    */
    abstract add: (options: {
        path: string;
        shortname: string;
        tags: string[];
        description: string;
        assetType: mls.l3.AssetsGroupType;
        content: File;
        reference?: mls.l3.IDSRef;
    }) => Promise<void>;
    /**
     * remove an asset from the design system
     * @returns {Promise<void>}  A Promise that resolves when the asset has been successfully removed.
     */
    abstract remove: (path: string, shortname: string) => Promise<void>;
    /**
     * Updates an asset in the system.
     * @param {string} path - The path of the asset to be updated.
     * @param {string} shortname - The shortname of the asset to be updated.
     * @param {string[]} tags - An array of tags to associate with the asset.
     * @param {string} description - A description for the asset.
     * @param {mls.l3.AssetsGroupType} assetType - The type of the asset.
     * @returns {Promise<void>}  A Promise that resolves when the asset has been successfully removed.
     */
    abstract update: (path: string, shortname: string, tags: string[], description: string, assetType: mls.l3.AssetsGroupType) => Promise<void>;
    /**
    * find a document to the system.
    * @param {string} path - The path where the assets will be find.
    * @param {string} shortname - The path where assets will be find.
    * @returns {IAssetsInfo | null} return information about the assets or null.
    */
    abstract find: (path: string, shortname: string) => IAssetsInfo | null;
}
export abstract class Css {
    _ds: DesignSystemIO;
    abstract list: ICssInfos;
    constructor(ds: DesignSystemIO);
    /**
    * return less code for all components and globals
    */
    abstract getStylesInLess: () => Promise<string>;
    /**
    * Adds a new file css
    *
    * @param name - The name of file css
    * @param content - The content to be added.
    * @returns A Promise that resolves when the css file has been successfully added.
    */
    abstract add: (name: string, content: string) => Promise<void>;
}
export abstract class Component {
    _ds: DesignSystemIO;
    abstract list: IComponentInfos;
    constructor(ds: DesignSystemIO);
    abstract examples: Example;
    abstract styles: Style;
    /**
    * Adds a component to the system.
    * @param {IComponentInfo} widget - The component information.
    * @returns {Promise<void>}  A Promise that resolves when the component has been successfully added.
    */
    abstract add: (widget: IComponentInfo) => Promise<void>;
    /**
     * Removes a component from the system.
     * @param {string} componentName - The name of the component to remove.
     * @returns {Promise<void>}  A Promise that resolves when the component has been successfully removed.
     *
     */
    abstract remove: (componentName: string) => Promise<void>;
    /**
     * return all CSS for a component, all classes and globals CSS
     * use for preview component
     * @param {string} componentName - The name of the component.
     * @returns {Promise<string>} - CSS code or null if not found
     */
    abstract getCSS: (componentName: string) => Promise<string>;
    /**
     * return less code for a component
     * @returns {Promise<string | null>} - less code for a component or null if not found
     */
    abstract getStylesLess: (componentName: string) => Promise<string | null>;
    /**
    * find a component
    * @param {string} componentName - The componentName.
    * @returns {IComponentInfo | null} return information about the assets or null.
    */
    abstract find: (componentName: string) => IComponentInfo | null;
}
export abstract class Example {
    _ds: DesignSystemIO;
    list: IComponentsExampleInfos;
    constructor(ds: DesignSystemIO);
    /**
    * Adds an example for a specific component.
    * @param {string} componentName - The name of the component, ex _100111_comp1
    * @param {string} exampleName - The name of the example - unique for this component
    * @param {string} description - The description of the example.
    * @param {string} exampleJsonP - The JSONP data of the example.
    * @param {mls.l3.IDSRef} reference - An optional reference for the example.
    * @returns {Promise<void>}  A Promise that resolves when the example has been successfully added.
    */
    abstract add: (componentName: string, exampleName: string, description: string, exampleJsonP: string, reference?: mls.l3.IDSRef) => Promise<void>;
    /**
     * Renames a specific example of a component.
     * @param {string} componentName - The name of the component which contains the example to be renamed.
     * @param {string} newExampleName - The new name for the example.
     * @returns {Promise<void>}  A Promise that resolves when the example has been successfully renamed.
     *
     */
    abstract rename: (componentName: string, exampleName: string, newExampleName: string) => Promise<void>;
    /**
     * Removes an example from a specific component.
     * @param {string} componentName - The name of the component.
     * @param {number} index - The index of the example to remove.
     * @returns {Promise<void>}  A Promise that resolves when the example has been successfully removed.
     */
    abstract remove: (componentName: string, exampleName: string) => Promise<void>;
    /**
    * find a component example
    * @param {string} componentName - The componentName.
    * @param {string} exampleName - The exampleName.
    * @returns {IComponentsExample | null} return information about the component or null.
    */
    abstract find: (componentName: string, exampleName: string) => IComponentsExample | null;
}
export abstract class Style {
    _ds: DesignSystemIO;
    abstract list: IComponentsStyleInfos;
    constructor(ds: DesignSystemIO);
    /**
   * Adds a style for a specific component.
   * @param {string} componentName - The name of the component.
   * @param {string} classname - The classname of the style.
   * @param {string} less - The LESS data for the style.
   * @param {mls.l3.IDSRef} reference - An optional reference for the style.
   * @returns {Promise<void>}  A Promise that resolves when the style has been successfully added.
   */
    abstract add: (componentName: string, classname: string, less: string, reference?: mls.l3.IDSRef) => Promise<void>;
    /**
     * rename component style, aka, classname
     * @param {string} componentName - The name of the component.
     * @param {string} styleName - The name of the style  to remove.
     * @param {string} newName - The new name
     * @returns {Promise<void>}  A Promise that resolves when the style has been successfully renamed.
     *
     */
    abstract rename: (componentName: string, styleName: string, newName: string) => Promise<void>;
    /**
     * remove a componente style by index
     * dont change others index
     * @param {string} componentName - The name of the component.
     * @param {string} styleName - The name of the style to remove.
     * @returns {Promise<void>}  A Promise that resolves when the style has been successfully removed.
     *
     */
    abstract remove: (componentName: string, styleName: string) => Promise<void>;
    /**
    * find a component style
    * @param {string} componentName - The componentName.
    * @param {string} styleName - The styleName.
    * @returns {IComponentsStyle | null} return information about the component style or null.
    */
    abstract find: (componentName: string, styleName: string) => IComponentsStyle | null;
}
export abstract class DesignSystemIO {
    constructor(project: number, dsindex: number);
    project: number;
    dsindex: number;
    abstract createdBy: string;
    abstract lastUpdated: string;
    abstract lastUpdatedBy: string;
    abstract docs: Doc;
    abstract tokens: Token;
    abstract css: Css;
    abstract assets: Asset;
    abstract components: Component;
    abstract init: () => Promise<void>;
    abstract remove: () => Promise<void>;
    abstract create: (project: number, dsindex: number, createdAt: string, reference?: IDSRef) => Promise<void>;
    abstract dispose: () => Promise<void>;
}
/**
 * Returns a DesignSystemIO instance for the given project, dsindex, and widgetIOName. If an instance is already cached, it returns the cached instance. Otherwise, it creates a new instance and caches it for future use.
 *
 * @param {number} project - The project number.
 * @param {number} dsindex - The index in design system array in project.
 * @param {string} widgetIOName - The name of the widgetIO.
 *
 * @returns {DesignSystemIO} - The DesignSystemIO instance for the given project, dsindex, and widgetIOName.
 */
export const getOrCreateDSInstanceIO: (project: number, dsindex: number, widgetIOName: string) => DesignSystemIO;
export interface IComponentInfos {
    [name: string]: IComponentInfo;
}
export interface IComponentInfo {
    name: string;
    l4MarketingRef: string;
    widgetExampleRef: IWCGeneratorExampleInfo;
    docPath: string;
    group: ComponentsGroups;
    tags: string[];
    reference: IDSRef;
    examples: IComponentsExample[];
    styles: IComponentsStyle[];
}
export interface IWCGeneratorExampleInfo {
    tagname: string;
    path: string;
}
export interface IComponentsExampleInfos {
    [exampleName: string]: IComponentsExample;
}
export interface IComponentsExample {
    exampleName: string;
    description: string;
    reference: IDSRef;
    /**
     * Retorna o el de visualizacao do component
    */
    getEl: (this: IComponentsExample) => Promise<HTMLElement>;
    /**
     * Retorna o json do exemplo
     */
    getJsonPExampleIO: (this: IComponentsExample) => Promise<string>;
    /**
     * atualiza o json do exemplo
     * @param content - string json do examplo
     * @return se content = string atualiza o examplo
     * @return se content = null exclui o exemplo
     *
     */
    setJsonPExampleIO: (this: IComponentsExample, content: string) => Promise<boolean>;
}
export interface IComponentsStyleInfos {
    [stylename: string]: IComponentsStyle;
}
export interface IComponentsStyle {
    stylename: string;
    reference?: IDSRef;
    /**
    * Le o arquivo do less e retorna
    */
    getStyleLessIO: (this: IComponentsStyle) => Promise<string>;
    /**
    * atualiza o less do style
    * @param content - string less
    * @return se content = string atualiza o less
    *
    */
    setStyleLessIO: (this: IComponentsStyle, content: string) => Promise<boolean>;
}
export interface IAssetInfos {
    [fullpath: string]: IAssetsInfo;
}
export interface IAssetsInfo {
    path: string;
    shortname: string;
    type: AssetsGroupType;
    src: string;
    description: string;
    tags: string[];
    content: string;
    reference: IDSRef;
}
export interface IDSRef {
    project: number;
    dsindex: number;
    referenceAt?: Date;
    index?: number;
}
export interface IDocInfos {
    [id: number]: IDocInfo;
}
export interface IDocInfo {
    id: number;
    parentID: number;
    title: string;
    /**
     * getContent , from disk or cache
    */
    getContent: (this: IDocInfo) => Promise<string>;
    /**
     * set content to disk
     *
     * @param content - string html, if null, delete file
     * @return true if saved
     *
     */
    setContent: (this: IDocInfo, content: string | null) => Promise<boolean>;
}
export type TokensCategories = 'color' | 'typography' | 'custom';
export interface ITokenInfos {
    [key: string]: ITokenInfo;
}
export interface ITokenInfo {
    key: string;
    value: string;
    category: TokensCategories;
}
export interface ICssInfos {
    [name: string]: ICssInfo;
}
export interface ICssInfo {
    name: string;
    getContent: (this: ICssInfo) => Promise<string>;
    setContent: (this: ICssInfo, content: string | null) => Promise<boolean>;
}
export type ComponentsGroups = 'selectOne' | 'selectMultiple' | 'action' | 'layout' | 'midia' | 'navigation';
export type AssetsGroupType = 'image' | 'video' | 'icon' | 'lib' | 'other';

}

declare namespace mls.l4 {

export const init: (mode: "preLoading" | "enterLevel") => Promise<void>;
export interface IDepsHtml {
    [index: number]: number[];
}
export const htmls: IDepsHtml;
export const scripts: {
    [wName: string]: string;
};
export const styles: {
    [wName: string]: string;
};
export const stylesRootSelectors: {
    [wName: string]: string[];
};
export const convertPathToClassName: (key: string) => string;

}

declare namespace mls.l5 {

// import { mls } from "../../src/index";
// import { cbe } from "../mls";
export const init: (mode: "preLoading" | "enterLevel") => Promise<void>;
export let actualOrg: number | undefined;
export const setActualOrg: (org: number | undefined) => void;
/**
 * find project in memory and return the organization index
 * @param prjID
 * @returns organization index or undefined if not found
 */
export const getProjectOrgIndex: (prjID: number) => number | undefined;
export const getProjectDetails: (prjID: number) => cbe.IPrj_settings | undefined;
export const getProjectSettings: (prjID: number) => cbe.IProjectInfo | undefined;
export const setProjectSettings: (prjID: number, settings: cbe.IProjectInfo) => void;
export const getBaseProject: (prjID: number) => number;
export const getProjectDependencies: (prjID: number, addParentPrj: boolean) => number[];
export const getOrgsName: () => string[];
export const getProjectsInOrg: (orgIndex: number) => number[];
/**
 * get configurations of the project
 */
export function getProjectConf(projectID: number): Promise<mls.l5_common.ProjectConfig>;
export function updateProjectConf(projectID: number, config: mls.l5_common.ProjectConfig): Promise<void>;

}

declare namespace mls.l6 {

export const init: (mode: "preLoading" | "enterLevel") => Promise<void>;

}

declare namespace mls.l7 {

export const init: (mode: "preLoading" | "enterLevel") => Promise<void>;

}

declare namespace mls.plugin {

// import { mls } from "../../src/index";
export type Scope = "l6dashboard" | "l5painel";
export interface IPluginIndexInstance {
    getMenus: () => MenuAction[];
    getHooks: () => HookAction[];
    getServices: () => ServiceAction[];
}
/**
 * Interface representing a menu action returned by the getMenu function.
 */
export interface MenuAction {
    /**
     * A category name used to group multiple commands under a single menu.
     */
    category: string | null;
    /**
     * The scope where this menu action will be executed.
     * Example values: ['l6Dashboard', 'pluginSettings', 'createNewWidget'].
     */
    scope: string[];
    /**
     * (Optional) The priority of the action within its category or among other hooks.
     * Higher numbers can indicate higher priority.
     */
    priority?: number;
    /**
     * The authorization roles that can execute this action.
     * Example: ['admin', 'editor', 'author', 'contributor', 'subscriber', '*'].
     */
    auth: string[];
    /**
     * The name of the widget that will execute when this menu option is selected.
     * Example: "_100111_pluginMyFrame1"
     */
    widget: string;
    /**
     * (Optional) The name of the widget that provides this menu action.
     */
    widgetConfig?: string;
}
/**
 * Interface representing a hook action returned by the getHooks function.
 */
export interface HookAction {
    /**
     * The title of the hook action.
     */
    title: string;
    /**
     * The name of the event that triggers this hook.
     */
    eventName: string;
    /**
     * The name of the widget that will execute when this hook is triggered, typically used in the backend.
     */
    widget: string;
}
/**
 * Interface representing a service provided by a plugin, returned by the getServices function.
 */
export interface ServiceAction {
    /**
     * The name of the widget that contains and manages the service.
     */
    widget: string;
}
/**
 * plugins modules must export this interface
 */
export interface IPluginData {
    title: string;
    getSvg(): any;
}
/**
 * Function that returns an array of HookAction objects representing the available hooks.
 * Each hook defines properties such as title, eventName, and widget.
 *
 * @returns {HookAction[]} List of hook actions.
 */
export function getHooks(): HookAction[];
export const plugins: Map<string, IPluginIndexInstance>;
/**
 * Clear all plugins and loads all plugins of a project
 */
export const loadAll: (projectID: number, clearOlds: boolean) => Promise<void>;
/**
 * get all menu actions from plugins loaded of a project and scope
 * filter only the actions that user have authority
 */
export const getAllMenuActions: (projectID: number, filter: {
    scope: Scope | "*";
    auth: string | "*";
    groupByCategoryAndPriority: boolean;
}) => MenuAction[];
/**
 * get all hooks references from plugins loaded of a project
 */
export const getAllHooks: (projectID: number) => HookAction[];
/**
 *  get all services references from plugins loaded of a project
 */
export const getAllServices: (projectID: number) => ServiceAction[];
/**
 * Load all modules from widgets list
 * Used to register web components and make initialization.
 */
export const loadModules: (widgets: string[]) => Promise<void>;
/**
 * load the config of a plugin
 * each plugin has a config , ex: json string
 */
export const loadConfig: (widget: string) => Promise<string>;
/**
 * save the config of a plugin
 */
export const saveConfig: (widget: string, config: string) => Promise<void>;

}

declare namespace mls.sites {

export interface ISitesHandlers {
    getHeader?: () => number | undefined;
    setHeader?: (index: number) => void;
    getAside?: () => number | undefined;
    setAside?: (index: number) => void;
    getPage?: () => number | undefined;
    setPage?: (index: number) => void;
}
/**
 * Injects the local implementations. Called by the runtime base
 * (mls-102033 shell) after it mounts; partial updates are merged.
 */
export const register: (impl: ISitesHandlers) => void;
/** Current header index (1-based), or undefined before the base registers. */
export const getHeader: () => number | undefined;
/** Switch the shell header to the nth entry (1-based) of the boot header list. */
export const setHeader: (index: number) => void;
/** Current aside index (1-based), or undefined before the base registers. */
export const getAside: () => number | undefined;
/** Switch the shell aside to the nth entry (1-based) of the boot aside list. */
export const setAside: (index: number) => void;
/** Current content page genome (e.g. 11, 21), or undefined before the base registers. */
export const getPage: () => number | undefined;
/** Switch the active content page to the given two-digit genome (e.g. 21). */
export const setPage: (index: number) => void;

}

declare namespace mls.stor {

// import { mls } from "../../src/index";
// import { cbe } from "../mls";
// export * as localStor from "./stor.localStor";
// export * as localDB from "./stor.localDB";
// export * as server from "./stor.server";
// export * as others from "./stor.others";
// export * as cache from "./stor.cache";
// export * as html from "./stor.html";
export interface IRegGetContents {
    fileInfo: mls.stor.IFileInfo;
    content: string | Blob | null;
}
export const files: {
    [fn: string]: IFileInfo;
};
export const projects: {
    [project: number]: IProjectInfo | null;
};
export const orgs: cbe.TOrgs;
export const LOCALPROJECTNUMBER = 100000;
export type IFileInfoStatus = "nochange" | "changed" | "new" | "renamed" | "deleted";
/**
 * information about a file in memory, ex a L2 model must return this
 * @param content - content of the file
 * @param contentType - type of the content
 * @param originalName - optional name of the file, in case of rename
 * @param originalProject - optional id of the project in case of rename
 * @param originalFolder - optional name of the folder in case of rename
 * @param originalCRC - optional crc of the file
 */
export interface IFileInfoValue {
    content: string | null | Blob;
    contentType?: 'string' | 'blob' | 'base64';
    originalShortName?: string;
    originalProject?: number;
    originalFolder?: string;
    originalCRC?: string;
}
export type IFileInfoAction = "dispose" | "aftersave" | "reopen";
export interface IFileInfoBase {
    project: number;
    level: number;
    shortName: string;
    folder: string;
    extension: string;
}
export interface IFileInfoPersistent extends IFileInfoBase {
    versionRef: string;
    projectDependencies: number[] | null;
    isLocalVersionOutdated: boolean;
    newVersionRefIfOutdated?: string;
    inLocalStorage: boolean;
    status: IFileInfoStatus;
    hasError: boolean;
    updatedAt?: string;
}
/**
 * information about a file from repository
 * @param {number} project - id of the project
 * @param {number} level - id of the level (module) 1 to 7
 * @param {string} shortName - name of the file
 * @param {string} folder - name of the folder ex: "src/components"
 * @param {string} extension - extension of the file ex: ".ts"
 * @param {string} versionRef - version of the file, git id or data last modified, used for search in local cache
 * @param {number[] | null} projectDependencies - Null if not calculated, or list of projects this file depends on.
 * @param {boolean} inLocalStorage - "true" or "false", true if file is in editing mode or a project=0
 * @param {string} status - "nochange" | "changed" | "new" | "renamed" | "deleted"
 * @param {boolean} hasError - "true" or "false"
 * @param {Function} getValueInfo - function to get the content of the file or undefined if file is not read before
 * @param {Function} onAction - function to handle actions or undefined if file is not read before, ex: dispose - request to clear memory or aftersave - after save a file , just information
 * @param {Function} getContent - function to get the content of the file, from local storage or local cache or repository
 */
export interface IFileInfo extends IFileInfoPersistent {
    getValueInfo?(this: IFileInfo): Promise<IFileInfoValue>;
    onAction?(this: IFileInfo, action: IFileInfoAction): Promise<void>;
    getContent(this: IFileInfo, defaultValue?: string | Blob | null): Promise<string | Blob | null>;
    /**
   * Retrieves the history of a file. Returns null if there's no implementation or if retrieval is not possible.
   *
   * @param {mls.stor.IFileInfo} file - The file information object.
   * @returns {Promise<IHistory[] | null>} - Promise resolving to an array of file history records or null if not available.
   */
    getHistory(this: mls.stor.IFileInfo): Promise<IHistory[] | null>;
    /**
     * Retrieves the content of a file from its history.
     *
     * @param {mls.stor.IFileInfo} file - The file information object.
     * @param {string} ref - The reference ID for the historical content.
     * @returns {Promise<string | null>} - Promise resolving to the file content or null.
     */
    getHistoryContent(this: mls.stor.IFileInfo, ref: string): Promise<string | null>;
    /**
     * get the content in cache, if not exist, get from repository
     * return url or null if not found
     */
    saveContentInCacheIfNeed(): Promise<string | null>;
    /**
     * get or create model for this file, only for source files: .ts, .html, .less, .defs.ts, .test.ts
     */
    getOrCreateModel(): Promise<mls.editor.IModelBase>;
}
export interface IProjectInfo {
    project: number;
    projectDriver: "local" | "mls" | string;
    projectURL: string;
    projectDependencies: number[] | null;
}
export interface IHistory {
    authorName: string;
    authorUrl: string;
    data: Date;
    ref: string;
    message: string;
    additions: number;
    deletions: number;
}
export interface ISetContentsResult {
    project: number;
    result: boolean;
}
export const getShortPath: ({ level, shortName, extension, folder }: {
    level: number;
    shortName: string;
    extension: string;
    folder: string;
}) => string;
export const getFileStorFromJson: (json: string, defaults: {
    project?: number;
    level?: number;
    folder?: string;
    extension?: string;
}) => IFileInfo | undefined;
export const getKeyToFile: ({ project, level, shortName, folder, extension }: IFileInfoBase) => string;
export const getKeyToFiles: (project: number, level: number, shortName: string, folder: string, extension: string) => string;
/**
 * return ex "_100111_/l2/folder1/file1.ts"
 */
export const convertFileToFileReference: (fileInfo: IFileInfoBase) => string;
/**
 * convert , ex "_100111_/l2/folder1/file1.ts" to IFileInfoBase
 * return project = 0 if any error
 * extension = ".ts" or ".defs.ts"
 */
export const convertFileReferenceToFile: (fileReference: string) => IFileInfoBase;
/**
 * convert path to file information
 * ex: "_100111_/l2/folder1/file1.ts"
 * ex2: "_100111_/file1.ts"
 * ex3: "file1.ts"
 * ex4: "file1"
 */
export const getPathToFile: (path: string) => IFileInfoBase;
/**
 * delete in memory all Information of a project
 */
export const removeProjectInfo: (project: number) => void;
/**
 * update many files in repositories
 * from one or many projects
 * from one or many drivers
 * @param {IFileInfo[]} fileInfos - list of files
 * @param {string} comments - comments to save on git
 */
export const setContents: (fileInfos: IFileInfo[], comments: string | null) => Promise<ISetContentsResult[]>;
/**
 * load or update one file in mls.stor.files
 */
export const addOrUpdateFile: ({ project, level, shortName, extension, versionRef, folder, updatedAt }: {
    project: number;
    level: number;
    shortName: string;
    extension: string;
    versionRef: string;
    folder: string;
    updatedAt?: string;
}) => Promise<mls.stor.IFileInfo | undefined>;
/**
 * change mls.stor.files for rename
 * don't change source
 */
export const renameFile: (storFile: mls.stor.IFileInfo, newName: mls.stor.IFileInfoBase) => boolean;
/**
 * Gets all unique project dependencies for a given project, excluding the project itself.
 * @param {number} project - The project ID to find dependencies for.
 * @returns {number[]} - An array of unique project dependencies.
 */
export const getProjectDependencies: (project: number) => number[];
export const isProjectLoaded: (project: number) => boolean;
/**
 * Loads project dependencies if needed.
 *
 * @param {number} project - The project ID to analyze.
 * @param {boolean} [forceUpdate=false] - Whether to force a new calculation. Use after a change in dependencies.
 * @returns {Promise<number[]>} - A promise that resolves to a list of project dependencies loadeds
 */
export const loadProjectdependenciesInfoIfNeed: (project: number, forceUpdate?: boolean) => Promise<number[]>;
export function getFiles(args: {
    project: number;
    shortName: string;
    folder: string;
    loadContent: boolean;
    level?: number;
}): Promise<IInfo>;
/**
 * return list of files with .defs.ts not exists or not updated
 */
export function findFilesNeedingDefsUpdate(args: IFileInfoBase, forceBeforeAt?: Date): IFileInfo[];
export function getFilesContent(info: IInfo): Promise<IInfo>;
export interface IInfo {
    ts: mls.stor.IFileInfo | undefined;
    tsContent?: string;
    html: mls.stor.IFileInfo | undefined;
    htmlContent?: string;
    less: mls.stor.IFileInfo | undefined;
    lessContent?: string;
    defs: mls.stor.IFileInfo | undefined;
    defsContent?: string;
    test?: mls.stor.IFileInfo | undefined;
    testContent?: string;
}

}

declare namespace mls.stor.cache {

// import { mls } from "../../src/index";
/**
 * register the mlsServiceWork if not registered yet
 */
export const installIfNeeded: () => Promise<ServiceWorkerRegistration | null>;
export const serviceWorkerNeedUpdate: () => Promise<boolean>;
/**
 * Adds a JS resource to the cache.
 *
 * @param path The path of the resource.
 * @param version The version of the resource.
 * @param js The JS resource as a string.
 *
 * @returns A promise that resolves when the operation is complete, a path to use in fetch.
 * @throws An error if the operation fails.
 */
export const addIfNeed: (args: {
    project: number;
    folder: string | null;
    shortName: string;
    version: string;
    content: string | Blob | null;
    extension: string;
    contentType?: string;
}) => Promise<string>;
export const addsIfNeed: (args: {
    project: number;
    folder: string[];
    shortName: string[];
    version: string[];
    content: string[];
    extension: string[];
    contentType: string[];
}) => Promise<string>;
/**
 * add a L2 resource to the cache
 * @returns A promise that resolves when the operation is complete, a path to use in fetch.
 * @throws An error if the operation fails.
 */
export const AddMfileIfNeed: (modelTS: mls.editor.IModelTS) => Promise<string>;
/**
 * get file from local cache , without no send to ServiceWorker
 */
export const getFileFromCache: (project: number, folder: string | null, shortName: string, extension: string, version: string) => Promise<string | null>;
/**
 * get url to use in import statement, to find browser local cache only
 * if not in the cache, return null
 */
export const getURL: (project: number, folder: string | null, shortName: string, extension: string, version: string) => Promise<string | null>;
export interface IServiceWorkerSts {
    versionSW: string;
    isTrace: boolean;
    totalRequests: number;
    totalHits: number;
    totalNotFound: number;
    totalInserts: number;
}
/**
 * get statistics for nerd
 */
export const getStatistics: () => Promise<IServiceWorkerSts | null>;
/**
* search in local cache (browser cache)
* @param fileInfo information of file
* @returns content or null (not in browser cache)
*/
export const getContent: (fileInfo: mls.stor.IFileInfo) => Promise<string | Blob | null>;
/**
 * stor content in local cache (browser cache) for future use
 * @param fileInfo information of file
 * @param content or null (erase)
 */
export const setContent: (fileInfo: mls.stor.IFileInfo, content: string | Blob | null) => Promise<string>;
export const setTraceServiceWorker: (enable: boolean) => void;
export const getStatesOfCache: (project: number) => Promise<IFileInfoInCache[]>;
export interface IFileInfoInCache {
    fileKey: string;
    localCacheState: 'HIT' | 'MISS' | 'INDEVELOPMENT';
}
/**
 * get all caches in BD Cache and compare with IndexedDB cache
 * clear olds caches in BD Cache
 */
export const clearObsoleteCache: () => Promise<void>;
export const sendACK: (id: string) => Promise<void>;
export const sendRequestMissed: () => Promise<void>;
/**
 * Clears all JS resources from the cache.
 *
 * @returns A promise that resolves when the operation is complete.
 * @throws An error if the operation fails.
 */
export const clearAll: () => Promise<void>;
/**
 * Clear all resources from a project in the cache.
 */
export const clearProjectsCache: (project: number[]) => Promise<void>;

}

declare namespace mls.stor.html {

/**
 * Updates or adds a mapping in the import map.
 * If the shortName already exists, the mapping will be updated with the new URL.
 * If the shortName does not exist, a new mapping will be added.
 *
 */
export const updateImportMap: (key: string, url: string) => void;

}

declare namespace mls.stor.localStor {

// import { mls } from "../../src/index";
/**
 * use to set content or clear content in local storage
 */
export const setContent: (fileInfo: mls.stor.IFileInfo, info: mls.stor.IFileInfoValue) => Promise<boolean>;
/**
 * return only files been changed in local storage , ex. .ts files
 * return shortPath, ex: 'l2/file1' or 'l2/folder1/file1'
 */
export const listFilesInDevelopment: (projectSearch: number, onlyExtension?: string) => Promise<string[]>;
export interface IRetProjectDetails {
    project: number;
    module?: string;
}
export const getProjectDetails: () => IRetProjectDetails;
export const setProjectDetails: (projectDetails: IRetProjectDetails) => void;

}

declare namespace mls.stor.localDB {

// import { ProjectsLastModified } from "@common/global.cbe.types";
// import { mls } from "../../src/index";
interface IIndexedDBFile {
    key: string;
    fileInfo: mls.stor.IFileInfoPersistent;
    info: mls.stor.IFileInfoValue;
}
export interface IIndexedDBPrj {
    key: string;
    project: number;
    repository_lastModified?: string;
    fileInfo: mls.cbe.IPrjSourcesFiles[];
    importsMap: string;
    indexModules: string;
}
export const parseKeyToFile: (key: string) => {
    project: number;
    level: number;
    shortName: string;
    folder: string;
    extension: string;
};
export const parseKeyToProject: (key: string) => number;
export const getKeyToPrj: (project: number) => string;
export const getKeyToTask: (project: number, task: number) => string;
export const getPrefixTasks: (project: number) => string;
export const saveFile: (fileInfo: mls.stor.IFileInfo, info: mls.stor.IFileInfoValue) => Promise<void>;
/**
 * Saves project information to local database.
 * @param project - The project number.
 * @param info - An array of project files.
 * @param baseProject_lastModified - The last modified date of the base project.
 * @returns A promise that resolves when the project information is saved.
 */
export const savePrjInfo: (project: number, info: mls.cbe.IPrjSourcesInfo, baseProject_lastModified: string) => Promise<void>;
/**
 * Removes project information from the local database.
 * use to refresh projects information on next load
 *
 * @param project - The project number.
 * @returns A promise that resolves when the project information is successfully removed.
 */
export const removePrjInfo: (project: number) => Promise<void>;
export const readFile: ({ project, level, shortName, extension, folder }: {
    project: number;
    level: number;
    shortName: string;
    extension: string;
    folder: string;
}) => Promise<IIndexedDBFile>;
export const readPrjInfo: (project: number) => Promise<IIndexedDBPrj>;
/**
 * Clears the storage for the specified key in IndexedDB.
 * @param key - The key of the object to be removed from storage.
 * @returns A Promise that resolves when the storage is successfully cleared for the specified key.
 * @example
 * ```
 * removeItem("myKey")
 *   .then(() => console.log("Storage cleared for the specified key!"))
 *   .catch((error) => console.error("Error clearing storage for the specified key:", error));
 * ```
 */
export const removeItem: (fileInfo: mls.stor.IFileInfo) => Promise<void>;
export const removeKey: (key: string) => Promise<void>;
/**
 * Clears all storage in IndexedDB.
 * @returns A Promise that resolves when the storage is successfully cleared for all keys.
 * @example
 * ```
 * clearAllItems()
 *   .then(() => console.log("All storage cleared!"))
 *   .catch((error) => console.error("Error clearing all storage:", error));
 * ```
 */
export const clearAllItems: () => Promise<void>;
/**
 * Retrieves all keys in IndexedDB that start with the specified prefix.
 * @param prefix - The prefix used to filter the keys.
 * @returns A Promise that resolves with an array of keys that start with the specified prefix.
 * @example
 * ```
 * getKeysWithPrefix("user")
 *   .then((keys) => console.log("Keys with prefix:", keys))
 *   .catch((error) => console.error("Error retrieving keys with prefix:", error));
 * ```
 */
export const getKeysWithPrefix: (prefix: string) => Promise<string[]>;
/**
 * Retrieves all keys in IndexedDB.
 * @returns A Promise that resolves with an array of all keys in IndexedDB.
 * @example
 * ```
 * getAllKeys()
 *   .then((keys) => console.log("All keys:", keys))
 *   .catch((error) => console.error("Error retrieving all keys:", error));
 * ```
 */
export const getAllKeys: () => Promise<string[]>;
/**
 * read IndexedDB , and return all projects with files with local changes
 */
export const getAllProjects: () => Promise<number[]>;
/**
 * Read IndexedDB and return [ { projectId, lastModified }]
 */
export const getProjectsLastModified: () => Promise<ProjectsLastModified[]>;
/**
 * Checks if a key exists in IndexedDB.
 * @param key - The key to check for existence.
 * @returns A Promise that resolves with a boolean indicating whether the key exists in IndexedDB.
 * @example
 * ```
 * exists("myKey")
 *   .then((exists) => console.log("Key exists:", exists))
 *   .catch((error) => console.error("Error checking key existence:", error));
 * ```
 */
export const exists: (key: string) => Promise<boolean>;
/**
 * Checks if a file exists in IndexedDB.
 * @returns A Promise that resolves with a boolean indicating whether the key exists in IndexedDB.
 */
export const existFile: ({ project, level, shortName, extension, folder }: {
    project: number;
    level: number;
    shortName: string;
    extension: string;
    folder: string;
}) => Promise<boolean>;
// export {};

}

declare namespace mls.stor.others {

// import { mls } from "../../src/index";
// import { IHistory } from "./stor";
/**
 * Abstract base class for driver I/O operations.
 * This serves as the blueprint for all driver I/O classes.
 */
export abstract class DriverIOBase {
    /**
     * The project ID.
     */
    abstract project: number;
    /**
     * The short name identifier for the driver.
     */
    abstract shortName: mls.cbe.Provider;
    /**
     * The version of the driver.
     */
    abstract driverVersion: string;
    /**
     * Retrieves content from the repository for multiple files.
     *
     * @param {number} project - The project ID.
     * @param {mls.stor.IFileInfo[]} fileInfos - Array of file information objects. All fileInfo must be the same project
     * @returns {Promise<mls.stor.IRegGetContents[]>} - Promise resolving to an array of file contents.
     */
    abstract getContents: (project: number, fileInfos: mls.stor.IFileInfo[]) => Promise<mls.stor.IRegGetContents[]>;
    /**
     * Sets content to the repository for multiple files.
     * Preferably performs an all-or-nothing update.
     *
     * @param {number} project - The project ID.
     * @param {mls.stor.IFileInfo[]} fileInfos - Array of file information objects. All fileInfo must be the same project.
     * @param {string | null} comments - Comments for the update.
     * @returns {Promise<boolean>} - Promise resolving to true if successful, false otherwise.
     */
    abstract setContents: (project: number, fileInfos: mls.stor.IFileInfo[], comments: string | null) => Promise<boolean>;
    /**
     * Loads information about files for a specific project.
     *
     * @param {number} project - The project ID.
     * @returns {Promise<mls.api.IPrjSourcesFiles[]>} - Promise resolving to an array of project files information.
     */
    abstract loadFilesInfo(project: number): Promise<mls.cbe.IPrjSourcesFiles[]>;
    /**
     * Retrieves the history of a file. Returns null if there's no implementation or if retrieval is not possible.
     *
     * @param {mls.stor.IFileInfo} file - The file information object.
     * @returns {Promise<IHistory[] | null>} - Promise resolving to an array of file history records or null if not available.
     */
    abstract getHistory(fileInfo: mls.stor.IFileInfo): Promise<IHistory[] | null>;
    /**
     * Retrieves the content of a file from its history.
     *
     * @param {mls.stor.IFileInfo} file - The file information object.
     * @param {string} ref - The reference ID for the historical content.
     * @returns {Promise<string | null>} - Promise resolving to the file content or null.
     */
    abstract getHistoryContent(fileInfo: mls.stor.IFileInfo, ref: string): Promise<string | null>;
    /**
     * get url for file in persistent site, ex: www.github.com/xxx
     */
    abstract getUrl(file: mls.stor.IFileInfo): string;
    /**
     * get actual version of files in repository
     */
    abstract getVersionFromFiles(options: {
        owner: string;
        repo: string;
        branchName: string;
        files: mls.stor.IFileInfo[];
    }): Promise<{
        [key: string]: string;
    } | undefined>;
    /**
     * Checks if a branch exists in the specified repository.
     *
     * @param {string} owner - The owner or organization of the repository.
     * @param {string} repo - The name of the repository.
     * @param {string} branchName - The name of the branch to check.
     * @returns {Promise<boolean>} - A promise that resolves to `true` if the branch exists, otherwise `false`.
     */
    abstract checkBranchExistence(owner: string, repo: string, branchName: string): Promise<boolean>;
    /**
     * create new branch in repository, before save files or include commits
     * @param {Object} options - The options for creating the pull request.
     * @param {string} options.owner - The owner or organization of the repository.
     * @param {string} options.repo - The name of the repository.
     * @param {string} options.branch - The name of the branch to create from.
     * @param {string} options.newBranch - The name of the new branch to create.
     * @param owner organization or user
     * @param repo repository name, ex 'mls-100111'
     * @param newBranch ex 'issue-123'
     */
    abstract createNewBranch(option: {
        owner: string;
        repo: string;
        branch: string;
        newBranch: string;
    }): Promise<boolean>;
    /**
     * Creates a pull request in a repository.
     *
     * @param {Object} options - The options for creating the pull request.
     * @param {string} options.owner - The owner or organization of the repository.
     * @param {string} options.repo - The name of the repository.
     * @param {string} options.title - The title of the pull request.
     * @param {string} options.description - The description of the pull request.
     * @returns {Promise<boolean>} - A promise that resolves to a boolean indicating whether the pull request was successfully created.
     */
    abstract createPullRequest(options: {
        owner: string;
        repo: string;
        title: string;
        description: string;
    }): Promise<boolean>;
    /**
     * Reviews a pull request by either approving or rejecting it.
     *
     * @param {Object} options - The options for reviewing the pull request.
     * @param {string} options.owner - The owner or organization of the repository.
     * @param {string} options.repo - The name of the repository.
     * @param {string} options.branch - The name of the branch.
     * @param {string} options.idRequest - The ID of the pull request to review.
     * @param {boolean} options.isApproved - Indicates whether the pull request is approved (true) or rejected (false).
     * @returns {Promise<boolean>} - A promise that resolves to a boolean indicating the success of the operation.
     */
    abstract reviewPullRequest(options: {
        owner: string;
        repo: string;
        branch: string;
        idRequest: string;
        isApproved: boolean;
    }): Promise<boolean>;
    /**
     * list pull requests of repository
     * @param owner organization or user
     * @param repo repository name, ex 'mls-100111'
     */
    abstract listPullRequests(owner: string, repo: string): Promise<IPullRequest[]>;
    /**
     * list forks of repository
     * @param owner organization or user
     * @param repo repository name, ex 'mls-100111'
     */
    abstract listForks(owner: string, repo: string): Promise<IFork[]>;
    /**
     * return list of branches of repository
     * @param owner organization or user
     * @param repo repository name, ex 'mls-100111'
     */
    abstract listBranches(owner: string, repo: string): Promise<IBranch[]>;
    /**
     * get user information
     */
    abstract getUserInfo(): Promise<IInfo>;
    /**
     * get organizations of user, don't return owner organization
     * @param login login name, get from getUserInfo method
     */
    abstract getOrganizations(login: string): Promise<IOrg[]>;
    /**
     * create repository on create new project process
     * @param login  login name, get from getUserInfo method
     * @param repo
     * @param organization organization or user
     * @param description description of repository
     * @param visibility 'PUBLIC', 'PRIVATE' or 'INTERNAL'
     * @returns true if success
     */
    abstract createRepository(login: string, repo: string, organization: string, description: string, visibility: 'PUBLIC' | 'PRIVATE' | 'INTERNAL'): Promise<boolean>;
    /**
     * delete repository
     * @param repo repository name
     * @param organization organization or user
     * @returns true if success
     */
    abstract deleteRepository(repo: string, organization: string): Promise<boolean>;
    /**
     * duplicate repository, create a fork in the organization or user , for changes and tests
     * @param login login name, get from getUserInfo method
     * @param repoOri repository name to fork
     * @param orgOri  organization or user
     * @param orgDest  organization or user
     * @returns true if success
     */
    abstract createFork(login: string, repoOri: string, orgOri: string, orgDest: string): Promise<boolean>;
    /**
     * rename repository , use after a temporary repository is created
     * @param owner organization or user
     * @param repo repository name
     * @param newName new name for repository
     * @returns true if success
     */
    abstract renameRepository(owner: string, repo: string, newName: string): Promise<boolean>;
    /**
     * create file in repository, if file exists, update the content
     * instead of save, this method create without commit , and without verification
     * @param owner organization or user
     * @param repo repository name
     * @param path ex '/folder1/tsconfig.json'
     * @param content string or Uint8Array for binary files
     * @returns true if success
     */
    abstract createFileInRepo(owner: string, repo: string, path: string, content: string | Uint8Array): Promise<boolean>;
    /**
     * change visibility of repository
     * @param owner organization or user
     * @param repo repository name
     * @param visibility 'PUBLIC', 'PRIVATE' or 'INTERNAL'
     */
    abstract changeVisibility(owner: string, repo: string, visibility: 'PUBLIC' | 'PRIVATE' | 'INTERNAL'): Promise<boolean>;
    /**
     * verify if repository exists
     * return:
     *  free: free to create the repository
     *  reuse: The repository already exists for the user, you can reuse it
     *  wait: Please wait, another user is creating;
     *  error: There is a repository, but I was unable to validate the user
     */
    abstract verifyRepositoryNew(owner: string, repo: string, user: string): Promise<'free' | 'reuse' | 'wait' | 'error'>;
    /**
     * verify if user has permission in repository
     * @param owner organization or user
     * @param repo repository name
     * @param login login name, get from getUserInfo method
     */
    abstract verifyPermission(owner: string, repo: string, login: string): Promise<IPermission>;
    /**
     * add variable to repository, if exists, update the value
     * use variable to store sensitive information, like secrets do collab backend
     * @param name variable name
     * @param value variable value
     * @returns true if success
     */
    abstract addVariable(name: string, value: string): Promise<boolean>;
    /**
     * update variable value
     * @param name variable name
     * @param value variable value
     * @returns true if success
     */
    abstract updateVariable(name: string, value: string): Promise<boolean>;
    /**
     * list variables of repository
     * @returns list of variables
     */
    abstract listVariables(): Promise<{
        variables: {
            name: string;
            value: string;
            created_at: string;
            updated_at: string;
        }[];
        total_count: number;
    }>;
    /**
     * delete variable of repository
     * @param name variable name
     * @returns true
     */
    abstract delVariable(name: string): Promise<boolean>;
}
export interface IDriverKey {
    project: number;
    shortName: string;
    driverVersion: string;
}
/**
 * find and return instance of DriverIOBase
 */
export const getDriver: (provider: mls.cbe.Provider) => DriverIOBase | undefined;
/**
 * find and return instance of DriverIOBase
 * find in project or project base (in project dependencies)
 */
export const getDefaultDriver: (project: number) => DriverIOBase;
/**
 * get list of drivers in imemory
 */
export const getDriversInfo: () => IDriverKey[];
export const addDriver: (driver: DriverIOBase, provider: mls.cbe.Provider) => void;
export const removeDriver: (driverName: string) => void;
export interface IInfo {
    name: string;
    login: string;
    avatarUrl: string;
}
export interface IOrg {
    name: string;
    id: string;
    avatarUrl: string;
    visibility: string;
}
export interface IPullRequest {
    id: string;
    title: string;
    url: string;
    body: string;
    state: 'open' | 'closed' | 'merged' | 'other';
    mergedAt: string;
    closedAt: string;
    createdAt: string;
    author: {
        login: string;
    };
}
export interface IFork {
    nameWithOwner: string;
    name: string;
    owner: {
        login: string;
    };
    defaultBranchRef: {
        name: string;
    };
    createdAt: string;
}
export interface IBranch {
    name: string;
}
export interface IPermission {
    write: boolean;
    read: boolean;
    create: boolean;
    delete: boolean;
}

}

declare namespace mls.stor.server {

// import { mls } from "../../src/index";
/**
 * Update project information, files, last changed, in change ...
 * load from multilevel studio - backend server
 * return false if not need
 */
export const loadProjectInfoIfNeeded: (project: number, forceUpdate?: boolean) => Promise<boolean>;
export const getAllRenomedFiles: (project: number) => Promise<string[]>;
/**
 * use after a login , to update project files info
 * update js too
 */
export const updateProjectFilesInfo: (projectSearch: number, dataServer: mls.cbe.IPrjSourcesInfo, lastModified: string) => Promise<void>;
/**
 * unzip sources if needed
 * after push or pull request, the actions on repository gitHub or gitLab
 * create a file with all sources, compacted in a zip file 'source.zip'
 * @param prj the number of project
 * @returns a error or warning message or empty string if ok
 */
export function unzipSourcesIfNeeded(prj: number): Promise<string>;

}

declare namespace mls.cbe {

export interface RequestBase {
    action: string;
}
export interface ResponseBase {
    statusCode: HttpStatus;
    msg?: string;
    updateCookies?: UpdateCookies[];
}
export interface ProjectsLastModified {
    project: number;
    lastModified: string;
}
export interface RequestLogin extends RequestBase {
    action: "login";
    queryString: string;
    baseProject: number;
    actualProject: number;
    projectsLastModified: ProjectsLastModified[];
}
export interface ResponseLogin extends ResponseBase {
    services: Service[];
    orgs: {
        [org: string]: IOrgInfo;
    };
    inits: {
        [widget: string]: string;
    };
    providers: Provider[];
    avatar_url: string;
    baseProject: number;
    alertMessage: string;
    errorMessage: string;
}
export interface UpdateCookies {
    name: string;
    value: string;
    path?: string;
    expires?: Date;
    httpOnly?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
}
export interface RequestInviteUserInOrg extends RequestBase {
    action: "addUserInOrg";
    orgName: string;
    userName: string;
    teamName: string;
    complementaryText: string;
}
export interface ResponseInviteUserInOrg extends ResponseBase {
}
export interface RequestChangeUserPreferences extends RequestBase {
    action: "changeUserPreferences";
    services: Service[];
}
export interface ResponseChangeUserPreferences extends ResponseBase {
    services: Service[];
}
export interface RequestSavePrjSettings extends RequestBase {
    action: "savePrjSettings";
    project: number;
    orgIndex: number;
    orgName: string;
    projectDetails: IPrj_settingsApi;
}
export interface ResponseSavePrjSettings extends ResponseBase {
    orgs: {
        [org: string]: IOrgInfo;
    };
}
export interface RequestAddOrUpdateOrgValue extends RequestBase {
    action: "addOrUpdateOrgValue";
    orgName: string;
    value: string;
}
export interface ResponseAddOrUpdateOrgValue extends ResponseBase {
    orgs: {
        [org: string]: IOrgInfo;
    };
}
export interface RequestSaveNewPrj extends RequestBase {
    action: "saveNewPrj";
    orgName: string;
    info: IProjectInfo;
    settings: IPrj_settingsApi;
}
export interface ResponseSaveNewPrj extends ResponseBase {
    projectID: number;
    orgs: {
        [org: string]: IOrgInfo;
    };
}
export interface RequestProjectUpdated {
    action: "onProjectUpdated";
    project: number;
    orgName: string;
    projectDriver: typeof GITHUBBRAND | typeof GITLABBRAND;
    lastModify: string;
    secret: string;
}
export interface Service {
    widget: string;
    places: ServicePlaces[];
}
export interface ServicePlaces {
    index: number;
    state: "foreground" | "background";
    class: string;
    level: number;
    position: 'left' | 'right';
}
export enum HttpStatus {
    OK = 200,
    NOT_MODIFIED = 304,
    BAD_REQUEST = 400,
    UNAUTHORIZED = 401,
    NOT_FOUND = 404,
    FORBIDDEN = 403,
    CONFLICT = 409,
    SERVER_ERROR = 500,
    NOT_IMPLEMENTED = 501
}
export interface ResponseStaticFile extends ResponseBase {
    content: string | Uint8Array;
    ETag: string;
}
export const GITHUBBRAND = "GitHub";
export const GITLABBRAND = "GitLab";
export const validDrivers: string[];
export interface IProjectInfo {
    projectDriver: "local" | "mls" | typeof GITHUBBRAND | typeof GITLABBRAND;
    projectURL: string;
}
export interface IPrjSourcesFiles {
    shortPath: string;
    versionRef: string;
    Length: number;
    update_at?: string;
    jsContent?: string;
}
export interface IPrjSourcesInfo {
    filesInfo: IPrjSourcesFiles[];
    importsMap: string;
    indexModules: string;
}
export interface IPrj_settingsApi {
    name: string;
    id: number;
    owner: string;
    userAuth: 'public' | 'private';
    value: string;
    repository_secret?: string;
    prj_dependencies: number[];
}
export interface IPrj_settings extends IPrj_settingsApi {
    created_at: string;
    archived_at: string;
    repository_lastModified?: string;
    files?: IPrjSourcesInfo | string;
}
export interface IOrg_settings {
    name: string;
    created_at: string;
    description: string;
    projects: IPrj_settings[];
    users: string[];
    teams: IOrg_Team[];
}
export interface IOrg_Team {
    name: string;
    auth: string;
    usrIndex: number[];
}
export interface IOrgInfo {
    key: string;
    value: string;
    sett: IOrg_settings;
    VersionNumber: number;
}
export interface TOrgs {
    [org: string]: IOrgInfo;
}
export interface IMlsTag {
    name: string;
    pos?: number;
    tagName?: string;
    comment: string;
    type?: string;
    modifiers?: string[];
}
export interface IMlsDOC {
    name: string;
    comment: string;
    pos?: number;
    line?: number;
    type?: string;
    modifiers?: string[];
    tags?: IMlsTag[];
    parameters?: IMlsTag[];
    members?: IMlsDOC[];
    initializerText?: string;
    initializerType?: string;
}
export interface IGetRefReturn {
    uri: string;
    pos: number;
    len: number;
}
export interface ICollabMessages {
    add: (message: string, typeMsg: ICollabMessageType, options?: IColllabMessageOptions) => void;
    close: Function;
}
export interface ICollabMessage {
    text: string;
    type: ICollabMessageType;
}
export interface IColllabMessageOptions {
    autoClose?: boolean;
    timeToClose?: number;
    clearOnClose?: boolean;
}
export type ICollabMessageType = 'information' | 'alert' | 'error';
export type Provider = 'google' | 'github' | 'gitlab' | 'aws' | 'azure' | 'cloudflare' | 'googlecloud';
export const providerWidgets: Record<Provider, string>;

}

declare namespace mls.l5_common {

// import type * as cbe from "./global.cbe.types.d.ts";
/**
 * find project in memory and return the organization index
 * @param prjID
 * @returns organization index or -1 if not found
 */
export const getProjectOrganizationIndex: (orgs: cbe.TOrgs, prjID: number) => number | undefined;
export const getProjectIndexInOrg: (org: cbe.IOrgInfo, prjID: number) => number;
export const getProjectDetails: (orgs: cbe.TOrgs, prjID: number) => cbe.IPrj_settings | undefined;
export const getOrgsName: (orgs: cbe.TOrgs) => string[];
export const getProjectsInOrg: (orgs: cbe.TOrgs, actualOrg: number) => number[];
export const getProjectSettings: (orgs: cbe.TOrgs, prjID: number) => cbe.IProjectInfo | undefined;
export const setProjectSettings: (orgs: cbe.TOrgs, prjID: number, settings: cbe.IProjectInfo) => void;
export const FILENAMEPROJECTCONFIG = "project";
export interface ProjectConfig {
    orgName: string;
    designSystems: DesignSystem[];
    languages: Language[];
    reasons: {
        [key: string]: string | Object;
    };
    services: string[];
    servicesConfigEnabled: boolean;
    plugins: {
        [pluginIndexName: string]: IPlugin;
    };
    links: ILinks[];
}
/**
 * links for project config, used in l5 / workspace / links
 */
export interface ILinks {
    title: string;
    url: string;
    color: string;
}
/**
 * Interface representing a plugin and its modules within a project.
 */
export interface IPlugin {
    [indexName: string]: IPluginModules;
}
export interface IPluginModules {
    [moduleName: string]: string | IPluginScopes;
}
export interface IPluginScopes {
    [scopeName: string]: string | IPluginCategory;
}
export interface IPluginCategory {
    [categoryName: string]: string;
}
export interface Language {
    language: string;
    name: string;
    path: string;
}
export interface DesignSystem {
    dsIndex: string;
    dsName: string;
    widgetIOName: string;
}

}

declare namespace mls.msg {




export enum HttpStatus {
  OK = 200,
  NOT_MODIFIED = 304,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  NOT_FOUND = 404,
  FORBIDDEN = 403,
  CONFLICT = 409,
  SERVER_ERROR = 500,
  NOT_IMPLEMENTED = 501,
  SERVICE_UNAVAILABLE = 503
}

export interface RequestBase {
  action: string;
}

export interface ResponseBase {
  statusCode: HttpStatus;
  msg?: string; // error message from 400 or 500 status code
}

export interface RequestAddMessage extends RequestBase {
  action: "addMessage";
  userId: string;
  threadId: string;
  content: string;
  contextToBot?: Record<string, any>;
  replyTo?: string; // use createAt of the message being replied to, obs. orderAt is not used for replyTo, because it can be changed when message is edited
}

export interface ResponseAddMessage extends ResponseBase {
  message: Message;
  messages?: Message[];
  task?: TaskData;
  taskRoomThread?: Thread;
  botOutputs?: BotOutput[];
  integrationOutputs?: IntegrationOutput[];
}

export interface RequestCreateAttachmentUpload extends RequestBase {
  action: "createAttachmentUpload";
  userId: string;
  threadId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface ResponseCreateAttachmentUpload extends ResponseBase {
  attachmentId: string;
  storageKey: string;
  uploadUrl: string;
  headers: Record<string, string>;
  expiresAt: string;
}

export interface AttachmentUploadCompletion {
  attachmentId: string;
  storageKey: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface RequestCompleteAttachmentUpload extends RequestBase {
  action: "completeAttachmentUpload";
  userId: string;
  threadId: string;
  content?: string;
  replyTo?: string;
  attachments: AttachmentUploadCompletion[];
}

export interface ResponseCompleteAttachmentUpload extends ResponseBase {
  message: Message;
}

export interface RequestDeleteAttachment extends RequestBase {
  action: "deleteAttachment";
  userId: string;
  threadId: string;
  messageId: string;
  attachmentId: string;
}

export interface ResponseDeleteAttachment extends ResponseBase {
  message: Message;
}

export interface RequestGetAttachmentUrl extends RequestBase {
  action: "getAttachmentUrl";
  userId: string;
  threadId: string;
  messageId: string;
  attachmentId: string;
}

export interface ResponseGetAttachmentUrl extends ResponseBase {
  url: string;
  expiresAt: string;
}

export interface RequestUpdateMessage extends RequestBase {
  action: "updateMessage";
  userId: string; // owner of the thread
  threadId: string;
  messageId: string;
  reaction?: string; // emoji or text to add or update or remove from reactions, if the user already reacted with this reaction it will be removed, otherwise it will be added
  pin?: boolean;
  favorite?: boolean;
  readConfirmation?: "request" | "confirm" | "cancel" | "requestExecution" | "reviewExecution";
  messageAction?: "delete" | "moderate" | "createTask";
  editContent?: string;
  taskTitle?: string;
}

export interface ResponseUpdateMessage extends ResponseBase {
  message: Message;
  thread?: Thread;
  messages?: Message[];
  user?: User;
  users?: User[];
}

export interface RequestAddMessageAI extends RequestBase {
  action: "addMessageAI";
  userId: string;
  threadId: string;
  taskTitle: string;
  userMessage: string;
  agentName: string;
  inputAI: IAMessageInputType[];
  longTermMemory?: Record<string, string>; // long term memory
  replyTo?: string; // use createAt of the message being replied to, obs. orderAt is not used for replyTo, because it can be changed when message is edited
}

export interface ResponseAddMessageAI extends ResponseBase {
  message: Message;
  task: TaskData;
}

export interface RequestApplyIntents extends RequestBase {
  action: "applyIntents";
  userId: string;
  intents: AgentIntent[];
}

export interface ResponseApplyIntents extends ResponseBase {
  message?: Message;
  task: TaskData;
}

export interface RequestAddUser extends RequestBase {
  action: "addUser";
  name: string;
  avatar_url?: string;
}

export interface ResponseAddUser extends ResponseBase {
  user: User;
}

export interface RequestAddOrUpdateOpenClawConnector extends RequestBase {
  action: "addOrUpdateOpenClawConnector";
  userId: string;
  connectorId: string;
  name: string;
  baseUrl: string;
  gatewayToken: string;
  inboundToken: string;
  enabled: boolean;
  defaultTimeoutMs?: number;
  defaultOutputMode?: OpenClawOutputMode;
}

export interface ResponseAddOrUpdateOpenClawConnector extends ResponseBase {
  connector: OpenClawConnector;
}

export interface RequestRemoveOpenClawConnector extends RequestBase {
  action: "removeOpenClawConnector";
  userId: string;
  connectorId: string;
}

export interface ResponseRemoveOpenClawConnector extends ResponseBase {
  connectorId: string;
}

export interface RequestListOpenClawConnectors extends RequestBase {
  action: "listOpenClawConnectors";
  userId: string;
}

export interface ResponseListOpenClawConnectors extends ResponseBase {
  connectors: OpenClawConnector[];
}

export interface RequestListOpenClawAvailableAgents extends RequestBase {
  action: "listOpenClawAvailableAgents";
  userId: string;
  connectorId: string;
}

export interface ResponseListOpenClawAvailableAgents extends ResponseBase {
  connectorId: string;
  defaultId: string;
  mainKey: string;
  scope: "per-sender" | "global";
  agents: OpenClawRemoteAgentSummary[];
}

export interface RequestCreateOpenClawAgent extends RequestBase {
  action: "createOpenClawAgent";
  userId: string;
  connectorId: string;
  name: string;
  workspace: string;
  emoji?: string;
  avatar?: string;
  soulMd?: string;
  identityMd?: string;
}

export interface ResponseCreateOpenClawAgent extends ResponseBase {
  connectorId: string;
  agent: OpenClawRemoteAgentSummary;
  collabUserId: string;
}

export interface RequestDeleteOpenClawAgent extends RequestBase {
  action: "deleteOpenClawAgent";
  userId: string;
  connectorId: string;
  agentId: string;
  deleteFiles?: boolean;
}

export interface ResponseDeleteOpenClawAgent extends ResponseBase {
  connectorId: string;
  agentId: string;
  collabUserId?: string;
  updatedThreadIds: string[];
}

export interface RequestUpdateUserDetails extends RequestBase {
  action: "updateUserDetails";
  userId: string;
  name?: string;
  status?: "active" | "blocked" | "deleted";
  avatar_url?: string;
  md?: string;
  deviceId?: string; // device id for push notifications
  notificationToken?: string; // FCM token for push notifications
}

export interface ResponseUpdateUserDetails extends ResponseBase {
  user: User;
}

export interface RequestAddThread extends RequestBase {
  action: "addThread";
  userId: string;
  name: string;
  visibility: ThreadVisibility;
  status: ThreadStatus;
  group: ThreadGroup;
  languages: string[];
  avatar_url: string;
  defaultTopics?: string[];
  welcomeMessage?: string;
  // firsstMessage?: string;
}

export interface ResponseAddThread extends ResponseBase {
  thread: Thread;
}

export interface RequestDeleteThread extends RequestBase {
  action: "deleteThread";
  userId: string; // owner of the thread
  threadId: string;
}

export interface ResponseDeleteThread extends ResponseBase {
  thread: Thread;
}

export interface RequestUpdateThread extends RequestBase {
  action: "updateThread";
  userId: string; // owner of the thread
  threadId: string;
  newOwnerId?: string;
  name?: string;
  visibility?: ThreadVisibility;
  status?: ThreadStatus;
  group?: ThreadGroup;
  languages?: string[];
  avatar_url?: string;
  defaultTopics?: string[];
  welcomeMessage?: string;
  notification?: ThreadNotification;
}

export interface ResponseUpdateThread extends ResponseBase {
  thread: Thread;
}

export interface RequestGetTaskUpdate extends RequestBase {
  action: "getTaskUpdate";
  userId: string;
  messageId: string;
  taskId: string;
}

export interface ResponseGetTaskUpdate extends ResponseBase {
  task: TaskData;
}

export interface RequestAddTaskAISteps extends RequestBase {
  action: "addTaskAISteps";
  userId: string;
  messageId: string;
  taskId: string;
  parentStepId: number;
  stepdIdToChangeStatus: number | null;
  newStatus: AIStepStatus; // status to set in stepdIdToChangeStatus
  traceMsg: string | null;
  newTaskTitle: string;
  steps: AIPayload[];
}

export interface ResponseAddTaskAISteps extends ResponseBase {
  task: TaskData;
}

/**
 * add new prompts to a existing interaction,
 * change status of stepIdToChangeStatus to newStatus
 * change status of interactionStepId to 'in_progress'
 * start LLM
 */
export interface RequestAppendPromptToInteraction extends RequestBase {
  action: "appendPromptToInteraction";
  userId: string;
  messageId: string;
  taskId: string;
  interactionStepId: number; // stepId with child interaction
  inputAI: IAMessageInputType[];
  stepdIdToChangeStatus: number;
  newStatus: AIStepStatus; // status to set in stepdIdToChangeStatus
  traceMsg?: string; // optional trace message
}

export interface ResponseAppendPromptToInteraction extends ResponseBase {
  task: TaskData;
}

export interface RequestUpdateStepStatus extends RequestBase {
  action: "updateStepStatus";
  userId: string;
  messageId: string;
  taskId: string;
  stepId: number;
  status: AIStepStatus;
  traceMsg?: string; // optional trace message
  newTaskTitle?: string; // optional new task title to set
  newTaskStatus?: TaskStatus; // optional new task status to set
}

export interface ResponseUpdateStepStatus extends ResponseBase {
  task: TaskData;
  message?: Message; // optional message if task was updated with new status
}

export interface RequestAddTaskAIInteraction extends RequestBase {
  action: "addTaskAIInteraction";
  userId: string;
  messageId: string;
  taskId: string;
  parentStepId: number;
  inputAI: IAMessageInputType[]
}

export interface ResponseAddTaskAIInteraction extends ResponseBase {
  task: TaskData;
}

export interface RequestUpdateTaskTitle extends RequestBase {
  action: "updateTaskTitle";
  userId: string;
  messageId: string;
  taskId: string;
  newTitle: string;
}

export interface ResponseUpdateTaskTitle extends ResponseBase {
  task: TaskData;
}

export interface RequestEnsureTaskRoom extends RequestBase {
  action: "ensureTaskRoom";
  userId: string;
  taskId: string;
  parentThreadId?: string;
}

export interface ResponseEnsureTaskRoom extends ResponseBase {
  task: TaskData;
  thread: Thread;
}

export interface TagVocabularyEntry {
  tag: string;
  label?: { pt: string; en: string };
  color: 'bug' | 'feature' | 'business' | 'process' | 'neutral';
}

export interface RequestListTasks extends RequestBase {
  action: "listTasks";
  userId: string;
  view: 'active' | 'closed';
  cursor?: string;
  pageSize?: number;
}

export interface ResponseListTasks extends ResponseBase {
  tasks: TaskData[];
  nextCursor?: string;
}

export interface RequestGetOrgPreferences extends RequestBase {
  action: "getOrgPreferences";
  userId: string;
  organizationId: string;
}

export interface ResponseGetOrgPreferences extends ResponseBase {
  tagVocabulary: TagVocabularyEntry[];
}

export interface RequestGetMessagesAfter extends RequestBase {
  action: "getMessagesAfter";
  threadId: string;
  lastOrderAt: string;
  userId: string;
}

export interface ResponseGetMessagesAfter extends ResponseBase {
  data: Message[];
  hasMore: boolean;
}

export interface RequestGetMessagesBefore extends RequestBase {
  action: "getMessagesBefore";
  threadId: string;
  orderAt: string;
  userId: string;
}

export interface ResponseGetMessagesBefore extends ResponseBase {
  data: Message[];
  hasMore: boolean;
}

export interface RequestGetMessage extends RequestBase {
  action: "getMessage";
  threadId: string;
  messageId: string;
  userId: string;
}

export interface ResponseGetMessage extends ResponseBase {
  message: Message;
}

export interface RequestAddUserInThread extends RequestBase {
  action: "addUserInThread";
  userId: string; // userId from executor
  userIdOrName: string;
  threadId: string;
  auth: UserAuth;
}

export interface ResponseAddUserInThread extends ResponseBase {
  thread: Thread;
}

export interface RequestAddOrUpdateThreadOpenClawAgent extends RequestBase {
  action: "addOrUpdateThreadOpenClawAgent";
  userId: string;
  threadId: string;
  alias: string;
  connectorId: string;
  agentId: string;
  collabUserId: string;
  enabled: boolean;
  sessionMode?: OpenClawSessionMode;
  handoffThreadRole?: OpenClawHandoffThreadRole;
  defaultForThread?: boolean;
}

export interface ResponseAddOrUpdateThreadOpenClawAgent extends ResponseBase {
  thread: Thread;
}

export interface RequestRemoveThreadOpenClawAgent extends RequestBase {
  action: "removeThreadOpenClawAgent";
  userId: string;
  threadId: string;
  alias: string;
}

export interface ResponseRemoveThreadOpenClawAgent extends ResponseBase {
  thread: Thread;
}

export interface RequestListThreadOpenClawAgents extends RequestBase {
  action: "listThreadOpenClawAgents";
  userId: string;
  threadId: string;
}

export interface ResponseListThreadOpenClawAgents extends ResponseBase {
  threadId: string;
  agents: OpenClawAgentBinding[];
}

export interface RequestRemoveUserInThread extends RequestBase {
  action: "removeUserInThread";
  userId: string; // usersId from executor
  userIdOrName: string; // usersId for user to be removed
  threadId: string;
  eventVisibility?: "all" | "admin";
}

export interface ResponseRemoveUserInThread extends ResponseBase {
  thread: Thread;
  messages?: Message[];
}

export interface RequestGetThreadUpdate extends RequestBase {
  action: "getThreadUpdate";
  userId: string;
  threadId: string;
  deviceId?: string; // device id for push notifications
  lastOrderAt?: string; // optional, to get messages after this orderAt
}

export interface ResponseGetThreadUpdate extends ResponseBase {
  thread: Thread;
  users: User[];
  messages?: Message[]; // optional, if lastOrderAt is provided
  threadsPending: string[]; // threads that the user has to sync
  hasMore?: boolean;
}

export interface RequestGetUserUpdate extends RequestBase {
  action: "getUserUpdate";
  userId?: string;
  name?: string;
  avatar_url?: string;
}

export interface ResponseGetUserUpdate extends ResponseBase {
  user: User;
}

export interface RequestGetUsers extends RequestBase {
  action: "getUsers";
  userId: string;
  status: "active" | "blocked";
  prefixName: string;
}

export interface ResponseGetUsers extends ResponseBase {
  users: {
    userId: string; // compact UTC format `yyyyMMddHHmmss.nnn` unique sorted index, nnn is a sequence number
    name: string;
  }[]
}

export interface RequestAppendLongTermMemory extends RequestBase {
  action: "appendLongTermMemory";
  userId: string;
  messageId: string;
  taskId: string;
  longTermMemory: Record<string, string>; // long term memory
}

export interface ResponseAppendLongTermMemory extends ResponseBase {
  task: TaskData;
}

export interface RequestAddOrUpdateThreadBot extends RequestBase {
  action: "addOrUpdateThreadBot";
  userId: string; // userId from executor
  threadId: string;
  botId: string;                  // Unique ID for this bot in the thread, ex: "agentBotWeddingGifts"
  llmPrompt: string;              // prompt for this bot with {{ var }} variables
  status: "active" | "disabled";
  config?: Record<string, any>;  // Optional runtime config for the bot, sent to the LLM
}

export interface ResponseAddOrUpdateThreadBot extends ResponseBase {
  thread: Thread;
}

export interface BotFlexibleResultBase {
  ref?: string; // complementary key for bot memory, ex: "thread/.../bot/.../ref"
  output?: string; // string to return to user
  [key: string]: any; // additional properties
}

export interface BotOutput {
  botId: string;
  cost: number;
  output: string;
}

// ====================
// INTEGRATIONS
// ====================

export type IntegrationType = "openclaw"; // extensible: add "slack" | "teams" etc. in the future

export interface ThreadIntegration {
  integrationId: string;          // Unique ID for this integration in the thread
  type: IntegrationType;
  status: "active" | "disabled";
  config: ThreadIntegrationConfig;
  triggers: ThreadBotTrigger[];   // reuse existing trigger system
  lastExecutionAt?: string;       // compact UTC format
}

export interface ThreadIntegrationConfig {
  url: string;           // base URL of the external service, e.g. "http://openclaw-host:3000"
  bearerToken: string;   // Bearer token for outbound calls to the external service
  inboundToken: string;  // token the external service sends in x-integration-token header
  agentId?: string;      // optional: specific agent/assistant id on the external service
  sessionId?: string;    // optional: session id for conversation continuity
}

export interface IntegrationOutput {
  integrationId: string;
  type: IntegrationType;
  responseMessageId?: string; // orderAt of the response message posted back, if any
  responseMessage?: Message;
  error?: string;             // error message if execution failed
}

export interface RequestAddOrUpdateThreadIntegration extends RequestBase {
  action: "addOrUpdateThreadIntegration";
  userId: string;
  threadId: string;
  integrationId: string;
  type: IntegrationType;
  status: "active" | "disabled";
  config: ThreadIntegrationConfig;
  triggers: ThreadBotTrigger[];
}

export interface ResponseAddOrUpdateThreadIntegration extends ResponseBase {
  thread: Thread;
}

export interface RequestRemoveThreadIntegration extends RequestBase {
  action: "removeThreadIntegration";
  userId: string;
  threadId: string;
  integrationId: string;
}

export interface ResponseRemoveThreadIntegration extends ResponseBase {
  thread: Thread;
}

export interface RequestWebhookInbound {
  threadId: string;
  integrationId?: string;
  connectorId?: string;
  agentId?: string;
  content: string;
  type?: Message['type'];
  replyTo?: string;
  externalCaseId?: string;
  channel?: string;
  customerIdentity?: string;
  priority?: "low" | "normal" | "high" | "urgent";
  metadata?: Record<string, any>;
}

export interface ResponseWebhookInbound extends ResponseBase {
  message: Message;
}


// ====================

export interface User {
  userId: string; // compact UTC format `yyyyMMddHHmmss.nnn` unique sorted index, nnn is a sequence number
  name: string;
  status: "active" | "blocked" | "deleted";
  avatar_url?: string;
  md?: string;
  threads: string[];
  notifications?: UserNotifications[];
  favorites?: string[];
  readConfirmations?: UserReadConfirmations;
  kind?: UserKind;
  metadata?: UserMetadata;
  // collab-auth identity binding (see layer_3_usecases/identity.ts).
  // `sub` is the stable collab-auth subject id and is the canonical key used to
  // verify the JWT presenting the request owns this record. `email` is stored
  // for display/cross-reference. Both are set once (trust-on-first-use for
  // pre-existing records) and compared afterwards.
  sub?: string;
  email?: string;
}

export interface UserReadConfirmations {
  pending?: string[];
  requested?: string[];
}
export interface UserNotifications {
  deviceId: string;
  notificationToken: string; // FCM token for push notifications
}

export type UserKind = "human" | "synthetic_agent" | "pma";

export interface UserMetadata {
  source?: "collab" | "openclaw" | "external";
  agentType?: "pma" | "agent" | "external_agent";
  definitionRef?: string;
  definitionVersion?: string;
  modelType?: string;
  connectorId?: string;
  agentId?: string;
  [key: string]: any;
}


export interface UserPerformanceCache extends User {
  // ----
  // only on frontend
  //
  lastSync?: string; // compact UTC format `yyyyMMddHHmmss`
}


// ====================
// THREADS
// ====================


export type UserAuth = "admin" | "moderator" | "read" | "write" | "none";

export interface ThreadUsers {
  userId: string;
  auth: UserAuth;
  notification?: ThreadNotification;
}

export type ThreadGroup = "CRM" | "TASK" | "DOCS" | "CONNECT" | "APPS";
export type ThreadVisibility = "public" | "private" | "company" | "team"; // use private for only users in this thread
export type ThreadStatus = "active" | "archived" | "deleting" | "deleted";
export type ThreadNotification = "all" | "mentions" | "never";

export interface Thread {
  threadId: string; // compact UTC format `yyyyMMddHHmmss.nnn` unique sorted index, nnn is a sequence number
  name: string; // name of the thread (room)
  users: ThreadUsers[];
  visibility: ThreadVisibility;
  status: ThreadStatus;
  group: ThreadGroup;
  history: ThreadHistoryEntry[]; // history of actions in this thread
  languages: string[]; // iso 639-1 codes, example: ['en', 'pt', 'es']
  defaultTopics?: string[];
  welcomeMessage?: string;
  avatar_url: string;
  bots?: ThreadBot[];
  integrations?: ThreadIntegration[];
  openClawAgents?: OpenClawAgentBinding[];
  agentDm?: AgentDirectMessageBinding;
  pinnedMessages?: PinnedMessage[];
  kind?: 'thread' | 'task-room';
  taskRoom?: {
    taskId: string;
    parentThreadId: string;
    workflowType: WorkflowType;
    pmaId?: string;
    pmaStatus?: "active" | "paused" | "disabled";
    pmaConfigRef?: string;
    lastDecisionLogRef?: string;
  };
  archivedAt?: string; // compact UTC format `yyyyMMddHHmmss` when this thread was archived
  archivedBy?: string;
  deletedAt?: string; // compact UTC format `yyyyMMddHHmmss` when this thread was deleted
  createdAt: string; // compact UTC format `yyyyMMddHHmmss` when this thread was created
}

export interface PinnedMessage {
  messageId: string;
  pinnedBy: string;
  pinnedAt: string;
  excerpt?: string;
}

export interface AgentDirectMessageBinding {
  enabled: boolean;
  agentId: string;
  agentUserId: string;
  agentType: "pma" | "agent";
  status: "active" | "paused" | "disabled";
  configRef?: string;
}

export interface ThreadHistoryEntry {
  action: string;
  userId: string;
  timestamp: string; // UTC format `yyyyMMddHHmmss`
}

export interface ThreadBot {
  botId: string;                  // Unique ID for this bot in the thread
  llmPrompt: string;              // prompt for this bot with {{ var }} variables
  threadFeature: ThreadFeature; // Feature this bot is associated with
  threadPermissionLevel: ThreadPermissionLevel; // Permission level for this bot
  triggers: ThreadBotTrigger[];
  status: "idle" | "running" | "disabled";
  lastExecutionAt?: string;      // UTC format
  memoryRef?: string;            // Reference to stored memory or context
  config?: Record<string, any>;  // Optional runtime config for the bot, sent to the LLM
}

export type OpenClawOutputMode = "final_only" | "status_and_final";
export type OpenClawSessionMode = "thread" | "thread_user";
export type OpenClawHandoffThreadRole = "handoff" | "collaboration";

export interface OpenClawConnector {
  connectorId: string;
  name: string;
  baseUrl: string;
  gatewayToken: string;
  inboundToken: string;
  enabled: boolean;
  defaultTimeoutMs: number;
  defaultOutputMode: OpenClawOutputMode;
  protocolVersion?: number;
  transport?: "ws" | "http";
}

export interface OpenClawAgentBinding {
  alias: string;
  connectorId: string;
  agentId: string;
  collabUserId: string;
  enabled: boolean;
  sessionMode?: OpenClawSessionMode;
  handoffThreadRole?: OpenClawHandoffThreadRole;
  defaultForThread?: boolean;
}

export interface OpenClawRemoteAgentSummary {
  id: string;
  name?: string;
  identity?: {
    name?: string;
    theme?: string;
    emoji?: string;
    avatar?: string;
    avatarUrl?: string;
  };
  workspace?: string;
  model?: {
    primary?: string;
    fallbacks?: string[];
  };
}

export interface OpenClawDeviceState {
  deviceId: string;
  publicKey: string;
  privateKeyPem: string;
  publicKeyPem?: string;
  deviceToken?: string;
  authorizedAt?: string;
}

export enum ThreadFeature {
  Summary = "summary",
  CustomPlugin = "custom_plugin",
  Tasks = "tasks",
  Workflow = "workflow",
  Notifications = "notifications",
  Voting = "voting",
  Moderation = "moderation",
  Feedback = "feedback"
}

export type ThreadPermissionLevel = "all" | "members" | "admin";

export interface ThreadBotTrigger {
  type: BotTriggerType;
  match?: "any" | "all"; // Optional: defines if all or any conditions are required (default: "any")
  conditions?: BotTriggerCondition[]; // Filters applied only for type "onNewMessage"
  args?: BotTriggerArgs; // Optional arguments depending on trigger type
}

export enum BotTriggerType {
  OnNewMessage = "onNewMessage",
  OnMention = "onMention",
  OnTaskCompleted = "onTaskCompleted",
  Schedule = "schedule",
  Manual = "manual"
}

export interface BotTriggerCondition {
  type: "hasTag" | "mention" | "startsWith" | "contains";
  value: string;
}

export type BotTriggerArgs =
  | { cron: string }                      // For type: "schedule", e.g. "0 18 * * 5"
  | { taskType: string }                 // For type: "onTaskCompleted"
  | Record<string, any>;                 // Generic fallback


export interface ThreadPerformanceCache extends Thread {
  // ----
  // only on frontend
  //
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
  lastSync?: string; // compact UTC format `yyyyMMddHHmmss`
}


// ====================
// MESSAGES
// ====================


export interface Message {
  threadId: string;
  orderAt: string; // compact UTC format `yyyyMMddHHmmss.nnn` unique sorted index, nnn is a sequence number
  createAt: string; // compact UTC format `yyyyMMddHHmmss`
  updatedAt?: string; // compact UTC format `yyyyMMddHHmmss`
  senderId: string;
  content: string;
  language_detected?: string;
  externalPlatform?: string;
  translations?: Record<string, string>;
  reactions?: Record<string, string[]>; // key is reaction (emoji or text), value is array of userIds who reacted
  readConfirmations?: MessageReadConfirmation[];
  attachments?: MessageAttachment[];
  moderation?: MessageModeration;
  edits?: MessageEditVersion[];
  editedAt?: string;
  editedBy?: string;
  type?: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'contact'; // default is `text`
  pin?: boolean;
  taskId?: string;
  stepId?: number;
  taskRoomRole?: 'conversation' | 'system' | 'agent' | 'workflow';

  taskTitle?: string; // title of the task, if this message is related to a task
  taskStatus?: TaskStatus; // status of the task, if this message is related to a task
  taskResults?: string[]; // resume of results of the task, if this message is related to a task
  taskResultsTranslated?: Record<string, string>; // translated results of the task, if this message is related to a task
  taskTitleTranslated?: Record<string, string>; // translated title of the task, if this message is related

  // updates?: object[];
  visibility?: "admin"; // only for admin, example: user left the thread
  url?: string;
  replyTo?: string; // use createAt of the message being replied to, obs. orderAt is not used for replyTo, because it can be changed when message is edited
}

export type MessageAttachmentKind = 'image' | 'video' | 'audio' | 'document' | 'file';
export type MessageAttachmentStatus = 'active' | 'deleted';

export interface MessageAttachment {
  attachmentId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  kind: MessageAttachmentKind;
  storageKey: string;
  uploadedBy: string;
  uploadedAt: string;
  status: MessageAttachmentStatus;
  deletedBy?: string;
  deletedAt?: string;
  url?: string;
}

export interface MessageReadConfirmation {
  kind?: "read" | "execution";
  requestedBy: string;
  requestedAt: string;
  targetUserIds: string[];
  confirmedBy?: Record<string, string>;
  canceledAt?: string;
  canceledBy?: string;
  followupHistory?: MessageFollowupHistoryEntry[];
}

export interface MessageFollowupHistoryEntry {
  userId: string;
  reaction: string;
  at: string;
}

export type MessageModerationStatus = "deleted" | "moderated";

export interface MessageModeration {
  status: MessageModerationStatus;
  by: string;
  at: string;
}

export interface MessageEditVersion {
  content: string;
  editedBy: string;
  editedAt: string;
}

export interface MessagePerformanceCache extends Message {
  // ----
  // only on frontend
  //
  lastSync?: string; // compact UTC format `yyyyMMddHHmmss`
  status?: 'read' | 'unread' | 'edited';
  footers: {
    title?: string;
    lines: string[];
    icon?: string; // icon to show in footer, ex: "fa fa-check"
    color?: string; // color of the footer, ex: "#00ff00"
    backgroundColor?: string; // background color of the footer, ex: "#000000"
    timestamp?: string;
  }[];
}

export interface ProviderConfig {
  provider: string;
  alternateProvider: string; // alternative provider to use if this is not available
  model: string;
  json: boolean; // accept json as output
  onlyImage?: boolean; // true if this model only generate images
  inputValue: number; // value for 1M tokens
  outputValue: number; // value for 1M tokens
  extrabody?: Record<string, string>;
}

export interface Providers {
  [provider: string]: Record<string, ProviderConfig>;
}

export type TaskOperationType = "create" | "read" | "update" | "delete" | "query";

export interface TaskOperation {
  operation: TaskOperationType;
  taskId?: string;
  data?: Partial<TaskData>;
  filters?: Record<string, any>;
  message?: string | null; // clarification message
}

export interface TaskData {
  PK: string; // Primary key, format: `task/#{taskId}`
  SK: 'metadata'; // Sort key of the composite primary key (legacy: “range key")
  title: string;
  owner: string; // who created this task, userId
  team: 'unassigned' | string | null; // team assigned to this task
  assignees?: string[]; // userIds assigned to this task
  dueDate?: string; // ISO date YYYY-MM-DD, managed by /setDueDate
  status: TaskStatus;
  last_updated: 0 | number; // Date.now()
  last_update_log: string | null; // description of last update
  source?: string; // source of the task, ex: "user", "system", "api", default is "user"
  url?: string; // ? not used ever
  description?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  effort?: number; // estimated effort in hours
  cost?: number;
  iaCompressed?: IACompressed; // steps , prompts
  tags?: string[];
  attachmentsUrl?: string[]; // urls of attachments related to this task
  messageid_created?: string; // thread id and message id from origin this task. ex: 20250521144240.1000/20250706203939.1000
  messageid_refs?: string[]; // messages id referenced in this task
  taskRoom?: {
    enabled: boolean;
    threadId?: string;
    workflowType?: WorkflowType;
    parentThreadId?: string;
    memoryRef?: string;
    status?: 'active' | 'archived' | 'deleted';
    pmaId?: string;
    pmaStatus?: "active" | "paused" | "disabled";
    pmaConfigRef?: string;
    lastDecisionLogRef?: string;
  };
}

export type TaskStatus = 'todo' | 'in progress' | 'paused' | 'done' | 'failed';
export type WorkflowType = 'staticWorkflow' | 'dynamicWorkflow';

export interface TaskDataToSave extends Omit<TaskData, 'iaCompressed'> {
  iaCompressed?: string;
}

//
// ====================
// AI TASKS
// ====================


export interface IACompressed {
  // this object can be compressed to a string for saving in DB
  nextSteps: AIPayload[];
  longMemory: Record<string, string>; // long term memory
  isTest?: boolean; // true if this is a test execution
  queueBackEnd: AgentIntent[]; // queue to be processed in backend
  queueFrontEnd: AgentHooks[]; // queue to be processed in frontend
}

export interface AIInteraction {
  input: IAMessageInputType[];
  tools?: LLMTool[];
  toolChoice?: LLMToolChoice;
  cost: number; // cost in this interaction , with no deep cost
  trace: string[]; // optional trace of the steps
  payload: AIPayload[] | null; // Tree of steps or null for not processed
}

export interface LLMTool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

export type LLMToolChoice =
  'auto' |
  'none' |
  'required' |
  {
    type: 'function';
    function: {
      name: string;
    };
  };

export interface IAMessageInputType {
  type: 'system' | 'human' | 'ai';
  content: string;
}

export type AIStepStatus =
  'waiting_dependency' | // not ready yet
  'waiting_human_input' | // for parallel steps waiting for human input
  'waiting_after_prompt' | // for parallel steps waiting for afterPrompt processing
  'waiting_after_prompt_with_error' | // for parallel steps waiting for afterPrompt processing
  'pending' | // already created, waiting to be processed
  'in_progress' | // being processed in LLM
  'completed' | // completed successfully
  'failed'; // failed execution

export interface AIStepProgress {
  total: number;
  completed: number;
  failed: number;
  templateTitle: string; // ex: "preparing file {{completed}} of {{total}}, errors: {{failed}}"
}

export type AIStepPlanningExecutionMode =
  'sequential' |
  'parallel_static' |
  'parallel_dynamic' |
  'manual_later';

export interface AIStepPlanningDynamicSource {
  sourcePlanId?: string;
  selectorField?: string;
  argsField?: string;
}

export interface AIStepPlanning {
  planId: string;
  dependsOn: string[];
  executionMode: AIStepPlanningExecutionMode;
  executionHost?: 'client' | 'server' | 'either';
  dynamicSource?: AIStepPlanningDynamicSource;
}

export interface AIStep {
  type: AIPayload['type'];
  stepId: number; // unique id , from first interaction
  status: AIStepStatus;
  stepTitle?: string;
  progress?: AIStepProgress;
  planning?: AIStepPlanning;
  // If null => interaction not prepared yet
  // If undefined => no LLM interaction needed for this step (e.g., tool call)
  // If defined => contains prompt/response used in this step
  interaction: AIInteraction | null | undefined;
  nextSteps: AIPayload[] | null; // Tree of steps or null for not processed or [] if no next steps
}

export type AIPayload = AIAgentStep | AIToolStep | AIClarificationStep | AIResultStep | AIFlexibleResultStep;

export interface AIWorkflowStep {
  type: WorkflowType;
  stepId: number;
  status: AIStepStatus;
  stepTitle?: string;
  progress?: AIStepProgress;
  planning?: AIStepPlanning;
  interaction: AIInteraction | null | undefined;
  nextSteps: AIPayload[] | null;
  workflowName?: string;
}

export interface AIAgentStep extends AIStep {
  type: 'agent';
  agentName: string;
  prompt?: string;
  rags: string[] | null; // name of files RAG to search
  onFailure?: 'fail' // default
  | 'continue' // continue workflow even if this step fail, use with caution, mark this step status = 'failed', don't mark parent step as failed.
  | 'wait_after_prompt' // afterPromptStep will be triggered with stepStatus = "waiting_after_prompt_with_error"
  | 'skip'; // skip this step and continue workflow as if it was completed successfully, mark this step status = 'completed'
}

export interface AIToolStep extends AIStep {
  type: 'tool';
  toolName: string;
  args: string; // JSON stringified
}

export interface AIClarificationStep extends AIStep {
  type: 'clarification';
  json?: string;
}

export interface AIResultStep extends AIStep {
  type: 'result';
  result: string;
}

export interface AIFlexibleResultStep extends AIStep {
  type: 'flexible';
  result: any; // Flexible JSON result, parsed and handled by afterPrompt function
}

export interface ExecutionContext {
  message: Message;
  task: TaskData | undefined; // use undefined for start new task
  isTest: boolean; // true if this is a test execution
}

// ===================
// AGENT INTENTS
// commands from frontend to backend
// ===================

export type AgentIntentUpdateStatus = {
  type: 'update-status';
  messageId: string;
  threadId: string;
  taskId: string;
  hookSequential: number;
  parentStepId: number;
  stepId: number;
  status: AIStepStatus;
  traceMsg?: string;
  cleaner?: 'input' | 'input_output'; // how to clean previous interactions in this step
}

export type AgentIntentAddStep = {
  type: 'add-step';
  messageId: string;
  threadId: string;
  taskId: string;
  parentStepId: number;
  step: AIPayload;
  stepTitle?: string;
  executionMode?: ExecutionMode;
}

export type AgentIntentPauseOrContinue = {
  type: 'pause-or-continue';
  messageId: string;
  threadId: string;
  taskId: string;
  reason: string
}

export type AgentIntentAddMessageAI = {
  type: 'add-message-ai';
  stepTitle?: string;
  request: Omit<RequestAddMessageAI, 'userId'>;
  executionMode?: ExecutionMode;
  skipRootLLM?: boolean;
}

export type ExecutionMode = {
  type: 'parallel';
  args: string[];
  maxParallel?: number; // max parallel items to process, default = 5
};

/**
 * Parallel steps execution mechanism.
 * Child steps inherit the system prompt from their parent step.
 * Human prompts are prepared client-side using compact args (via beforePrompt hook).
 * Keep args short, unique, and deterministic.
 *
 * Parallel execution flow:
 *
 * 1. Frontend requests creation of a parent step (via API) with system prompt only
 *    and one or more AgentIntentParallelSteps.
 *
 * 1.1 Frontend enforces max parallel items per request.
 *     Use pagination (offset/limit or batch markers) in args when more items exist.
 *
 * 2. Backend:
 *    - Creates parent step with status "in_progress"
 *    - Enqueues AgentIntentParallelSteps in queueBackEnd
 *    - Immediately creates a batch of "waiting_human_input" child steps (no human prompt yet)
 *
 * 2.1 Parent remains "in_progress" until all children reach terminal state ("completed" or "failed").
 *
 * 2.2 Child steps are pre-allocated and reused as prompts arrive.
 *
 * 3. Backend enqueues multiple AgentHookBeforePrompt (one per waiting_human_input child) for frontend.
 *
 * 4. Frontend prepares human prompts and returns AgentIntentContinueParallelStep items.
 *
 * 5. Backend:
 *    - Updates child steps with received human prompts
 *    - Applies strong deduplication (ignore duplicates by parentStepId + args)
 *    - Cleans queueBackEnd and queueFrontEnd
 *
 * 6. Backend executes child steps as they become ready.
 *
 * 6.1 After each child execution, backend sends feedback AgentHook to frontend
 *     (success or error). Frontend then requests child status update to "completed" or "failed".
 *
 * 7. When ALL children are in terminal state, backend finalizes the parent step.
 *
 * 7.1 Finished child steps are deleted to reduce task object size.
 *
 * Critical implementation notes:
 * - Uniqueness key: parentStepId + args (must be collision-resistant)
 * - Step 5 MUST implement strict idempotency and duplicate rejection
 * - Error handling, child retries, and stuck-state timeouts are responsibility of other system layers
 */
export type AgentIntentParallelSteps = {
  type: 'parallel-steps';
  parentStepId: number; // parentStepId + args must be unique to identify this parallel execution
  args: string;         // compact args to identify unique step arguments
};

export type AgentIntentPromptReady = {
  type: 'prompt_ready';
  messageId: string;
  threadId: string;
  taskId: string;
  hookSequential: number; // unique sequential id of the corresponding AgentHookBeforePrompt
  parentStepId: number;
  args: string;           // original args (for validation/deduplication)
  humanPrompt: string;    // prepared human prompt ready for execution
  systemPrompt?: string;  // optional updated system prompt for this step
  tools?: LLMTool[];
  toolChoice?: LLMToolChoice;
};

export type AgentIntentRemoveHook = {
  type: 'remove-hook';
  messageId: string;
  threadId: string;
  taskId: string;
  hookSequential: number;
};

export type AgentIntent = AgentIntentAddStep | AgentIntentPauseOrContinue | AgentIntentUpdateStatus | AgentIntentParallelSteps | AgentIntentPromptReady | AgentIntentAddMessageAI | AgentIntentRemoveHook;

// ===================
// AGENT HOOKS
// functions to be executed in frontend
// ===================

export type AgentHookBase = {
  hookSequential: number; // unique sequential id to order hooks
  stepId: number,
}

export type AgentHookBeforePromptStep = AgentHookBase & {
  type: 'beforePromptStep', // prepare new prompt after agent or tool step or parallel step
  parentStepId: number,
  args: string,
}

export type AgentHookBeforeTool = AgentHookBase & {
  type: 'beforeTool', // prepare new prompt after agent or tool step or parallel step
  parentStepId: number,
  args: string,
}

export type AgentHookAfterPromptStep = AgentHookBase & {
  type: 'afterPromptStep' // after human prompt step is added
  parentStepId: number,
}

export type AgentHookPooling = AgentHookBase & {
  type: 'pooling' // pooling to check for updates
  executionCount: number; // number of times this pooling has been executed
  afterMs: number; // milliseconds to wait before next pooling
}

export type AgentHooks = AgentHookBeforePromptStep | AgentHookAfterPromptStep | AgentHookPooling | AgentHookBeforeTool;

}