import {SSTConfig} from "sst";
import {DdbApi, DdbTrigger} from "./stacks/Ddb";

export default {
    config(_input) {
        return {
            name: "eda-latency",
            region: "us-west-2",
        };
    },
    stacks(app) {
        app.setDefaultRemovalPolicy("destroy");
        app.stack(DdbApi)
            .stack(DdbTrigger)
    },
} satisfies SSTConfig;
