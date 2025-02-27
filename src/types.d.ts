import { TSConfig } from 'pkg-types'

export interface ConfigurationProperty {
    title?: string;
    description?: string;
    tags?: string[];
    tsType?: string;
    markdownType?: string;
    id?: string;
    properties?: { [key: string]: ConfigurationProperty };
    default?: any;
    type: string;
}

export interface NuxtrConfiguration {
    openItemsAfterCreation: boolean;
    defaultPackageManager: "null" | "Yarn" | "NPM" | "pnpm" | "Bun";
    monorepoMode: {
        DirectoryName: string | null;
    };
    vueFiles: {
        template: {
            defaultLanguage: "html" | "pug";
        }
        firstTag: "template" | "script";
        script: {
            type: "setup" | "normal";
            defaultLanguage: "js" | "ts";
        };
        style: {
            addStyleTag: boolean;
            alwaysScoped: boolean;
            defaultLanguage:
            | "css"
            | "scss"
            | "sass"
            | "less"
            | "stylus"
            | "postcss";
        };
        pages: {
            defaultTemplate: string;
        };
        layouts: {
            defaultTemplate: string;
        };
    };
    intellisense: {
        vueFiles: boolean;
        nuxtignore: boolean;
        nuxtrc: boolean;
    };
    snippets: {
        nuxt: boolean;
        nitro: boolean;
    }
}

interface TSConfigNuxt extends TSConfig {
    vueCompilerOptions?: {
        plugins?: string[] | undefined;
    }
}

type nuxtModule = {
    name: string;
    description: string;
    repo: string;
    npm: string;
    github: string;
    category: string;
    type: string;
    compatibility: {
        nuxt: string;
        requires: Record<string, any>;
    };
    tags: string[];
};