declare module "@waves/waves-repl" {
    import * as React from "react";

    export type ReplProps = {
        theme: string;
        readOnly?: boolean;
        className?: string;
        style?: Record<string, React.CSSProperties>;
        env?: Record<string, unknown>;
        withoutWelcome?: boolean;
    };

    export class Repl extends React.Component<ReplProps> {
        updateEnv(env: unknown): void;
    }
}
