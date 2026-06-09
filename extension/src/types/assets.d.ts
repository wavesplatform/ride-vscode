declare module "*.css";
declare module "*.svg";

declare module "long" {
    class Long {}
    export = Long;
}

type Long = import("long");
